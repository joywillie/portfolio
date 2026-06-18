const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'joytech_2026_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false
});

// LOGIN API: Returns JSON so the browser stays on the same page
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length > 0 && await bcrypt.compare(password, result.rows[0].password)) {
            req.session.userId = result.rows[0].id;
            return res.json({ success: true, redirect: '/admin' });
        } 
        
        return res.status(401).json({ success: false, message: `Invalid credentials for ${new Date().getFullYear()}.` });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Server error, please try again." });
    }
});

// LOGIN GET: Serves the page with the script to handle errors without redirection
app.get('/login', (req, res) => {
    res.send(`
        <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form id="loginForm" style="background:#1e293b; padding:40px; border-radius:12px; width:360px; border:1px solid #334155;">
                <h2 style="text-align:center; color:#38bdf8;">Login</h2>
                <div id="errorBox" style="display:none; background:#b91c1c; color:white; padding:10px; border-radius:6px; margin-bottom:15px; text-align:center;"></div>
                <input type="email" name="email" placeholder="Email" required style="width:100%; padding:12px; margin-bottom:12px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px; box-sizing:border-box;">
                <input type="password" name="password" placeholder="Password" required style="width:100%; padding:12px; margin-bottom:20px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px; box-sizing:border-box;">
                <button type="submit" style="width:100%; padding:12px; background:#38bdf8; border:none; color:#0f172a; font-weight:bold; cursor:pointer; border-radius:5px;">Login</button>
            </form>
            <script>
                document.getElementById('loginForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const res = await fetch('/api/admin/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value })
                    });
                    const data = await res.json();
                    if (data.success) {
                        window.location.href = data.redirect;
                    } else {
                        const err = document.getElementById('errorBox');
                        err.innerText = data.message;
                        err.style.display = 'block';
                    }
                });
            </script>
        </body>
    `);
});

app.get('/admin', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 Gateway online at port: ${PORT}`));
