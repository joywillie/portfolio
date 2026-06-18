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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());

const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.redirect('/login');
  }
};

// 🌐 Updated Cache-Busting Routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'signin.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) return res.status(400).send('Email already exists. <a href="/login">Login Instead</a>');

    const hashed = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)', [fullName || 'User', email.toLowerCase().trim(), hashed]);
    return res.redirect('/login');
  } catch (err) {
    res.status(500).send('Registration failed.');
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
      return res.status(400).send('Invalid credentials. <a href="/login">Try again</a>');
    }

    const token = jwt.sign({ userId: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
    return res.redirect('/');
  } catch (err) {
    res.status(500).send('Login failed.');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    try {
      await fetch("https://formspree.io/f/xjgledbb", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ name, email, message })
      });
    } catch (fErr) {}
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false });
  }
});

app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.use(express.static(__dirname));
app.listen(PORT, () => console.log(`🚀 Portal active on port ${PORT}`));
