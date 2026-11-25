/**
 * KasKu — Transaksi (Tambah & Tampil)
 * Day 8 (24 November 2026) + Day 9 (25 November 2026)
 *
 * Day 8 — fungsi tambah transaksi di sisi UI: validasi input, lalu
 * memasukkan transaksi baru ke daftar yang sedang dipakai
 * aplikasi. Ini pasangan JavaScript dari model PHP
 * backend/models/Transaksi.php (Day 7) — aturannya sama persis,
 * hanya medianya berbeda (array di memori, bukan tabel MySQL).
 *
 * Day 9 — fungsi tampil daftar transaksi: pengurutan (terbaru
 * dulu), pengelompokan per tanggal dengan label relatif
 * ("Hari ini", "Kemarin", "3 hari lalu"), model baris siap
 * tampil, dan render HTML daftar yang aman dari injeksi
 * (semua teks pengguna di-escape). Dipakai halaman utama
 * (index.html) dan form tambah (Day 18) untuk menampilkan
 * daftar setelah transaksi ditambah.
 *
 * Aturan yang ditegakkan di sini (lihat docs/day-02-struktur-data.md):
 * - `jumlah` wajib diisi, angka, lebih dari 0, maksimal
 *   Rp999.999.999.999,99 (DECIMAL(15,2) di skema).
 * - `tipe` wajib 'pemasukan' atau 'pengeluaran', dan harus sama
 *   dengan `tipe` kategori yang dipilih.
 * - `kategori_id` wajib merujuk ke kategori yang ada
 *   (KATEGORI_DEFAULT dari assets/js/data.js, id 1-13).
 * - `tanggal` wajib tanggal yang valid dan tidak boleh di masa
 *   depan (tanggal kejadian, bukan tanggal input).
 * - `deskripsi` wajib diisi (maks. 255 karakter); `catatan`
 *   opsional.
 *
 * Bentuk transaksi yang dihasilkan sama dengan contoh JSON di
 * Day 2 dan data contoh Day 5: kategori disematkan di dalam
 * tiap transaksi, `jumlah` selalu positif.
 *
 * Dipakai oleh: assets/js/form.js (Day 18, form tambah transaksi).
 * Daftar ditampilkan di bawah ini (Day 9); edit di Day 10, hapus
 * di Day 11; filter di assets/js/filter.js (Day 12-13), saldo di
 * assets/js/saldo.js (Day 14). Data bertahan ke backend lewat
 * backend/controllers/TransaksiController.php (Day 23-24).
 *
 * ES module tanpa dependensi selain format.js dan data.js:
 *   import { tambahTransaksi, renderDaftarTransaksi } from './transaksi.js';
 */

import {
  MAKSIMAL_JUMLAH,
  ZONA_WAKTU,
  formatRupiahDenganTanda,
  formatTanggal,
  formatTanggalRelatif,
  isTanggalMasaDepan,
  isTanggalValid,
  parseRupiah,
  tanggalHariIni,
} from './format.js';
import { KATEGORI_DEFAULT, getKategoriById } from './data.js';

/** Nilai `tipe` yang diizinkan — sama dengan ENUM di schema.sql. */
export const TIPE_PEMASUKAN = 'pemasukan';
export const TIPE_PENGELUARAN = 'pengeluaran';

/** @type {string[]} */
export const TIPE_VALID = [TIPE_PEMASUKAN, TIPE_PENGELUARAN];

/** Batas kolom, mengikuti database/schema.sql dan Day 2. */
export const MAKSIMAL_DESKRIPSI = 255;

/* ------------------------------------------------------------------ */
/* Galat validasi                                                       */
/* ------------------------------------------------------------------ */

/**
 * Galat yang dilempar `tambahTransaksi()` (dan `buatStore().tambah()`)
 * bila input tidak lolos validasi. `errors` berisi satu entri per
 * field yang bermasalah, supaya form (Day 18) bisa menampilkan
 * pesan di samping field yang salah, bukan satu pesan umum.
 *
 * @example
 *   try {
 *     tambahTransaksi(daftar, { kategori_id: 99, jumlah: 0 });
 *   } catch (e) {
 *     if (e instanceof ErrorValidasiTransaksi) {
 *       console.log(e.errors); // [{field:'kategori_id', ...}, ...]
 *     }
 *   }
 */
