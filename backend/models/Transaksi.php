<?php

declare(strict_types=1);

/**
 * KasKu — Model Transaksi
 * Day 7 (23 November 2026)
 *
 * Model untuk tabel `transaksi` (lihat database/schema.sql, Day 3).
 * Satu baris = satu kejadian uang masuk atau keluar. `jumlah`
 * selalu disimpan positif; arah arus uang ditentukan `tipe`.
 *
 * Aturan yang ditegakkan di sini (lihat docs/day-02-struktur-data.md):
 * - `jumlah` wajib diisi, angka, lebih dari 0, maksimal
 *   Rp999.999.999.999,99 (DECIMAL(15,2) di skema).
 * - `tipe` wajib 'pemasukan' atau 'pengeluaran', dan harus sama
 *   dengan `tipe` kategori yang dipilih.
 * - `kategori_id` wajib merujuk ke kategori yang ada.
 * - `tanggal` wajib tanggal yang valid dan tidak boleh di masa
 *   depan (tanggal kejadian, bukan tanggal input).
 * - `deskripsi` wajib diisi (maks. 255 karakter); `catatan`
 *   opsional.
 * - Kategori yang masih dipakai transaksi tidak boleh dihapus —
 *   ditegakkan oleh FOREIGN KEY ... ON DELETE RESTRICT di tabel
 *   `transaksi` (dicek juga di backend/models/Kategori.php).
 *
 * Dipakai oleh: backend/controllers/TransaksiController.php
 * (Day 23-24) dan backend/controllers/LaporanController.php
 * (Day 25). Daftar transaksi di sisi UI memakai fungsi di
 * assets/js/transaksi.js (Day 8-11) dan filter di
 * assets/js/filter.js (Day 12-13).
 *
 * Tanpa dependensi framework — cukup disuntik koneksi PDO:
 *   $pdo = new PDO($dsn, $user, $pass); // lihat
 *   // backend/config/database.php (Day 22) untuk konfigurasi.
 *   $transaksi = new Transaksi($pdo);
 *   $id = $transaksi->create([
 *       'kategori_id' => 6,
 *       'tipe'        => 'pengeluaran',
 *       'jumlah'      => 25000,
 *       'tanggal'     => '2026-11-18',
 *       'deskripsi'   => 'Makan siang di warteg',
 *   ]);
 */

namespace KasKu\Models;

use DateTimeImmutable;
use InvalidArgumentException;
use PDO;
use PDOException;
use RuntimeException;

class Transaksi
{
    /** Nilai `tipe` yang diizinkan — sama dengan ENUM di schema.sql. */
    public const TIPE_PEMASUKAN = 'pemasukan';
    public const TIPE_PENGELUARAN = 'pengeluaran';

    /** @var string[] */
    public const TIPE_VALID = [self::TIPE_PEMASUKAN, self::TIPE_PENGELUARAN];

    /**
     * Batas kolom, mengikuti database/schema.sql dan
     * docs/day-02-struktur-data.md.
     */
    public const MAKSIMAL_JUMLAH = 999999999999.99;
    public const MAKSIMAL_DESKRIPSI = 255;

    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /* ------------------------------------------------------------------ */
    /* Baca                                                                 */
    /* ------------------------------------------------------------------ */

    /**
     * Semua transaksi, terbaru dulu (tanggal lalu id menurun).
     * Filter opsional — dipakai filter per kategori (Day 12),
     * filter per bulan/tahun (Day 13), dan ringkasan (Day 25).
     *
     * @param string|null $tipe      'pemasukan' atau 'pengeluaran'.
     * @param int|null    $kategoriId hanya transaksi kategori ini.
     * @param string|null $dari      tanggal awal 'Y-m-d' (inklusif).
     * @param string|null $sampai    tanggal akhir 'Y-m-d' (inklusif).
     * @return array<int, array<string, mixed>> tiap baris sudah
     *   berbentuk toArray() — kategori disematkan di dalamnya.
     */
    public function all(
        ?string $tipe = null,
        ?int $kategoriId = null,
        ?string $dari = null,
        ?string $sampai = null
    ): array {
        $where = [];
        $params = [];

        if ($tipe !== null) {
            $this->validasiTipe($tipe);
            $where[] = 't.tipe = :tipe';
            $params[':tipe'] = $tipe;
        }
        if ($kategoriId !== null) {
            $where[] = 't.kategori_id = :kategori_id';
            $params[':kategori_id'] = $kategoriId;
        }
        if ($dari !== null) {
            $where[] = 't.tanggal >= :dari';
            $params[':dari'] = $this->validasiTanggal($dari);
        }
        if ($sampai !== null) {
            $where[] = 't.tanggal <= :sampai';
            $params[':sampai'] = $this->validasiTanggal($sampai);
        }

        $sql = $this->selectDenganKategori();
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY t.tanggal DESC, t.id DESC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return array_map(
            [self::class, 'toArray'],
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        );
    }

