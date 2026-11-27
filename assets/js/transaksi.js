/**
 * KasKu — Transaksi (Tambah, Tampil, Edit & Hapus)
 * Day 8 (24 November 2026) + Day 9 (25 November 2026) +
 * Day 10 (26 November 2026) + Day 11 (27 November 2026)
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
 * Day 10 — fungsi edit transaksi: ubah sebagian field transaksi
 * yang sudah ada (field yang tidak disertakan dipertahankan),
 * lalu gabungannya divalidasi ulang seluruhnya — termasuk
 * kecocokan tipe dengan kategori barunya. `id` dan
 * `created_at` dipertahankan; `updated_at` diperbarui hanya
 * bila benar-benar ada yang berubah. Id yang tidak ditemukan
 * melempar ErrorTransaksiTidakDitemukan. Ini pasangan
 * JavaScript dari Transaksi::update() di model PHP (Day 7).
 *
 * Day 11 — fungsi hapus transaksi + konfirmasi: transaksi hanya
 * dihapus setelah pengguna mengonfirmasi (pesan konfirmasi
 * menyebut deskripsi, jumlah, kategori, dan tanggalnya, supaya
 * tidak salah hapus). Pembatalan tidak mengubah daftar sama
 * sekali; penghapusan yang berhasil mengembalikan transaksi
 * terhapus beserta indeksnya, sehingga UI bisa menawarkan
 * "Urungkan" lewat `pulihkanTransaksi()`. Ini pasangan
 * JavaScript dari Transaksi::delete() di model PHP (Day 7) —
 * menghapus transaksi tidak memengaruhi kategorinya.
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
 * Dipakai oleh: assets/js/form.js (Day 18, form tambah & edit
 * transaksi). Daftar ditampilkan di bawah ini (Day 9), diedit
 * di Day 10, dan dihapus di Day 11; filter di
 * assets/js/filter.js (Day 12-13), saldo di assets/js/saldo.js
 * (Day 14). Data bertahan ke backend lewat
 * backend/controllers/TransaksiController.php (Day 23-24).
 *
 * ES module tanpa dependensi selain format.js dan data.js:
 *   import { tambahTransaksi, editTransaksi, hapusTransaksi, renderDaftarTransaksi } from './transaksi.js';
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
 * Galat yang dilempar `tambahTransaksi()` dan `editTransaksi()`
 * (serta `buatStore().tambah()` / `.edit()`) bila input tidak
 * lolos validasi. `errors` berisi satu entri per
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
/* Edit transaksi (Day 10)                                              */
/* ------------------------------------------------------------------ */

/**
 * Galat yang dilempar `editTransaksi()` dan `hapusTransaksi()`
 * (serta `buatStore().edit()` / `.hapus()`) bila id yang mau
 * diubah/dihapus tidak ada di daftar. Dibedakan dari
 * `ErrorValidasiTransaksi` karena penyebabnya bukan isian form,
 * melainkan transaksi yang sudah tidak ada — mis. daftar sudah
 * berubah sejak barisnya ditampilkan. Pasangan JavaScript dari
 * InvalidArgumentException "Transaksi id ... tidak ditemukan"
 * di model PHP (Day 7).
 */
export class ErrorTransaksiTidakDitemukan extends Error {
  /**
   * @param {unknown} id id yang dicari.
   */
  constructor(id) {
    super(`Transaksi id ${id} tidak ditemukan.`);
    this.name = 'ErrorTransaksiTidakDitemukan';
    this.id = id;
  }
}

/**
 * Cari satu transaksi berdasarkan id.
 *
 * Id boleh berupa teks (mis. dari atribut `data-id` baris
 * daftar) — diubah ke angka dulu sebelum dicocokkan.
 *
 * @param {Array<object>} daftar
 * @param {number|string} id
 * @returns {object|null} transaksi, atau null bila tidak ada
 *   (termasuk bila id bukan bilangan bulat positif).
 */
export function cariTransaksi(daftar, id) {
  const idAngka = Number(id);
  if (!Number.isInteger(idAngka) || idAngka <= 0) {
    return null;
  }
  return daftar.find((t) => t.id === idAngka) || null;
}

