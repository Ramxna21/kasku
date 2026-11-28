/**
 * KasKu — Filter Transaksi per Kategori
 * Day 12 (28 November 2026)
 *
 * Menyaring daftar transaksi (Day 8-11) berdasarkan kategori,
 * supaya pengguna bisa fokus melihat satu jenis arus uang saja —
 * mis. hanya "Makanan & Minuman" — tanpa mengubah data aslinya.
 * Ini logika di balik dropdown filter di atas daftar transaksi:
 * pilihan kategori datang dari elemen <select> (teks), disaring di
 * sini, lalu hasilnya ditampilkan `renderDaftarTransaksi()`
 * (transaksi.js, Day 9).
 *
 * Day 13 menambah filter per bulan/tahun di file ini juga; karena
 * itu filter berbentuk objek (`{ kategori_id }`) dan pintu masuk
 * utamanya `terapkanFilter()` — Day 13 tinggal menambah field
 * bulan/tahun ke objek yang sama.
 *
 * Aturan yang diikuti (lihat docs/day-02-struktur-data.md):
 * - Kategori yang sah adalah kategori bawaan id 1-13
 *   (KATEGORI_DEFAULT dari assets/js/data.js); daftar lain bisa
 *   diberikan lewat `opsi.kategori` untuk pengujian/kategori
 *   buatan pengguna nanti.
 * - "Semua kategori" diwakili `null` di logika dan teks 'semua'
 *   di elemen <select>; keduanya (plus '', 0, dan undefined)
 *   diterima `normalisasiKategoriId()`.
 * - Id kategori tidak dikenal adalah galat
 *   (ErrorFilterTidakValid), bukan hasil kosong diam-diam —
 *   supaya bug di UI ketahuan, bukan menyembunyikan transaksi.
 * - Menyaring tidak pernah mengubah daftar asal (pola immutable
 *   yang sama dengan transaksi.js) dan tidak mengurutkan ulang:
 *   urutan tampilan tetap urusan `urutkanTransaksi()` (Day 9).
 * - Di sini hanya hitungan transaksi per kategori. Total uang
 *   (pemasukan/pengeluaran/saldo) dihitung di assets/js/saldo.js
 *   (Day 14), grafik per kategori menyusul di Day 19.
 *
 * Dipakai oleh: halaman utama (index.html) di atas daftar
 * transaksi, dan form/daftar Day 18. Contoh pemakaian:
 *   import { filterPerKategori, renderOpsiFilterKategori } from './filter.js';
 *   import { renderDaftarTransaksi } from './transaksi.js';
 *
 *   selectKategori.innerHTML = renderOpsiFilterKategori(daftar);
 *   const hasil = filterPerKategori(daftar, selectKategori.value);
 *   wadahDaftar.innerHTML = renderDaftarTransaksi(hasil);
 *
 * ES module — dependensi: data.js (daftar kategori) dan
 * transaksi.js (escapeHtml untuk render opsi yang aman).
 */

import { KATEGORI_DEFAULT } from './data.js';
import { escapeHtml } from './transaksi.js';

/** Nilai <select> untuk pilihan "tanpa filter kategori". */
export const SEMUA_KATEGORI = 'semua';

/** Label pilihan "tanpa filter kategori". */
export const LABEL_SEMUA_KATEGORI = 'Semua kategori';

/**
 * Filter awal: belum ada kategori dipilih.
 * Day 13 menambah field bulan/tahun ke bentuk ini.
 */
export const FILTER_AWAL = Object.freeze({ kategori_id: null });

/* ------------------------------------------------------------------ */
/* Galat & pembantu internal                                            */
/* ------------------------------------------------------------------ */

/**
 * Galat yang dilempar bila id kategori filter tidak sah —
 * bukan angka bulat positif, atau tidak ada di daftar kategori.
 * UI menangkapnya untuk menampilkan pesan, bukan daftar kosong
 * yang membingungkan.
 */
export class ErrorFilterTidakValid extends Error {
  /**
   * @param {string} pesan
   */
  constructor(pesan) {
    super(pesan);
    this.name = 'ErrorFilterTidakValid';
  }
}

