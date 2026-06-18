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
  ssl: true
});

// 🛠️ Core Middleware Registry
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Intercepts standard HTML form submissions
app.use(cookieParser());

/**
 * 🔒 MIDDLEWARE SECURITY GATEWAY
 * Protects your main portfolio files. If someone tries to access your website
 * without being logged in, they are immediately redirected to the sign-in page.
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
 * Checks if the primary file exists in the folder. If it doesn't, it automatically
 * serves the "(1)" duplicate fallback version so your links never break with a 404 error.
 */
const sendSmartFile = (res, primaryName, fallbackName) => {
  const primaryPath = path.join(__dirname, primaryName);
  if (fs.existsSync(primaryPath)) {
    return res.sendFile(primaryPath);
  } else {
    return res.sendFile(path.join(__dirname, fallbackName));
  }
};

// --- 🌐 GET ROUTES: SERVING THE HTML PAGES NATIVELY ---

// Serves your Sign In page (Catches clean URLs, .html extensions, and space duplicates)
app.get(['/signin', '/signin.html', '/signin%20(1).html', '/signin (1).html'], (req, res) => {
  sendSmartFile(res, 'signin.html', 'signin (1).html');
});

// Serves your Sign Up page (Catches clean URLs, .html extensions, and space duplicates)
app.get(['/signup', '/signup.html', '/signup%20(1).html', '/signup (1).html'], (req, res) => {
  sendSmartFile(res, 'signup.html', 'signup (1).html');
});

// Serves a custom styled backend page if someone clicks Forgot Password
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

// --- ⚙️ POST ROUTES: CONNECTING HTML FORM SUBMISSIONS TO NEON DATABASE ---

// SIGN UP PROCESSOR: Catches form submissions from your signup page
app.post(['/api/auth/signup', '/signup', '/signup.html', '/api/signup'], async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    // Fallback support if your HTML input fields use different names (like name instead of fullName)
    const clientName = fullName || req.body.name;

    if (!email || !password) {
      return res.status(400).send('Missing email or password fields. <a href="/signup">Try again</a>');
    }

    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).send('This email is already registered. <a href="/signup">Try to Sign In</a>');
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    await pool.query('INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)', [clientName || 'User', email.toLowerCase().trim(), hashed]);
    
    // Redirects browser instantly back to the log in panel after successful database entry
    return res.redirect('/signin');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Database registration failure.');
  }
});

// SIGN IN PROCESSOR: Catches form submissions from your signin page
app.post(['/api/auth/signin', '/signin', '/signin.html', '/api/signin'], async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('Please enter both email and password. <a href="/signin">Go back</a>');
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).send('Invalid email or password. <a href="/signin">Go back</a>');
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).send('Invalid email or password. <a href="/signin">Go back</a>');
    }
    
    // Generate secure session token cookie
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // 🚀 THE CONNECTING LINK: Sends the user directly to your website home screen!
    return res.redirect('/');

  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal server login failure.');
  }
});

// Logout Endpoint to clear cookie data sessions
app.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/signin');
});

// --- 📨 CONTACT FORM DATA ROUTER ---
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

// --- 🔒 PROTECTED PORTFOLIO VIEWS (ONLY VIEWABLE IF LOGGED IN) ---
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
app.listen(PORT, () => console.log(`🚀 Fully Connected Authentication System serving on port ${PORT}`));
