<?php

declare(strict_types=1);

/**
 * KasKu — Model Kategori
 * Day 6 (22 November 2026)
 *
 * Model untuk tabel `kategori` (lihat database/schema.sql, Day 3).
 * Satu kategori mengelompokkan transaksi menjadi pemasukan atau
 * pengeluaran; arah arus uang disimpan di kolom `tipe` supaya
 * satu tabel cukup untuk keduanya.
 *
 * Aturan yang ditegakkan di sini (lihat docs/day-02-struktur-data.md):
 * - `nama` wajib diisi (maks. 50 karakter) dan unik dalam satu
 *   `tipe` — boleh ada "Lainnya" pemasukan dan "Lainnya"
 *   pengeluaran, tapi tidak boleh ada dua "Makanan & Minuman"
 *   bertipe pengeluaran.
 * - `tipe` wajib 'pemasukan' atau 'pengeluaran'.
 * - `ikon` opsional (maks. 20 karakter, mis. emoji "🍜").
 * - `warna` opsional, kode hex '#RRGGBB' (mis. "#f59e0b").
 * - Kategori bawaan (`is_default = 1`) tidak boleh dihapus,
 *   hanya bisa disembunyikan (di luar cakupan tahap ini).
 * - Kategori yang masih dipakai transaksi tidak boleh dihapus —
 *   ditegakkan juga oleh FOREIGN KEY ... ON DELETE RESTRICT di
 *   tabel `transaksi`.
 *
 * Daftar kategori bawaan di bawah sama persis dengan INSERT di
 * database/schema.sql dan KATEGORI_DEFAULT di assets/js/data.js
 * (Day 5) — id 1-13. Dipakai oleh `seedDefault()` dan oleh
 * model Transaksi (Day 7) untuk memastikan `tipe` transaksi
 * sama dengan `tipe` kategorinya.
 *
 * Dipakai oleh: backend/controllers/TransaksiController.php
 * (Day 23-24) dan backend/controllers/LaporanController.php
 * (Day 25).
 *
 * Tanpa dependensi framework — cukup disuntik koneksi PDO:
 *   $pdo = new PDO($dsn, $user, $pass); // lihat
 *   // backend/config/database.php (Day 22) untuk konfigurasi.
 *   $kategori = new Kategori($pdo);
 *   $semua = $kategori->all();
 */

namespace KasKu\Models;

use InvalidArgumentException;
use PDO;
use PDOException;
use RuntimeException;

class Kategori
{
    /** Nilai `tipe` yang diizinkan — sama dengan ENUM di schema.sql. */
    public const TIPE_PEMASUKAN = 'pemasukan';
    public const TIPE_PENGELUARAN = 'pengeluaran';

    /** @var string[] */
    public const TIPE_VALID = [self::TIPE_PEMASUKAN, self::TIPE_PENGELUARAN];

    /** Panjang maksimum kolom, mengikuti database/schema.sql. */
    public const MAKSIMAL_NAMA = 50;
    public const MAKSIMAL_IKON = 20;