    /**
     * Satu transaksi berdasarkan id, kategori disematkan.
     *
     * @return array<string, mixed>|null null bila tidak ditemukan.
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            $this->selectDenganKategori() . ' WHERE t.id = :id'
        );
        $stmt->execute([':id' => $id]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : self::toArray($row);
    }

    /**
     * Semua transaksi untuk satu kategori, terbaru dulu.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findByKategori(int $kategoriId): array
    {
        return $this->all(kategoriId: $kategoriId);
    }

    /**
     * Semua transaksi dalam satu bulan kalender, terbaru dulu.
     * Dipakai filter per bulan/tahun (Day 13) dan ringkasan
     * bulanan (Day 25).
     *
     * @return array<int, array<string, mixed>>
     */
    public function findByPeriode(int $tahun, int $bulan): array
    {
        if ($bulan < 1 || $bulan > 12) {
            throw new InvalidArgumentException(
                "Bulan harus 1-12, bukan '{$bulan}'."
            );
        }
        if ($tahun < 2000 || $tahun > 2100) {
            throw new InvalidArgumentException(
                "Tahun harus 2000-2100, bukan '{$tahun}'."
            );
        }

        $awal = sprintf('%04d-%02d-01', $tahun, $bulan);
        $akhir = (new DateTimeImmutable($awal))
            ->modify('last day of this month')
            ->format('Y-m-d');

        return $this->all(dari: $awal, sampai: $akhir);
    }

    /**
     * Total nominal untuk satu tipe dalam rentang tanggal opsional.
     * Dipakai perhitungan saldo (Day 14) dan ringkasan (Day 25):
     * saldo = totalByTipe('pemasukan') - totalByTipe('pengeluaran').
     */
    public function totalByTipe(
        string $tipe,
        ?string $dari = null,
        ?string $sampai = null
    ): float {
        $this->validasiTipe($tipe);

        $where = ['tipe = :tipe'];
        $params = [':tipe' => $tipe];
        if ($dari !== null) {
            $where[] = 'tanggal >= :dari';
            $params[':dari'] = $this->validasiTanggal($dari);
        }
        if ($sampai !== null) {
            $where[] = 'tanggal <= :sampai';
            $params[':sampai'] = $this->validasiTanggal($sampai);
        }

        $stmt = $this->pdo->prepare(
            'SELECT COALESCE(SUM(jumlah), 0) FROM transaksi WHERE '
            . implode(' AND ', $where)
        );
        $stmt->execute($params);

        return (float) $stmt->fetchColumn();
    }

    /* ------------------------------------------------------------------ */
    /* Tulis                                                                */
    /* ------------------------------------------------------------------ */

