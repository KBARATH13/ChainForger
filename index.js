require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

// Route modules
const authRoutes = require('./src/routes/authRoutes');
const networkRoutes = require('./src/routes/networkRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const rpcRoutes = require('./src/routes/rpcRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Database Connection
connectDB();

// Global Middleware & CORS Bridge
app.use(cors());
app.use(express.json());

// Public Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ChainForger BaaS Backend Control Plane',
    timestamp: new Date().toISOString()
  });
});

// Mount Route Modules
app.use('/api/auth', authRoutes);
app.use('/api/networks', networkRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/rpc', rpcRoutes);

// Start Gateway Listener
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ChainForger Control Plane] Gateway online at http://0.0.0.0:${PORT} (http://localhost:${PORT})`);
});

module.exports = app;
