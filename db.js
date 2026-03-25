const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect('YOUR_CONNECTION_STRING_HERE');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Stop the app if connection fails
  }
};

connectDB();