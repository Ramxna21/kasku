/**
 * KasKu — Data Contoh (Seed)
 * Day 5 (21 November 2026)
 *
 * Data contoh transaksi untuk pengembangan: dipakai untuk menguji
 * daftar transaksi (Day 9), filter (Day 12-13), saldo (Day 14),
 * dan export CSV (Day 27) sebelum ada data asli dari pengguna.
 *
 * Aturan yang diikuti (lihat docs/day-02-struktur-data.md):
 * - Kategori dan id-nya sama persis dengan kategori bawaan di
 *   database/schema.sql (id 1-13); `tipe` transaksi selalu sama
 *   dengan `tipe` kategorinya.
 * - `jumlah` selalu positif; arah arus uang ditentukan `tipe`.
 * - `tanggal` format 'YYYY-MM-DD', tidak ada yang di masa depan
 *   (terakhir 21 November 2026, hari file ini dibuat).
 * - Bentuk objek sama dengan contoh JSON di Day 2 dan respons API
 *   (Minggu 4): kategori disematkan di dalam tiap transaksi.
 *
 * Ringkasan data contoh ini (dihitung dari daftar di bawah):
 * - 18 transaksi: 4 pemasukan (Rp4.550.000) dan 14 pengeluaran
 *   (Rp623.500), saldo Rp3.926.500.
 *
 * Data ini HANYA untuk pengembangan lokal — bukan data pengguna.
 * Ambil salinan segar lewat `getTransaksiContoh()` supaya perubahan
 * di UI tidak mengubah seed-nya.
 *
 * ES module tanpa dependensi — cukup di-import:
 *   import { TRANSAKSI_CONTOH, getTransaksiContoh } from './data.js';
 */

/* ------------------------------------------------------------------ */
/* Kategori bawaan                                                      */
/* ------------------------------------------------------------------ */

/**
 * Kategori bawaan KasKu, salinan dari `database/schema.sql`
 * (INSERT INTO kategori ...) dan docs/day-02-struktur-data.md.
 * Dipakai juga oleh model Kategori (Day 6).
 */
export const KATEGORI_DEFAULT = [
  // Pemasukan
  { id: 1, nama: 'Gaji', tipe: 'pemasukan', ikon: '💼', warna: '#22c55e' },
  { id: 2, nama: 'Freelance', tipe: 'pemasukan', ikon: '💻', warna: '#3b82f6' },
  { id: 3, nama: 'Usaha', tipe: 'pemasukan', ikon: '🏪', warna: '#a855f7' },
  { id: 4, nama: 'Hadiah', tipe: 'pemasukan', ikon: '🎁', warna: '#ec4899' },
  { id: 5, nama: 'Lainnya', tipe: 'pemasukan', ikon: '➕', warna: '#64748b' },
  // Pengeluaran
  { id: 6, nama: 'Makanan & Minuman', tipe: 'pengeluaran', ikon: '🍜', warna: '#f59e0b' },
  { id: 7, nama: 'Transportasi', tipe: 'pengeluaran', ikon: '🚌', warna: '#0ea5e9' },
  { id: 8, nama: 'Belanja', tipe: 'pengeluaran', ikon: '🛍️', warna: '#8b5cf6' },
  { id: 9, nama: 'Tagihan', tipe: 'pengeluaran', ikon: '🧾', warna: '#ef4444' },
  { id: 10, nama: 'Hiburan', tipe: 'pengeluaran', ikon: '🎬', warna: '#f97316' },
  { id: 11, nama: 'Kesehatan', tipe: 'pengeluaran', ikon: '💊', warna: '#10b981' },
  { id: 12, nama: 'Pendidikan', tipe: 'pengeluaran', ikon: '📚', warna: '#6366f1' },
  { id: 13, nama: 'Lainnya', tipe: 'pengeluaran', ikon: '➕', warna: '#64748b' },
];

/**
 * Cari kategori bawaan berdasarkan id.
 *
 * @param {number} id - id kategori (1-13).
 * @returns {object|null} kategori, atau null bila tidak ditemukan.
 */
export function getKategoriById(id) {
  return KATEGORI_DEFAULT.find((kategori) => kategori.id === id) || null;
}

/**
 * Salinan kategori bawaan (deep copy) supaya pemakaian di UI
 * tidak bisa mengubah daftar aslinya.
 *
 * @returns {Array<object>} salinan KATEGORI_DEFAULT.
 */
export function getKategoriDefault() {
  return JSON.parse(JSON.stringify(KATEGORI_DEFAULT));
}