    /**
     * Kategori bawaan KasKu, salinan dari `database/schema.sql`
     * (INSERT INTO kategori ...) dan docs/day-02-struktur-data.md.
     * Id di sini sama dengan id hasil INSERT di skema, supaya
     * data contoh Day 5 tetap konsisten dengan database.
     *
     * @var array<int, array{nama: string, tipe: string, ikon: string, warna: string}>
     */
    public const KATEGORI_DEFAULT = [
        // Pemasukan
        1  => ['nama' => 'Gaji',              'tipe' => self::TIPE_PEMASUKAN,   'ikon' => '💼', 'warna' => '#22c55e'],
        2  => ['nama' => 'Freelance',         'tipe' => self::TIPE_PEMASUKAN,   'ikon' => '💻', 'warna' => '#3b82f6'],
        3  => ['nama' => 'Usaha',             'tipe' => self::TIPE_PEMASUKAN,   'ikon' => '🏪', 'warna' => '#a855f7'],
        4  => ['nama' => 'Hadiah',            'tipe' => self::TIPE_PEMASUKAN,   'ikon' => '🎁', 'warna' => '#ec4899'],
        5  => ['nama' => 'Lainnya',           'tipe' => self::TIPE_PEMASUKAN,   'ikon' => '➕', 'warna' => '#64748b'],
        // Pengeluaran
        6  => ['nama' => 'Makanan & Minuman', 'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '🍜', 'warna' => '#f59e0b'],
        7  => ['nama' => 'Transportasi',      'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '🚌', 'warna' => '#0ea5e9'],
        8  => ['nama' => 'Belanja',           'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '🛍️', 'warna' => '#8b5cf6'],
        9  => ['nama' => 'Tagihan',           'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '🧾', 'warna' => '#ef4444'],
        10 => ['nama' => 'Hiburan',           'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '🎬', 'warna' => '#f97316'],
        11 => ['nama' => 'Kesehatan',         'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '💊', 'warna' => '#10b981'],
        12 => ['nama' => 'Pendidikan',        'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '📚', 'warna' => '#6366f1'],
        13 => ['nama' => 'Lainnya',           'tipe' => self::TIPE_PENGELUARAN, 'ikon' => '➕', 'warna' => '#64748b'],
    ];

    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /* ------------------------------------------------------------------ */
    /* Baca                                                                 */
    /* ------------------------------------------------------------------ */

    /**
     * Semua kategori, diurutkan: pemasukan dulu lalu pengeluaran,
     * masing-masing menurut abjad nama.
     *
     * @return array<int, array<string, mixed>>
     */
    public function all(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, nama, tipe, ikon, warna, is_default, created_at, updated_at'
            . ' FROM kategori'
            . " ORDER BY FIELD(tipe, 'pemasukan', 'pengeluaran'), nama"
        );

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Semua kategori untuk satu tipe saja.
     *
     * @param string $tipe 'pemasukan' atau 'pengeluaran'.
     * @return array<int, array<string, mixed>>
     */
    public function findByTipe(string $tipe): array
    {
        $this->validasiTipe($tipe);

        $stmt = $this->pdo->prepare(
            'SELECT id, nama, tipe, ikon, warna, is_default, created_at, updated_at'
            . ' FROM kategori WHERE tipe = :tipe ORDER BY nama'
        );
        $stmt->execute([':tipe' => $tipe]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Satu kategori berdasarkan id.
     *
     * @return array<string, mixed>|null null bila tidak ditemukan.
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, nama, tipe, ikon, warna, is_default, created_at, updated_at'
            . ' FROM kategori WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * Satu kategori berdasarkan nama dan tipe — pasangan yang
     * dijamin unik oleh UNIQUE KEY uk_kategori_nama_tipe.
     *
     * @return array<string, mixed>|null null bila tidak ditemukan.
     */
    public function findByNamaDanTipe(string $nama, string $tipe): ?array
    {
        $this->validasiTipe($tipe);

        $stmt = $this->pdo->prepare(
            'SELECT id, nama, tipe, ikon, warna, is_default, created_at, updated_at'
            . ' FROM kategori WHERE nama = :nama AND tipe = :tipe'
        );
        $stmt->execute([':nama' => trim($nama), ':tipe' => $tipe]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    /**
     * Jumlah transaksi yang memakai kategori ini. Dipakai sebelum
     * hapus — dan dicek ulang oleh FOREIGN KEY di database.
     */
    public function jumlahTransaksi(int $id): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM transaksi WHERE kategori_id = :id'
        );
        $stmt->execute([':id' => $id]);

        return (int) $stmt->fetchColumn();
    }

    /* ------------------------------------------------------------------ */
    /* Tulis                                                                */
    /* ------------------------------------------------------------------ */

    /**
     * Buat kategori baru (kategori buatan pengguna, is_default = 0).
     *
     * @param array{nama: string, tipe: string, ikon?: string|null, warna?: string|null} $data
     * @return int id kategori yang baru dibuat.
     *
     * @throws InvalidArgumentException bila data tidak valid
     *   (nama kosong/terlalu panjang/duplikat, tipe tidak valid,
     *   ikon terlalu panjang, atau warna bukan hex).
     * @throws RuntimeException bila penyimpanan ke database gagal.
     */
    public function create(array $data): int
    {
        $data = $this->validasiData($data);

        if ($this->findByNamaDanTipe($data['nama'], $data['tipe']) !== null) {
            throw new InvalidArgumentException(
                "Kategori '{$data['nama']}' sudah ada untuk tipe '{$data['tipe']}'."
            );
        }

        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO kategori (nama, tipe, ikon, warna, is_default)'
                . ' VALUES (:nama, :tipe, :ikon, :warna, 0)'
            );
            $stmt->execute([
                ':nama'  => $data['nama'],
                ':tipe'  => $data['tipe'],
                ':ikon'  => $data['ikon'],
                ':warna' => $data['warna'],
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Gagal menyimpan kategori: ' . $e->getMessage(), 0, $e);
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Ubah kategori yang sudah ada. Nama dan tipe tidak boleh
     * bertabrakan dengan kategori lain (aturan unik nama+tipe).
     *
     * @param array{nama?: string, tipe?: string, ikon?: string|null, warna?: string|null} $data
     * @return bool true bila ada baris yang berubah.
     *
     * @throws InvalidArgumentException bila id tidak ada atau
     *   data tidak valid.
     */
    public function update(int $id, array $data): bool
    {
        $lama = $this->findById($id);
        if ($lama === null) {
            throw new InvalidArgumentException("Kategori id {$id} tidak ditemukan.");
        }

        $data = $this->validasiData(array_merge($lama, $data));

        $duplikat = $this->findByNamaDanTipe($data['nama'], $data['tipe']);
        if ($duplikat !== null && (int) $duplikat['id'] !== $id) {
            throw new InvalidArgumentException(
                "Kategori '{$data['nama']}' sudah ada untuk tipe '{$data['tipe']}'."
            );
        }

        try {
            $stmt = $this->pdo->prepare(
                'UPDATE kategori SET nama = :nama, tipe = :tipe,'
                . ' ikon = :ikon, warna = :warna WHERE id = :id'
            );
            $stmt->execute([
                ':nama'  => $data['nama'],
                ':tipe'  => $data['tipe'],
                ':ikon'  => $data['ikon'],
                ':warna' => $data['warna'],
                ':id'    => $id,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Gagal mengubah kategori: ' . $e->getMessage(), 0, $e);
        }

        return $stmt->rowCount() > 0;
    }

    /**
     * Hapus kategori buatan pengguna. Kategori bawaan tidak boleh
     * dihapus, dan kategori yang masih dipakai transaksi juga
     * tidak boleh dihapus (dicek di sini, ditegakkan juga oleh
     * FOREIGN KEY ... ON DELETE RESTRICT).
     *
     * @return bool true bila ada baris yang terhapus.
     *
     * @throws InvalidArgumentException bila id tidak ada, kategori
     *   bawaan, atau masih dipakai transaksi.
     */
    public function delete(int $id): bool
    {
        $kategori = $this->findById($id);
        if ($kategori === null) {
            throw new InvalidArgumentException("Kategori id {$id} tidak ditemukan.");
        }
        if ((int) $kategori['is_default'] === 1) {
            throw new InvalidArgumentException(
                "Kategori bawaan '{$kategori['nama']}' tidak boleh dihapus."
            );
        }
        if ($this->jumlahTransaksi($id) > 0) {
            throw new InvalidArgumentException(
                "Kategori '{$kategori['nama']}' masih dipakai transaksi dan tidak boleh dihapus."
            );
        }

        $stmt = $this->pdo->prepare('DELETE FROM kategori WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Masukkan (atau perbarui) 13 kategori bawaan ke database.
     * Aman dijalankan ulang: INSERT ... ON DUPLICATE KEY UPDATE
     * memakai kunci unik (nama, tipe), sama seperti skema Day 3.
     *
     * @return int jumlah baris yang dimasukkan atau diperbarui.
     */
    public function seedDefault(): int
    {
        $jumlah = 0;

        $stmt = $this->pdo->prepare(
            'INSERT INTO kategori (id, nama, tipe, ikon, warna, is_default)'
            . ' VALUES (:id, :nama, :tipe, :ikon, :warna, 1)'
            . ' ON DUPLICATE KEY UPDATE'
            . ' nama = VALUES(nama), tipe = VALUES(tipe),'
            . ' ikon = VALUES(ikon), warna = VALUES(warna),'
            . ' is_default = VALUES(is_default)'
        );

        foreach (self::KATEGORI_DEFAULT as $id => $kategori) {
            $stmt->execute([
                ':id'    => $id,
                ':nama'  => $kategori['nama'],
                ':tipe'  => $kategori['tipe'],
                ':ikon'  => $kategori['ikon'],
                ':warna' => $kategori['warna'],
            ]);
            $jumlah += $stmt->rowCount();
        }

        return $jumlah;
    }

    /* ------------------------------------------------------------------ */
    /* Validasi                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Periksa `tipe` — hanya 'pemasukan' atau 'pengeluaran'.
     *
     * @throws InvalidArgumentException bila tipe tidak valid.
     */
    public function validasiTipe(string $tipe): void
    {
        if (!in_array($tipe, self::TIPE_VALID, true)) {
            throw new InvalidArgumentException(
                "Tipe kategori harus 'pemasukan' atau 'pengeluaran', bukan '{$tipe}'."
            );
        }
    }

    /**
     * Normalisasi dan validasi data kategori sebelum disimpan.
     *
     * @param array<string, mixed> $data
     * @return array{nama: string, tipe: string, ikon: string|null, warna: string|null}
     *
     * @throws InvalidArgumentException bila ada field tidak valid.
     */
    private function validasiData(array $data): array
    {
        $nama = trim((string) ($data['nama'] ?? ''));
        if ($nama === '') {
            throw new InvalidArgumentException('Nama kategori wajib diisi.');
        }
        if (mb_strlen($nama) > self::MAKSIMAL_NAMA) {
            throw new InvalidArgumentException(
                'Nama kategori maksimal ' . self::MAKSIMAL_NAMA . ' karakter.'
            );
        }

        $tipe = (string) ($data['tipe'] ?? '');
        $this->validasiTipe($tipe);

        $ikon = $data['ikon'] ?? null;
        $ikon = $ikon === null || $ikon === '' ? null : (string) $ikon;
        if ($ikon !== null && mb_strlen($ikon) > self::MAKSIMAL_IKON) {
            throw new InvalidArgumentException(
                'Ikon kategori maksimal ' . self::MAKSIMAL_IKON . ' karakter.'
            );
        }

        $warna = $data['warna'] ?? null;
        $warna = $warna === null || $warna === '' ? null : strtolower(trim((string) $warna));
        if ($warna !== null && !preg_match('/^#[0-9a-f]{6}$/', $warna)) {
            throw new InvalidArgumentException(
                "Warna kategori harus kode hex '#RRGGBB', bukan '{$warna}'."
            );
        }

        return ['nama' => $nama, 'tipe' => $tipe, 'ikon' => $ikon, 'warna' => $warna];
    }

    /**
     * Bentuk yang sama dengan contoh JSON di
     * docs/day-02-struktur-data.md dan respons API (Minggu 4):
     * kategori disematkan di dalam tiap transaksi.
     *
     * @param array<string, mixed> $row baris dari tabel kategori.
     * @return array{id: int, nama: string, tipe: string, ikon: string|null, warna: string|null}
     */
    public static function toArray(array $row): array
    {
        return [
            'id'    => (int) $row['id'],
            'nama'  => (string) $row['nama'],
            'tipe'  => (string) $row['tipe'],
            'ikon'  => $row['ikon'] ?? null,
            'warna' => $row['warna'] ?? null,
        ];
    }
}
