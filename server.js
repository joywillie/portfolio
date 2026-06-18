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

// Neon PostgreSQL Database Pool Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Parsers Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/**
 * 🔒 GATEWAY INTERCEPTOR
 * Verifies if user holds an active cookie session token.
 * If token is absent or corrupted, pushes traffic straight to /signin.
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

// --- OPEN ENTRANCE AUTHENTICATION PAGES ---
app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'signin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

// --- API AUTH LOGIC CONTROLLER LOOP ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }
    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists." });
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)', [fullName, email.toLowerCase().trim(), hashed]);
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Database creation loop failed." });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid email or password parameters." });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: "Invalid email or password parameters." });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gateway login internal failure." });
  }
});

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

// --- PROTECTED VIEWS (LOOKS DIRECTLY IN ROOT FOR YOUR UNTOUCHED portfolio FILES) ---
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index (1).html'));
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

// Serve static assets directly from the root repository folder
app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`🚀 Secure Gateway serving files cleanly on port ${PORT}`));
