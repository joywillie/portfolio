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

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Database connection failed:', err.stack);
  }
  console.log('🚀 Connected to PostgreSQL successfully.');
  release();
});

// ==========================================================================
// 2. MIDDLEWARE LAYER & ASSET ROUTING
// ==========================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve asset subfolders explicitly (Keeps server.js and package.json safe)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// 3. FRONT-END ROUTING MATRIX (With Dual-Folder Fallback)
// ==========================================================================

// Reusable helper function to look for files in the root first, then fall back to public/
const servePage = (fileName, res) => {
  res.sendFile(path.join(__dirname, fileName), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', fileName), (fallbackErr) => {
        if (fallbackErr) {
          res.status(404).send(`<h1>404 - Page Not Found</h1><p>Could not locate ${fileName} in root or public directories.</p>`);
        }
      });
    }
  });
};

// Home Route
app.get('/', (req, res) => servePage('index.html', res));

// About Page Routes (Handles both /about and /about.html formats)
app.get('/about.html', (req, res) => servePage('about.html', res));
app.get('/about', (req, res) => servePage('about.html', res));

// Skills Page Routes
app.get('/skills.html', (req, res) => servePage('skills.html', res));
app.get('/skills', (req, res) => servePage('skills.html', res));

// Projects Page Routes
app.get('/projects.html', (req, res) => servePage('projects.html', res));
app.get('/projects', (req, res) => servePage('projects.html', res));

// Contact Page Routes
app.get('/contact.html', (req, res) => servePage('contact.html', res));
app.get('/contact', (req, res) => servePage('contact.html', res));

// ==========================================================================
// 4. SECURE FORM SUBMISSION & DUPLICATE PROTECTION
// ==========================================================================
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).send('All form fields are required.');
  }

  try {
    // Check for identical duplicate message submission
    const duplicateCheck = await pool.query(
      'SELECT id FROM messages WHERE email = $1 AND message = $2 LIMIT 1',
      [email, message]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.send(`
        <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; padding:20px; text-align:center;">
          <h1 style="color:#f43f5e; font-size:2.5rem;">Message Already Received!</h1>
          <p style="color:#cbd5e1; max-width:500px; line-height:1.6;">It looks like you've already sent this exact message. Duplicate entries are blocked to prevent spam.</p>
          <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:600;">Go Back</a>
        </div>
      `);
    }

    // Insert clean record
    await pool.query(
      'INSERT INTO messages(name, email, message, created_at) VALUES($1, $2, $3, NOW())',
      [name, email, message]
    );

    res.send(`
      <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; padding:20px; text-align:center;">
        <h1 style="color:#38bdf8; font-size:2.5rem;">Message Sent Successfully!</h1>
        <p style="color:#cbd5e1; max-width:500px; line-height:1.6;">Thank you for reaching out. Your submission has been securely written to the database matrix.</p>
        <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:600;">Go Back</a>
      </div>
    `);

  } catch (err) {
    console.error('🔴 Production Database Exception Error:', err);
    res.status(500).send('Critical Server Error: Unable to record submission entry.');
  }
});

// ==========================================================================
// 5. RUNTIME INITIALIZATION
// ==========================================================================
app.listen(PORT, () => {
  console.log(`📡 JoyTech core engine listening on port: ${PORT}`);
});