export class ErrorValidasiTransaksi extends Error {
  /**
   * @param {Array<{field: string, pesan: string}>} errors
   */
  constructor(errors) {
    super(
      'Transaksi tidak valid: ' +
        errors.map((e) => `${e.field} (${e.pesan})`).join('; ')
    );
    this.name = 'ErrorValidasiTransaksi';
    this.errors = errors;
  }
}

/* ------------------------------------------------------------------ */
/* Validasi                                                             */
/* ------------------------------------------------------------------ */

/**
 * Periksa `kategori_id` — wajib merujuk ke kategori yang ada.
 *
 * @param {unknown} kategoriId
 * @param {Array<object>} [kategori=KATEGORI_DEFAULT] daftar kategori
 *   yang dipakai; ganti dengan daftar dari backend bila sudah ada.
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiKategoriId(kategoriId, kategori = KATEGORI_DEFAULT) {
  const id = Number(kategoriId);
  if (!Number.isInteger(id) || id <= 0) {
    return { field: 'kategori_id', pesan: 'Kategori wajib dipilih.' };
  }
  const ditemukan = kategori.some((k) => k.id === id);
  if (!ditemukan) {
    return {
      field: 'kategori_id',
      pesan: `Kategori id ${id} tidak ditemukan.`,
    };
  }
  return null;
}

/**
 * Periksa `tipe` — hanya 'pemasukan' atau 'pengeluaran'.
 *
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiTipe(tipe) {
  if (!TIPE_VALID.includes(tipe)) {
    return {
      field: 'tipe',
      pesan: "Tipe transaksi harus 'pemasukan' atau 'pengeluaran'.",
    };
  }
  return null;
}

/**
 * Periksa kecocokan `tipe` dengan `tipe` kategorinya — aturan
 * Day 2 no. 2, ditegakkan juga di model PHP (Day 7).
 *
 * @returns {{field: string, pesan: string}|null} null bila cocok
 *   (atau bila kategori/tipe-nya sendiri sudah tidak valid —
 *   galat itu dilaporkan oleh validasi masing-masing).
 */
export function validasiKesesuaianTipe(kategoriId, tipe, kategori = KATEGORI_DEFAULT) {
  const galatKategori = validasiKategoriId(kategoriId, kategori);
  const galatTipe = validasiTipe(tipe);
  if (galatKategori !== null || galatTipe !== null) {
    return null;
  }
  const kategoriDipilih = kategori.find((k) => k.id === Number(kategoriId));
  if (kategoriDipilih.tipe !== tipe) {
    return {
      field: 'tipe',
      pesan:
        `Tipe transaksi '${tipe}' tidak cocok dengan kategori ` +
        `'${kategoriDipilih.nama}' yang bertipe '${kategoriDipilih.tipe}'.`,
    };
  }
  return null;
}

/**
 * Ubah input `jumlah` menjadi angka. Menerima angka mentah
 * (mis. 25000) maupun teks dari form (mis. "25.000" atau
 * "Rp25.000") lewat parseRupiah() dari format.js.
 *
 * @param {unknown} jumlah
 * @returns {number|null} angka, atau null bila bukan angka.
 */
export function parseJumlah(jumlah) {
  if (typeof jumlah === 'number') {
    return Number.isFinite(jumlah) ? jumlah : null;
  }
  if (typeof jumlah === 'string') {
    return parseRupiah(jumlah);
  }
  return null;
}

