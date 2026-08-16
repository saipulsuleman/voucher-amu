# Design Spec: Fitur Masa Berlaku Voucher & Integrasi Google Sheets

## 1. Latar Belakang & Aturan Bisnis
Voucher BBM PT. Arba Mitra Usaha Gorontalo (SPBU 74-961-4) memiliki aturan masa berlaku:
- **Voucher Standar (V25, V50, V100, V200, V300):** Berlaku **6 Bulan (180 Hari)** sejak tanggal nota transaksi.
- **Kupon Manual (MANUAL):** Berlaku **1 Bulan (30 Hari)** sejak tanggal nota transaksi *(TETAP)*.

---

## 2. Integrasi Google Sheets (1:1 Excel Alignment)

### A. Format Kolom Google Sheets (19 Kolom)
Struktur tabel pada seluruh worksheet transaksi (*REKAPITULASI TOTAL*, *Voucher 25k..300k*, *Voucher Manual*):
1. `No.`
2. `No. Nota`
3. `Tanggal` (DD/MM/YYYY)
4. `Bulan`
5. `Tahun`
6. `Nama Instansi`
7. `Pecahan`
8. `Seri Awal`
9. `Seri Akhir`
10. `Lembar`
11. `Subtotal Nominal`
12. `Metode Pembayaran Voucher`
13. `Admin`
14. `Metode Pembayaran Admin`
15. `Biaya Clearing`
16. `Total`
17. `Petugas / TTD`
18. **`Tgl Kadaluarsa`** (DD/MM/YYYY: +6 bln untuk V25-V300, +1 bln untuk Manual)
19. **`Status Kadaluarsa`** (`AKTIF`, `SEGERA BERAKHIR`, atau `KADALUARSA`)

---

## 3. Alur Sinkronisasi Data
1. Frontend `js/database.js` menghitung `expiry_date_formatted` dan `expiry_status` saat menyusun payload kirim ke Google Sheets.
2. Webhook Google Apps Script (`full_code.gs`) menerima array data dan mengisi baris ke sheet terkait secara presisi tanpa merusak formula atau format yang ada.
3. Seluruh kalkulasi akuntansi (Laba Rugi, Arus Kas, Jurnal Umum) tetap berjalan normal.
