// 🖥️ Protected Admin Command Center Dashboard
app.get('/admin', requireAuth, async (req, res) => {
  try {
    // Fetch all contact messages from your Neon PostgreSQL database
    const messagesResult = await pool.query('SELECT id, name, email, message, NOW() as received_at FROM contact_messages ORDER BY id DESC');
    
    // Generate data table rows dynamically
    let tableRows = '';
    if (messagesResult.rows.length === 0) {
      tableRows = `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 30px;">No messages received yet.</td></tr>`;
    } else {
      messagesResult.rows.forEach(msg => {
        tableRows += `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 16px; font-weight: bold; color: #38bdf8;">${msg.name}</td>
            <td style="padding: 16px;"><a href="mailto:${msg.email}" style="color: #ffffff; text-decoration: none; border-bottom: 1px dashed #38bdf8;">${msg.email}</a></td>
            <td style="padding: 16px; color: #cbd5e1; max-width: 400px; word-wrap: break-word;">${msg.message}</td>
            <td style="padding: 16px; text-align: right;">
              <button onclick="deleteMessage(${msg.id})" style="background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">Delete</button>
            </td>
          </tr>
        `;
      });
    }

    // Send down the premium administration dashboard template
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Control Center - JoyTech</title>
          <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: sans-serif; background-color: #0f172a; color: #ffffff; min-height: 100vh; }
              header { display: flex; justify-content: space-between; align-items: center; padding: 20px 8%; border-bottom: 1px solid #1e293b; background-color: #0f172a; }
              .logo { font-size: 24px; font-weight: bold; color: #38bdf8; text-decoration: none; }
              .btn-logout { background-color: #334155; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: bold; }
              .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
              .db-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
              .db-header h2 { font-size: 28px; color: #ffffff; }
              .badge { background-color: #38bdf8; color: #0f172a; padding: 4px 10px; border-radius: 20px; font-size: 14px; font-weight: bold; }
              .table-wrapper { background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
              table { width: 100%; border-collapse: collapse; text-align: left; }
              th { background-color: #1e293b; padding: 16px; color: #94a3b8; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #334155; }
              tr:hover { background-color: #1e293b60; }
          </style>
      </head>
      <body>
          <header>
              <a href="/" class="logo">JoyTech Admin</a>
              <a href="/logout" class="btn-logout">Exit Portal</a>
          </header>
          <div class="container">
              <div class="db-header">
                  <h2>Inbound Form Enquiries</h2>
                  <span class="badge">${messagesResult.rows.length} Total Messages</span>
              </div>
              <div class="table-wrapper">
                  <table>
                      <thead>
                          <tr>
                              <th>Sender Name</th>
                              <th>Email Address</th>
                              <th>Message Body</th>
                              <th style="text-align: right;">Action Actions</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${tableRows}
                      </tbody>
                  </table>
              </div>
          </div>
          <script>
              async function deleteMessage(id) {
                  if(confirm("Are you sure you want to drop this message record permanently?")) {
                      try {
                          const res = await fetch('/api/admin/messages/' + id, { method: 'DELETE' });
                          if(res.ok) { window.location.reload(); }
                      } catch(err) { alert("Action failed."); }
                  }
              }
          </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error loading administration metrics.');
  }
});

// ⚙️ API Delete Endpoint for Dashboard Records
app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM contact_messages WHERE id = $1', [id]);
    return res.sendStatus(200);
  } catch (err) {
    return res.sendStatus(500);
  }
});