/**
 * Siapkan isian form edit dari transaksi yang sudah ada —
 * kebalikan arah dari `normalisasiTransaksi()`: `catatan` null
 * menjadi teks kosong supaya field form tidak menampilkan
 * "null". Dipakai form edit (Day 18) saat pengguna menekan
 * tombol edit pada satu baris daftar.
 *
 * @param {object} transaksi
 * @returns {{kategori_id: number, tipe: string, jumlah: number, tanggal: string, deskripsi: string, catatan: string}}
 */
export function siapkanDataEdit(transaksi) {
  return {
    kategori_id: transaksi.kategori_id,
    tipe: transaksi.tipe,
    jumlah: transaksi.jumlah,
    tanggal: transaksi.tanggal,
    deskripsi: transaksi.deskripsi,
    catatan: transaksi.catatan ?? '',
  };
}

/**
 * Ubah satu transaksi yang sudah ada di daftar.
 *
 * Pola yang sama dengan `Transaksi::update()` di model PHP
 * (Day 7): field yang tidak disertakan di `data` dipertahankan
 * dari transaksi lama, lalu gabungannya divalidasi ulang
 * seluruhnya — termasuk kecocokan `tipe` dengan kategori
 * barunya. Jadi mengganti kategori saja ke kategori bertipe
 * lain akan ditolak sampai `tipe`-nya ikut diganti.
 *
 * Hanya enam field isian yang boleh diubah (kategori_id, tipe,
 * jumlah, tanggal, deskripsi, catatan); `id` dan `created_at`
 * selalu dipertahankan, `updated_at` diperbarui. Mengosongkan
 * `catatan` ('' atau null) menghapus catatan; mengosongkan
 * `tanggal` berarti hari ini, sama seperti saat menambah.
 *
 * Daftar lama TIDAK diubah — dikembalikan daftar baru dengan
 * transaksi hasil edit di posisi yang sama. Bila hasil edit
 * ternyata sama persis dengan data lama, tidak ada yang
 * berubah: daftar asal dikembalikan apa adanya,
 * `berubah: false`, dan `updated_at` tidak disentuh (sama
 * seperti UPDATE MySQL yang tidak mengubah baris apa pun).
 *
 * @param {Array<object>} daftar daftar transaksi yang sudah ada.
 * @param {number|string} id id transaksi yang diubah.
 * @param {object} [data] field yang diubah; field lain
 *   dipertahankan dari transaksi lama.
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori yang dipakai.
 * @returns {{daftar: Array<object>, transaksi: object, sebelumnya: object, berubah: boolean}}
 *   daftar baru, transaksi hasil edit, transaksi sebelum edit
 *   (untuk pesan "diubah dari ..." / undo), dan penanda apakah
 *   ada field yang benar-benar berubah.
 * @throws {ErrorTransaksiTidakDitemukan} bila id tidak ada di daftar.
 * @throws {ErrorValidasiTransaksi} bila gabungan data tidak valid.
 *
 * @example
 *   const { daftar, transaksi, berubah } = editTransaksi(daftarLama, 1, {
 *     jumlah: '30.000',
 *   });
 *   // transaksi.jumlah === 30000, field lain sama dengan semula
 *   // berubah === true; daftarLama[0].jumlah tetap 25000
 */