/* ------------------------------------------------------------------ */
/* Transaksi contoh                                                     */
/* ------------------------------------------------------------------ */

/**
 * Bangun satu transaksi contoh dengan kategori tersemat,
 * mengikuti bentuk JSON di docs/day-02-struktur-data.md.
 * Dipakai di bawah hanya untuk menyusun TRANSAKSI_CONTOH.
 */
function buatTransaksi(id, kategoriId, jumlah, tanggal, jam, deskripsi, catatan) {
  const kategori = getKategoriById(kategoriId);
  if (!kategori) {
    throw new Error(`buatTransaksi: kategori id ${kategoriId} tidak ada.`);
  }
  const dibuat = `${tanggal}T${jam}:00+07:00`;
  return {
    id,
    kategori_id: kategoriId,
    kategori: { ...kategori },
    tipe: kategori.tipe,
    jumlah,
    tanggal,
    deskripsi,
    catatan: catatan === undefined ? null : catatan,
    created_at: dibuat,
    updated_at: dibuat,
  };
}

/**
 * 18 transaksi contoh, 17-21 November 2026.
 * Dua entri pertama sama dengan contoh JSON di Day 2
 * (makan siang warteg & gaji magang November).
 */
export const TRANSAKSI_CONTOH = [
  buatTransaksi(1, 6, 25000, '2026-11-18', '11:30', 'Makan siang di warteg', 'Nasi + ayam goreng + es teh'),
  buatTransaksi(2, 1, 3500000, '2026-11-17', '09:00', 'Gaji magang bulan November', null),
  buatTransaksi(3, 7, 12000, '2026-11-17', '07:45', 'Ojek online ke kampus', null),
  buatTransaksi(4, 6, 15000, '2026-11-17', '07:00', 'Sarapan nasi uduk', null),
  buatTransaksi(5, 2, 750000, '2026-11-18', '16:20', 'Jasa desain logo warung kopi', 'DP 50%, pelunasan setelah revisi'),
  buatTransaksi(6, 6, 18000, '2026-11-18', '15:10', 'Kopi susu gula aren', null),
  buatTransaksi(7, 6, 32500, '2026-11-19', '19:05', 'Makan malam ayam geprek', 'Level 3 + es teh manis'),
  buatTransaksi(8, 9, 85000, '2026-11-19', '08:15', 'Paket data internet 30 hari', 'Kuota 25 GB'),
  buatTransaksi(9, 8, 149000, '2026-11-19', '13:40', 'Beli kaos polos', 'Warna hitam, ukuran L'),
  buatTransaksi(10, 7, 10000, '2026-11-19', '07:50', 'Parkir motor di kampus', null),
  buatTransaksi(11, 12, 120000, '2026-11-20', '11:25', 'Buku pemrograman bekas', 'JavaScript: The Good Parts'),
  buatTransaksi(12, 6, 22000, '2026-11-20', '07:10', 'Sarapan bubur ayam', null),
  buatTransaksi(13, 10, 45000, '2026-11-20', '20:00', 'Nonton film di bioskop', 'Tiket weekday + popcorn kecil'),
  buatTransaksi(14, 11, 55000, '2026-11-20', '17:30', 'Vitamin dan obat flu', null),
  buatTransaksi(15, 4, 100000, '2026-11-20', '10:05', 'Transfer dari kakak', 'Buat jajan akhir pekan'),
  buatTransaksi(16, 6, 15000, '2026-11-21', '16:40', 'Jajan gorengan sore', 'Tempe + tahu isi + es teh'),
  buatTransaksi(17, 7, 20000, '2026-11-21', '08:00', 'Bensin motor', 'Pertalite 2 liter'),
  buatTransaksi(18, 3, 200000, '2026-11-21', '12:15', 'Keuntungan jualan pulsa minggu ini', null),
];

/**
 * Salinan transaksi contoh (deep copy). Selalu pakai fungsi ini
 * saat memuat seed ke aplikasi — mis. ke localStorage atau state —
 * supaya mengedit/menghapus transaksi tidak merusak seed-nya.
 * Panggil lagi untuk "reset" kembali ke data contoh awal.
 *
 * @returns {Array<object>} salinan TRANSAKSI_CONTOH.
 */
export function getTransaksiContoh() {
  return JSON.parse(JSON.stringify(TRANSAKSI_CONTOH));
}

export default {
  KATEGORI_DEFAULT,
  TRANSAKSI_CONTOH,
  getKategoriById,
  getKategoriDefault,
  getTransaksiContoh,
};
