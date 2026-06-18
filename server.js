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
    secret: process.env.SESSION_SECRET || 'joytech_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') 
        ? { rejectUnauthorized: false } 
        : false
});

// Authentication logic with error redirection
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0 && await bcrypt.compare(password, result.rows[0].password)) {
            req.session.userId = result.rows[0].id;
            res.redirect('/admin');
        } else {
            res.redirect('/login?error=true');
        }
    } catch (err) {
        res.redirect('/login?error=true');
    }
});

// Login page with dynamic error message injection
app.get('/login', (req, res) => {
    const errorMsg = req.query.error === 'true' 
        ? '<div style="background:#ef4444; color:white; padding:10px; border-radius:6px; margin-bottom:15px; text-align:center;">Invalid email or password.</div>' 
        : '';
    res.send(`
        <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form action="/api/admin/login" method="POST" style="background:#1e293b; padding:40px; border-radius:12px; width:360px;">
                <h2 style="text-align:center; color:#38bdf8;">Admin Login</h2>
                ${errorMsg}
                <input type="email" name="email" placeholder="Email" required style="width:100%; padding:10px; margin-bottom:10px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px;">
                <input type="password" name="password" placeholder="Password" required style="width:100%; padding:10px; margin-bottom:20px; background:#0f172a; border:1px solid #334155; color:white; border-radius:5px;">
                <button type="submit" style="width:100%; padding:10px; background:#38bdf8; border:none; color:#0f172a; font-weight:bold; cursor:pointer; border-radius:5px;">Login</button>
            </form>
        </body>
    `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => req.session.userId ? res.sendFile(path.join(__dirname, 'admin.html')) : res.redirect('/login'));

app.listen(PORT, () => console.log(`Gateway online on port ${PORT}`));
