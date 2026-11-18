# Day 02 — Rancangan Struktur Data KasKu

Tanggal: 18 November 2026
Status: rancangan — diimplementasikan di `database/schema.sql` (Day 3), `backend/models/Kategori.php` (Day 6), dan `backend/models/Transaksi.php` (Day 7).

## Tujuan

Menetapkan bentuk data yang dipakai seluruh aplikasi KasKu: apa saja yang dicatat
dalam satu transaksi, bagaimana kategori dikelompokkan, dan aturan apa yang
menjaga datanya tetap konsisten — sebelum satu baris SQL atau PHP ditulis.

## Entitas

KasKu hanya punya dua entitas inti. Sengaja dibuat minimal supaya mudah
dipahami dan mudah dikembangkan nanti (misalnya tambah anggaran bulanan atau
dompet terpisah).

```
Kategori  1 ─── *  Transaksi
```

Satu kategori dipakai oleh banyak transaksi. Satu transaksi selalu punya tepat
satu kategori. Tidak ada transaksi tanpa kategori — ini menjaga filter per
kategori (Day 12) dan grafik pengeluaran per kategori (Day 19) selalu bisa
dihitung.

## 1. Kategori

Kategori mengelompokkan transaksi menjadi **pemasukan** atau **pengeluaran**.
Jenisnya disimpan di kolom `tipe` supaya satu tabel cukup untuk keduanya.

| Field        | Tipe              | Keterangan |
| ------------ | ----------------- | ---------- |
| `id`         | INT, PK, AI       | Pengenal kategori |
| `nama`       | VARCHAR(50)       | Nama kategori, unik per tipe (mis. "Makanan") |
| `tipe`       | ENUM('pemasukan', 'pengeluaran') | Arah arus uang kategori ini |
| `ikon`       | VARCHAR(20), nullable | Emoji/ikon untuk tampilan (mis. "🍜") |
| `warna`      | VARCHAR(7), nullable | Kode warna hex untuk grafik (mis. "#f59e0b") |
| `is_default` | TINYINT(1), default 1 | 1 = kategori bawaan aplikasi, 0 = buatan pengguna |
| `created_at` | TIMESTAMP         | Waktu dibuat |
| `updated_at` | TIMESTAMP         | Waktu terakhir diubah |

### Kategori bawaan

Kategori bawaan di-seed saat instalasi dan tidak boleh dihapus (hanya bisa
disembunyikan). Daftar ini dipakai juga oleh data contoh Day 5.

**Pemasukan:**

| Nama | Ikon | Warna |
| ---- | ---- | ----- |
| Gaji | 💼 | #22c55e |
| Freelance | 💻 | #3b82f6 |
| Usaha | 🏪 | #a855f7 |
| Hadiah | 🎁 | #ec4899 |
| Lainnya | ➕ | #64748b |

**Pengeluaran:**

| Nama | Ikon | Warna |
| ---- | ---- | ----- |
| Makanan & Minuman | 🍜 | #f59e0b |
| Transportasi | 🚌 | #0ea5e9 |
| Belanja | 🛍️ | #8b5cf6 |
| Tagihan | 🧾 | #ef4444 |
| Hiburan | 🎬 | #f97316 |
| Kesehatan | 💊 | #10b981 |
| Pendidikan | 📚 | #6366f1 |
| Lainnya | ➕ | #64748b |

Aturan nama: nama kategori unik **dalam satu tipe** — boleh ada "Lainnya"
pemasukan dan "Lainnya" pengeluaran, tapi tidak boleh ada dua "Makanan &
Minuman" bertipe pengeluaran.

## 2. Transaksi

Satu baris = satu kejadian uang masuk atau keluar.

