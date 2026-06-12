const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// 1. SMART DATABASE POOL CONFIGURATION
// ==========================================================================
const isProduction = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: isProduction || 'postgresql://postgres:password@localhost:5432/joytech_db',
  // Enforces SSL exclusively in production (Render) to prevent local setup failures
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// ==========================================================================
// 2. MIDDLEWARE LAYER & SAFE STATIC DIRECTORIES
// ==========================================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SAFE ROUTING: Serve asset subfolders directly instead of exposing the entire root directory (.)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Keep serving the public folder safely for asset hosting
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// 3. FRONT-END PAGES MANUAL MAP (Protects backend files)
// ==========================================================================
// Robust root route with your clean double-fallback configuration
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// Securely serving contact.html whether it's in root or public
app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'contact.html'));
    }
  });
});

// ==========================================================================
// 4. DATABASE FORM SUBMISSION HANDLER
// ==========================================================================
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).send('All form fields are required.');
  }

  try {
    await pool.query(
      'INSERT INTO messages(name, email, message, created_at) VALUES($1, $2, $3, NOW())',
      [name, email, message]
    );
    // Professional success message view screen matching your layout styles
    res.send(`
      <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px;">
        <h1 style="color:#38bdf8;">Message Sent Successfully!</h1>
        <p>Thank you for getting in touch, Joyce will respond shortly.</p>
        <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 24px; text-decoration:none; border-radius:8px; font-weight:600;">Go Back</a>
      </div>
    `);
  } catch (err) {
    console.error('Database Insertion Error:', err);
    res.status(500).send('Database Error: Unable to save your message.');
  }
});

// Start application runtime listening instance
app.listen(PORT, () => {
  console.log(`🚀 Server actively tracking live deployments on port ${PORT}`);
});
