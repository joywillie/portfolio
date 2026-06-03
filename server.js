const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Direct Express to look inside the public folder for static resources
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle Contact Form Post requests
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await pool.query(
      'INSERT INTO messages(name, email, message) VALUES($1, $2, $3)',
      [name, email, message]
    );
    res.send('<h1>Message Sent Successfully!</h1><a href="/">Go Back</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Database Error');
  }
});

// Explicitly route requests to root back to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