export function editTransaksi(daftar, id, data = {}, opsi = {}) {
  const lama = cariTransaksi(daftar, id);
  if (lama === null) {
    throw new ErrorTransaksiTidakDitemukan(id);
  }

  const kategori = opsi.kategori ?? KATEGORI_DEFAULT;
  const input = data ?? {};

  // Gabungkan: field yang disertakan (bukan undefined) menimpa
  // data lama; field di luar daftar ini diabaikan.
  const gabungan = {
    kategori_id:
      input.kategori_id !== undefined ? input.kategori_id : lama.kategori_id,
    tipe: input.tipe !== undefined ? input.tipe : lama.tipe,
    jumlah: input.jumlah !== undefined ? input.jumlah : lama.jumlah,
    tanggal: input.tanggal !== undefined ? input.tanggal : lama.tanggal,
    deskripsi:
      input.deskripsi !== undefined ? input.deskripsi : lama.deskripsi,
    catatan: input.catatan !== undefined ? input.catatan : lama.catatan,
  };

  const errors = validasiTransaksi(gabungan, { kategori });
  if (errors.length > 0) {
    throw new ErrorValidasiTransaksi(errors);
  }

  const normal = normalisasiTransaksi(gabungan);

  const berubah =
    normal.kategori_id !== lama.kategori_id ||
    normal.tipe !== lama.tipe ||
    normal.jumlah !== lama.jumlah ||
    normal.tanggal !== lama.tanggal ||
    normal.deskripsi !== lama.deskripsi ||
    normal.catatan !== (lama.catatan ?? null);

  if (!berubah) {
    return { daftar, transaksi: lama, sebelumnya: lama, berubah: false };
  }

  const kategoriDipilih =
    kategori.find((k) => k.id === normal.kategori_id) ??
    getKategoriById(normal.kategori_id);

  const transaksi = {
    ...lama,
    kategori_id: normal.kategori_id,
    kategori: { ...kategoriDipilih },
    tipe: normal.tipe,
    jumlah: normal.jumlah,
    tanggal: normal.tanggal,
    deskripsi: normal.deskripsi,
    catatan: normal.catatan,
    updated_at: waktuSekarangWIB(),
  };

  return {
    daftar: daftar.map((t) => (t.id === lama.id ? transaksi : t)),
    transaksi,
    sebelumnya: lama,
    berubah: true,
  };
}


/* ------------------------------------------------------------------ */
/* Hapus transaksi (Day 11)                                             */
/* ------------------------------------------------------------------ */

/**
 * Pesan konfirmasi sebelum satu transaksi dihapus. Menyebut
 * deskripsi, jumlah bertanda, kategori, dan tanggalnya supaya
 * pengguna yakin transaksi yang benar yang akan hilang —
 * "Hapus transaksi ini?" saja terlalu mudah salah klik saat
 * daftarnya panjang.
 *
 * @param {object} transaksi transaksi yang akan dihapus.
 * @returns {string} contoh:
 *   'Hapus "Makan siang di warteg" (-Rp25.000 · Makanan &
 *   Minuman · 24 November 2026)? Transaksi yang dihapus tidak
 *   dapat dikembalikan.'
 */
export function pesanKonfirmasiHapus(transaksi) {
  const kategoriNama = transaksi.kategori?.nama ?? 'Tanpa kategori';
  return (
    `Hapus "${transaksi.deskripsi}" ` +
    `(${formatRupiahDenganTanda(transaksi.jumlah, transaksi.tipe)} · ` +
    `${kategoriNama} · ${formatTanggal(transaksi.tanggal)})? ` +
    'Transaksi yang dihapus tidak dapat dikembalikan.'
  );
}

/**
 * Siapkan data untuk dialog konfirmasi hapus: transaksi yang
 * dituju dan pesan siap tampil. Dipakai UI (Day 18) saat
 * pengguna menekan tombol hapus pada satu baris daftar —
 * dialog ditampilkan dulu, penghapusan baru dijalankan lewat
 * `hapusTransaksi()` setelah pengguna menyetujui.
 *
 * @param {Array<object>} daftar
 * @param {number|string} id id transaksi yang akan dihapus
 *   (boleh teks, mis. dari atribut `data-hapus-id`).
 * @returns {{transaksi: object, pesan: string}}
 * @throws {ErrorTransaksiTidakDitemukan} bila id tidak ada di daftar.
 */
export function siapkanKonfirmasiHapus(daftar, id) {
  const transaksi = cariTransaksi(daftar, id);
  if (transaksi === null) {
    throw new ErrorTransaksiTidakDitemukan(id);
  }
  return { transaksi, pesan: pesanKonfirmasiHapus(transaksi) };
}

