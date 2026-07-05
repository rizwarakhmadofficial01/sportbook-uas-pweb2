// db/database.js
// Lightweight SQLite database (pure JS via sql.js/WASM - no native build tools needed)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'sportbook.sqlite');

let SQL = null;
let db = null;

function persist() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function init() {
  SQL = await initSqlJs({});
  if (fs.existsSync(DB_PATH)) {
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
    createSchema();
    seed();
    persist();
  }
  return db;
}

function createSchema() {
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,      -- Futsal, Badminton, Basket, dst
      price_per_hour INTEGER NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,   -- YYYY-MM-DD
      start_time TEXT NOT NULL,     -- HH:MM
      end_time TEXT NOT NULL,       -- HH:MM
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, rejected, cancelled, completed
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (field_id) REFERENCES fields(id)
    );
  `);
}

function seed() {
  const adminPass = bcrypt.hashSync('admin123', 10);
  const userPass = bcrypt.hashSync('user123', 10);

  db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
    ['Admin SportBook', 'admin@sportbook.test', adminPass, 'admin']);
  db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
    ['Rizwar (Demo User)', 'user@sportbook.test', userPass, 'user']);

  const fields = [
    ['Lapangan Futsal A', 'Futsal', 150000, 'Lapangan futsal indoor, rumput sintetis kualitas FIFA.', '/images/futsal.jpg'],
    ['Lapangan Futsal B', 'Futsal', 130000, 'Lapangan futsal outdoor, cocok untuk latihan santai.', '/images/futsal.jpg'],
    ['Lapangan Badminton 1', 'Badminton', 60000, 'Lantai vinyl standar PBSI, pencahayaan LED.', '/images/badminton.jpg'],
    ['Lapangan Badminton 2', 'Badminton', 55000, 'Cocok untuk 2-4 pemain, tersedia net cadangan.', '/images/badminton.jpg'],
    ['Lapangan Basket Indoor', 'Basket', 200000, 'Lapangan basket full court indoor.', '/images/basket.jpg'],
  ];
  fields.forEach(f => {
    db.run(`INSERT INTO fields (name, category, price_per_hour, description, image_url) VALUES (?, ?, ?, ?, ?)`, f);
  });
}

// Helper query functions (mimic better-sqlite3 style API for convenience)
function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Get last inserted row id
function lastInsertId() {
  const res = get('SELECT last_insert_rowid() AS id');
  return res ? res.id : null;
}

module.exports = { init, run, get, all, lastInsertId, persist };
