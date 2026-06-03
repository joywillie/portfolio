const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// This checks BOTH the root folder AND the public folder so it never fails!
app.use(express.static(path.join(__dirname, '.')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Fallback: If it finds index.html in public, use it. Otherwise, use the root one.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
