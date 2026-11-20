/**
 * KasKu — Helper Format
 * Day 4 (20 November 2026)
 *
 * Fungsi-fungsi format tampilan yang dipakai seluruh aplikasi KasKu:
 * nominal Rupiah dan tanggal berbahasa Indonesia.
 *
 * Aturan yang diikuti (lihat docs/day-02-struktur-data.md):
 * - `jumlah` selalu disimpan positif (DECIMAL(15,2), maks.
 *   Rp999.999.999.999,99); arah arus uang ditentukan kolom `tipe`.
 * - `tanggal` disimpan sebagai DATE 'YYYY-MM-DD'.
 *
 * Dipakai oleh: assets/js/data.js (Day 5), assets/js/transaksi.js
 * (Day 8-11), assets/js/filter.js (Day 12-13), assets/js/saldo.js
 * (Day 14), dan assets/js/export.js (Day 27).
 *
 * ES module tanpa dependensi — cukup di-import:
 *   import { formatRupiah, formatTanggal } from './format.js';
 */

/** Nominal terbesar yang diizinkan skema (Day 2, aturan validasi 1). */
export const MAKSIMAL_JUMLAH = 999999999999.99;

/** Zona waktu aplikasi: semua tanggal tampil memakai WIB. */
export const ZONA_WAKTU = 'Asia/Jakarta';

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const NAMA_BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const NAMA_HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

/* ------------------------------------------------------------------ */
/* Rupiah                                                              */
/* ------------------------------------------------------------------ */

/**
 * Format angka menjadi Rupiah lengkap, mis. 25000 -> "Rp25.000".
 *
 * Desimal hanya ditampilkan bila ada sen (atau bila opsi `desimal`
 * bernilai true), sesuai kebiasaan penulisan Rupiah sehari-hari.
 * Nilai negatif ditolak: jumlah KasKu selalu positif, tanda arah
 * ditambahkan lewat `formatRupiahDenganTanda()`.
 *
 * @param {number} jumlah - nominal dalam Rupiah (>= 0).
 * @param {object} [opsi]
 * @param {boolean} [opsi.desimal=false] - selalu tampilkan 2 desimal.
 * @returns {string} contoh: "Rp25.000", "Rp25.000,50".
 */
export function formatRupiah(jumlah, opsi = {}) {
  if (typeof jumlah !== 'number' || !Number.isFinite(jumlah)) {
    throw new TypeError('formatRupiah: jumlah harus berupa angka.');
  }
  if (jumlah < 0) {
    throw new RangeError('formatRupiah: jumlah tidak boleh negatif.');
  }
  if (jumlah > MAKSIMAL_JUMLAH) {
    throw new RangeError(
      `formatRupiah: jumlah melebihi batas Rp${MAKSIMAL_JUMLAH.toLocaleString('id-ID')}.`,
    );
  }

  const adaSen = jumlah % 1 !== 0;
  const tampilkanDesimal = opsi.desimal === true || adaSen;

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: tampilkanDesimal ? 2 : 0,
    maximumFractionDigits: tampilkanDesimal ? 2 : 0,
  }).format(jumlah);
}

/**
 * Format Rupiah singkat untuk kartu ringkasan (Day 16) dan grafik
 * (Day 19), mis. 25000 -> "Rp25 rb", 3500000 -> "Rp3,5 jt".
 *
 * @param {number} jumlah - nominal dalam Rupiah (>= 0).
 * @returns {string} contoh: "Rp25 rb", "Rp3,5 jt", "Rp1,25 M".
 */
export function formatRupiahSingkat(jumlah) {
  if (typeof jumlah !== 'number' || !Number.isFinite(jumlah) || jumlah < 0) {
    throw new TypeError('formatRupiahSingkat: jumlah harus berupa angka >= 0.');
  }

  const satuan = [
    { nilai: 1_000_000_000_000, akhiran: ' T' },
    { nilai: 1_000_000_000, akhiran: ' M' },
    { nilai: 1_000_000, akhiran: ' jt' },
    { nilai: 1_000, akhiran: ' rb' },
  ];

  for (const { nilai, akhiran } of satuan) {
    if (jumlah >= nilai) {
      const angka = jumlah / nilai;
      const dibulatkan = Math.round(angka * 100) / 100;
      const teks = dibulatkan.toLocaleString('id-ID', {
        maximumFractionDigits: 2,
      });
      return `Rp${teks}${akhiran}`;
    }
  }

  return formatRupiah(jumlah);
}

