// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Low, JSONFile } = require('lowdb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// DB setup (lowdb)
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

app.use(cors());
app.use(bodyParser.json());

// initialize db if empty
async function initDB() {
  await db.read();
  db.data = db.data || { transactions: [] };
  await db.write();
}
initDB();

// Routes
app.get('/api/transactions', async (req, res) => {
  await db.read();
  const { from, to } = req.query;
  let tx = db.data.transactions || [];
  if (from || to) {
    tx = tx.filter(t => {
      const d = new Date(t.date);
      if (from && d < new Date(from)) return false;
      if (to && d > new Date(to)) return false;
      return true;
    });
  }
  res.json(tx.sort((a,b)=> new Date(b.date)-new Date(a.date)));
});

app.post('/api/transactions', async (req, res) => {
  const payload = req.body;
  await db.read();
  const id = Date.now();
  const item = { id, ...payload };
  db.data.transactions.push(item);
  await db.write();
  res.status(201).json(item);
});

app.put('/api/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.read();
  const idx = db.data.transactions.findIndex(t=>t.id===id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.data.transactions[idx] = { ...db.data.transactions[idx], ...req.body };
  await db.write();
  res.json(db.data.transactions[idx]);
});

app.delete('/api/transactions/:id', async (req, res) => {
  const id = Number(req.params.id);
  await db.read();
  db.data.transactions = db.data.transactions.filter(t=>t.id!==id);
  await db.write();
  res.status(204).end();
});

// optional: endpoint to export all data
app.get('/api/export', async (req, res) => {
  await db.read();
  res.json(db.data.transactions);
});

app.listen(PORT, () => {
  console.log(`DRE backend running on http://localhost:${PORT}`);
});