/**
 * Periksa `jumlah` — wajib angka, lebih dari 0, dan tidak
 * melebihi batas DECIMAL(15,2) di skema.
 *
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiJumlah(jumlah) {
  const angka = parseJumlah(jumlah);
  if (angka === null) {
    return { field: 'jumlah', pesan: 'Jumlah wajib diisi dengan angka.' };
  }
  if (angka <= 0) {
    return { field: 'jumlah', pesan: 'Jumlah harus lebih dari 0.' };
  }
  if (angka > MAKSIMAL_JUMLAH) {
    return {
      field: 'jumlah',
      pesan: 'Jumlah maksimal Rp999.999.999.999,99.',
    };
  }
  return null;
}

/**
 * Periksa `tanggal` — wajib format 'YYYY-MM-DD' yang valid dan
 * tidak boleh di masa depan.
 *
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiTanggal(tanggal) {
  if (typeof tanggal !== 'string' || !isTanggalValid(tanggal)) {
    return {
      field: 'tanggal',
      pesan: "Tanggal harus format 'YYYY-MM-DD' yang valid.",
    };
  }
  if (isTanggalMasaDepan(tanggal)) {
    return {
      field: 'tanggal',
      pesan: `Tanggal tidak boleh di masa depan: '${tanggal}'.`,
    };
  }
  return null;
}

/**
 * Periksa `deskripsi` — wajib diisi, maks. 255 karakter.
 *
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiDeskripsi(deskripsi) {
  if (typeof deskripsi !== 'string' || deskripsi.trim() === '') {
    return { field: 'deskripsi', pesan: 'Deskripsi wajib diisi.' };
  }
  if ([...deskripsi.trim()].length > MAKSIMAL_DESKRIPSI) {
    return {
      field: 'deskripsi',
      pesan: `Deskripsi maksimal ${MAKSIMAL_DESKRIPSI} karakter.`,
    };
  }
  return null;
}

/**
 * Periksa `catatan` — opsional; bila diisi harus berupa teks.
 *
 * @returns {{field: string, pesan: string}|null} null bila valid.
 */
export function validasiCatatan(catatan) {
  if (catatan === undefined || catatan === null || catatan === '') {
    return null;
  }
  if (typeof catatan !== 'string') {
    return { field: 'catatan', pesan: 'Catatan harus berupa teks.' };
  }
  return null;
}

/**
 * Jalankan semua validasi di atas untuk satu input transaksi.
 * Tidak melempar — mengembalikan daftar galat (kosong bila valid),
 * supaya form bisa memeriksa dulu tanpa try/catch.
 *
 * Field `tanggal` boleh kosong: artinya hari ini (tanggal
 * kejadian; default kolom di schema.sql).
 *
 * @param {object} data input mentah dari form.
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori yang dipakai.
 * @returns {Array<{field: string, pesan: string}>} daftar galat,
 *   kosong bila semua valid.
 */
export function validasiTransaksi(data, opsi = {}) {
  const kategori = opsi.kategori ?? KATEGORI_DEFAULT;
  const errors = [];

  const galatKategori = validasiKategoriId(data.kategori_id, kategori);
  if (galatKategori !== null) errors.push(galatKategori);

  const galatTipe = validasiTipe(data.tipe);
  if (galatTipe !== null) errors.push(galatTipe);

  const galatCocok = validasiKesesuaianTipe(data.kategori_id, data.tipe, kategori);
  if (galatCocok !== null) errors.push(galatCocok);

  const galatJumlah = validasiJumlah(data.jumlah);
  if (galatJumlah !== null) errors.push(galatJumlah);

  // Tanggal kosong berarti hari ini — hanya divalidasi bila diisi.
  if (data.tanggal !== undefined && data.tanggal !== null && data.tanggal !== '') {
    const galatTanggal = validasiTanggal(data.tanggal);
    if (galatTanggal !== null) errors.push(galatTanggal);
  }

  const galatDeskripsi = validasiDeskripsi(data.deskripsi);
  if (galatDeskripsi !== null) errors.push(galatDeskripsi);

  const galatCatatan = validasiCatatan(data.catatan);
  if (galatCatatan !== null) errors.push(galatCatatan);

  return errors;
}

/* ------------------------------------------------------------------ */
/* Normalisasi & pembuatan                                              */
/* ------------------------------------------------------------------ */

/**
 * Normalisasi input yang sudah lolos validasi ke bentuk
 * transaksi yang disimpan: angka dibulatkan ke 2 desimal
 * (DECIMAL(15,2)), teks di-trim, tanggal kosong menjadi hari
 * ini, catatan kosong menjadi null.
 *
 * @param {object} data input yang sudah valid.
 * @returns {{kategori_id: number, tipe: string, jumlah: number, tanggal: string, deskripsi: string, catatan: string|null}}
 */
