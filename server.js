const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Look for files directly in the main folder (root)
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle Contact Form submissions
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query(
      'INSERT INTO messages(name, email, message) VALUES($1, $2, $3)',
      [name, email, message]
    );
    res.send('<h1>Message Sent Successfully!</h1><a href="/contact.html">Go Back</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Serve index.html directly from the main folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
