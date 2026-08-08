/**
 * Terbilang.js - Indonesian Number to Words Converter
 * PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4)
 */

function terbilangAngka(angka) {
  const bil = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let n = Math.floor(Math.abs(Number(angka) || 0));
  
  if (n === 0) return "";
  
  if (n < 12) {
    return bil[n];
  } else if (n < 20) {
    return (terbilangAngka(n - 10) + " Belas").trim();
  } else if (n < 100) {
    return (terbilangAngka(Math.floor(n / 10)) + " Puluh " + terbilangAngka(n % 10)).trim();
  } else if (n < 200) {
    return ("Seratus " + terbilangAngka(n - 100)).trim();
  } else if (n < 1000) {
    return (terbilangAngka(Math.floor(n / 100)) + " Ratus " + terbilangAngka(n % 100)).trim();
  } else if (n < 2000) {
    return ("Seribu " + terbilangAngka(n - 1000)).trim();
  } else if (n < 1000000) {
    return (terbilangAngka(Math.floor(n / 1000)) + " Ribu " + terbilangAngka(n % 1000)).trim();
  } else if (n < 1000000000) {
    return (terbilangAngka(Math.floor(n / 1000000)) + " Juta " + terbilangAngka(n % 1000000)).trim();
  } else if (n < 1000000000000) {
    return (terbilangAngka(Math.floor(n / 1000000000)) + " Milyar " + terbilangAngka(n % 1000000000)).trim();
  }
  return "";
}

function formatTerbilangRupiah(angka, toUppercase = false) {
  if (isNaN(angka) || angka === null || angka === undefined) return "Nol Rupiah";
  const num = Math.floor(Math.abs(Number(angka)));
  if (num === 0) return toUppercase ? "NOL RUPIAH" : "Nol Rupiah";
  
  let text = terbilangAngka(num).replace(/\s+/g, ' ').trim() + " Rupiah";
  return toUppercase ? text.toUpperCase() : text;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { terbilangAngka, formatTerbilangRupiah };
}
