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
    secret: process.env.SESSION_SECRET || 'joytech_secret_engine_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==========================================
// 🗄️ DATABASE CONNECTION
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false
});

// ==========================================
// 🔐 AUTHENTICATION FLOWS (WITH REDIRECT FIX)
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
            return res.redirect('/login?error=invalid');
        }

        req.session.userId = result.rows[0].id;
        res.redirect('/admin');
    } catch (err) {
        res.redirect('/login?error=server');
    }
});

app.get('/login', (req, res) => {
    // Inject error message if query param exists
    const errorMsg = req.query.error === 'invalid' 
        ? '<div style="background:#ef4444; color:white; padding:12px; border-radius:6px; margin-bottom:15px; text-align:center; border:1px solid #7f1d1d;">Invalid email or password. Please try again.</div>' 
        : '';

    res.send(`
        <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; margin:0; padding: 20px;">
            <form action="/api/admin/login" method="POST" style="background:#1e293b; padding:40px; border-radius:12px; display:flex; flex-direction:column; gap:20px; width:100%; max-width:360px; border:1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="margin:0; color:#38bdf8; text-align:center; font-size: 24px;">Admin Access Portal</h2>
                
                ${errorMsg}

                <div style="background: rgba(56, 189, 248, 0.1); border: 1px dashed #38bdf8; padding: 14px; border-radius: 6px; font-size: 13px; color: #cbd5e1;">
                    <strong style="color: #38bdf8;">🔐 Master Credentials:</strong><br>
                    Email: admin@joytech.com<br>
                    Password: admin2026
                </div>

                <input type="email" name="email" placeholder="Email Address" required style="padding:14px; background:#0f172a; border:1px solid #334155; color:white; border-radius:6px; outline:none;">
                <input type="password" name="password" placeholder="Password" required style="padding:14px; background:#0f172a; border:1px solid #334155; color:white; border-radius:6px; outline:none;">
                
                <button type="submit" style="background:#38bdf8; color:#0f172a; border:none; padding:14px; font-weight:bold; border-radius:6px; cursor:pointer;">Authenticate</button>
            </form>
        </body>
    `);
});

// ==========================================
// 📄 STATIC FRONTEND & DASHBOARD
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ==========================================
// 🚀 SERVER ACTIVATION
// ==========================================
app.listen(PORT, () => {
    console.log(`📡 JoyTech Gateway online at port: ${PORT}`);
});