export function normalisasiTransaksi(data) {
  const jumlah = Math.round(parseJumlah(data.jumlah) * 100) / 100;
  const tanggal =
    data.tanggal === undefined || data.tanggal === null || data.tanggal === ''
      ? tanggalHariIni()
      : data.tanggal;

  return {
    kategori_id: Number(data.kategori_id),
    tipe: data.tipe,
    jumlah,
    tanggal,
    deskripsi: data.deskripsi.trim(),
    catatan:
      data.catatan === undefined || data.catatan === null || data.catatan === ''
        ? null
        : data.catatan,
  };
}

/**
 * Waktu sekarang dalam format ISO dengan offset WIB
 * ('YYYY-MM-DDTHH:mm:ss+07:00'), sama dengan contoh JSON di
 * Day 2 — dipakai untuk `created_at`/`updated_at`.
 *
 * @returns {string} contoh: "2026-11-24T09:50:00+07:00".
 */
export function waktuSekarangWIB() {
  const sekarang = new Date();
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_WAKTU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(sekarang);

  const ambil = (jenis) => bagian.find((b) => b.type === jenis).value;
  return (
    `${ambil('year')}-${ambil('month')}-${ambil('day')}` +
    `T${ambil('hour')}:${ambil('minute')}:${ambil('second')}+07:00`
  );
}

/**
 * Id berikutnya untuk daftar transaksi: id terbesar yang ada
 * ditambah 1 (data contoh Day 5 berakhir di id 18, jadi
 * transaksi baru pertama mendapat id 19).
 *
 * @param {Array<{id: number}>} daftar
 * @returns {number}
 */
export function idBerikutnya(daftar) {
  return daftar.reduce((maks, t) => Math.max(maks, t.id || 0), 0) + 1;
}

/**
 * Tambah satu transaksi ke daftar.
 *
 * Daftar lama TIDAK diubah — dikembalikan daftar baru dengan
 * transaksi tambahan di akhir (pola immutable, memudahkan
 * render ulang daftar di Day 9 dan undo nanti).
 *
 * @param {Array<object>} daftar daftar transaksi yang sudah ada.
 * @param {object} data input mentah:
 *   {kategori_id, tipe, jumlah, tanggal?, deskripsi, catatan?}.
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori yang dipakai.
 * @returns {{daftar: Array<object>, transaksi: object}} daftar baru
 *   dan transaksi yang baru dibuat (kategori tersemat, bentuk
 *   sama dengan contoh JSON Day 2).
 * @throws {ErrorValidasiTransaksi} bila ada field tidak valid.
 *
 * @example
 *   const { daftar, transaksi } = tambahTransaksi(daftarLama, {
 *     kategori_id: 6,
 *     tipe: 'pengeluaran',
 *     jumlah: '25.000',
 *     tanggal: '2026-11-24',
 *     deskripsi: 'Makan siang di warteg',
 *   });
 *   // transaksi.id === 19 (bila daftarLama = TRANSAKSI_CONTOH)
 *   // transaksi.jumlah === 25000
 *   // transaksi.kategori.nama === 'Makanan & Minuman'
 */
export function tambahTransaksi(daftar, data, opsi = {}) {
  const kategori = opsi.kategori ?? KATEGORI_DEFAULT;
  const errors = validasiTransaksi(data, { kategori });
  if (errors.length > 0) {
    throw new ErrorValidasiTransaksi(errors);
  }

  const normal = normalisasiTransaksi(data);
  const kategoriDipilih = getKategoriById(normal.kategori_id);
  const sekarang = waktuSekarangWIB();

  const transaksi = {
    id: idBerikutnya(daftar),
    kategori_id: normal.kategori_id,
    kategori: { ...kategoriDipilih },
    tipe: normal.tipe,
    jumlah: normal.jumlah,
    tanggal: normal.tanggal,
    deskripsi: normal.deskripsi,
    catatan: normal.catatan,
    created_at: sekarang,
    updated_at: sekarang,
  };

  return { daftar: [...daftar, transaksi], transaksi };
}

