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

// 🔒 Security Gateway
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

// 🌟 INLINE SIGN-IN PAGE (This completely bypasses the signin.html file to kill the cache error!)
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign In - JoyTech</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; background-color: #0f172a; color: #ffffff; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .login-container { background-color: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); width: 100%; max-width: 420px; border: 1px solid #334155; text-align: center; }
            .login-header h2 { color: #38bdf8; font-size: 28px; margin-bottom: 8px; }
            .login-header p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
            .form-group { margin-bottom: 20px; text-align: left; }
            .form-group label { display: block; margin-bottom: 8px; color: #94a3b8; font-size: 14px; }
            .form-group input { width: 100%; padding: 12px 16px; background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #ffffff; font-size: 16px; outline: none; }
            .form-group input:focus { border-color: #38bdf8; }
            .btn-submit { width: 100%; padding: 14px; background-color: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; }
            .btn-submit:hover { background-color: #0ea5e9; }
            .login-footer { text-align: center; margin-top: 24px; color: #94a3b8; font-size: 14px; }
            .login-footer a { color: #38bdf8; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-header">
                <h2>Welcome Back</h2>
                <p>Sign in to access your JoyTech Portfolio platform</p>
            </div>
            <form action="/api/auth/signin" method="POST">
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" name="email" placeholder="enter your email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn-submit">Sign In</button>
            </form>
            <div class="login-footer">
                Don't have an account? <a href="/signup">Sign Up</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// 🌟 INLINE SIGN-UP PAGE
app.get('/signup', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign Up - JoyTech</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; background-color: #0f172a; color: #ffffff; display: flex; justify-content: center; align-items: center; height: 100vh; }
            .signup-container { background-color: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); width: 100%; max-width: 420px; border: 1px solid #334155; text-align: center; }
            .signup-header h2 { color: #38bdf8; font-size: 28px; margin-bottom: 8px; }
            .signup-header p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
            .form-group { margin-bottom: 20px; text-align: left; }
            .form-group label { display: block; margin-bottom: 8px; color: #94a3b8; font-size: 14px; }
            .form-group input { width: 100%; padding: 12px 16px; background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #ffffff; font-size: 16px; outline: none; }
            .btn-submit { width: 100%; padding: 14px; background-color: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; }
            .signup-footer { text-align: center; margin-top: 24px; color: #94a3b8; font-size: 14px; }
            .signup-footer a { color: #38bdf8; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="signup-container">
            <div class="signup-header">
                <h2>Create Account</h2>
                <p>Join the JoyTech Portfolio platform</p>
            </div>
            <form action="/api/auth/signup" method="POST">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" name="fullName" placeholder="enter your full name" required>
                </div>
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" name="email" placeholder="enter your email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn-submit">Sign Up</button>
            </form>
            <div class="signup-footer">
                Already have an account? <a href="/login">Sign In</a>
            </div>
        </div>
    </body>
    </html>
  `);
});

// ⚙️ Database Sign In Endpoint
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

// ⚙️ Database Sign Up Endpoint
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

app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/login');
});

// 📨 Contact Box Handler
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

// 🔒 Protected Website File Routing
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.use(express.static(__dirname));
app.listen(PORT, () => console.log(`🚀 Overruled server running on port ${PORT}`));
