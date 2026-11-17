# Roadmap 30 Hari — KasKu

Periode: **17 November – 16 Desember 2026**
Aturan main: 1 hari = 1 langkah kecil = 1 commit. Tidak ada commit kosong; setiap commit menambah atau memperbaiki sesuatu yang nyata.

## Minggu 1 — Fondasi (17–23 Nov)
- **Day 1 (17 Nov):** README project + roadmap 30 hari + halaman `index.html` awal
- **Day 2 (18 Nov):** `docs/day-02-struktur-data.md` — rancangan struktur data transaksi & kategori
- **Day 3 (19 Nov):** `database/schema.sql` — skema tabel `transaksi` dan `kategori`
- **Day 4 (20 Nov):** `assets/js/format.js` — helper format Rupiah & format tanggal Indonesia
- **Day 5 (21 Nov):** `assets/js/data.js` — data contoh (seed) transaksi untuk pengembangan
- **Day 6 (22 Nov):** `backend/models/Kategori.php` — model kategori + daftar kategori bawaan
- **Day 7 (23 Nov):** `backend/models/Transaksi.php` — model transaksi (properti + validasi dasar)

## Minggu 2 — Logika Inti (24–30 Nov)
- **Day 8 (24 Nov):** `assets/js/transaksi.js` — fungsi tambah transaksi
- **Day 9 (25 Nov):** sambungan transaksi.js — fungsi tampil daftar transaksi
- **Day 10 (26 Nov):** sambungan transaksi.js — fungsi edit transaksi
- **Day 11 (27 Nov):** sambungan transaksi.js — fungsi hapus transaksi + konfirmasi
- **Day 12 (28 Nov):** `assets/js/filter.js` — filter per kategori
- **Day 13 (29 Nov):** sambungan filter.js — filter per bulan/tahun
- **Day 14 (30 Nov):** `assets/js/saldo.js` — hitung total pemasukan, pengeluaran, saldo

## Minggu 3 — Tampilan (1–7 Des)
- **Day 15 (1 Des):** `assets/css/style.css` — layout dasar dashboard
- **Day 16 (2 Des):** sambungan style.css — kartu ringkasan saldo
- **Day 17 (3 Des):** sambungan style.css — tabel transaksi yang rapi
- **Day 18 (4 Des):** `assets/js/form.js` — form tambah transaksi + validasi di sisi UI
- **Day 19 (5 Des):** `assets/js/chart.js` — grafik batang pengeluaran per kategori (CSS/canvas)
- **Day 20 (6 Des):** sambungan style.css — responsive untuk layar HP
- **Day 21 (7 Des):** sambungan style.css + toggle — dark mode

## Minggu 4 — Backend, API & Finishing (8–16 Des)
- **Day 22 (8 Des):** `backend/config/database.php` — konfigurasi koneksi database (PDO)
- **Day 23 (9 Des):** `backend/controllers/TransaksiController.php` — endpoint daftar & tambah (index/store)
- **Day 24 (10 Des):** sambungan controller — endpoint ubah & hapus (update/destroy)
- **Day 25 (11 Des):** `backend/controllers/LaporanController.php` — ringkasan bulanan
- **Day 26 (12 Des):** `docs/api.md` — dokumentasi endpoint API KasKu
- **Day 27 (13 Des):** `assets/js/export.js` — export transaksi ke CSV
- **Day 28 (14 Des):** `docs/testing.md` — checklist pengujian manual + hasil uji
- **Day 29 (15 Des):** `docs/day-29-retrospektif.md` — retrospektif: yang berhasil, kendala, pelajaran
- **Day 30 (16 Des):** Penyempurnaan README final (cara menjalankan lengkap + screenshot struktur) & penutup project
