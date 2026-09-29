// TODO: create the Express app, mount routes, start listening.
// Hint: the Stripe webhook needs the RAW body. Think about mounting order.
// src/server.js
require('dotenv').config();
const express = require('express');
const config = require('./config');

const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errors');

const generateRoutes = require('./routes/generate');
const usageRoutes = require('./routes/usage');
const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhooks');

const app = express();

// 1. Stripe webhook route FIRST, with RAW body — must come before express.json()
//    Stripe signature verification needs the exact raw bytes, not a parsed object.
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

// 2. Now safe to parse JSON for every other route
app.use(express.json());

// 3. Tenant-authenticated routes
app.use('/generate', auth, generateRoutes);
app.use('/usage', auth, usageRoutes);

// 4. Checkout doesn't strictly need tenant auth for this capstone's scope —
//    document that choice in README if you leave it open, or add `auth` if you