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

// 🗄️ Neon PostgreSQL Database Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// 🛠️ Core Middleware Registry
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());

/**
 * 🔒 MIDDLEWARE SECURITY GATEWAY
 * Protects your portfolio pages. If a user isn't logged in, it answers 
 * background JavaScript calls smoothly or redirects them to sign in.
 */
const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/signin');
  }
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    return res.redirect('/signin');
  }
};

/**
 * 🔀 SMART FILE HELPER
 * Delivers files seamlessly behind the scenes, scanning for duplicate folder names.
 */
const sendSmartFile = (res, primaryName, fallbackName) => {
  const primaryPath = path.join(__dirname, primaryName);
  if (fs.existsSync(primaryPath)) {
    return res.sendFile(primaryPath);
  } else {
    return res.sendFile(path.join(__dirname, fallbackName));
  }
};

// --- 🌐 GET ALIASES: SERVING ALL RAW HTML FILE VARIATIONS ---

app.get(['/signin', '/signin.html', '/signin%20(1).html', '/signin (1).html'], (req, res) => {
  sendSmartFile(res, 'signin.html', 'signin (1).html');
});

app.get(['/signup', '/signup.html', '/signup%20(1).html', '/signup (1).html'], (req, res) => {
  sendSmartFile(res, 'signup.html', 'signup (1).html');
});

app.get(['/forgot-password', '/forgot-password.html', '/forgot-password%20(1).html', '/forgot-password (1).html'], (req, res) => {
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

// --- ⚙️ TWISTED POST INTERCEPTORS: DYNAMICALLY RESPONDING IN BOTH JSON & REDIRECTS ---

// SIGN UP PROCESSOR
app.post(['/api/auth/signup', '/signup', '/signup.html', '/api/signup', '/register'], async (req, res) => {
  try {
    const email = req.body.email || req.body.Email || req.body.user_email;
    const password = req.body.password || req.body.Password || req.body.user_password;
    const name = req.body.fullName || req.body.name || 'New User';

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Missing email or password.' });
    }

    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)', [name, email.toLowerCase().trim(), hashed]);
    
    // Twist: Returns success JSON so your custom script transitions smoothly
    return res.status(200).json({ success: true, redirect: '/signin' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Database failure.' });
  }
});

// SIGN IN PROCESSOR (FIXES THE CONNECTION ERROR!)
app.post(['/api/auth/signin', '/signin', '/signin.html', '/api/signin', '/login'], async (req, res) => {
  try {
    const email = req.body.email || req.body.Email || req.body.user_email;
    const password = req.body.password || req.body.Password || req.body.user_password;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Fields are mandatory.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // Twist: Send exact positive validation object back to the AJAX handler
    return res.status(200).json({ success: true, redirect: '/' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server gateway error.' });
  }
});

// Session Logout Route
app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/signin');
});

// --- 📨 DUAL DATA STREAM PIPELINE (NEON + FORMSPREE) ---
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

// --- 🔒 PROTECTED WEBSITE PAGES ---
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

// Serve assets like CSS, Images, JS directly from root directory securely
app.use(express.static(__dirname));

// Initialize Listening Server Container Port
app.listen(PORT, () => console.log(`🚀 System fully synchronized on port ${PORT}`));
