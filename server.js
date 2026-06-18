const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_key_2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());

const requireAuth = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) return res.redirect('/login');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.redirect('/login');
  }
};

/* ==========================================================================
   🌐 PUBLIC CMS DATA FEED API (Used by Frontends to Fetch Content)
   ========================================================================== */

app.get('/api/public/site-data', async (req, res) => {
  try {
    const content = await pool.query('SELECT * FROM site_content');
    const skills = await pool.query('SELECT * FROM skills ORDER BY id DESC');
    const projects = await pool.query('SELECT * FROM projects ORDER BY id DESC');
    const custom = await pool.query('SELECT * FROM custom_sections ORDER BY display_order ASC, id DESC');

    const contentMap = {};
    content.rows.forEach(row => { contentMap[row.key] = row.value; });

    res.json({
      fixedText: contentMap,
      skills: skills.rows,
      projects: projects.rows,
      customSections: custom.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   🛠️ ULTIMATE ADMIN CMS CONTROL PANEL PORTAL (GET /admin)
   ========================================================================== */
app.get('/admin', requireAuth, async (req, res) => {
  try {
    const messages = await pool.query('SELECT * FROM contact_messages ORDER BY id DESC');
    const content = await pool.query('SELECT * FROM site_content');
    const skills = await pool.query('SELECT * FROM skills ORDER BY id DESC');
    const projects = await pool.query('SELECT * FROM projects ORDER BY id DESC');
    const custom = await pool.query('SELECT * FROM custom_sections ORDER BY page_target ASC, id DESC');

    const contentMap = {};
    content.rows.forEach(row => { contentMap[row.key] = row.value; });

    let messageRows = '';
    messages.rows.forEach(msg => {
      messageRows += `<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;color:#38bdf8;font-weight:bold;">${msg.name}</td><td style="padding:12px;">${msg.email}</td><td style="padding:12px;color:#cbd5e1;">${msg.message}</td><td style="padding:12px;text-align:right;"><button onclick="deleteItem('/api/admin/messages/${msg.id}')" style="background:#ef4444;border:none;padding:5px 10px;color:white;border-radius:4px;cursor:pointer;">Delete</button></td></tr>`;
    });

    let skillRows = '';
    skills.rows.forEach(sk => {
      skillRows += `<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;color:#ffffff;">${sk.name}</td><td style="padding:12px;text-align:right;"><button onclick="deleteItem('/api/admin/skills/${sk.id}')" style="background:#ef4444;border:none;padding:5px 10px;color:white;border-radius:4px;cursor:pointer;">Remove</button></td></tr>`;
    });

    let projectRows = '';
    projects.rows.forEach(p => {
      projectRows += `<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;color:#38bdf8;font-weight:bold;">${p.title}</td><td style="padding:12px;color:#cbd5e1;">${p.description}</td><td style="padding:12px;text-align:right;"><button onclick="deleteItem('/api/admin/projects/${p.id}')" style="background:#ef4444;border:none;padding:5px 10px;color:white;border-radius:4px;cursor:pointer;">Remove</button></td></tr>`;
    });

    let customRows = '';
    custom.rows.forEach(c => {
      customRows += `<tr style="border-bottom:1px solid #334155;"><td style="padding:12px;color:#a855f7;font-weight:bold;text-transform:uppercase;">${c.page_target}</td><td style="padding:12px;color:#38bdf8;font-weight:bold;">${c.section_title}</td><td style="padding:12px;color:#cbd5e1;">${c.section_content}</td><td style="padding:12px;text-align:right;"><button onclick="deleteItem('/api/admin/custom/${c.id}')" style="background:#ef4444;border:none;padding:5px 10px;color:white;border-radius:4px;cursor:pointer;">Delete</button></td></tr>`;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Master Suite Admin Portal - JoyTech</title>
          <style>
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
              body { background-color: #0f172a; color: #ffffff; min-height: 100vh; }
              header { display: flex; justify-content: space-between; align-items: center; padding: 20px 8%; border-bottom: 1px solid #1e293b; background-color: #0f172a; }
              .logo { font-size: 24px; font-weight: bold; color: #38bdf8; text-decoration: none; }
              .btn-logout { background-color: #334155; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; }
              .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
              .tabs { display: flex; gap: 8px; margin-bottom: 25px; border-bottom: 1px solid #334155; padding-bottom: 10px; flex-wrap: wrap; }
              .tab-btn { background: none; border: none; color: #94a3b8; font-size: 15px; font-weight: bold; padding: 10px 16px; cursor: pointer; border-radius: 6px; }
              .tab-btn.active { background-color: #38bdf8; color: #0f172a; }
              .tab-content { display: none; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
              .tab-content.active { display: block; }
              .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
              label { color: #94a3b8; font-size: 13px; font-weight: bold; text-transform: uppercase; }
              input, textarea, select { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; font-size: 15px; outline: none; }
              input:focus, textarea:focus, select:focus { border-color: #38bdf8; }
              .btn-save { background: #38bdf8; color: #0f172a; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; width: fit-content; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left; }
              th { padding: 12px; color: #94a3b8; text-transform: uppercase; font-size: 12px; border-bottom: 2px solid #334155; background: #111827; }
          </style>
      </head>
      <body>
          <header>
              <a href="/" class="logo">JoyTech Central Console</a>
              <a href="/logout" class="btn-logout">Exit Portal</a>
          </header>
          <div class="container">
              <div class="tabs">
                  <button class="tab-btn active" onclick="switchTab('msg-tab')">Messages Inbox</button>
                  <button class="tab-btn" onclick="switchTab('core-text-tab')">Edit Main Pages Text</button>
                  <button class="tab-btn" onclick="switchTab('lists-tab')">Skills & Projects Lists</button>
                  <button class="tab-btn" onclick="switchTab('infinite-tab')">✨ Add Custom Sections (Infinite)</button>
              </div>

              <div id="msg-tab" class="tab-content active">
                  <h3 style="margin-bottom:15px; color:#38bdf8;">User Contact Submissions</h3>
                  <table>
                      <thead><tr><th>Sender Name</th><th>Email Address</th><th>Message Body</th><th style="text-align:right">Action</th></tr></thead>
                      <tbody>${messageRows || '<tr><td colspan="4">No messages received.</td></tr>'}</tbody>
                  </table>
              </div>

              <div id="core-text-tab" class="tab-content">
                  <h3 style="margin-bottom:15px; color:#38bdf8;">Modify Core Page Text Elements</h3>
                  <form action="/api/admin/save-core-text" method="POST">
                      <div class="form-group"><label>Home Hero Title Tag</label><input type="text" name="hero_title" value="${contentMap.hero_title || ''}" required></div>
                      <div class="form-group"><label>Home Hero Subheading Profession</label><input type="text" name="hero_subtitle" value="${contentMap.hero_subtitle || ''}" required></div>
                      <div class="form-group"><label>Home Hero Detailed Paragraph Description</label><textarea name="hero_description" rows="3" required>${contentMap.hero_description || ''}</textarea></div>
                      <div class="form-group"><label>About Me Page Personal Biography Text Block</label><textarea name="about_bio" rows="4" required>${contentMap.about_bio || ''}</textarea></div>
                      <button type="submit" class="btn-save">Save Dynamic Layout Text</button>
                  </form>
              </div>

              <div id="lists-tab" class="tab-content">
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:30px;">
                      <div>
                          <h3 style="color:#38bdf8; margin-bottom:10px;">Add New Skill Pillar</h3>
                          <form action="/api/admin/add-skill" method="POST" style="display:flex; gap:10px; margin-bottom:15px;">
                              <input type="text" name="name" placeholder="e.g. Flutter Development" required>
                              <button type="submit" class="btn-save">Add</button>
                          </form>
                          <table><thead><tr><th>Skill Name</th><th style="text-align:right">Action</th></tr></thead><tbody>${skillRows}</tbody></table>
                      </div>
                      <div>
                          <h3 style="color:#38bdf8; margin-bottom:10px;">Add Project Card Portfolio Item</h3>
                          <form action="/api/admin/add-project" method="POST" style="display:flex; flex-direction:column; gap:10px;">
                              <input type="text" name="title" placeholder="Project Title" required>
                              <textarea name="description" placeholder="Project Summary Specs" rows="2" required></textarea>
                              <input type="url" name="project_url" placeholder="Live Demo Anchor Link" required>
                              <button type="submit" class="btn-save">Save Project</button>
                          </form>
                          <table><thead><tr><th>Title</th><th>Description</th><th style="text-align:right">Action</th></tr></thead><tbody>${projectRows}</tbody></table>
                      </div>
                  </div>
              </div>

              <div id="infinite-tab" class="tab-content">
                  <h3 style="margin-bottom:5px; color:#38bdf8;">The Content Creation Machine</h3>
                  <p style="color:#94a3b8; font-size:14px; margin-bottom:20px;">Think of anything new you want on your site (e.g. "My Certifications", "Hobbies", "Work Experience"). Add it below, pick a page, and it will appear automatically.</p>
                  
                  <form action="/api/admin/add-custom-section" method="POST" style="background:#0f172a; padding:20px; border-radius:8px; border:1px solid #334155; margin-bottom:25px;">
                      <div class="form-group">
                          <label>Choose Page Target Destination</label>
                          <select name="page_target">
                              <option value="home">Home Page (Bottom)</option>
                              <option value="about">About Page (Bottom)</option>
                              <option value="skills">Skills Page (Bottom)</option>
                              <option value="projects">Projects Page (Bottom)</option>
                              <option value="contact">Contact Page (Bottom)</option>
                          </select>
                      </div>
                      <div class="form-group"><label>Section Component Header Title</label><input type="text" name="section_title" placeholder="e.g., Industrial Attachment Experience or Professional Certifications" required></div>
                      <div class="form-group"><label>Section Detailed Body Content Content</label><textarea name="section_content" rows="4" placeholder="Type out your bullet points, paragraphs, or lists here..." required></textarea></div>
                      <button type="submit" class="btn-save" style="background:#a855f7; color:white;">Inject Dynamic Section Live</button>
                  </form>

                  <h3 style="margin-bottom:10px; color:#38bdf8;">Your Active Custom Infused Sections</h3>
                  <table>
                      <thead><tr><th>Target Page</th><th>Section Heading Title</th><th>Body Content Copy Text</th><th style="text-align:right">Action Command</th></tr></thead>
                      <tbody>${customRows || '<tr><td colspan="4">No custom structural sections built yet.</td></tr>'}</tbody>
                  </table>
              </div>
          </div>

          <script>
              function switchTab(tabId) {
                  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                  document.getElementById(tabId).classList.add('active');
                  event.currentTarget.classList.add('active');
              }
              async function deleteItem(endpoint) {
                  if(confirm("Are you positive you want to completely discard this record item?")) {
                      const res = await fetch(endpoint, { method: 'DELETE' });
                      if(res.ok) window.location.reload();
                  }
              }
          </script>
      </body>
      </html>
    `);
  } catch (err) { res.status(500).send('CMS Generation Engine fault error.'); }
});

/* ==========================================================================
   ⚙️ DATA PROCESSING PIPELINE API HANDLERS
   ========================================================================== */

app.post('/api/admin/save-core-text', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
    }
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Database writing block failure.'); }
});

app.post('/api/admin/add-skill', requireAuth, async (req, res) => {
  try {
    await pool.query('INSERT INTO skills (name) VALUES ($1)', [req.body.name]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Database skill injection fail.'); }
});

app.post('/api/admin/add-project', requireAuth, async (req, res) => {
  try {
    const { title, description, project_url } = req.body;
    await pool.query('INSERT INTO projects (title, description, project_url) VALUES ($1, $2, $3)', [title, description, project_url]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Database project addition fail.'); }
});

app.post('/api/admin/add-custom-section', requireAuth, async (req, res) => {
  try {
    const { page_target, section_title, section_content } = req.body;
    await pool.query('INSERT INTO custom_sections (page_target, section_title, section_content) VALUES ($1, $2, $3)', [page_target, section_title, section_content]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Database layout injection failure.'); }
});

app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (err) { res.sendStatus(500); }
});

app.delete('/api/admin/skills/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM skills WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (err) { res.sendStatus(500); }
});

app.delete('/api/admin/projects/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (err) { res.sendStatus(500); }
});

app.delete('/api/admin/custom/:id', requireAuth, async (req, res) => {
  try { await pool.query('DELETE FROM custom_sections WHERE id = $1', [req.params.id]); res.sendStatus(200); } catch (err) { res.sendStatus(500); }
});

/* ==========================================================================
   🔐 BASE AUTH CHANNELS MATRIX
   ========================================================================== */
app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>Sign In</title><style>body{background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;}form{background:#1e293b;padding:30px;border-radius:10px;width:330px;border:1px solid #334155;}input{width:100%;padding:10px;margin:10px 0;background:#0f172a;border:1px solid #334155;color:white;border-radius:5px;}button{width:100%;padding:12px;background:#38bdf8;color:#0f172a;border:none;border-radius:5px;font-weight:bold;cursor:pointer;}</style></head><body><form action="/api/auth/signin" method="POST"><h2 style="color:#38bdf8;margin-bottom:12px;">Admin Console Login</h2><input type="email" name="email" placeholder="System Email" required><input type="password" name="password" placeholder="Master Key" required><button type="submit">Unlock System Portal</button></form></body></html>`);
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
      return res.status(400).send('Invalid Entry Credentials. <a href="/login">Re-Attempt</a>');
    }
    const token = jwt.sign({ userId: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
    return res.redirect('/');
  } catch (err) { res.status(500).send('Login processing failure.'); }
});

app.get('/logout', (req, res) => { res.clearCookie('auth_token'); res.redirect('/login'); });

app.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    return res.status(200).json({ success: true });
  } catch (err) { return res.status(500).json({ success: false }); }
});

// 🔓 Dynamic Router Layer Array
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.use(express.static(__dirname));
app.listen(PORT, () => console.log(`🚀 Automated CMS Online on port ${PORT}`));
