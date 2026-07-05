// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

router.use(isLoggedIn, isAdmin);

// ---------- DASHBOARD ----------
router.get('/dashboard', (req, res) => {
  const totalFields = db.get('SELECT COUNT(*) AS c FROM fields').c;
  const totalUsers = db.get(`SELECT COUNT(*) AS c FROM users WHERE role = 'user'`).c;
  const pendingBookings = db.get(`SELECT COUNT(*) AS c FROM bookings WHERE status = 'pending'`).c;
  const totalRevenue = db.get(`SELECT COALESCE(SUM(total_price),0) AS s FROM bookings WHERE status IN ('confirmed','completed')`).s;

  const recentBookings = db.all(`
    SELECT b.*, u.name AS user_name, f.name AS field_name
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    JOIN fields f ON f.id = b.field_id
    ORDER BY b.created_at DESC LIMIT 5
  `);

  res.render('admin/dashboard', {
    title: 'Dashboard Admin',
    totalFields, totalUsers, pendingBookings, totalRevenue, recentBookings
  });
});

// ---------- CRUD LAPANGAN (FIELDS) ----------
router.get('/fields', (req, res) => {
  const fields = db.all('SELECT * FROM fields ORDER BY id DESC');
  res.render('admin/fields', { title: 'Kelola Lapangan', fields });
});

router.get('/fields/new', (req, res) => {
  res.render('admin/field_form', { title: 'Tambah Lapangan', field: null });
});

router.post('/fields', (req, res) => {
  const { name, category, price_per_hour, description, image_url } = req.body;
  if (!name || !category || !price_per_hour) {
    req.flash('error', 'Nama, kategori, dan harga wajib diisi.');
    return res.redirect('/admin/fields/new');
  }
  db.run(`INSERT INTO fields (name, category, price_per_hour, description, image_url) VALUES (?, ?, ?, ?, ?)`,
    [name, category, parseInt(price_per_hour), description || '', image_url || '/images/default.jpg']);
  req.flash('success', 'Lapangan berhasil ditambahkan.');
  res.redirect('/admin/fields');
});

router.get('/fields/:id/edit', (req, res) => {
  const field = db.get('SELECT * FROM fields WHERE id = ?', [req.params.id]);
  if (!field) { req.flash('error', 'Lapangan tidak ditemukan.'); return res.redirect('/admin/fields'); }
  res.render('admin/field_form', { title: 'Edit Lapangan', field });
});

router.put('/fields/:id', (req, res) => {
  const { name, category, price_per_hour, description, image_url, is_active } = req.body;
  db.run(`UPDATE fields SET name=?, category=?, price_per_hour=?, description=?, image_url=?, is_active=? WHERE id=?`,
    [name, category, parseInt(price_per_hour), description || '', image_url || '/images/default.jpg', is_active ? 1 : 0, req.params.id]);
  req.flash('success', 'Lapangan berhasil diperbarui.');
  res.redirect('/admin/fields');
});

router.delete('/fields/:id', (req, res) => {
  const activeBooking = db.get(`SELECT id FROM bookings WHERE field_id = ? AND status IN ('pending','confirmed')`, [req.params.id]);
  if (activeBooking) {
    req.flash('error', 'Tidak dapat menghapus: masih ada booking aktif untuk lapangan ini.');
    return res.redirect('/admin/fields');
  }
  db.run('DELETE FROM fields WHERE id = ?', [req.params.id]);
  req.flash('success', 'Lapangan berhasil dihapus.');
  res.redirect('/admin/fields');
});

// ---------- KELOLA BOOKING ----------
router.get('/bookings', (req, res) => {
  const statusFilter = req.query.status;
  let sql = `
    SELECT b.*, u.name AS user_name, u.email AS user_email, f.name AS field_name, f.category
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    JOIN fields f ON f.id = b.field_id
  `;
  const params = [];
  if (statusFilter) {
    sql += ' WHERE b.status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY b.booking_date DESC, b.start_time DESC';
  const bookings = db.all(sql, params);
  res.render('admin/bookings', { title: 'Kelola Booking', bookings, statusFilter: statusFilter || '' });
});

router.put('/bookings/:id/status', (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];
  if (!allowed.includes(status)) {
    req.flash('error', 'Status tidak valid.');
    return res.redirect('/admin/bookings');
  }
  db.run('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
  req.flash('success', `Status booking berhasil diubah menjadi "${status}".`);
  res.redirect('/admin/bookings');
});

// ---------- KELOLA USER (view only, bonus) ----------
router.get('/users', (req, res) => {
  const users = db.all(`SELECT id, name, email, role, created_at FROM users ORDER BY id DESC`);
  res.render('admin/users', { title: 'Daftar Pengguna', users });
});

module.exports = router;
