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

// Session setup for secure admin dashboard authentication
app.use(session({
    secret: process.env.SESSION_SECRET || 'joytech_secret_engine_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 Hours
}));

// ==========================================
// 🗄️ DATABASE CONNECTION POOL
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Uncomment ssl line below if deploying live to Render / Heroku
    // ssl: { rejectUnauthorized: false } 
});

// ==========================================
// 🛠️ DATABASE INITIALIZATION & SEEDING
// ==========================================
const initDatabase = async () => {
    try {
        // 1. Create Core Tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                fullname VARCHAR(100),
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS fixed_text (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT
            );
            
            CREATE TABLE IF NOT EXISTS custom_sections (
                id SERIAL PRIMARY KEY,
                page_target VARCHAR(50),
                section_title VARCHAR(255),
                section_content TEXT
            );
            
            CREATE TABLE IF NOT EXISTS skills (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE
            );
            
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                project_url TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100),
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Seed Default Text Values if empty
        const textCheck = await pool.query('SELECT COUNT(*) FROM fixed_text');
        if (parseInt(textCheck.rows[0].count) === 0) {
            const defaultTexts = [
                ['hero_title', 'Joyce William'],
                ['hero_subtitle', 'ICT Technician & Web Developer'],
                ['hero_description', 'Passionate about web development, UI design, mobile applications, and building modern digital experiences.'],
                ['about_bio', 'Information Communication Technician student at Meru University of Science and Technology. Focused on building production-ready architectures, troubleshooting corporate technical environments, and managing enterprise systems.'],
                ['contact_phone', '0745806435'],
                ['contact_email', 'jw42205769@gmail.com']
            ];
            for (let [key, val] of defaultTexts) {
                await pool.query('INSERT INTO fixed_text (key, value) VALUES ($1, $2)', [key, val]);
            }
        }

        // 3. 🔐 SEED MASTER ADMIN ACCOUNT
        const userCheck = await pool.query('SELECT COUNT(*) FROM users');
        if (parseInt(userCheck.rows[0].count) === 0) {
            const hashedPassword = await bcrypt.hash('admin2026', 10);
            await pool.query(
                'INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3)',
                ['System Admin', 'admin@joytech.com', hashedPassword]
            );
            console.log('\n======================================================');
            console.log('✨ SUCCESS: Default Admin Account Created Successfully!');
            console.log('📧 Email: admin@joytech.com');
            console.log('🔑 Password: admin2026');
            console.log('======================================================\n');
        }
    } catch (err) {
        console.error('❌ Database bootstrapping error:', err);
    }
};
initDatabase();

// ==========================================
// 🔓 PUBLIC API ENDPOINTS
// ==========================================

// Aggregated route fetching all site data inside a single JSON request
app.get('/api/public/site-data', async (req, res) => {
    try {
        const textData = await pool.query('SELECT * FROM fixed_text');
        const sectionsData = await pool.query('SELECT * FROM custom_sections ORDER BY id ASC');
        const skillsData = await pool.query('SELECT * FROM skills ORDER BY id ASC');
        const projectsData = await pool.query('SELECT * FROM projects ORDER BY id ASC');

        // Transform array into clean key-value layout
        const fixedText = {};
        textData.rows.forEach(row => { fixedText[row.key] = row.value; });

        res.json({
            fixedText,
            customSections: sectionsData.rows,
            skills: skillsData.rows,
            projects: projectsData.rows
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to stream framework layout payload' });
    }
});

// Contact message handler routing entries straight to database storage
app.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;
    try {
        await pool.query(
            'INSERT INTO messages (name, email, message) VALUES ($1, $2, $3)',
            [name, email, message]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: 'Form processing anomaly detected' });
    }
});

// ==========================================
// 🔑 AUTHENTICATION FLOWS
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).send('Invalid email or password');

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).send('Invalid email or password');

        req.session.userId = user.id;
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Authentication pipeline crash');
    }
});

app.get('/api/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Authentication Guard Middleware
const checkAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

// ==========================================
// 📄 STATIC FRONTEND PAGE ROUTING MAP
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

// Login view template path routing
app.get('/login', (req, res) => {
    res.send(`
        <body style="background:#0f172a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
            <form action="/api/admin/login" method="POST" style="background:#1e293b; padding:40px; border-radius:12px; display:flex; flex-direction:column; gap:20px; width:100%; max-width:360px; border:1px solid #334155;">
                <h2 style="margin:0; color:#38bdf8; text-align:center;">Admin Access Portal</h2>
                <input type="email" name="email" placeholder="Email" required style="padding:14px; background:#0f172a; border:1px solid #334155; color:white; border-radius:6px; outline:none;">
                <input type="password" name="password" placeholder="Password" required style="padding:14px; background:#0f172a; border:1px solid #334155; color:white; border-radius:6px; outline:none;">
                <button type="submit" style="background:#38bdf8; color:#0f172a; border:none; padding:14px; font-weight:bold; border-radius:6px; cursor:pointer;">Authenticate</button>
            </form>
        </body>
    `);
});

// Admin Dashboard Route Guarded View Setup
app.get('/admin', checkAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==========================================
// 🎛️ DYNAMIC ENGINE COMPONENT MANAGEMENT (CRUD)
// ==========================================
app.post('/api/admin/sections', checkAuth, async (req, res) => {
    const { page_target, section_title, section_content } = req.body;
    try {
        await pool.query(
            'INSERT INTO custom_sections (page_target, section_title, section_content) VALUES ($1, $2, $3)',
            [page_target, section_title, section_content]
        );
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Engine write exception');
    }
});

app.post('/api/admin/text-update', checkAuth, async (req, res) => {
    const { key, value } = req.body;
    try {
        await pool.query(
            'INSERT INTO fixed_text (key, value) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, value]
        );
        res.redirect('/admin');
    } catch (err) {
        res.status(500).send('Static string update pipeline failure');
    }
});

// ==========================================
// 🚀 SERVER ACTIVATION ENGINE
// ==========================================
app.listen(PORT, () => {
    console.log(`📡 JoyTech Core Engine online and serving data streams on port: ${PORT}`);
});
