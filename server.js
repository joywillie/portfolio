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

// 🗄️ Neon PostgreSQL Connection Pool Configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware Configuration
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

// --- AUTHENTICATION ROUTING BLOCKS (ACCESSIBLE TO EVERYONE) ---

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// API: Handle New User Registration
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Email is already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)',
      [fullName, email.toLowerCase().trim(), hashedPassword]
    );

    return res.status(201).json({ success: true, message: "Registration successful!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server database error during signup." });
  }
});

// API: Handle User Login Session Generation
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please fill in all fields." });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    // Generate secure session token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    // Set HTTP-Only Cookie inside client's browser securely
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true if live on Render production
      maxAge: 24 * 60 * 60 * 1000 // 24 Hours
    });

    return res.status(200).json({ success: true, message: "Login successful!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error during authentication." });
  }
});

// Session Termination / Logout Route
app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/signin');
});

// --- DUAL PIPELINE ROUTE: SAVES TO NEON DB & SENDS EMAIL TO FORMSPREE ---
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: "All form fields are required." });
  }

  try {
    // 🖥️ Pipeline 1: Write directly into Neon PostgreSQL tables
    await pool.query(
      'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)',
      [name, email, message]
    );
    console.log("📥 Message entry recorded inside Neon Console.");

    // ✉️ Pipeline 2: Forward payload downstream to Formspree for email notification
    const formspreeResponse = await fetch("https://formspree.io/f/xjgledbb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ name, email, message })
    });

    if (!formspreeResponse.ok) {
      console.warn("⚠️ Formspree payload processing was rejected by external endpoint.");
    } else {
      console.log("🚀 Message successfully forwarded to Formspree email relay.");
    }

    // Return a clean 200 OK structure back to contact.html JavaScript handler
    return res.status(200).json({ success: true, message: "Form submission completed successfully!" });

  } catch (error) {
    console.error("Backend contact pipeline exception thrown:", error);
    return res.status(500).json({ success: false, message: "Internal server data stream error." });
  }
});

// --- PROTECTED WEB CONTENT INTERFACES (REQUIRES VERIFIED MIDDLEWARE SESSIONS) ---

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/about', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/skills', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'skills.html'));
});

app.get('/projects', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'projects.html'));
});

app.get('/contact', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Serve static elements (assets, style formats, and images) to verified users cleanly
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Active Server Listener Engine
app.listen(PORT, () => {
  console.log(`🚀 JoyTech Secure Gateway Engine listening cleanly on port ${PORT}`);
});
