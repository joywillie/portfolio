const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// 1. DATABASE POOL CONFIGURATION
// ==========================================================================
const isProduction = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: isProduction || 'postgresql://postgres:password@localhost:5432/joytech_db',
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// ==========================================================================
// 2. MIDDLEWARE LAYER & ASSET ROUTING
// ==========================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static asset delivery pipelines
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images'))); // 👈 FIX: Added to serve your profile picture folder!
app.use(express.static(path.join(__dirname, 'public')));

// NATIVE COOKIE PARSER MIDDLEWARE FUNCTION
const checkAdminAuth = (req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader.includes('joytech_session=authenticated_admin')) {
    next(); // Pass verification checks cleanly
  } else {
    // If resource request is an API path, return raw status code rather than rendering page HTML strings
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized operation.' });
    }
    res.redirect('/login.html');
  }
};

// ==========================================================================
// 3. FRONT-END ROUTING MATRIX (Dual Folder Structural Fallback)
// ==========================================================================
const servePage = (fileName, res) => {
  res.sendFile(path.join(__dirname, fileName), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', fileName), (fallbackErr) => {
        if (fallbackErr) {
          res.status(404).send('<h1>404 - Page Not Found</h1>');
        }
      });
    }
  });
};

app.get('/', (req, res) => servePage('index.html', res));
app.get('/about', (req, res) => servePage('about.html', res));
app.get('/about.html', (req, res) => servePage('about.html', res));
app.get('/skills', (req, res) => servePage('skills.html', res));
app.get('/skills.html', (req, res) => servePage('skills.html', res));
app.get('/projects', (req, res) => servePage('projects.html', res));
app.get('/projects.html', (req, res) => servePage('projects.html', res));
app.get('/contact', (req, res) => servePage('contact.html', res));
app.get('/contact.html', (req, res) => servePage('contact.html', res));

// Login Router Views
app.get('/login.html', (req, res) => servePage('login.html', res));
app.get('/login', (req, res) => servePage('login.html', res));

// Protected Dashboard Layout Access Route (Guarded by auth middleware)
app.get('/admin', checkAdminAuth, (req, res) => servePage('admin.html', res));
app.get('/admin.html', checkAdminAuth, (req, res) => servePage('admin.html', res));

// ==========================================================================
// 4. AUTHENTICATION OPERATIONS HANDLERS
// ==========================================================================
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Credentials map directly from secure Environment Variables (or standard defaults for local dev testing)
  const SECURE_USER = process.env.ADMIN_USER || 'admin';
  const SECURE_PASS = process.env.ADMIN_PASSWORD || 'JoyTech@2026';

  if (username === SECURE_USER && password === SECURE_PASS) {
    // Generate secure session identifier instructions back down into browser storage
    const cookieOptions = isProduction 
      ? 'Secure; HttpOnly; SameSite=Strict; Path=/' 
      : 'HttpOnly; SameSite=Strict; Path=/';
    
    res.setHeader('Set-Cookie', `joytech_session=authenticated_admin; ${cookieOptions}`);
    res.redirect('/admin');
  } else {
    res.redirect('/login.html?error=1');
  }
});

app.get('/logout', (req, res) => {
  // Overwrite existing user session keys with historical expiration dates to wipe storage
  res.setHeader('Set-Cookie', 'joytech_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;');
  res.redirect('/login.html');
});

// ==========================================================================
// 5. SECURE FORM SUBMISSIONS & API ENGINES
// ==========================================================================

// SECURE API DATA ENDPOINT: Stream database list elements directly down to verified dashboard sessions
app.get('/api/messages', checkAdminAuth, async (req, res) => {
  try {
    const dataRecords = await pool.query('SELECT id, name, email, message, created_at FROM messages ORDER BY created_at DESC');
    res.json(dataRecords.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to access message table system logs.' });
  }
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).send('All fields are required.');

  try {
    const duplicateCheck = await pool.query('SELECT id FROM messages WHERE email = $1 AND message = $2 LIMIT 1', [email, message]);
    if (duplicateCheck.rows.length > 0) {
      return res.send(`
        <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; text-align:center; padding:20px;">
          <h1 style="color:#f43f5e; font-size:2.5rem;">Message Already Received!</h1>
          <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:600;">Go Back</a>
        </div>
      `);
    }

    await pool.query('INSERT INTO messages(name, email, message, created_at) VALUES($1, $2, $3, NOW())', [name, email, message]);
    res.send(`
      <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; text-align:center; padding:20px;">
        <h1 style="color:#38bdf8; font-size:2.5rem;">Message Sent Successfully!</h1>
        <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:600;">Go Back</a>
      </div>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Insertion Error.');
  }
});

app.listen(PORT, () => {
  console.log(`📡 JoyTech core engine running on port: ${PORT}`);
});
