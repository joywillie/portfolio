const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_key_2026';

// MIDDLEWARE ARCHITECTURE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// NEON POSTGRESQL POOL CONFIGURATION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// CORE PAGE NAVIGATION ROUTES
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

// AUTHENTICATION INTERFACE ROUTES
app.get('/signin', (req, res) => res.sendFile(path.join(__dirname, 'signin.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'forgot-password.html')));

/* ==========================================================================
   AUTHENTICATION LOGIC ROUTING ENGINES
   ========================================================================== */

// 1. SIGNUP CONTROLLER (Registration)
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All parameters required.' });
  }

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      [name, email, hashedPassword]
    );

    return res.status(201).json({ success: true, message: 'Account created successfully!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error context during registration.' });
  }
});

// 2. SIGNIN CONTROLLER (Login)
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid user credentials.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid user credentials.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    return res.status(200).json({ success: true, token, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database session runtime failure.' });
  }
});

// 3. FORGOT PASSWORD CONTROLLER (Reset Pin Generator)
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address required.' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No account associated with this email.' });
    }

    // Generate secure 6-digit PIN token valid for 1 hour
    const resetPin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 3600000); 

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetPin, expiryTime, email]
    );

    // View your Render Dashboard server logs to read this output PIN!
    console.log(`\n🔑 [PASSWORD RESET SYSTEM PIN] -> User: ${email} | PIN: ${resetPin}\n`);

    return res.status(200).json({ success: true, message: 'Reset token PIN generated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Recovery transactional runtime processing error.' });
  }
});

// 4. HYBRID CONTACT FORM ROUTE
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query('INSERT INTO contact_messages (name, email, message, created_at) VALUES ($1, $2, $3, NOW())', [name, email, message]);
    await fetch('https://formspree.io/f/xjgledbb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, email, message })
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Pipeline contact route error.' });
  }
});

app.listen(PORT, () => console.log(`🚀 Production server executing on port ${PORT}`));
