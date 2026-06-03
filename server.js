const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.static('.'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