/* ------------------------------------------------------------------ */
/* Tampil daftar transaksi (Day 9)                                      */
/* ------------------------------------------------------------------ */

/** Urutan tampilan yang diizinkan untuk `urutkanTransaksi()`. */
export const URUTAN_VALID = ['terbaru', 'terlama', 'terbesar', 'terkecil'];

/**
 * Urutkan daftar transaksi untuk ditampilkan.
 *
 * Daftar lama TIDAK diubah — dikembalikan salinan yang sudah
 * diurutkan (pola immutable yang sama dengan `tambahTransaksi()`).
 *
 * - 'terbaru' (default): tanggal terbaru dulu; tanggal sama
 *   diurutkan id terbesar dulu (yang terakhir ditambah di atas).
 * - 'terlama': tanggal terlama dulu; tanggal sama diurutkan
 *   id terkecil dulu.
 * - 'terbesar': jumlah terbesar dulu; seri diurutkan tanggal
 *   terbaru dulu, lalu id terbesar dulu.
 * - 'terkecil': jumlah terkecil dulu; seri sama seperti 'terbesar'.
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi]
 * @param {'terbaru'|'terlama'|'terbesar'|'terkecil'} [opsi.urutan='terbaru']
 * @returns {Array<object>} salinan daftar yang sudah diurutkan.
 * @throws {TypeError} bila `opsi.urutan` tidak dikenal.
 *
 * @example
 *   urutkanTransaksi(TRANSAKSI_CONTOH)[0].tanggal; // '2026-11-21'
 *   urutkanTransaksi(TRANSAKSI_CONTOH, { urutan: 'terbesar' })[0].jumlah;
 *   // 3500000 (Gaji Bulanan)
 */
export function urutkanTransaksi(daftar, opsi = {}) {
  const urutan = opsi.urutan ?? 'terbaru';
  if (!URUTAN_VALID.includes(urutan)) {
    throw new TypeError(
      `urutkanTransaksi: urutan harus salah satu dari ${URUTAN_VALID.join(', ')}.`,
    );
  }

  const salinan = [...daftar];
  switch (urutan) {
    case 'terbaru':
      return salinan.sort(
        (a, b) =>
          b.tanggal.localeCompare(a.tanggal) || b.id - a.id,
      );
    case 'terlama':
      return salinan.sort(
        (a, b) =>
          a.tanggal.localeCompare(b.tanggal) || a.id - b.id,
      );
    case 'terbesar':
      return salinan.sort(
        (a, b) =>
          b.jumlah - a.jumlah ||
          b.tanggal.localeCompare(a.tanggal) ||
          b.id - a.id,
      );
    case 'terkecil':
      return salinan.sort(
        (a, b) =>
          a.jumlah - b.jumlah ||
          b.tanggal.localeCompare(a.tanggal) ||
          b.id - a.id,
      );
    default:
      return salinan;
  }
}

/**
 * Kelompokkan transaksi per tanggal untuk tampilan daftar
 * (satu judul tanggal, lalu transaksi hari itu di bawahnya).
 * Kelompok diurutkan tanggal terbaru dulu; isi tiap kelompok
 * diurutkan id terbesar dulu (konsisten dengan 'terbaru').
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi]
 * @param {string} [opsi.acuan] tanggal pembanding 'YYYY-MM-DD'
 *   untuk label relatif (default: hari ini; dipakai pengujian).
 * @returns {Array<{tanggal: string, label: string, transaksi: Array<object>}>}
 *   contoh label: "Hari ini", "Kemarin", "3 hari lalu",
 *   "18 November 2026" (di luar seminggu, lihat format.js).
 *
 * @example
 *   kelompokkanPerTanggal(TRANSAKSI_CONTOH)[0];
 *   // { tanggal: '2026-11-21', label: '...', transaksi: [...] }
 */
