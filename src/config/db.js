const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chainforger';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.warn(`[Database Warning] MongoDB connection failed (${err.message}).`);
    console.warn(`[Database Warning] Running in offline/fallback mode. Ensure MongoDB is running on ${uri} for persistence.`);
    return null;
  }
};

module.exports = connectDB;

