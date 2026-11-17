# KasKu — Aplikasi Catatan Keuangan Pribadi

KasKu adalah aplikasi web full-stack sederhana untuk mencatat pemasukan dan pengeluaran harian, melihat saldo, dan membaca ringkasan keuangan per bulan.

Project ini dibangun **bertahap selama 30 hari** — satu langkah kecil setiap hari, satu commit setiap hari. Progres hariannya bisa diikuti di [ROADMAP-30-HARI.md](ROADMAP-30-HARI.md).

## Fitur (target akhir)

- ✅ Catat transaksi: pemasukan & pengeluaran, lengkap dengan kategori, tanggal, dan catatan
- ✅ Dashboard saldo: total pemasukan, total pengeluaran, dan saldo akhir
- ✅ Filter transaksi per kategori dan per bulan
- ✅ Ringkasan bulanan + grafik pengeluaran per kategori
- ✅ Export data ke CSV
- ✅ Tampilan responsive + dark mode

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (modular)
- **Backend:** PHP (struktur MVC sederhana, gaya Laravel)
- **Database:** MySQL (skema disiapkan bertahap di folder `database/`)
- **Tools:** Git & GitHub, VS Code

## Struktur Project (dibangun bertahap)

```
kasku/
├── index.html          # halaman utama / dashboard
├── assets/
│   ├── css/            # styling
│   └── js/             # logika frontend per modul
├── backend/
│   ├── config/         # koneksi database
│   ├── controllers/    # controller transaksi & laporan
│   └── models/         # model Transaksi & Kategori
├── database/
│   └── schema.sql      # skema tabel
└── docs/               # catatan pengembangan harian
```

## Cara Menjalankan (versi awal)

Cukup buka `index.html` di browser. Instruksi menjalankan backend PHP + MySQL akan ditambahkan saat tahap backend dimulai (Minggu ke-4 roadmap).

## Pengembang

**Ramdani Nastian** — Mahasiswa Teknik Informatika, Universitas Bina Insani Bekasi
GitHub: [@Ramxna21](https://github.com/Ramxna21)
