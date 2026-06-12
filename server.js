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
  // Enforces SSL exclusively on production environments like Render
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Test connection on boot
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

// Serve asset subfolders explicitly (Prevents root-level source code exposure)
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// 3. FRONT-END ROUTING MATRIX (With Dual-Folder Fallback)
// ==========================================================================

// Home Page Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

// Contact Page Route
app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'contact.html'));
    }
  });
});

// Clean URL Helper for Contact
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'contact.html'));
    }
  });
});

// ==========================================================================
// 4. SECURE FORM SUBMISSION & DUPLICATE PROTECTION
// ==========================================================================
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  
  // Sanity check validation
  if (!name || !email || !message) {
    return res.status(400).send('All form fields are required.');
  }

  try {
    // ANTI-SPAM LOOKUP: Check if this exact message text already exists from this sender
    const duplicateCheck = await pool.query(
      'SELECT id FROM messages WHERE email = $1 AND message = $2 LIMIT 1',
      [email, message]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.send(`
        <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; padding:20px; text-align:center;">
          <h1 style="color:#f43f5e; font-size:2.5rem;">Message Already Received!</h1>
          <p style="color:#cbd5e1; max-width:500px; line-height:1.6;">It looks like you've already sent this exact message. Duplicate entries are blocked to prevent spam.</p>
          <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:600; transition:0.2s; margin-top:10px;">Go Back</a>
        </div>
      `);
    }

    // Insert clean unique message records
    await pool.query(
      'INSERT INTO messages(name, email, message, created_at) VALUES($1, $2, $3, NOW())',
      [name, email, message]
    );

    // Dynamic success UI matching JoyTech UI kit palette
    res.send(`
      <div style="background:#0f172a; color:white; font-family:'Poppins',sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:20px; padding:20px; text-align:center;">
        <h1 style="color:#38bdf8; font-size:2.5rem;">Message Sent Successfully!</h1>
        <p style="color:#cbd5e1; max-width:500px; line-height:1.6;">Thank you for reaching out. Your submission has been securely written to the database matrix.</p>
        <a href="/contact.html" style="background:#38bdf8; color:#0f172a; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:600; transition:0.2s; margin-top:10px;">Go Back</a>
      </div>
    `);

  } catch (err) {
    console.error('🔴 Production Database Exception Error:', err);
    res.status(500).send('Critical Server Core Error: Unable to record submission entry.');
  }
});

// ==========================================================================
// 5. RUNTIME INITIALIZATION
// ==========================================================================
app.listen(PORT, () => {
  console.log(`📡 JoyTech core engine listening on port: ${PORT}`);
});
