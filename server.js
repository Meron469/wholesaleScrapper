// This file is the main entry point for Render.com deployment
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Set NODE_ENV for deployment
process.env.NODE_ENV = 'production';

// Middleware for production API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers for API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    note: 'Please try again later or contact support.'
  });
});

// Health check endpoint for Render.com
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the scraper API - this will set up all routes
console.log('Starting Zillow FSBO Scraper via server.js entry point...');
// We don't mount the scraper routes directly since scraper.js creates its own server
require('./scraper.js');

// Start server if not already started by scraper.js
if (!module.parent) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Zillow FSBO scraper API running on port ${port}`);
  });
}

module.exports = app;