/**
 * Hapus satu transaksi dari daftar, setelah konfirmasi.
 *
 * Penghapusan bersifat merusak, jadi fungsi ini tidak pernah
 * menghapus diam-diam: transaksi hanya dihapus bila
 * `opsi.konfirmasi` bernilai `true`, atau berupa fungsi yang
 * mengembalikan `true` saat dipanggil dengan
 * `(transaksi, pesan)` — pola terakhir cocok untuk
 * `window.confirm` maupun dialog buatan sendiri di UI, dan
 * mudah diuji tanpa browser. Tanpa konfirmasi (atau fungsi
 * konfirmasi mengembalikan `false`), daftar asal dikembalikan
 * apa adanya dengan `dibatalkan: true`.
 *
 * Daftar lama TIDAK diubah — dikembalikan daftar baru tanpa
 * transaksi tersebut (pola immutable yang sama dengan
 * `tambahTransaksi()` / `editTransaksi()`). Transaksi yang
 * terhapus dan indeks asalnya ikut dikembalikan supaya UI
 * bisa menawarkan "Urungkan" lewat `pulihkanTransaksi()`.
 * Menghapus transaksi tidak memengaruhi kategorinya — sama
 * seperti `Transaksi::delete()` di model PHP (Day 7), hanya
 * kategori yang dipakai transaksi yang dilindungi dari
 * penghapusan, bukan sebaliknya.
 *
 * @param {Array<object>} daftar daftar transaksi yang sudah ada.
 * @param {number|string} id id transaksi yang dihapus.
 * @param {object} [opsi]
 * @param {boolean|Function} [opsi.konfirmasi] `true`, atau
 *   fungsi `(transaksi, pesan) => boolean`. Tanpa ini
 *   penghapusan dibatalkan.
 * @returns {{daftar: Array<object>, terhapus: object|null, indeks: number, dibatalkan: boolean}}
 *   daftar baru, transaksi yang terhapus (null bila dibatalkan),
 *   indeks asal transaksi itu (-1 bila dibatalkan), dan penanda
 *   apakah penghapusan dibatalkan karena tidak dikonfirmasi.
 * @throws {ErrorTransaksiTidakDitemukan} bila id tidak ada di daftar.
 *
 * @example
 *   const hasil = hapusTransaksi(daftarLama, 1, {
 *     konfirmasi: (t, pesan) => window.confirm(pesan),
 *   });
 *   if (!hasil.dibatalkan) {
 *     // tampilkan toast "Transaksi dihapus" + tombol Urungkan:
 *     // pulihkanTransaksi(hasil.daftar, hasil.terhapus, hasil.indeks)
 *   }
 */
export function hapusTransaksi(daftar, id, opsi = {}) {
  const transaksi = cariTransaksi(daftar, id);
  if (transaksi === null) {
    throw new ErrorTransaksiTidakDitemukan(id);
  }

  const konfirmasi = opsi.konfirmasi;
  const disetujui =
    typeof konfirmasi === 'function'
      ? konfirmasi(transaksi, pesanKonfirmasiHapus(transaksi)) === true
      : konfirmasi === true;

  if (!disetujui) {
    return { daftar, terhapus: null, indeks: -1, dibatalkan: true };
  }

  const indeks = daftar.findIndex((t) => t.id === transaksi.id);
  return {
    daftar: daftar.filter((t) => t.id !== transaksi.id),
    terhapus: transaksi,
    indeks,
    dibatalkan: false,
  };
}

/**
 * Pulihkan transaksi yang baru dihapus — pasangan "Urungkan"
 * dari `hapusTransaksi()`. Transaksi dimasukkan kembali di
 * indeks asalnya (dibatasi ke rentang daftar saat ini), dengan
 * id dan seluruh field apa adanya, sehingga urutan daftar
 * kembali seperti sebelum penghapusan.
 *
 * Bila id transaksi itu ternyata sudah ada di daftar (mis.
 * tombol Urungkan ditekan dua kali, atau transaksi sudah
 * dipulihkan dari jalur lain), daftar dikembalikan apa adanya
 * dengan `dipulihkan: false` — bukan galat, supaya UI tidak
 * perlu menangani pengecualian untuk klik ganda.
 *
 * Daftar lama TIDAK diubah.
 *
 * @param {Array<object>} daftar
 * @param {object} transaksi transaksi hasil `hapusTransaksi().terhapus`.
 * @param {number} [indeks] indeks asal dari `hapusTransaksi().indeks`;
 *   tanpa ini transaksi ditambahkan di akhir daftar.
 * @returns {{daftar: Array<object>, transaksi: object, dipulihkan: boolean}}
 * @throws {TypeError} bila `transaksi` bukan objek ber-id valid.
 */