    /**
     * Buat transaksi baru.
     *
     * @param array{kategori_id: int, tipe: string, jumlah: float|int|string, tanggal?: string, deskripsi: string, catatan?: string|null} $data
     * @return int id transaksi yang baru dibuat.
     *
     * @throws InvalidArgumentException bila data tidak valid
     *   (kategori tidak ada, tipe tidak cocok dengan kategori,
     *   jumlah tidak positif/melebihi batas, tanggal di masa
     *   depan, atau deskripsi kosong/terlalu panjang).
     * @throws RuntimeException bila penyimpanan ke database gagal.
     */
    public function create(array $data): int
    {
        $data = $this->validasiData($data);
        $this->validasiKategoriDanTipe($data['kategori_id'], $data['tipe']);

        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO transaksi'
                . ' (kategori_id, tipe, jumlah, tanggal, deskripsi, catatan)'
                . ' VALUES (:kategori_id, :tipe, :jumlah, :tanggal, :deskripsi, :catatan)'
            );
            $stmt->execute([
                ':kategori_id' => $data['kategori_id'],
                ':tipe'        => $data['tipe'],
                ':jumlah'      => $data['jumlah'],
                ':tanggal'     => $data['tanggal'],
                ':deskripsi'   => $data['deskripsi'],
                ':catatan'     => $data['catatan'],
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Gagal menyimpan transaksi: ' . $e->getMessage(), 0, $e);
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Ubah transaksi yang sudah ada. Field yang tidak disertakan
     * dipertahankan dari data lama, lalu seluruhnya divalidasi
     * ulang — termasuk kecocokan tipe dengan kategorinya.
     *
     * @param array{kategori_id?: int, tipe?: string, jumlah?: float|int|string, tanggal?: string, deskripsi?: string, catatan?: string|null} $data
     * @return bool true bila ada baris yang berubah.
     *
     * @throws InvalidArgumentException bila id tidak ada atau
     *   data tidak valid.
     */
    public function update(int $id, array $data): bool
    {
        $lama = $this->findById($id);
        if ($lama === null) {
            throw new InvalidArgumentException("Transaksi id {$id} tidak ditemukan.");
        }

        $gabung = array_merge($lama, $data);
        $gabung['kategori_id'] = (int) $gabung['kategori_id'];
        $data = $this->validasiData($gabung);
        $this->validasiKategoriDanTipe($data['kategori_id'], $data['tipe']);

        try {
            $stmt = $this->pdo->prepare(
                'UPDATE transaksi SET kategori_id = :kategori_id,'
                . ' tipe = :tipe, jumlah = :jumlah, tanggal = :tanggal,'
                . ' deskripsi = :deskripsi, catatan = :catatan'
                . ' WHERE id = :id'
            );
            $stmt->execute([
                ':kategori_id' => $data['kategori_id'],
                ':tipe'        => $data['tipe'],
                ':jumlah'      => $data['jumlah'],
                ':tanggal'     => $data['tanggal'],
                ':deskripsi'   => $data['deskripsi'],
                ':catatan'     => $data['catatan'],
                ':id'          => $id,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException('Gagal mengubah transaksi: ' . $e->getMessage(), 0, $e);
        }

        return $stmt->rowCount() > 0;
    }

    /**
     * Hapus transaksi. Menghapus transaksi tidak memengaruhi
     * kategorinya — hanya kategori yang dipakai transaksi yang
     * dilindungi dari penghapusan, bukan sebaliknya.
     *
     * @return bool true bila ada baris yang terhapus.
     *
     * @throws InvalidArgumentException bila id tidak ada.
     */
    public function delete(int $id): bool
    {
        if ($this->findById($id) === null) {
            throw new InvalidArgumentException("Transaksi id {$id} tidak ditemukan.");
        }

        $stmt = $this->pdo->prepare('DELETE FROM transaksi WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
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
                "Tipe transaksi harus 'pemasukan' atau 'pengeluaran', bukan '{$tipe}'."
            );
        }
    }

    /**
     * Periksa `jumlah` — wajib angka, lebih dari 0, dan tidak
     * melebihi batas DECIMAL(15,2) di skema.
     *
     * @return float jumlah yang sudah dinormalisasi.
     * @throws InvalidArgumentException bila jumlah tidak valid.
     */
    public function validasiJumlah(mixed $jumlah): float
    {
        if ($jumlah === null || $jumlah === '') {
            throw new InvalidArgumentException('Jumlah wajib diisi.');
        }
        if (!is_numeric($jumlah)) {
            throw new InvalidArgumentException(
                "Jumlah harus berupa angka, bukan '{$jumlah}'."
            );
        }

        $jumlah = (float) $jumlah;
        if ($jumlah <= 0) {
            throw new InvalidArgumentException('Jumlah harus lebih dari 0.');
        }
        if ($jumlah > self::MAKSIMAL_JUMLAH) {
            throw new InvalidArgumentException(
                'Jumlah maksimal Rp999.999.999.999,99.'
            );
        }

        return $jumlah;
    }

    /**
     * Periksa `tanggal` — wajib format 'Y-m-d' yang valid dan
     * tidak boleh di masa depan.
     *
     * @return string tanggal yang sudah dinormalisasi 'Y-m-d'.
     * @throws InvalidArgumentException bila tanggal tidak valid.
     */
    public function validasiTanggal(string $tanggal): string
    {
        $tanggal = trim($tanggal);
        $parsed = DateTimeImmutable::createFromFormat('Y-m-d', $tanggal);

        if ($parsed === false || $parsed->format('Y-m-d') !== $tanggal) {
            throw new InvalidArgumentException(
                "Tanggal harus format 'YYYY-MM-DD' yang valid, bukan '{$tanggal}'."
            );
        }
        if ($tanggal > date('Y-m-d')) {
            throw new InvalidArgumentException(
                "Tanggal tidak boleh di masa depan: '{$tanggal}'."
            );
        }

        return $tanggal;
    }

    /**
     * Normalisasi dan validasi data transaksi sebelum disimpan.
     *
     * @param array<string, mixed> $data
     * @return array{kategori_id: int, tipe: string, jumlah: float, tanggal: string, deskripsi: string, catatan: string|null}
     *
     * @throws InvalidArgumentException bila ada field tidak valid.
     */
    private function validasiData(array $data): array
    {
        $kategoriId = (int) ($data['kategori_id'] ?? 0);
        if ($kategoriId <= 0) {
            throw new InvalidArgumentException('Kategori wajib dipilih.');
        }

        $tipe = (string) ($data['tipe'] ?? '');
        $this->validasiTipe($tipe);

        $jumlah = $this->validasiJumlah($data['jumlah'] ?? null);

        // Tanggal kejadian; kosong berarti hari ini.
        $tanggal = $data['tanggal'] ?? '';
        $tanggal = $tanggal === null || $tanggal === ''
            ? date('Y-m-d')
            : $this->validasiTanggal((string) $tanggal);

        $deskripsi = trim((string) ($data['deskripsi'] ?? ''));
        if ($deskripsi === '') {
            throw new InvalidArgumentException('Deskripsi wajib diisi.');
        }
        if (mb_strlen($deskripsi) > self::MAKSIMAL_DESKRIPSI) {
            throw new InvalidArgumentException(
                'Deskripsi maksimal ' . self::MAKSIMAL_DESKRIPSI . ' karakter.'
            );
        }

        $catatan = $data['catatan'] ?? null;
        $catatan = $catatan === null || $catatan === '' ? null : (string) $catatan;

        return [
            'kategori_id' => $kategoriId,
            'tipe'        => $tipe,
            'jumlah'      => $jumlah,
            'tanggal'     => $tanggal,
            'deskripsi'   => $deskripsi,
            'catatan'     => $catatan,
        ];
    }

    /**
     * Pastikan kategori ada dan `tipe` transaksi sama dengan
     * `tipe` kategorinya — aturan dari docs/day-02-struktur-data.md.
     *
     * @throws InvalidArgumentException bila kategori tidak ada
     *   atau tipenya tidak cocok.
     */
    private function validasiKategoriDanTipe(int $kategoriId, string $tipe): void
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, nama, tipe FROM kategori WHERE id = :id'
        );
        $stmt->execute([':id' => $kategoriId]);

        $kategori = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($kategori === false) {
            throw new InvalidArgumentException(
                "Kategori id {$kategoriId} tidak ditemukan."
            );
        }
        if ($kategori['tipe'] !== $tipe) {
            throw new InvalidArgumentException(
                "Tipe transaksi '{$tipe}' tidak cocok dengan kategori "
                . "'{$kategori['nama']}' yang bertipe '{$kategori['tipe']}'."
            );
        }
    }

    /**
     * SELECT dasar: transaksi digabung dengan kategorinya supaya
     * toArray() bisa menyematkan kategori di tiap transaksi.
     */
    private function selectDenganKategori(): string
    {
        return 'SELECT t.id, t.kategori_id, t.tipe, t.jumlah, t.tanggal,'
            . ' t.deskripsi, t.catatan, t.created_at, t.updated_at,'
            . ' k.nama AS kategori_nama, k.tipe AS kategori_tipe,'
            . ' k.ikon AS kategori_ikon, k.warna AS kategori_warna'
            . ' FROM transaksi t'
            . ' JOIN kategori k ON k.id = t.kategori_id';
    }

    /**
     * Bentuk yang sama dengan contoh JSON di
     * docs/day-02-struktur-data.md dan respons API (Minggu 4):
     * kategori disematkan di dalam tiap transaksi.
     *
     * @param array<string, mixed> $row baris dari tabel transaksi
     *   (dengan kolom kategori_* dari selectDenganKategori()).
     * @return array{id: int, kategori_id: int, kategori: array{id: int, nama: string, tipe: string, ikon: string|null, warna: string|null}, tipe: string, jumlah: float, tanggal: string, deskripsi: string, catatan: string|null, created_at: string, updated_at: string}
     */
    public static function toArray(array $row): array
    {
        return [
            'id'          => (int) $row['id'],
            'kategori_id' => (int) $row['kategori_id'],
            'kategori'    => Kategori::toArray([
                'id'    => $row['kategori_id'],
                'nama'  => $row['kategori_nama'] ?? '',
                'tipe'  => $row['kategori_tipe'] ?? $row['tipe'],
                'ikon'  => $row['kategori_ikon'] ?? null,
                'warna' => $row['kategori_warna'] ?? null,
            ]),
            'tipe'       => (string) $row['tipe'],
            'jumlah'     => (float) $row['jumlah'],
            'tanggal'    => (string) $row['tanggal'],
            'deskripsi'  => (string) $row['deskripsi'],
            'catatan'    => $row['catatan'] ?? null,
            'created_at' => (string) $row['created_at'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }
}