/**
 * Format Rupiah dengan tanda arah sesuai `tipe` transaksi:
 * pemasukan diawali "+", pengeluaran diawali "-".
 *
 * @param {number} jumlah - nominal dalam Rupiah (>= 0).
 * @param {'pemasukan'|'pengeluaran'} tipe - arah arus uang.
 * @returns {string} contoh: "+Rp3.500.000", "-Rp25.000".
 */
export function formatRupiahDenganTanda(jumlah, tipe) {
  if (tipe !== 'pemasukan' && tipe !== 'pengeluaran') {
    throw new TypeError(
      "formatRupiahDenganTanda: tipe harus 'pemasukan' atau 'pengeluaran'.",
    );
  }
  const tanda = tipe === 'pemasukan' ? '+' : '-';
  return tanda + formatRupiah(jumlah);
}

/**
 * Ubah teks Rupiah (mis. dari input pengguna) kembali menjadi angka.
 * Menerima "Rp25.000", "25.000,50", "25000", "Rp 3.500.000,75".
 * Pemisah ribuan Indonesia adalah titik, pemisah desimal adalah koma.
 *
 * @param {string} teks - teks yang mengandung nominal Rupiah.
 * @returns {number|null} angka hasil parse, atau null bila tidak valid.
 */
export function parseRupiah(teks) {
  if (typeof teks !== 'string') {
    return null;
  }

  const bersih = teks
    .replace(/[^0-9.,-]/g, '') // buang "Rp", spasi, dan karakter lain
    .replace(/\./g, '') // buang pemisah ribuan
    .replace(',', '.'); // koma desimal -> titik desimal

  if (bersih === '' || bersih === '-' || bersih === '.') {
    return null;
  }

  const hasil = Number(bersih);
  return Number.isFinite(hasil) ? hasil : null;
}

/* ------------------------------------------------------------------ */
/* Tanggal                                                             */
/* ------------------------------------------------------------------ */

/**
 * Uraikan string tanggal 'YYYY-MM-DD' menjadi komponennya.
 * Mengembalikan null bila format salah atau tanggal tidak ada
 * di kalender (mis. "2026-02-30").
 *
 * @param {string} tanggal - tanggal 'YYYY-MM-DD'.
 * @returns {{tahun:number, bulan:number, hari:number}|null}
 */
export function parseTanggal(tanggal) {
  if (typeof tanggal !== 'string') {
    return null;
  }

  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal);
  if (!cocok) {
    return null;
  }

  const tahun = Number(cocok[1]);
  const bulan = Number(cocok[2]);
  const hari = Number(cocok[3]);

  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) {
    return null;
  }

  // Pastikan tanggalnya sungguh ada (menolak 30 Februari, dsb.).
  const cek = new Date(tahun, bulan - 1, hari);
  if (
    cek.getFullYear() !== tahun ||
    cek.getMonth() !== bulan - 1 ||
    cek.getDate() !== hari
  ) {
    return null;
  }

  return { tahun, bulan, hari };
}

/** Apakah string tanggal valid? (aturan validasi Day 2, no. 4). */
export function isTanggalValid(tanggal) {
  return parseTanggal(tanggal) !== null;
}

/**
 * Tanggal hari ini dalam format 'YYYY-MM-DD' (zona WIB).
 * Sama dengan nilai default kolom `tanggal` di database/schema.sql.
 *
 * @returns {string} contoh: "2026-11-20".
 */
export function tanggalHariIni() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_WAKTU,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Apakah tanggal berada di masa depan? Dipakai validasi form
 * (Day 18): transaksi tidak boleh bertanggal besok atau setelahnya.
 *
 * @param {string} tanggal - tanggal 'YYYY-MM-DD'.
 * @returns {boolean} true bila tanggal tidak valid atau di masa depan.
 */