export function kelompokkanPerTanggal(daftar, opsi = {}) {
  const terurut = urutkanTransaksi(daftar, { urutan: 'terbaru' });
  const kelompok = [];

  for (const transaksi of terurut) {
    const terakhir = kelompok[kelompok.length - 1];
    if (terakhir && terakhir.tanggal === transaksi.tanggal) {
      terakhir.transaksi.push(transaksi);
      continue;
    }
    kelompok.push({
      tanggal: transaksi.tanggal,
      label: formatTanggalRelatif(transaksi.tanggal, opsi.acuan),
      transaksi: [transaksi],
    });
  }

  return kelompok;
}

/**
 * Ubah satu transaksi menjadi model baris siap tampil — semua
 * teks sudah diformat (Rupiah bertanda +/-, tanggal Indonesia,
 * label relatif), jadi template HTML tinggal menempelkannya.
 * Kategori diambil dari yang tersemat di transaksi; bila tidak
 * ada, dicari dari KATEGORI_DEFAULT berdasarkan `kategori_id`.
 *
 * @param {object} transaksi
 * @param {object} [opsi]
 * @param {string} [opsi.acuan] tanggal pembanding untuk label relatif.
 * @returns {{id: number, tanggal: string, tanggalTampil: string, tanggalRelatif: string, deskripsi: string, catatan: string|null, kategoriNama: string, kategoriIkon: string, kategoriWarna: string, tipe: string, jumlah: number, jumlahTeks: string}}
 *
 * @example
 *   barisTransaksi(TRANSAKSI_CONTOH[0]);
 *   // { id: 1, tanggalTampil: '17 November 2026',
 *   //   tanggalRelatif: '...', kategoriNama: 'Gaji',
 *   //   jumlahTeks: '+Rp 3.500.000', ... }
 */
export function barisTransaksi(transaksi, opsi = {}) {
  const kategori =
    transaksi.kategori || getKategoriById(transaksi.kategori_id) || {};

  return {
    id: transaksi.id,
    tanggal: transaksi.tanggal,
    tanggalTampil: formatTanggal(transaksi.tanggal),
    tanggalRelatif: formatTanggalRelatif(transaksi.tanggal, opsi.acuan),
    deskripsi: transaksi.deskripsi,
    catatan: transaksi.catatan ?? null,
    kategoriNama: kategori.nama ?? 'Tanpa kategori',
    kategoriIkon: kategori.ikon ?? '',
    kategoriWarna: kategori.warna ?? '#9ca3af',
    tipe: transaksi.tipe,
    jumlah: transaksi.jumlah,
    jumlahTeks: formatRupiahDenganTanda(transaksi.jumlah, transaksi.tipe),
  };
}

/**
 * Daftar baris siap tampil dari satu daftar transaksi:
 * diurutkan lalu diubah ke model baris. Ini jalan pintas yang
 * dipakai halaman utama — setara dengan
 * `urutkanTransaksi(daftar, opsi).map((t) => barisTransaksi(t, opsi))`.
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi] diteruskan ke `urutkanTransaksi()` dan
 *   `barisTransaksi()` (`urutan`, `acuan`).
 * @returns {Array<object>}
 */
export function daftarBaris(daftar, opsi = {}) {
  return urutkanTransaksi(daftar, opsi).map((t) => barisTransaksi(t, opsi));
}

/**
 * Ringkasan hitungan untuk daftar — dipakai judul/penanda
 * kosong di atas daftar. Sengaja hanya hitungan, bukan total
 * uang: total pemasukan/pengeluaran/saldo dihitung di
 * assets/js/saldo.js (Day 14).
 *
 * @param {Array<object>} daftar
 * @returns {{total: number, pemasukan: number, pengeluaran: number}}
 */
export function ringkasanDaftar(daftar) {
  return {
    total: daftar.length,
    pemasukan: daftar.filter((t) => t.tipe === 'pemasukan').length,
    pengeluaran: daftar.filter((t) => t.tipe === 'pengeluaran').length,
  };
}