export function pulihkanTransaksi(daftar, transaksi, indeks) {
  if (
    transaksi === null ||
    typeof transaksi !== 'object' ||
    !Number.isInteger(Number(transaksi.id)) ||
    Number(transaksi.id) <= 0
  ) {
    throw new TypeError(
      'pulihkanTransaksi: transaksi harus objek dengan id bilangan bulat positif.',
    );
  }

  if (cariTransaksi(daftar, transaksi.id) !== null) {
    return { daftar, transaksi, dipulihkan: false };
  }

  const posisi =
    indeks === undefined || indeks === null
      ? daftar.length
      : Math.min(Math.max(Math.floor(indeks) || 0, 0), daftar.length);

  return {
    daftar: [
      ...daftar.slice(0, posisi),
      transaksi,
      ...daftar.slice(posisi),
    ],
    transaksi,
    dipulihkan: true,
  };
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
 * style.css (Day 15-17) untuk warna jumlahnya. Tombol hapus
 * membawa `data-hapus-id` (Day 11) — UI menangkap kliknya,
 * menampilkan konfirmasi dari `siapkanKonfirmasiHapus()`, lalu
 * memanggil `hapusTransaksi()`.
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
    `<button type="button" class="transaksi-item__hapus" ` +
    `data-hapus-id="${baris.id}" ` +
    `aria-label="Hapus transaksi ${escapeHtml(baris.deskripsi)}">Hapus</button>` +
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
 * @returns {{tambah: Function, edit: Function, hapus: Function, pulihkan: Function, semua: Function, cari: Function, jumlah: Function, tampilkan: Function}}
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
 *   const diubah = store.edit(baru.id, { jumlah: 550000 });
 *   diubah.jumlah; // 550000
 *   const hasilHapus = store.hapus(baru.id, { konfirmasi: true });
 *   hasilHapus.dibatalkan; // false
 *   store.pulihkan(hasilHapus.terhapus, hasilHapus.indeks);
 *   store.jumlah(); // 19 (kembali seperti semula)
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
     * Ubah transaksi yang sudah ada di store (Day 10).
     * Field yang tidak disertakan dipertahankan dari data lama.
     * @returns {object} transaksi hasil edit.
     * @throws {ErrorTransaksiTidakDitemukan} bila id tidak ada.
     * @throws {ErrorValidasiTransaksi} bila hasil gabungan tidak valid.
     */
    edit(id, data, opsi = {}) {
      const hasil = editTransaksi(daftar, id, data, opsi);
      daftar = hasil.daftar;
      return hasil.transaksi;
    },

    /**
     * Hapus transaksi dari store setelah konfirmasi (Day 11).
     * Tanpa `opsi.konfirmasi` yang menyetujui, tidak ada yang
     * berubah dan hasilnya `dibatalkan: true`.
     * @returns {{terhapus: object|null, indeks: number, dibatalkan: boolean}}
     *   transaksi terhapus (untuk Urungkan), indeks asalnya,
     *   dan penanda pembatalan.
     * @throws {ErrorTransaksiTidakDitemukan} bila id tidak ada.
     */
    hapus(id, opsi = {}) {
      const hasil = hapusTransaksi(daftar, id, opsi);
      daftar = hasil.daftar;
      return {
        terhapus: hasil.terhapus,
        indeks: hasil.indeks,
        dibatalkan: hasil.dibatalkan,
      };
    },

    /**
     * Pulihkan transaksi yang baru dihapus dari store (Day 11)
     * — pasangan Urungkan dari `hapus()`.
     * @returns {{transaksi: object, dipulihkan: boolean}}
     */
    pulihkan(transaksi, indeks) {
      const hasil = pulihkanTransaksi(daftar, transaksi, indeks);
      daftar = hasil.daftar;
      return { transaksi: hasil.transaksi, dipulihkan: hasil.dipulihkan };
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
     * Satu transaksi berdasarkan id (id boleh berupa teks,
     * mis. dari atribut `data-id` baris daftar).
     *
     * @param {number|string} id
     * @returns {object|null}
     */
    cari(id) {
      return cariTransaksi(daftar, id);
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
  ErrorTransaksiTidakDitemukan,
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
  cariTransaksi,
  siapkanDataEdit,
  editTransaksi,
  pesanKonfirmasiHapus,
  siapkanKonfirmasiHapus,
  hapusTransaksi,
  pulihkanTransaksi,
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