export function isTanggalMasaDepan(tanggal) {
  const bagian = parseTanggal(tanggal);
  if (!bagian) {
    return true;
  }
  return tanggal > tanggalHariIni();
}

/**
 * Format tanggal menjadi teks Indonesia.
 *
 * @param {string} tanggal - tanggal 'YYYY-MM-DD'.
 * @param {object} [opsi]
 * @param {'panjang'|'sedang'|'pendek'|'angka'} [opsi.gaya='sedang']
 *   - 'panjang': "Rabu, 18 November 2026"
 *   - 'sedang':  "18 November 2026"
 *   - 'pendek':  "18 Nov 2026"
 *   - 'angka':   "18/11/2026"
 * @returns {string} tanggal terformat, atau string aslinya bila tidak valid.
 */
export function formatTanggal(tanggal, opsi = {}) {
  const bagian = parseTanggal(tanggal);
  if (!bagian) {
    return String(tanggal);
  }

  const { tahun, bulan, hari } = bagian;
  const gaya = opsi.gaya || 'sedang';

  switch (gaya) {
    case 'panjang': {
      const hariMinggu = new Date(tahun, bulan - 1, hari).getDay();
      return `${NAMA_HARI[hariMinggu]}, ${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
    }
    case 'pendek':
      return `${hari} ${NAMA_BULAN_SINGKAT[bulan - 1]} ${tahun}`;
    case 'angka': {
      const bb = String(bulan).padStart(2, '0');
      const hh = String(hari).padStart(2, '0');
      return `${hh}/${bb}/${tahun}`;
    }
    case 'sedang':
    default:
      return `${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
  }
}

/**
 * Format tanggal relatif terhadap hari ini ("Hari ini", "Kemarin",
 * "2 hari lalu"). Tanggal yang lebih jauh dari 7 hari ditampilkan
 * dengan format sedang. Dipakai daftar transaksi (Day 9).
 *
 * @param {string} tanggal - tanggal 'YYYY-MM-DD'.
 * @param {string} [acuan=tanggalHariIni()] - tanggal pembanding, untuk pengujian.
 * @returns {string} contoh: "Hari ini", "Kemarin", "3 hari lalu".
 */
export function formatTanggalRelatif(tanggal, acuan = tanggalHariIni()) {
  const bagian = parseTanggal(tanggal);
  const acuanBagian = parseTanggal(acuan);
  if (!bagian || !acuanBagian) {
    return String(tanggal);
  }

  const selisihHari = Math.round(
    (new Date(acuanBagian.tahun, acuanBagian.bulan - 1, acuanBagian.hari)
      - new Date(bagian.tahun, bagian.bulan - 1, bagian.hari))
      / 86_400_000,
  );

  if (selisihHari === 0) {
    return 'Hari ini';
  }
  if (selisihHari === 1) {
    return 'Kemarin';
  }
  if (selisihHari === -1) {
    return 'Besok';
  }
  if (selisihHari > 1 && selisihHari <= 7) {
    return `${selisihHari} hari lalu`;
  }
  // Di luar seminggu — tampilkan tanggal lengkap supaya tidak ambigu.
  return formatTanggal(tanggal);
}

/**
 * Format "Bulan Tahun", mis. "November 2026".
 * Dipakai judul ringkasan bulanan (Day 25) dan filter bulan (Day 13).
 *
 * @param {string} tanggal - tanggal 'YYYY-MM-DD'.
 * @returns {string} contoh: "November 2026".
 */
export function formatBulanTahun(tanggal) {
  const bagian = parseTanggal(tanggal);
  if (!bagian) {
    return String(tanggal);
  }
  return `${NAMA_BULAN[bagian.bulan - 1]} ${bagian.tahun}`;
}

export default {
  MAKSIMAL_JUMLAH,
  ZONA_WAKTU,
  formatRupiah,
  formatRupiahSingkat,
  formatRupiahDenganTanda,
  parseRupiah,
  parseTanggal,
  isTanggalValid,
  isTanggalMasaDepan,
  tanggalHariIni,
  formatTanggal,
  formatTanggalRelatif,
  formatBulanTahun,
};
