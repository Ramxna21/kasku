-- ============================================================
-- KasKu — Skema Database
-- Day 3 (19 November 2026)
--
-- Terjemahan dari rancangan struktur data di
-- docs/day-02-struktur-data.md menjadi skema MySQL/MariaDB.
-- Dua tabel inti: kategori dan transaksi.
--
-- Cara pakai:
--   mysql -u <user> -p kasku < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS kasku
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE kasku;

-- ------------------------------------------------------------
-- Tabel: kategori
-- Mengelompokkan transaksi menjadi pemasukan atau pengeluaran.
-- Satu tabel cukup untuk keduanya; arah arus uang disimpan
-- di kolom `tipe`.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kategori (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nama        VARCHAR(50) NOT NULL,
    tipe        ENUM('pemasukan', 'pengeluaran') NOT NULL,
    ikon        VARCHAR(20) NULL,
    warna       VARCHAR(7) NULL,
    is_default  TINYINT(1) NOT NULL DEFAULT 1,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- Nama kategori unik dalam satu tipe: boleh ada "Lainnya"
    -- pemasukan dan "Lainnya" pengeluaran, tapi tidak boleh ada
    -- dua "Makanan & Minuman" bertipe pengeluaran.
    UNIQUE KEY uk_kategori_nama_tipe (nama, tipe),
    KEY idx_kategori_tipe (tipe)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Tabel: transaksi
-- Satu baris = satu kejadian uang masuk atau keluar.
-- `jumlah` selalu disimpan positif; arahnya ditentukan `tipe`.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaksi (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    kategori_id INT UNSIGNED NOT NULL,
    tipe        ENUM('pemasukan', 'pengeluaran') NOT NULL,
    jumlah      DECIMAL(15, 2) NOT NULL,
    tanggal     DATE NOT NULL DEFAULT (CURRENT_DATE),
    deskripsi   VARCHAR(255) NOT NULL,
    catatan     TEXT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- Kategori yang masih dipakai transaksi tidak boleh dihapus.
    CONSTRAINT fk_transaksi_kategori
        FOREIGN KEY (kategori_id) REFERENCES kategori (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    -- Nominal wajib positif; arah ditentukan kolom `tipe`.
    CONSTRAINT ck_transaksi_jumlah_positif CHECK (jumlah > 0),

    -- Indeks yang direncanakan di Day 2:
    KEY idx_transaksi_kategori (kategori_id),   -- filter per kategori
    KEY idx_transaksi_tanggal (tanggal),        -- filter per bulan/tahun
    KEY idx_transaksi_tipe_tanggal (tipe, tanggal) -- saldo per periode
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Data awal: kategori bawaan (is_default = 1)
-- Dipakai juga oleh data contoh Day 5 (assets/js/data.js).
-- INSERT ... ON DUPLICATE KEY UPDATE supaya file ini aman
-- dijalankan ulang tanpa menggandakan data.
-- ------------------------------------------------------------
INSERT INTO kategori (id, nama, tipe, ikon, warna, is_default) VALUES
    -- Pemasukan
    (1,  'Gaji',               'pemasukan',   '💼', '#22c55e', 1),
    (2,  'Freelance',          'pemasukan',   '💻', '#3b82f6', 1),
    (3,  'Usaha',              'pemasukan',   '🏪', '#a855f7', 1),
    (4,  'Hadiah',             'pemasukan',   '🎁', '#ec4899', 1),
    (5,  'Lainnya',            'pemasukan',   '➕', '#64748b', 1),
    -- Pengeluaran
    (6,  'Makanan & Minuman',  'pengeluaran', '🍜', '#f59e0b', 1),
    (7,  'Transportasi',       'pengeluaran', '🚌', '#0ea5e9', 1),
    (8,  'Belanja',            'pengeluaran', '🛍️', '#8b5cf6', 1),
    (9,  'Tagihan',            'pengeluaran', '🧾', '#ef4444', 1),
    (10, 'Hiburan',            'pengeluaran', '🎬', '#f97316', 1),
    (11, 'Kesehatan',          'pengeluaran', '💊', '#10b981', 1),
    (12, 'Pendidikan',         'pengeluaran', '📚', '#6366f1', 1),
    (13, 'Lainnya',            'pengeluaran', '➕', '#64748b', 1)
ON DUPLICATE KEY UPDATE
    nama = VALUES(nama),
    tipe = VALUES(tipe),
    ikon = VALUES(ikon),
    warna = VALUES(warna),
    is_default = VALUES(is_default);

-- Contoh transaksi (opsional, untuk pengembangan lokal).
-- Dihapus/diabaikan saat data contoh Day 5 dipakai.
-- INSERT INTO transaksi (kategori_id, tipe, jumlah, tanggal, deskripsi, catatan) VALUES
--     (6, 'pengeluaran', 25000.00, '2026-11-18', 'Makan siang di warteg', 'Nasi + ayam goreng + es teh'),
--     (1, 'pemasukan',  3500000.00, '2026-11-17', 'Gaji magang bulan November', NULL);
