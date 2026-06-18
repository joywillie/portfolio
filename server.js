const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_key_2026';

// 🗄️ Neon PostgreSQL Database Pool Connection with Optimized SSL Handshake
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

// 🛠️ Core Middleware Registry
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Crucial for reading raw HTML form text fields
app.use(cookieParser());

/**
 * 🔒 MIDDLEWARE SECURITY GATEWAY
 * Intercepts unauthenticated navigation traffic.
 * If a visitor has no valid auth token cookie, they are forced to Sign In instantly.
 */
const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.redirect('/signin');
  }
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.redirect('/signin');
  }
};

// --- OPEN ENTRANCE AUTHENTICATION ROUTING BLOCKS ---

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'signin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

// API: Handle New User Registration
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).send('Missing required fields. <a href="/signup">Try again</a>');
    }

    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).send('Email already exists. <a href="/signup">Try again</a>');
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)', [fullName, email.toLowerCase().trim(), hashed]);
    
    // Smooth backend redirect straight to your sign-in portal after registration
    return res.redirect('/signin');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Database creation loop failed.');
  }
});

// API: Handle User Login & Automatic Dashboard Redirection
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('Please enter both email and password. <a href="/signin">Go back</a>');
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).send('Invalid email or password parameters. <a href="/signin">Go back</a>');
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).send('Invalid email or password parameters. <a href="/signin">Go back</a>');
    }
    
    // Generate secure session token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    // Set cookie validation header explicitly inside the browser
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // 🚀 THE REDIRECT FIX: Forces your browser window directly onto your real index.html file!
    return res.redirect('/');

  } catch (err) {
    console.error(err);
    return res.status(500).send('Gateway login internal failure.');
  }
});

// Session Termination / Logout Route
app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/signin');
});

// --- DUAL DATA STREAM PIPELINE (NEON + FORMSPREE) ---
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    await fetch("https://formspree.io/f/xjgledbb", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ name, email, message })
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

// --- PROTECTED VIEWS (LOADS ORIGINAL UNTOUCHED LAYOUTS FROM YOUR ROOT BRANCH) ---
app.get('/', requireAuth, (req, res) => {
  // Corrected to use your exact file name
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/skills', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'skills.html'));
});

app.get('/projects', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'projects.html'));
});

app.get('/contact', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'contact (1).html'));
});

// Serve static elements fallback directly out of the repository root folder configuration
app.use(express.static(__dirname));

// Initialize Active Server Listener Engine
app.listen(PORT, () => console.log(`🚀 Secure Gateway serving files cleanly on port ${PORT}`));
