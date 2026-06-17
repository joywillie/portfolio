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

// Neon PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/**
 * 🔒 GATEWAY MIDDLEWARE
 * Intercepts requests. If a user has no valid token cookie, 
 * they are forced back to the sign-in screen instantly.
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

// --- AUTHENTICATION ROUTES (OPEN TO EVERYONE) ---

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

// API: Handle Registration
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

// API: Handle Login
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

    // Generate secure token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    // Set secure HTTP-Only cookie browser-side
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true if deployed live on Render
      maxAge: 24 * 60 * 60 * 1000 // 24 Hours
    });

    return res.status(200).json({ success: true, message: "Login successful!" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error during login authentication." });
  }
});

// API: Handle Logout
app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/signin');
});

// --- PROTECTED PORTFOLIO ROUTES (REQUIRES AUTH MIDDLEWARE) ---

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

// Serve assets like pictures or custom styling cleanly to verified viewers
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`🚀 Gateway Server running seamlessly on port ${PORT}`);
});
