const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🎛️ MIDDLEWARE CONFIGURATION
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'joytech_secure_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // 1 hour session
}));

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false
});

// ==========================================
// 🔐 AUTHENTICATION ROUTES
// ==========================================

// Login POST: Process credentials and redirect back on failure
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length > 0 && await bcrypt.compare(password, result.rows[0].password)) {
            req.session.userId = result.rows[0].id;
            return res.redirect('/admin');
        } 
        
        // Redirect back to login with error status to trigger the year-specific message
        return res.redirect('/login?status=error');
    } catch (err) {
        return res.redirect('/login?status=error');
    }
});

// Login GET: Render form with dynamic year injection
app.get('/login', (req, res) => {
    const currentYear = new Date().getFullYear(); 
    const isError = req.query.status === 'error';
    
    const errorHTML = isError 
        ? `<div style="background:#b91c1c; color:white; padding:12px; border-radius:6px; margin-bottom:15px; text-align:center; font-size:14px;">
             Invalid credentials for ${currentYear}. Please try again.
           </div>` 
        : '';

    res.send(`
        <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form action="/api/admin/login" method="POST" style="background:#1e293b; padding:40px; border-radius:12px; width:360px; border:1px solid #334155;">
                <h2 style="text-align:center; color:#38bdf8; margin-bottom:20px;">Admin Login</h2>
                ${errorHTML}
                <input type="email" name="email" placeholder="Email" required style="width:100%; padding:12px; margin-bottom:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px; box-sizing:border-box;">
                <input type="password" name="password" placeholder="Password" required style="width:100%; padding:12px; margin-bottom:20px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px; box-sizing:border-box;">
                <button type="submit" style="width:100%; padding:12px; background:#38bdf8; border:none; color:#0f172a; font-weight:bold; cursor:pointer; border-radius:5px;">Login</button>
            </form>
        </body>
    `);
});

// ==========================================
// 📄 PAGES & DASHBOARD
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/admin', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => console.log(`🚀 Gateway online at port: ${PORT}`));