/**
 * Ambil satu halaman dari daftar (sudah diurutkan terbaru dulu)
 * untuk tampilan berhalaman. Halaman di luar jangkauan
 * dikembalikan kosong — bukan galat — supaya UI tinggal
 * menampilkan keadaan kosong.
 *
 * @param {Array<object>} daftar
 * @param {number} [halaman=1] nomor halaman, mulai dari 1.
 * @param {number} [perHalaman=10] jumlah baris per halaman.
 * @returns {{halaman: number, perHalaman: number, total: number, totalHalaman: number, data: Array<object>}}
 */
export function halamanDaftar(daftar, halaman = 1, perHalaman = 10) {
  const terurut = urutkanTransaksi(daftar, { urutan: 'terbaru' });
  const halamanAman = Math.max(1, Math.floor(halaman) || 1);
  const perHalamanAman = Math.max(1, Math.floor(perHalaman) || 10);
  const totalHalaman = Math.max(1, Math.ceil(terurut.length / perHalamanAman));

  return {
    halaman: halamanAman,
    perHalaman: perHalamanAman,
    total: terurut.length,
    totalHalaman,
    data: terurut.slice(
      (halamanAman - 1) * perHalamanAman,
      halamanAman * perHalamanAman,
    ),
  };
}

/**
 * Escape teks pengguna supaya aman disisipkan ke HTML
 * (deskripsi dan catatan diketik bebas — jangan sampai
 * `<script>` di dalamnya ikut dijalankan browser).
 *
 * @param {unknown} teks
 * @returns {string}
 */