/** Daftar kategori yang berlaku: opsi.kategori atau bawaan. */
function daftarKategori(opsi = {}) {
  const kategori = opsi.kategori ?? KATEGORI_DEFAULT;
  if (!Array.isArray(kategori)) {
    throw new TypeError('filter: opsi.kategori harus berupa array.');
  }
  return kategori;
}

/** Cari kategori berdasarkan id di daftar yang berlaku. */
function cariKategori(id, opsi = {}) {
  return daftarKategori(opsi).find((k) => k.id === id) || null;
}

/** Pastikan daftar transaksi benar-benar array. */
function pastikanDaftar(daftar, namaFungsi) {
  if (!Array.isArray(daftar)) {
    throw new TypeError(`${namaFungsi}: daftar harus berupa array.`);
  }
}

/* ------------------------------------------------------------------ */
/* Normalisasi pilihan kategori                                         */
/* ------------------------------------------------------------------ */

/**
 * Ubah pilihan kategori dari UI menjadi id yang siap dipakai:
 * `null` berarti "semua kategori", selain itu id kategori yang
 * sah. Nilai dari <select> selalu teks, jadi "6" diterima sama
 * seperti angka 6.
 *
 * @param {number|string|null|undefined} kategoriId - pilihan
 *   kategori: null/undefined/''/0/'semua' untuk semua kategori,
 *   atau id kategori (angka atau teks angka).
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori yang
 *   berlaku (default KATEGORI_DEFAULT).
 * @returns {number|null} id kategori, atau null untuk semua.
 * @throws {ErrorFilterTidakValid} bila id tidak sah/tidak dikenal.
 *
 * @example
 *   normalisasiKategoriId('semua'); // null
 *   normalisasiKategoriId('6');     // 6
 *   normalisasiKategoriId(99);      // melempar ErrorFilterTidakValid
 */
export function normalisasiKategoriId(kategoriId, opsi = {}) {
  if (kategoriId === null || kategoriId === undefined) {
    return null;
  }
  if (typeof kategoriId === 'string') {
    const teks = kategoriId.trim().toLowerCase();
    if (teks === '' || teks === SEMUA_KATEGORI) {
      return null;
    }
  }
  if (kategoriId === 0 || kategoriId === '0') {
    return null;
  }

  const id = Number(kategoriId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorFilterTidakValid(
      `normalisasiKategoriId: kategori_id "${kategoriId}" tidak valid.`,
    );
  }
  if (cariKategori(id, opsi) === null) {
    throw new ErrorFilterTidakValid(
      `normalisasiKategoriId: kategori id ${id} tidak ditemukan.`,
    );
  }
  return id;
}

/**
 * Id kategori milik satu transaksi. `kategori_id` adalah sumber
 * utama; bila tidak ada, dipakai kategori yang tersemat
 * (`transaksi.kategori.id`) — bentuk respons API Day 23-24.
 *
 * @param {object} transaksi
 * @returns {number|null} id kategori, atau null bila tidak ada.
 */
