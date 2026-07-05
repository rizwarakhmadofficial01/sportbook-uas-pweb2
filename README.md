# SportBook - Sistem Booking Lapangan Olahraga

Aplikasi web untuk booking lapangan olahraga (Futsal, Badminton, Basket, dll) dengan dua role: **Admin** (pengelola) dan **User** (penyewa).

## Fitur Utama
- Autentikasi (Register, Login, Logout) dengan password terenkripsi (bcrypt)
- Role-based access control (Admin vs User)
- CRUD Lapangan (Admin)
- Booking lapangan dengan validasi konflik jadwal (User)
- Kelola status booking: pending → confirmed/rejected → completed/cancelled (Admin)
- Riwayat & pembatalan booking (User)
- Dashboard statistik untuk Admin dan User

## Tech Stack
- **Backend:** Node.js, Express.js
- **View Engine:** EJS (Server-Side Rendering)
- **Database:** SQLite (via sql.js - embedded, tanpa perlu instalasi server DB terpisah)
- **Auth:** express-session + bcryptjs
- **Lainnya:** method-override (REST-style form), connect-flash (notifikasi)

## Cara Menjalankan

```bash
npm install
npm start
```

Aplikasi berjalan di `http://localhost:3000`

## Akun Demo

| Role  | Email                  | Password  |
|-------|------------------------|-----------|
| Admin | admin@sportbook.test   | admin123  |
| User  | user@sportbook.test    | user123   |

Database SQLite otomatis dibuat & di-seed saat pertama kali dijalankan (`data/sportbook.sqlite`).

## Struktur Folder

```
sportbook/
├── server.js              # Entry point aplikasi
├── db/database.js         # Setup & helper query SQLite
├── middleware/auth.js      # Middleware autentikasi & otorisasi
├── routes/
│   ├── auth.js            # Register, login, logout
│   ├── admin.js            # CRUD lapangan, kelola booking (khusus admin)
│   └── user.js              # Browse lapangan, booking, riwayat (khusus user)
├── views/                  # Template EJS
└── public/                 # CSS statis
```

## Skema Database

**users**: id, name, email, password (hashed), role (admin/user), created_at
**fields**: id, name, category, price_per_hour, description, image_url, is_active
**bookings**: id, user_id (FK), field_id (FK), booking_date, start_time, end_time, total_price, status, notes

## Catatan Keamanan
- Password di-hash menggunakan bcrypt (salt rounds 10)
- Validasi input di sisi server untuk semua form
- Session-based auth dengan cookie httpOnly bawaan express-session
- Role-based middleware mencegah akses lintas peran
