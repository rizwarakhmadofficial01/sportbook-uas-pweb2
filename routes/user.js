// routes/user.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { isLoggedIn, isUser } = require('../middleware/auth');

router.use(isLoggedIn, isUser);

// ---------- DASHBOARD ----------
router.get('/dashboard', (req, res) => {
  const userId = req.session.user.id;
  const myBookings = db.all(`
    SELECT b.*, f.name AS field_name, f.category, f.image_url
    FROM bookings b JOIN fields f ON f.id = b.field_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC LIMIT 5
  `, [userId]);
  const totalBookings = db.get('SELECT COUNT(*) AS c FROM bookings WHERE user_id = ?', [userId]).c;
  const activeFieldsCount = db.get('SELECT COUNT(*) AS c FROM fields WHERE is_active = 1').c;

  res.render('user/dashboard', { title: 'Dashboard', myBookings, totalBookings, activeFieldsCount });
});

// ---------- BROWSE LAPANGAN ----------
router.get('/fields', (req, res) => {
  const category = req.query.category || '';
  let sql = 'SELECT * FROM fields WHERE is_active = 1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY name ASC';
  const fields = db.all(sql, params);
  const categories = db.all('SELECT DISTINCT category FROM fields');
  res.render('user/fields', { title: 'Daftar Lapangan', fields, categories, category });
});

// ---------- FORM BOOKING ----------
router.get('/fields/:id/book', (req, res) => {
  const field = db.get('SELECT * FROM fields WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!field) { req.flash('error', 'Lapangan tidak ditemukan.'); return res.redirect('/user/fields'); }
  res.render('user/booking_form', { title: 'Booking Lapangan', field });
});

router.post('/fields/:id/book', (req, res) => {
  const userId = req.session.user.id;
  const fieldId = req.params.id;
  const { booking_date, start_time, end_time, notes } = req.body;

  const field = db.get('SELECT * FROM fields WHERE id = ?', [fieldId]);
  if (!field) { req.flash('error', 'Lapangan tidak ditemukan.'); return res.redirect('/user/fields'); }

  if (!booking_date || !start_time || !end_time) {
    req.flash('error', 'Tanggal dan jam booking wajib diisi.');
    return res.redirect(`/user/fields/${fieldId}/book`);
  }
  if (start_time >= end_time) {
    req.flash('error', 'Jam selesai harus lebih besar dari jam mulai.');
    return res.redirect(`/user/fields/${fieldId}/book`);
  }

  // Cegah booking tanggal lampau
  const today = new Date().toISOString().slice(0, 10);
  if (booking_date < today) {
    req.flash('error', 'Tidak dapat booking untuk tanggal yang sudah lewat.');
    return res.redirect(`/user/fields/${fieldId}/book`);
  }

  // Cek konflik jadwal (overlap) pada lapangan & tanggal yang sama, status aktif
  const conflict = db.get(`
    SELECT id FROM bookings
    WHERE field_id = ? AND booking_date = ? AND status IN ('pending','confirmed')
      AND NOT (end_time <= ? OR start_time >= ?)
  `, [fieldId, booking_date, start_time, end_time]);

  if (conflict) {
    req.flash('error', 'Jadwal bertabrakan dengan booking lain di lapangan ini. Silakan pilih jam lain.');
    return res.redirect(`/user/fields/${fieldId}/book`);
  }

  // Hitung total harga berdasarkan durasi jam
  const [sh, sm] = start_time.split(':').map(Number);
  const [eh, em] = end_time.split(':').map(Number);
  const durationHours = (eh + em / 60) - (sh + sm / 60);
  const totalPrice = Math.round(durationHours * field.price_per_hour);

  db.run(`
    INSERT INTO bookings (user_id, field_id, booking_date, start_time, end_time, total_price, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `, [userId, fieldId, booking_date, start_time, end_time, totalPrice, notes || '']);

  req.flash('success', 'Booking berhasil dibuat! Menunggu konfirmasi Admin.');
  res.redirect('/user/bookings');
});

// ---------- RIWAYAT BOOKING ----------
router.get('/bookings', (req, res) => {
  const userId = req.session.user.id;
  const bookings = db.all(`
    SELECT b.*, f.name AS field_name, f.category
    FROM bookings b JOIN fields f ON f.id = b.field_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `, [userId]);
  res.render('user/bookings', { title: 'Riwayat Booking Saya', bookings });
});

// ---------- BATALKAN BOOKING ----------
router.put('/bookings/:id/cancel', (req, res) => {
  const userId = req.session.user.id;
  const booking = db.get('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!booking) { req.flash('error', 'Booking tidak ditemukan.'); return res.redirect('/user/bookings'); }
  if (!['pending', 'confirmed'].includes(booking.status)) {
    req.flash('error', 'Booking ini tidak dapat dibatalkan.');
    return res.redirect('/user/bookings');
  }
  db.run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [req.params.id]);
  req.flash('success', 'Booking berhasil dibatalkan.');
  res.redirect('/user/bookings');
});

module.exports = router;
