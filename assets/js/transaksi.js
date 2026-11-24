/**
 * KasKu — Transaksi (Tambah)
 * Day 8 (24 November 2026)
 *
 * Fungsi tambah transaksi di sisi UI: validasi input, lalu
 * memasukkan transaksi baru ke daftar yang sedang dipakai
 * aplikasi. Ini pasangan JavaScript dari model PHP
 * backend/models/Transaksi.php (Day 7) — aturannya sama persis,
 * hanya medianya berbeda (array di memori, bukan tabel MySQL).
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
 * Daftar ditampilkan di Day 9, edit di Day 10, hapus di Day 11;
 * filter di assets/js/filter.js (Day 12-13), saldo di
 * assets/js/saldo.js (Day 14). Data bertahan ke backend lewat
 * backend/controllers/TransaksiController.php (Day 23-24).
 *
 * ES module tanpa dependensi selain format.js dan data.js:
 *   import { tambahTransaksi } from './transaksi.js';
 */

import {
  MAKSIMAL_JUMLAH,
  ZONA_WAKTU,
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
/* Store kecil untuk UI                                                 */
/* ------------------------------------------------------------------ */

/**
 * Store kecil di memori untuk daftar transaksi yang dipakai UI.
 * Dipakai form tambah (Day 18) sampai ada penyimpanan tetap
 * (localStorage / API backend Minggu 4). Isi awal biasanya
 * `getTransaksiContoh()` dari data.js saat pengembangan.
 *
 * @param {Array<object>} [transaksiAwal=[]] isi awal store.
 * @returns {{tambah: Function, semua: Function, cari: Function, jumlah: Function}}
 *
 * @example
 *   import { getTransaksiContoh } from './data.js';
 *   const store = buatStore(getTransaksiContoh());
 *   const baru = store.tambah({
 *     kategori_id: 1, tipe: 'pemasukan', jumlah: 500000,
 *     deskripsi: 'Bonus proyek',
 *   });
 *   store.jumlah(); // 19
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
     * Salinan daftar transaksi saat ini (urut input; pengurutan
     * terbaru-dulu untuk tampilan dikerjakan di Day 9).
     *
     * @returns {Array<object>}
     */
    semua() {
      return [...daftar];
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
  buatStore,
};