export function escapeHtml(teks) {
  return String(teks ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render satu transaksi menjadi satu baris daftar (`<li>`).
 * Kelas `transaksi-item--pemasukan` / `--pengeluaran` dipakai
 * style.css (Day 15-17) untuk warna jumlahnya.
 *
 * @param {object} transaksi
 * @param {object} [opsi] diteruskan ke `barisTransaksi()`.
 * @returns {string} HTML satu `<li>`, tanpa pembungkus `<ul>`.
 */
export function renderBarisTransaksi(transaksi, opsi = {}) {
  const baris = barisTransaksi(transaksi, opsi);

  const catatan = baris.catatan
    ? `<p class="transaksi-item__catatan">${escapeHtml(baris.catatan)}</p>`
    : '';

  return (
    `<li class="transaksi-item transaksi-item--${baris.tipe}" ` +
    `data-id="${baris.id}">` +
    `<span class="transaksi-item__ikon" style="background-color: ` +
    `${escapeHtml(baris.kategoriWarna)}">${escapeHtml(baris.kategoriIkon)}</span>` +
    `<span class="transaksi-item__info">` +
    `<span class="transaksi-item__deskripsi">${escapeHtml(baris.deskripsi)}</span>` +
    `<span class="transaksi-item__meta">${escapeHtml(baris.kategoriNama)} &middot; ` +
    `${escapeHtml(baris.tanggalRelatif)}</span>` +
    `${catatan}` +
    `</span>` +
    `<span class="transaksi-item__jumlah">${escapeHtml(baris.jumlahTeks)}</span>` +
    `</li>`
  );
}

/**
 * Render seluruh daftar transaksi menjadi HTML, dikelompokkan
 * per tanggal dengan judul tanggal relatif ("Hari ini",
 * "Kemarin", ...). Daftar kosong menghasilkan pesan keadaan
 * kosong, bukan daftar kosong tanpa penjelasan.
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi]
 * @param {string} [opsi.acuan] tanggal pembanding untuk label relatif.
 * @param {string} [opsi.pesanKosong='Belum ada transaksi. Tambahkan transaksi pertama Anda.']
 * @returns {string} HTML `<div class="daftar-transaksi">...</div>`.
 *
 * @example
 *   document.getElementById('daftar-transaksi').innerHTML =
 *     renderDaftarTransaksi(store.semua());
 */
export function renderDaftarTransaksi(daftar, opsi = {}) {
  if (!Array.isArray(daftar) || daftar.length === 0) {
    const pesan =
      opsi.pesanKosong ??
      'Belum ada transaksi. Tambahkan transaksi pertama Anda.';
    return (
      `<div class="daftar-transaksi daftar-transaksi--kosong">` +
      `<p>${escapeHtml(pesan)}</p></div>`
    );
  }

  const kelompok = kelompokkanPerTanggal(daftar, opsi);
  const bagian = kelompok
    .map((k) => {
      const baris = k.transaksi
        .map((t) => renderBarisTransaksi(t, opsi))
        .join('');
      return (
        `<section class="kelompok-tanggal">` +
        `<h3 class="kelompok-tanggal__judul">${escapeHtml(k.label)} ` +
        `<span class="kelompok-tanggal__tanggal">${escapeHtml(formatTanggal(k.tanggal))}</span></h3>` +
        `<ul class="kelompok-tanggal__daftar">${baris}</ul>` +
        `</section>`
      );
    })
    .join('');

  return `<div class="daftar-transaksi">${bagian}</div>`;
}

/* ------------------------------------------------------------------ */
/* Store kecil untuk UI                                                 */
/* ------------------------------------------------------------------ */

/**
 * Store kecil di memori untuk daftar transaksi yang dipakai UI.
 * Dipakai form tambah (Day 18) sampai ada penyimpanan tetap
 * (localStorage / API backend Minggu 4). Isi awal biasanya
 * `getTransaksiContoh()` dari data.js saat pengembangan.
 *
 * @param {Array<object>} [transaksiAwal=[]] isi awal store.
 * @returns {{tambah: Function, semua: Function, cari: Function, jumlah: Function, tampilkan: Function}}
 *
 * @example
 *   import { getTransaksiContoh } from './data.js';
 *   const store = buatStore(getTransaksiContoh());
 *   const baru = store.tambah({
 *     kategori_id: 1, tipe: 'pemasukan', jumlah: 500000,
 *     deskripsi: 'Bonus proyek',
 *   });
 *   store.jumlah(); // 19
 *   store.tampilkan()[0].deskripsi; // 'Bonus proyek' (terbaru dulu)
 */
export function buatStore(transaksiAwal = []) {
  let daftar = [...transaksiAwal];

  return {
    /**
     * Tambah transaksi baru ke store.
     * @returns {object} transaksi yang baru dibuat.
     * @throws {ErrorValidasiTransaksi} bila input tidak valid.
     */
    tambah(data, opsi = {}) {
      const hasil = tambahTransaksi(daftar, data, opsi);
      daftar = hasil.daftar;
      return hasil.transaksi;
    },

    /**
     * Salinan daftar transaksi saat ini (urut input).
     *
     * @returns {Array<object>}
     */
    semua() {
      return [...daftar];
    },

    /**
     * Daftar transaksi siap tampil: diurutkan terbaru dulu
     * (atau sesuai `opsi.urutan`) lalu diubah ke model baris
     * (Day 9 — lihat `daftarBaris()`).
     *
     * @param {object} [opsi] diteruskan ke `daftarBaris()`.
     * @returns {Array<object>}
     */
    tampilkan(opsi = {}) {
      return daftarBaris(daftar, opsi);
    },

    /**
     * Satu transaksi berdasarkan id.
     *
     * @param {number} id
     * @returns {object|null}
     */
    cari(id) {
      return daftar.find((t) => t.id === id) || null;
    },

    /** Jumlah transaksi di store. */
    jumlah() {
      return daftar.length;
    },
  };
}

export default {
  TIPE_PEMASUKAN,
  TIPE_PENGELUARAN,
  TIPE_VALID,
  MAKSIMAL_DESKRIPSI,
  URUTAN_VALID,
  ErrorValidasiTransaksi,
  validasiKategoriId,
  validasiTipe,
  validasiKesesuaianTipe,
  parseJumlah,
  validasiJumlah,
  validasiTanggal,
  validasiDeskripsi,
  validasiCatatan,
  validasiTransaksi,
  normalisasiTransaksi,
  waktuSekarangWIB,
  idBerikutnya,
  tambahTransaksi,
  urutkanTransaksi,
  kelompokkanPerTanggal,
  barisTransaksi,
  daftarBaris,
  ringkasanDaftar,
  halamanDaftar,
  escapeHtml,
  renderBarisTransaksi,
  renderDaftarTransaksi,
  buatStore,
};
