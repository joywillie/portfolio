const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secure_matrix_key_2026';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());

// Authenticated Session Route Guard
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
   🌐 PUBLIC REST ENDPOINTS (Dynamic Data Streams)
   ========================================================================= */

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
   🛠️ ADMIN PORTAL INTERFACE CONTROL CENTER (GET /admin)
   ========================================================================= */
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
      messageRows += `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 16px 20px; color: #38bdf8; font-weight: 500;">${msg.name}</td>
          <td style="padding: 16px 20px;"><a href="mailto:${msg.email}" style="color: #38bdf8; text-decoration: underline;">${msg.email}</a></td>
          <td style="padding: 16px 20px; color: #cbd5e1; max-width: 400px; line-height: 1.5;">${msg.message}</td>
          <td style="padding: 16px 20px; text-align: right;">
            <button onclick="deleteItem('/api/admin/messages/${msg.id}')" style="background: #ef4444; border: none; padding: 8px 16px; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Delete</button>
          </td>
        </tr>`;
    });

    let skillRows = '';
    skills.rows.forEach(sk => {
      skillRows += `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 14px 20px; color: #ffffff; font-weight: 500;">${sk.name}</td>
          <td style="padding: 14px 20px; text-align: right;">
            <button onclick="deleteItem('/api/admin/skills/${sk.id}')" style="background: #ef4444; border: none; padding: 6px 12px; color: white; border-radius: 6px; font-weight: bold; cursor: pointer;">Remove</button>
          </td>
        </tr>`;
    });

    let projectRows = '';
    projects.rows.forEach(p => {
      projectRows += `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 14px 20px; color: #38bdf8; font-weight: bold;">${p.title}</td>
          <td style="padding: 14px 20px; color: #cbd5e1;">${p.description}</td>
          <td style="padding: 14px 20px; text-align: right;">
            <button onclick="deleteItem('/api/admin/projects/${p.id}')" style="background: #ef4444; border: none; padding: 6px 12px; color: white; border-radius: 6px; font-weight: bold; cursor: pointer;">Remove</button>
          </td>
        </tr>`;
    });

    let customRows = '';
    custom.rows.forEach(c => {
      customRows += `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 14px 20px; color: #a855f7; font-weight: bold; text-transform: uppercase; font-size: 13px;">${c.page_target}</td>
          <td style="padding: 14px 20px; color: #38bdf8; font-weight: bold;">${c.section_title}</td>
          <td style="padding: 14px 20px; color: #cbd5e1; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.section_content}</td>
          <td style="padding: 14px 20px; text-align: right;">
            <button onclick="deleteItem('/api/admin/custom/${c.id}')" style="background: #ef4444; border: none; padding: 6px 12px; color: white; border-radius: 6px; font-weight: bold; cursor: pointer;">Delete</button>
          </td>
        </tr>`;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>JoyTech Admin Control Center</title>
          <style>
              * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
              body { background-color: #0f172a; color: #ffffff; min-height: 100vh; display: flex; flex-direction: column; }
              header { display: flex; justify-content: space-between; align-items: center; padding: 24px 8%; border-bottom: 1px solid #1e293b; background-color: #0f172a; }
              .logo { font-size: 24px; font-weight: bold; color: #38bdf8; text-decoration: none; }
              .btn-logout { background-color: #334155; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 14px; transition: background 0.2s; }
              .btn-logout:hover { background-color: #475569; }
              .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; width: 100%; }
              .tabs { display: flex; gap: 12px; margin-bottom: 30px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; flex-wrap: wrap; }
              .tab-btn { background: none; border: none; color: #94a3b8; font-size: 15px; font-weight: bold; padding: 12px 20px; cursor: pointer; border-radius: 6px; transition: all 0.2s; }
              .tab-btn:hover { color: #ffffff; background: #1e293b; }
              .tab-btn.active { background-color: #38bdf8; color: #0f172a; }
              .tab-content { display: none; background: #1e293b; border-radius: 12px; padding: 35px; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
              .tab-content.active { display: block; }
              .title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
              .title-bar h2 { font-size: 28px; font-weight: bold; color: #ffffff; }
              .badge { background: #38bdf8; color: #0f172a; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: bold; }
              .form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
              label { color: #94a3b8; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
              input, textarea, select { width: 100%; padding: 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: white; font-size: 15px; outline: none; transition: border 0.2s; }
              input:focus, textarea:focus, select:focus { border-color: #38bdf8; }
              .btn-save { background: #38bdf8; color: #0f172a; border: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px; width: fit-content; transition: background 0.2s; }
              .btn-save:hover { background: #0ea5e9; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left; }
              th { padding: 14px 20px; color: #94a3b8; text-transform: uppercase; font-size: 12px; font-weight: bold; border-bottom: 2px solid #1e293b; background: #0f172a; }
          </style>
      </head>
      <body>
          <header>
              <a href="/" class="logo">JoyTech Admin</a>
              <a href="/logout" class="btn-logout">Exit Portal</a>
          </header>
          <div class="container">
              <div class="tabs">
                  <button class="tab-btn active" onclick="switchTab('msg-tab')">Inbound Form Enquiries</button>
                  <button class="tab-btn" onclick="switchTab('core-text-tab')">Global Page Text</button>
                  <button class="tab-btn" onclick="switchTab('lists-tab')">Skills & Projects arrays</button>
                  <button class="tab-btn" onclick="switchTab('infinite-tab')">✨ Infinite Content Engine</button>
              </div>

              <div id="msg-tab" class="tab-content active">
                  <div class="title-bar">
                      <h2>Inbound Form Enquiries</h2>
                      <span class="badge">${messages.rows.length} Total Messages</span>
                  </div>
                  <div style="overflow-x: auto;">
                      <table>
                          <thead>
                              <tr>
                                  <th>Sender Name</th>
                                  <th>Email Address</th>
                                  <th>Message Body</th>
                                  <th style="text-align:right">Actions</th>
                              </tr>
                          </thead>
                          <tbody>${messageRows || '<tr><td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8;">No structural form submissions discovered inside the database matrix layer.</td></tr>'}</tbody>
                      </table>
                  </div>
              </div>

              <div id="core-text-tab" class="tab-content">
                  <div class="title-bar"><h2>Global Static Core Strings</h2></div>
                  <form action="/api/admin/save-core-text" method="POST">
                      <div class="form-group"><label>Home Screen Hero Title Line</label><input type="text" name="hero_title" value="${contentMap.hero_title || ''}" required></div>
                      <div class="form-group"><label>Home Screen Hero Subtitle Position Tag</label><input type="text" name="hero_subtitle" value="${contentMap.hero_subtitle || ''}" required></div>
                      <div class="form-group"><label>Home Screen Hero Descriptive Bio Block</label><textarea name="hero_description" rows="3" required>${contentMap.hero_description || ''}</textarea></div>
                      <div class="form-group"><label>About Screen Detailed Biography Workspace</label><textarea name="about_bio" rows="5" required>${contentMap.about_bio || ''}</textarea></div>
                      <div class="form-group"><label>Contact Screen Anchor Phone Number String</label><input type="text" name="contact_phone" value="${contentMap.contact_phone || ''}" required></div>
                      <div class="form-group"><label>Contact Screen Public Destination Email Routing Address</label><input type="email" name="contact_email" value="${contentMap.contact_email || ''}" required></div>
                      <button type="submit" class="btn-save">Execute Database Content Sync</button>
                  </form>
              </div>

              <div id="lists-tab" class="tab-content">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; flex-wrap: wrap;">
                      <div>
                          <h3 style="margin-bottom: 16px; color: #38bdf8;">Add New Skill Item</h3>
                          <form action="/api/admin/add-skill" method="POST" style="display: flex; gap: 12px; margin-bottom: 24px;">
                              <input type="text" name="name" placeholder="e.g. Flutter Application Development" required>
                              <button type="submit" class="btn-save" style="padding: 0 24px;">Append</button>
                          </form>
                          <table><thead><tr><th>Technical Skill Tag Name</th><th style="text-align:right">Action</th></tr></thead><tbody>${skillRows}</tbody></table>
                      </div>
                      <div>
                          <h3 style="margin-bottom: 16px; color: #38bdf8;">Add Portfolio Project Card</h3>
                          <form action="/api/admin/add-project" method="POST" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                              <input type="text" name="title" placeholder="Project Title Name" required>
                              <textarea name="description" placeholder="Technical Architecture Summary Specs" rows="2" required></textarea>
                              <input type="url" name="project_url" placeholder="Direct URL (Live Production App/GitHub)" required>
                              <button type="submit" class="btn-save">Save Project Element</button>
                          </form>
                          <table><thead><tr><th>Title</th><th>Description</th><th style="text-align:right">Action</th></tr></thead><tbody>${projectRows}</tbody></table>
                      </div>
                  </div>
              </div>

              <div id="infinite-tab" class="tab-content">
                  <div class="title-bar">
                      <h2>Infinite Content Component Generation Engine</h2>
                  </div>
                  <p style="color: #94a3b8; margin-bottom: 24px; line-height: 1.6; font-size: 15px;">Inject completely custom sections into any core viewport layout runtime path instantly without writing any HTML file system modifications.</p>
                  
                  <form action="/api/admin/add-custom-section" method="POST" style="background: #0f172a; padding: 24px; border-radius: 10px; border: 1px solid #334155; margin-bottom: 30px;">
                      <div class="form-group">
                          <label>Target Core Viewport View Location</label>
                          <select name="page_target">
                              <option value="home">Home Route (Bottom Flow)</option>
                              <option value="about">About Biography Page Layer</option>
                              <option value="skills">Technical Core Skills Screen</option>
                              <option value="projects">Engineering Implementation Portfolio</option>
                              <option value="contact">Communications Entry Hub</option>
                          </select>
                      </div>
                      <div class="form-group"><label>Custom Section Header Title Label</label><input type="text" name="section_title" placeholder="e.g. Industrial Attachment Operations / Academic Certifications" required></div>
                      <div class="form-group"><label>Comprehensive Body Text Layout Copy Content Blocks</label><textarea name="section_content" rows="4" placeholder="Input multi-line copy strings, details, item blocks..." required></textarea></div>
                      <button type="submit" class="btn-save" style="background: #a855f7; color: white;">Inject Components Into Framework</button>
                  </form>

                  <h3 style="margin-bottom: 16px; color: #38bdf8;">Your Active Custom Infused Content Blocks</h3>
                  <div style="overflow-x: auto;">
                      <table>
                          <thead>
                              <tr>
                                  <th>Target Route Path</th>
                                  <th>Component Title Header</th>
                                  <th>Content String Data Summary Snippet</th>
                                  <th style="text-align:right">Action Command</th>
                              </tr>
                          </thead>
                          <tbody>${customRows || '<tr><td colspan="4" style="padding:16px; text-align:center; color:#94a3b8;">No infinite operational custom blocks injected yet.</td></tr>'}</tbody>
                      </table>
                  </div>
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
                  if(confirm("Confirm removal of this record matrix node permanently from your system cluster?")) {
                      const res = await fetch(endpoint, { method: 'DELETE' });
                      if(res.ok) window.location.reload();
                  }
              }
          </script>
      </body>
      </html>
    `);
  } catch (err) { res.status(500).send('Administrative Interface Parsing System Malfunction Exception.'); }
});

/* ==========================================================================
   ⚙️ DATA PROCESSING REST HANDLERS
   ========================================================================= */

app.post('/api/admin/save-core-text', requireAuth, async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query('INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
    }
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Database content layer stream rewrite structural break.'); }
});

app.post('/api/admin/add-skill', requireAuth, async (req, res) => {
  try {
    await pool.query('INSERT INTO skills (name) VALUES ($1)', [req.body.name]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Skill item registry sequence failed.'); }
});

app.post('/api/admin/add-project', requireAuth, async (req, res) => {
  try {
    const { title, description, project_url } = req.body;
    await pool.query('INSERT INTO projects (title, description, project_url) VALUES ($1, $2, $3)', [title, description, project_url]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Project card storage stack overflow exception.'); }
});

app.post('/api/admin/add-custom-section', requireAuth, async (req, res) => {
  try {
    const { page_target, section_title, section_content } = req.body;
    await pool.query('INSERT INTO custom_sections (page_target, section_title, section_content) VALUES ($1, $2, $3)', [page_target, section_title, section_content]);
    res.redirect('/admin');
  } catch (err) { res.status(500).send('Dynamic layout processing segment crash.'); }
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
   🔐 IDENTITY VERIFICATION SYSTEMS GATEWAY (SIGN IN / OUT)
   ========================================================================= */

app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sign In - JoyTech</title>
        <style>
            body { background: #0f172a; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            form { background: #1e293b; padding: 40px; border-radius: 12px; width: 360px; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
            h2 { color: #38bdf8; font-size: 28px; margin-top: 0; margin-bottom: 12px; font-weight: bold; }
            .inp { width: 100%; padding: 14px; margin: 12px 0 20px 0; background: #0f172a; border: 1px solid #334155; color: white; border-radius: 8px; box-sizing: border-box; outline: none; font-size: 15px; transition: border 0.2s; }
            .inp:focus { border-color: #38bdf8; }
            .btn { width: 100%; padding: 14px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; transition: background 0.2s; }
            .btn:hover { background: #0ea5e9; }
        </style>
    </head>
    <body>
        <form action="/api/auth/signin" method="POST">
            <h2>Admin Console Login</h2>
            <input type="email" name="email" class="inp" placeholder="System Email" required>
            <input type="password" name="password" class="inp" placeholder="Master Key" required>
            <button type="submit" class="btn">Unlock System Portal</button>
        </form>
    </body>
    </html>
  `);
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password))) {
      return res.status(400).send('Invalid Entry Credentials Parameters Sourced. <a href="/login">Re-Attempt Identity Authentication</a>');
    }
    const token = jwt.sign({ userId: result.rows[0].id, email: result.rows[0].email }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 });
    return res.redirect('/admin');
  } catch (err) { res.status(500).send('Identity Validation Sequence Failure Event.'); }
});

app.get('/logout', (req, res) => { res.clearCookie('auth_token'); res.redirect('/login'); });

app.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    await pool.query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [name, email, message]);
    return res.status(200).json({ success: true });
  } catch (err) { return res.status(500).json({ success: false }); }
});

// UI View File Access Core Layout Routers
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/skills', (req, res) => res.sendFile(path.join(__dirname, 'skills.html')));
app.get('/projects', (req, res) => res.sendFile(path.join(__dirname, 'projects.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));

app.use(express.static(__dirname));
app.listen(PORT, () => console.log(`🚀 Automated Production CMS Infrastructure Engine actively mapped to port ${PORT}`));