| Field         | Tipe              | Keterangan |
| ------------- | ----------------- | ---------- |
| `id`          | INT, PK, AI       | Pengenal transaksi |
| `kategori_id` | INT, FK → kategori.id | Kategori transaksi; `ON DELETE RESTRICT` supaya kategori yang masih dipakai tidak bisa dihapus |
| `tipe`        | ENUM('pemasukan', 'pengeluaran') | Harus sama dengan `tipe` kategorinya (dicek di model, Day 7) |
| `jumlah`      | DECIMAL(15,2)     | Nominal dalam Rupiah; selalu positif, arah ditentukan `tipe` |
| `tanggal`     | DATE              | Tanggal kejadian (bukan tanggal input); default hari ini |
| `deskripsi`   | VARCHAR(255)      | Keterangan singkat, mis. "Makan siang di warteg" |
| `catatan`     | TEXT, nullable    | Catatan tambahan, opsional |
| `created_at`  | TIMESTAMP         | Waktu dibuat |
| `updated_at`  | TIMESTAMP         | Waktu terakhir diubah |

### Kenapa `jumlah` selalu positif?

Menyimpan pengeluaran sebagai angka negatif menggoda, tapi membuat rumus
saldo rawan salah (mudah tertukar tanda). KasKu menyimpan `jumlah` selalu
positif dan mengandalkan `tipe` untuk arahnya. Saldo dihitung (Day 14) dengan:

```
saldo = SUM(jumlah WHERE tipe = 'pemasukan')
      - SUM(jumlah WHERE tipe = 'pengeluaran')
```

### Aturan validasi (ditegakkan di model, Day 7)

1. `jumlah` wajib diisi, angka, lebih dari 0, maksimal Rp999.999.999.999,99.
2. `tipe` wajib `pemasukan` atau `pengeluaran`, dan harus sama dengan `tipe`
   kategori yang dipilih.
3. `kategori_id` wajib merujuk ke kategori yang ada.
4. `tanggal` wajib format tanggal yang valid dan tidak boleh di masa depan.
5. `deskripsi` wajib diisi (maks. 255 karakter); `catatan` opsional.

## Contoh data (JSON)

Bentuk yang sama dipakai data contoh Day 5 (`assets/js/data.js`) dan respons
API (Minggu 4).

```json
{
  "id": 1,
  "kategori_id": 6,
  "kategori": {
    "id": 6,
    "nama": "Makanan & Minuman",
    "tipe": "pengeluaran",
    "ikon": "🍜",
    "warna": "#f59e0b"
  },
  "tipe": "pengeluaran",
  "jumlah": 25000,
  "tanggal": "2026-11-18",
  "deskripsi": "Makan siang di warteg",
  "catatan": "Nasi + ayam goreng + es teh",
  "created_at": "2026-11-18T11:30:00+07:00",
  "updated_at": "2026-11-18T11:30:00+07:00"
}
```

```json
{
  "id": 2,
  "kategori_id": 1,
  "kategori": {
    "id": 1,
    "nama": "Gaji",
    "tipe": "pemasukan",
    "ikon": "💼",
    "warna": "#22c55e"
  },
  "tipe": "pemasukan",
  "jumlah": 3500000,
  "tanggal": "2026-11-17",
  "deskripsi": "Gaji magang bulan November",
  "catatan": null,
  "created_at": "2026-11-17T09:00:00+07:00",
  "updated_at": "2026-11-17T09:00:00+07:00"
}
```

## Indeks yang direncanakan (Day 3)

- `transaksi(kategori_id)` — mempercepat filter per kategori.
- `transaksi(tanggal)` — mempercepat filter per bulan/tahun dan ringkasan bulanan.
- `transaksi(tipe, tanggal)` — mempercepat perhitungan saldo per periode.

## Keputusan yang sengaja ditunda

- **Multi-dompet / multi-pengguna:** belum ada kolom pengguna atau dompet.
  Aplikasi ini single-user dulu; ditambahkan hanya kalau dibutuhkan.
- **Transaksi berulang (langganan):** tidak ada kolom jadwal; dicatat manual
  tiap bulan.
- **Lampiran struk/foto:** tidak disimpan di tahap ini.

## Langkah berikutnya

- **Day 3:** terjemahkan rancangan ini menjadi `database/schema.sql`.
- **Day 5:** pakai kategori bawaan di atas untuk data contoh transaksi.
- **Day 6–7:** model `Kategori` dan `Transaksi` menegakkan aturan validasi di atas.
