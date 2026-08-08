# Design Spec: Validasi UI (Tanggal & Error Boundary)

## Tujuan
Meningkatkan keandalan aplikasi dengan mencegah input tanggal di masa depan dan menangani error JavaScript yang tidak tertangani (unhandled exceptions) dengan antarmuka pengguna yang informatif, alih-alih membiarkan aplikasi freeze.

## Ruang Lingkup
Dokumen ini hanya mencakup:
1. Validasi input tanggal pada form transaksi baru.
2. Global Error Handler untuk menangkap error JavaScript yang tidak terduga dan menampilkan modal/UI informatif.

## Pendekatan Desain

### 1. Validasi Tanggal
- **UI Atribut:** Elemen `<input type="date" id="input-date">` di `index.html` akan diatur atribut `max`-nya secara dinamis saat aplikasi di-load (`app.js`). Nilai `max` adalah tanggal hari ini dalam format `YYYY-MM-DD`.
- **Validasi Logika:** Saat fungsi submit/simpan form dipanggil, akan ada pengecekan ulang di level JavaScript. Jika tanggal yang dimasukkan melebihi hari ini, proses penyimpanan dibatalkan dan fungsi alert UI bawaan aplikasi akan dipanggil untuk menampilkan pesan error validasi kepada pengguna.

### 2. Error Boundary (Global Exception Handling)
Karena aplikasi menggunakan arsitektur Vanilla JS (tanpa framework seperti React), kita mengandalkan event listener global.
- **Event Listeners:** Memasang `window.onerror` dan `window.addEventListener('unhandledrejection', ...)` pada awal pemuatan skrip (`app.js`).
- **Modal UI:** Jika error terdeteksi, fungsi handler akan menyisipkan/menampilkan elemen Modal (atau overlay screen) dengan z-index tinggi.
- **Isi Modal:**
  - Judul: "Terjadi Kesalahan Aplikasi" (dengan ikon peringatan merah).
  - Pesan Error: Menampilkan deskripsi error secara teknis namun rapi, untuk mempermudah pelaporan.
  - Tombol: "Salin Pesan Error" (menyalin teks error ke clipboard) dan "Muat Ulang Aplikasi" (memanggil `window.location.reload()`).
- **CSS:** Styling akan ditambahkan ke `css/style.css` untuk memastikan modal ini tampil menarik, menggunakan modern design dengan warna merah sebagai indikator error (Glassmorphism atau shadow yang tegas).

## Pertimbangan & Batasan
- Sistem ini tidak mencegah input tanggal masa lalu (historis), yang diperlukan untuk input nota bulan sebelumnya.
- Error yang disebabkan oleh pemutusan jaringan murni (Network Offline) yang sudah ditangani oleh try-catch lokal mungkin tidak memicu Global Boundary jika tidak di-throw ulang. Ini sesuai desain, karena error jaringan biasa memiliki UI peringatan koneksinya sendiri di fase berikutnya.
