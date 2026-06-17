const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE ARCHITECTURE
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC FILE SERVER PIPELINE (Serves your assets, styles, and images)
app.use(express.static(path.join(__dirname)));

// NEON POSTGRESQL CONNECTION CONFIGURATION
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for secure serverless connections to Neon
  }
});

// HTML ROUTING CONTEXTS
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/skills', (req, res) => {
  res.sendFile(path.join(__dirname, 'skills.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

/* ==========================================================================
   HYBRID POST CONTROLLER ROUTE: NEON STORAGE + FORMSPREE EMAIL FORWARDING
   ========================================================================== */
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  // Basic guard validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are strictly required.' });
  }

  try {
    // OPERATION 1: Persist details into Neon Database Console
    const sqlQuery = `
      INSERT INTO contact_messages (name, email, message, created_at) 
      VALUES ($1, $2, $3, NOW())
    `;
    await pool.query(sqlQuery, [name, email, message]);
    console.log("💾 Pipeline Success: Log recorded securely in Neon Database!");

    // OPERATION 2: Forward backend payload to Formspree endpoint hidden from public view
    const formspreeEndpoint = 'https://formspree.io/f/xjgledbb';
    
    const formspreeResponse = await fetch(formspreeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ name, email, message })
    });

    if (formspreeResponse.ok) {
      console.log("✉️ Pipeline Success: Formspree email copy dispatched successfully!");
    } else {
      console.warn("⚠️ Warning: Neon saved successfully, but Formspree rejected forwarding.");
    }

    // Return uniform application/json success back to browser client side
    return res.status(200).json({ success: true, message: 'Form processed inside both channels.' });

  } catch (error) {
    console.error("❌ Critical Pipeline Interruption Error:", error);
    return res.status(500).json({ error: 'Internal system data transit failure.' });
  }
});

// INITIALIZE SYSTEM CAPTURE LISTENER
app.listen(PORT, () => {
  console.log(`🚀 JoyTech Production Server executing on port: ${PORT}`);
});
