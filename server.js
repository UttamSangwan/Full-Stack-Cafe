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
    img: String,
    inStock: { type: Boolean, default: true }
}), 'menuitems');

// --- 3. MIDDLEWARE & SECURITY ---
app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const isAuthenticated = (req, res, next) => {
    const user = req.query.user || req.body.user;
    if (user && user !== 'null' && user !== 'undefined') return next();
    res.redirect('/login');
};

// --- 4. ROUTES ---
app.get('/login', (req, res) => res.render('login', { error: null }));

/**
 * UPDATED LOGIN ROUTE FOR FETCH
 * Returns JSON instead of Redirecting/Rendering
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, password });
        if (user) {
            const redirectUrl = user.role === 'admin' ? '/admin' : '/dashboard';
            // Send JSON response with the redirect path and username
            res.status(200).json({ 
                success: true, 
                redirect: `${redirectUrl}?user=${encodeURIComponent(user.username)}` 
            });
        } else {
            // Send 401 Unauthorized with error message
            res.status(401).json({ success: false, message: "Invalid username or password" });
        }
    } catch (err) { 
        res.status(500).json({ success: false, message: "Server login error" }); 
    }
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

app.get('/order-history', isAuthenticated, async (req, res) => {
    try {
        const username = req.query.user;
        const orders = await Order.find({ user: username }).sort({ createdAt: -1 });
        res.render('order-history', { user: username, orders: orders });
    } catch (err) {
        res.status(500).send("Error loading history");
    }
});

app.post('/place-order', async (req, res) => {
    try {
        let { user, items, total } = req.body;
        const newOrder = new Order({ 
            user, 
            items: Array.isArray(items) ? items : [], 
            total: parseFloat(total) || 0, 
            status: 'Pending' 
        });
        await newOrder.save();
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ success: false }); 
    }
});

// --- ADMIN ROUTES ---

app.get('/admin', isAuthenticated, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        const menu = await MenuItem.find();
        res.render('admin', { orders, menu, user: req.query.user });
    } catch (err) { res.status(500).send("Admin Panel Error"); }
});

app.post('/admin/toggle-stock/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);
        item.inStock = !item.inStock;
        await item.save();
        res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
    } catch (err) { res.status(500).send("Toggle Error"); }
});

app.get('/admin/edit-menu/:id', isAuthenticated, async (req, res) => {
    try {
        const item = await MenuItem.findById(req.params.id);
        res.render('edit-menu', { item, user: req.query.user });
    } catch (err) { res.status(500).send("Item Not Found"); }
});

app.post('/admin/update-menu/:id', isAuthenticated, async (req, res) => {
    try {
        const { name, price, category, img } = req.body;
        await MenuItem.findByIdAndUpdate(req.params.id, {
            name,
            price: parseFloat(price),
            category,
            img
        });
        res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
    } catch (err) { res.status(500).send("Update Error"); }
});

app.post('/admin/order/update-status/:id', isAuthenticated, async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
        res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
    } catch (err) { res.status(500).send("Error updating status"); }
});

app.post('/admin/add-menu', isAuthenticated, async (req, res) => {
    try {
        const { name, price, category, img } = req.body;
        await new MenuItem({ 
            name, 
            price: parseFloat(price) || 0, 
            category, 
            img,
            inStock: true 
        }).save();
        res.redirect(`/admin?user=${encodeURIComponent(req.query.user)}`);
    } catch (err) { res.status(500).send("Add Item Error"); }
});

app.get('/order-summary', isAuthenticated, (req, res) => {
    res.render('checkout', { user: req.query.user });
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));