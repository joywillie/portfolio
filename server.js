const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_key_2026';

// Database Config
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Setup Uploads Directory
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, 'profile.jpg')
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(express.static(__dirname));

/**
 * 🔒 MIDDLEWARE
 */
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

/* ==========================================================================
   🌐 API ENDPOINTS (JSON RESPONSE)
   ========================================================================== */

// Sign In API - Returns JSON instead of redirecting
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 86400000 });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Profile Photo Upload API
app.post('/api/upload-photo', upload.single('photo'), (req, res) => {
    res.json({ success: true, message: "Photo updated." });
});

// Contact Form Sync
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    return res.status(200).json({ success: true });
  } catch (err) { return res.status(500).json({ success: false }); }
});

/* ==========================================================================
   🔒 PAGE ROUTING
   ========================================================================== */
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'signin.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 Gateway online at port ${PORT}`));
