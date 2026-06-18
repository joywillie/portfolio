const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_key_2026';

// 🗄️ Neon PostgreSQL Database Pool Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

// 🛠️ Core Middleware Registry
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
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

/**
 * 🔀 SMART FILE HELPER
 * Ensures your files load perfectly whether they use standard names 
 * or duplicate variations (like 'signin (1).html') without throwing errors.
 */
const sendSmartFile = (res, primaryName, fallbackName) => {
  const primaryPath = path.join(__dirname, primaryName);
  if (fs.existsSync(primaryPath)) {
    return res.sendFile(primaryPath);
  } else {
    return res.sendFile(path.join(__dirname, fallbackName));
  }
};

// --- AUTOMATED AUTHENTICATION ROUTING BLOCKS ---

// Serve Sign In page layout (Handles both clean /signin and /signin.html from your website links)
app.get(['/signin', '/signin.html'], (req, res) => {
  sendSmartFile(res, 'signin.html', 'signin (1).html');
});

// Serve Sign Up page layout (Handles both clean /signup and /signup.html from your website links)
app.get(['/signup', '/signup.html'], (req, res) => {
  sendSmartFile(res, 'signup.html', 'signup (1).html');
});

// Fallback Route Handler for Forgot Password (Handles both clean /forgot-password and /forgot-password.html)
app.get(['/forgot-password', '/forgot-password.html'], (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 60px; background-color: #0f172a; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 0;">
      <div style="background-color: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); max-width: 450px;">
        <h2 style="color: #38bdf8; margin-bottom: 20px;">Password Recovery</h2>
        <p style="color: #94a3b8; line-height: 1.6;">The automated password reset system is currently undergoing scheduled maintenance.</p>
        <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 30px;">Please contact your systems administrator or create a new account to log in.</p>
        <a href="/signin" style="background-color: #38bdf8; color: #0f172a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">&larr; Back to Sign In</a>
      </div>
    </div>
  `);
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
    
    // Redirect cleanly to login portal after successful database registration
    return res.redirect('/signin');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Database creation loop failed.');
  }
});

// API: Handle User Login & Automatic Website Presentation
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
    
    // 🚀 AFTER SIGNIN: Forces your browser window straight onto your website layout!
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
  sendSmartFile(res, 'index.html', 'index (1).html');
});

app.get('/about', requireAuth, (req, res) => {
  sendSmartFile(res, 'about.html', 'about (1).html');
});

app.get('/skills', requireAuth, (req, res) => {
  sendSmartFile(res, 'skills.html', 'skills (1).html');
});

app.get('/projects', requireAuth, (req, res) => {
  sendSmartFile(res, 'projects.html', 'projects (1).html');
});

app.get('/contact', requireAuth, (req, res) => {
  sendSmartFile(res, 'contact (1).html', 'contact.html');
});

// Serve static elements fallback directly out of the repository root folder configuration
app.use(express.static(__dirname));

// Initialize Active Server Listener Engine
app.listen(PORT, () => console.log(`🚀 Secure Gateway serving files cleanly on port ${PORT}`));
