require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const morgan = require('morgan');
const app = express();
const PORT = 3000;

// --- 1. MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// --- 2. DATABASE MODELS ---
const User = mongoose.model('Users', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }
}), 'users');

const Order = mongoose.model('Order', new mongoose.Schema({
    user: String,
    items: Array, 
    total: Number,
    status: { type: String, default: 'Pending' },
    createdAt: { type: Date, default: Date.now }
}), 'orders');

const MenuItem = mongoose.model('MenuItem', new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    img: String
}), 'menuitems');

// --- 3. MIDDLEWARE & SECURITY ---
app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));


const isAuthenticated = (req, res, next) => {
    const user = req.query.user || req.body.user;
    if (user && user !== 'null') return next();
    res.redirect('/login');
};

// --- 4. ROUTES ---

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, password });
        if (user) {
            const path = user.role === 'admin' ? '/admin' : '/dashboard';
            // Encode the username to handle spaces/special characters in URLs
            res.redirect(`${path}?user=${encodeURIComponent(user.username)}`);
        } else {
            res.render('login', { error: "Invalid credentials" });
        }
    } catch (err) { res.status(500).send("Login Error"); }
});

app.get('/dashboard', async (req, res) => {
    try {
        const menuItems = await MenuItem.find({});
        const categories = [...new Set(menuItems.map(item => item.category))].map(cat => ({
            name: cat,
            items: menuItems.filter(i => i.category === cat)
        }));
        res.render('userdashboard', { categories, user: req.query.user || null });
    } catch (err) { res.status(500).send("Dashboard Error"); }
});

app.post('/place-order', async (req, res) => {
    try {
        let { user, items, total } = req.body;
        // Ensure items is treated as an array
        const itemsArray = Array.isArray(items) ? items : (typeof items === 'string' ? items.split(', ') : []);

        const newOrder = new Order({ 
            user, 
            items: itemsArray, 
            total: parseFloat(total), 
            status: 'Pending' 
        });
        
        await newOrder.save();
        res.json({ success: true });
    } catch (err) { 
        console.error("Order Placement Error:", err);
        res.status(500).json({ success: false, message: "Server error" }); 
    }
});

app.get('/admin', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        const menu = await MenuItem.find();
        res.render('admin', { orders, menu, user: req.query.user });
    } catch (err) { res.status(500).send("Admin Panel Error"); }
});

// Update this route in server.js
app.post('/admin/order/update-status/:id', isAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        // Update the order status in MongoDB
        await Order.findByIdAndUpdate(req.params.id, { status: status });
        
        console.log(`✅ Order ${req.params.id} updated to: ${status}`);
        res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
    } catch (err) {
        console.error("Status Update Error:", err);
        res.status(500).send("Error updating status");
    }
});
app.get('/order-summary', (req, res) => {
    const username = req.query.user;
    if (!username || username === 'null') {
        return res.redirect('/login');
    }
    res.render('checkout', { user: username });
});

app.post('/admin/add-menu', isAuthenticated, async (req, res) => {
    const { name, price, category, img } = req.body;
    await new MenuItem({ name, price: parseFloat(price), category, img }).save();
    res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
});

// --- FIXED API ROUTE ---
app.get('/api/order-history', async (req, res) => {
    try {
        const user = req.query.user;
        if (!user || user === 'undefined' || user === 'null') {
            return res.status(400).json({ error: "Valid User required" });
        }
        
        // Find orders matching the username string
        const history = await Order.find({ user: user }).sort({ createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error("API Error:", err); // This helps you see the actual error in the terminal
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));