export function kategoriIdTransaksi(transaksi) {
  if (!transaksi || typeof transaksi !== 'object') {
    return null;
  }
  const id = Number(transaksi.kategori_id ?? transaksi.kategori?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Label filter kategori untuk ditampilkan ke pengguna — judul
 * daftar hasil saringan atau penanda filter aktif.
 *
 * @param {number|string|null} kategoriId pilihan kategori.
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {string} contoh: "Semua kategori", "🍜 Makanan & Minuman".
 */
export function labelFilterKategori(kategoriId, opsi = {}) {
  const id = normalisasiKategoriId(kategoriId, opsi);
  if (id === null) {
    return LABEL_SEMUA_KATEGORI;
  }
  const kategori = cariKategori(id, opsi);
  return kategori.ikon ? `${kategori.ikon} ${kategori.nama}` : kategori.nama;
}

/* ------------------------------------------------------------------ */
/* Menyaring daftar                                                     */
/* ------------------------------------------------------------------ */

/**
 * Saring daftar transaksi per kategori.
 *
 * Daftar asal TIDAK diubah dan urutannya dipertahankan apa
 * adanya — pengurutan tampilan tetap dilakukan
 * `urutkanTransaksi()`/`renderDaftarTransaksi()` (Day 9).
 * Transaksi tanpa kategori yang terbaca hanya ikut tampil saat
 * filternya "semua kategori".
 *
 * @param {Array<object>} daftar
 * @param {number|string|null} [kategoriId=null] kategori pilihan
 *   (lihat `normalisasiKategoriId()`); null/'semua' = semua.
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {Array<object>} salinan daftar yang sudah tersaring.
 * @throws {TypeError} bila `daftar` bukan array.
 * @throws {ErrorFilterTidakValid} bila kategori tidak dikenal.
 *
 * @example
 *   filterPerKategori(TRANSAKSI_CONTOH, 6).length;    // 6
 *   filterPerKategori(TRANSAKSI_CONTOH, 'semua').length; // 18
 */
export function filterPerKategori(daftar, kategoriId = null, opsi = {}) {
  pastikanDaftar(daftar, 'filterPerKategori');
  const id = normalisasiKategoriId(kategoriId, opsi);
  if (id === null) {
    return [...daftar];
  }
  return daftar.filter((t) => kategoriIdTransaksi(t) === id);
}

/**
 * Normalisasi objek filter menjadi bentuk baku
 * `{ kategori_id: number|null }`. Field lain diabaikan untuk
 * sekarang; Day 13 menambah bulan/tahun ke bentuk ini.
 *
 * @param {object} [filter]
 * @param {number|string|null} [filter.kategori_id]
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {{kategori_id: number|null}}
 */
export function normalisasiFilter(filter = {}, opsi = {}) {
  const sumber = filter && typeof filter === 'object' ? filter : {};
  return {
    kategori_id: normalisasiKategoriId(sumber.kategori_id ?? null, opsi),
  };
}

/**
 * Terapkan objek filter ke daftar transaksi — pintu masuk utama
 * yang dipakai UI, supaya Day 13 (filter bulan/tahun) tinggal
 * memperluas objek filternya tanpa mengubah cara memanggil.
 *
 * @param {Array<object>} daftar
 * @param {object} [filter] lihat `normalisasiFilter()`.
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {Array<object>} salinan daftar yang sudah tersaring.
 *
 * @example
 *   terapkanFilter(TRANSAKSI_CONTOH, { kategori_id: 7 }).length; // 3
 *   terapkanFilter(TRANSAKSI_CONTOH, FILTER_AWAL).length;        // 18
 */
export function terapkanFilter(daftar, filter = {}, opsi = {}) {
  const baku = normalisasiFilter(filter, opsi);
  return filterPerKategori(daftar, baku.kategori_id, opsi);
}

/**
 * Ringkasan hasil saringan untuk judul di atas daftar —
 * berapa transaksi tampil dari totalnya, dan kategori apa yang
 * sedang aktif. Hanya hitungan; total uang menyusul Day 14.
 *
 * @param {Array<object>} daftar daftar sebelum disaring.
 * @param {number|string|null} [kategoriId=null] kategori pilihan.
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {{kategori_id: number|null, label: string, aktif: boolean, jumlahTampil: number, jumlahTotal: number, teks: string}}
 *   contoh teks: "Menampilkan 6 dari 18 transaksi · 🍜 Makanan & Minuman".
 */
export function ringkasanFilter(daftar, kategoriId = null, opsi = {}) {
  pastikanDaftar(daftar, 'ringkasanFilter');
  const id = normalisasiKategoriId(kategoriId, opsi);
  const hasil = filterPerKategori(daftar, id, opsi);
  const label = labelFilterKategori(id, opsi);
  const aktif = id !== null;
  return {
    kategori_id: id,
    label,
    aktif,
    jumlahTampil: hasil.length,
    jumlahTotal: daftar.length,
    teks:
      `Menampilkan ${hasil.length} dari ${daftar.length} transaksi` +
      (aktif ? ` · ${label}` : ''),
  };
}

/* ------------------------------------------------------------------ */
/* Hitungan & pengelompokan per kategori                                */
/* ------------------------------------------------------------------ */

/** Urutan hasil `hitungPerKategori()` yang diizinkan. */
export const URUTAN_KATEGORI_VALID = ['terbanyak', 'nama', 'id'];

/**
 * Hitung jumlah transaksi per kategori — bahan label dropdown
 * ("Makanan & Minuman (6)") dan penanda kategori terlaris.
 * Kategori transaksi yang tidak ada di daftar berlaku (data
 * lama) tetap dihitung, dengan nama dari kategori tersematnya
 * atau "Kategori tidak dikenal".
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori berlaku.
 * @param {boolean} [opsi.sertakanKosong=false] ikutkan kategori
 *   tanpa transaksi (jumlah 0).
 * @param {'terbanyak'|'nama'|'id'} [opsi.urutan='terbanyak']
 *   'terbanyak': jumlah terbesar dulu, seri menurut nama.
 * @returns {Array<{kategori: object, kategori_id: number, jumlahTransaksi: number}>}
 * @throws {TypeError} bila `daftar` bukan array atau urutan asing.
 *
 * @example
 *   hitungPerKategori(TRANSAKSI_CONTOH)[0];
 *   // { kategori: { id: 6, nama: 'Makanan & Minuman', ... },
 *   //   kategori_id: 6, jumlahTransaksi: 6 }
 */
export function hitungPerKategori(daftar, opsi = {}) {
  pastikanDaftar(daftar, 'hitungPerKategori');
  const urutan = opsi.urutan ?? 'terbanyak';
  if (!URUTAN_KATEGORI_VALID.includes(urutan)) {
    throw new TypeError(
      `hitungPerKategori: urutan harus salah satu dari ${URUTAN_KATEGORI_VALID.join(', ')}.`,
    );
  }

  const hitungan = new Map();
  const catat = (kategori) => {
    if (!hitungan.has(kategori.id)) {
      hitungan.set(kategori.id, {
        kategori,
        kategori_id: kategori.id,
        jumlahTransaksi: 0,
      });
    }
    return hitungan.get(kategori.id);
  };

  if (opsi.sertakanKosong === true) {
    for (const kategori of daftarKategori(opsi)) {
      catat(kategori);
    }
  }
  for (const transaksi of daftar) {
    const id = kategoriIdTransaksi(transaksi);
    if (id === null) {
      continue;
    }
    const kategori =
      cariKategori(id, opsi) ||
      transaksi.kategori || {
        id,
        nama: 'Kategori tidak dikenal',
        tipe: transaksi.tipe ?? null,
        ikon: '',
        warna: '#9ca3af',
      };
    catat(kategori).jumlahTransaksi += 1;
  }

  const hasil = [...hitungan.values()];
  switch (urutan) {
    case 'nama':
      return hasil.sort(
        (a, b) =>
          a.kategori.nama.localeCompare(b.kategori.nama) ||
          a.kategori_id - b.kategori_id,
      );
    case 'id':
      return hasil.sort((a, b) => a.kategori_id - b.kategori_id);
    case 'terbanyak':
    default:
      return hasil.sort(
        (a, b) =>
          b.jumlahTransaksi - a.jumlahTransaksi ||
          a.kategori.nama.localeCompare(b.kategori.nama) ||
          a.kategori_id - b.kategori_id,
      );
  }
}

/**
 * Kelompokkan transaksi per kategori — satu kelompok per
 * kategori, isi kelompok mempertahankan urutan daftar asal.
 * Urutan kelompok sama dengan `hitungPerKategori()`.
 *
 * @param {Array<object>} daftar
 * @param {object} [opsi] diteruskan ke `hitungPerKategori()`.
 * @returns {Array<{kategori: object, kategori_id: number, jumlahTransaksi: number, transaksi: Array<object>}>}
 */
export function kelompokkanPerKategori(daftar, opsi = {}) {
  const kelompok = hitungPerKategori(daftar, opsi).map((h) => ({
    ...h,
    transaksi: [],
  }));
  const perId = new Map(kelompok.map((k) => [k.kategori_id, k]));
  for (const transaksi of daftar) {
    const id = kategoriIdTransaksi(transaksi);
    if (id !== null && perId.has(id)) {
      perId.get(id).transaksi.push(transaksi);
    }
  }
  return kelompok;
}

/* ------------------------------------------------------------------ */
/* Opsi dropdown filter                                                 */
/* ------------------------------------------------------------------ */

/**
 * Model opsi dropdown filter kategori: pilihan "Semua kategori"
 * di urutan pertama, lalu semua kategori berlaku (termasuk yang
 * belum punya transaksi, supaya daftar pilihannya lengkap),
 * masing-masing dengan jumlah transaksinya di daftar saat ini.
 *
 * @param {Array<object>} [daftar=[]] daftar untuk hitungan.
 * @param {object} [opsi]
 * @param {Array<object>} [opsi.kategori] daftar kategori berlaku.
 * @param {number|string|null} [opsi.terpilih] kategori terpilih
 *   saat ini; menandai `terpilih: true` pada opsi yang cocok.
 * @returns {Array<{value: string, label: string, kategori_id: number|null, grup: string|null, jumlahTransaksi: number, terpilih: boolean}>}
 *   `value` siap dipakai sebagai value <option>; `grup` adalah
 *   tipe kategori ('pemasukan'/'pengeluaran') untuk <optgroup>.
 *
 * @example
 *   opsiFilterKategori(TRANSAKSI_CONTOH)[0];
 *   // { value: 'semua', label: 'Semua kategori (18)', ... }
 */
export function opsiFilterKategori(daftar = [], opsi = {}) {
  pastikanDaftar(daftar, 'opsiFilterKategori');
  const terpilih = normalisasiKategoriId(opsi.terpilih ?? null, opsi);
  const hitungan = new Map(
    hitungPerKategori(daftar, { ...opsi, sertakanKosong: true }).map((h) => [
      h.kategori_id,
      h.jumlahTransaksi,
    ]),
  );

  const hasil = [
    {
      value: SEMUA_KATEGORI,
      label: `${LABEL_SEMUA_KATEGORI} (${daftar.length})`,
      kategori_id: null,
      grup: null,
      jumlahTransaksi: daftar.length,
      terpilih: terpilih === null,
    },
  ];
  for (const kategori of daftarKategori(opsi)) {
    const jumlah = hitungan.get(kategori.id) ?? 0;
    hasil.push({
      value: String(kategori.id),
      label:
        `${kategori.ikon ? `${kategori.ikon} ` : ''}${kategori.nama} (${jumlah})`,
      kategori_id: kategori.id,
      grup: kategori.tipe ?? null,
      jumlahTransaksi: jumlah,
      terpilih: terpilih === kategori.id,
    });
  }
  return hasil;
}

/**
 * Render isi <select> filter kategori sebagai HTML: opsi
 * "Semua kategori", lalu <optgroup> Pemasukan dan Pengeluaran.
 * Semua label di-escape (escapeHtml dari transaksi.js) karena
 * nama kategori bisa berasal dari buatan pengguna nanti.
 *
 * @param {Array<object>} [daftar=[]] daftar untuk hitungan.
 * @param {object} [opsi] diteruskan ke `opsiFilterKategori()`.
 * @returns {string} HTML <option>/<optgroup> siap ditempel ke <select>.
 *
 * @example
 *   selectKategori.innerHTML =
 *     renderOpsiFilterKategori(daftar, { terpilih: 6 });
 */
export function renderOpsiFilterKategori(daftar = [], opsi = {}) {
  const semuaOpsi = opsiFilterKategori(daftar, opsi);
  const renderOpsi = (o) =>
    `<option value="${escapeHtml(o.value)}"${o.terpilih ? ' selected' : ''}>${escapeHtml(o.label)}</option>`;

  const bagian = [renderOpsi(semuaOpsi[0])];
  const labelGrup = { pemasukan: 'Pemasukan', pengeluaran: 'Pengeluaran' };
  for (const grup of ['pemasukan', 'pengeluaran']) {
    const isiGrup = semuaOpsi.filter((o) => o.grup === grup);
    if (isiGrup.length === 0) {
      continue;
    }
    bagian.push(
      `<optgroup label="${labelGrup[grup]}">${isiGrup.map(renderOpsi).join('')}</optgroup>`,
    );
  }
  // Kategori tanpa tipe yang dikenal tetap ditampilkan, tanpa grup.
  for (const o of semuaOpsi.slice(1)) {
    if (o.grup !== 'pemasukan' && o.grup !== 'pengeluaran') {
      bagian.push(renderOpsi(o));
    }
  }
  return bagian.join('');
}

/* ------------------------------------------------------------------ */
/* State filter untuk UI                                                */
/* ------------------------------------------------------------------ */

/**
 * Buat state filter kategori untuk satu dropdown — pasangan
 * `buatStore()` di transaksi.js: UI cukup memegang objek ini,
 * bukan variabel kategori lepas. Pilihan tidak sah ditolak
 * sebelum state berubah, jadi filter yang sedang tampil tidak
 * pernah rusak oleh nilai <select> yang asing.
 *
 * @param {number|string|null} [kategoriAwal=null] kategori awal.
 * @param {object} [opsi] diteruskan ke `normalisasiKategoriId()`.
 * @returns {object} state filter (lihat method di bawah).
 *
 * @example
 *   const filter = buatFilterKategori();
 *   filter.setKategori(selectKategori.value);
 *   wadahDaftar.innerHTML =
 *     renderDaftarTransaksi(filter.terapkan(store.semua()));
 */
export function buatFilterKategori(kategoriAwal = null, opsi = {}) {
  let kategoriId = normalisasiKategoriId(kategoriAwal, opsi);

  return {
    /** Id kategori terpilih, atau null untuk semua kategori. */
    kategoriId() {
      return kategoriId;
    },

    /** Nilai siap <select>: 'semua' atau teks id kategori. */
    nilaiSelect() {
      return kategoriId === null ? SEMUA_KATEGORI : String(kategoriId);
    },

    /** Label kategori terpilih (lihat `labelFilterKategori()`). */
    label() {
      return labelFilterKategori(kategoriId, opsi);
    },

    /** Apakah filter sedang aktif (kategori tertentu dipilih)? */
    aktif() {
      return kategoriId !== null;
    },

    /**
     * Ganti kategori terpilih. Nilai tidak sah melempar
     * ErrorFilterTidakValid dan state tidak berubah.
     *
     * @param {number|string|null} kategoriBaru
     * @returns {number|null} id kategori setelah diganti.
     */
    setKategori(kategoriBaru) {
      kategoriId = normalisasiKategoriId(kategoriBaru, opsi);
      return kategoriId;
    },

    /** Kembali ke "semua kategori". */
    reset() {
      kategoriId = null;
      return kategoriId;
    },

    /**
     * Saring daftar dengan kategori terpilih saat ini.
     *
     * @param {Array<object>} daftar
     * @returns {Array<object>}
     */
    terapkan(daftar) {
      return filterPerKategori(daftar, kategoriId, opsi);
    },

    /**
     * Ringkasan hasil saringan saat ini (lihat `ringkasanFilter()`).
     *
     * @param {Array<object>} daftar
     * @returns {object}
     */
    ringkasan(daftar) {
      return ringkasanFilter(daftar, kategoriId, opsi);
    },

    /**
     * Model opsi dropdown dengan pilihan saat ini tertandai.
     *
     * @param {Array<object>} [daftar=[]]
     * @returns {Array<object>}
     */
    opsi(daftar = []) {
      return opsiFilterKategori(daftar, { ...opsi, terpilih: kategoriId });
    },

    /**
     * HTML isi <select> dengan pilihan saat ini tertandai.
     *
     * @param {Array<object>} [daftar=[]]
     * @returns {string}
     */
    renderOpsi(daftar = []) {
      return renderOpsiFilterKategori(daftar, {
        ...opsi,
        terpilih: kategoriId,
      });
    },
  };
}

export default {
  SEMUA_KATEGORI,
  LABEL_SEMUA_KATEGORI,
  FILTER_AWAL,
  URUTAN_KATEGORI_VALID,
  ErrorFilterTidakValid,
  normalisasiKategoriId,
  kategoriIdTransaksi,
  labelFilterKategori,
  filterPerKategori,
  normalisasiFilter,
  terapkanFilter,
  ringkasanFilter,
  hitungPerKategori,
  kelompokkanPerKategori,
  opsiFilterKategori,
  renderOpsiFilterKategori,
  buatFilterKategori,
};
