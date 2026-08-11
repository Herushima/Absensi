# Sistem Absensi Berbasis Web (Google Apps Script) — v2

Sistem absensi karyawan dengan backend 100% Google Apps Script — tanpa hosting/database eksternal.
Data tersimpan di **Google Sheets**, foto absen tersimpan di **Google Drive**.

## Fitur
- **Karyawan mendaftar sendiri** lewat menu Daftar → status "Pending" → menunggu disetujui admin
- **Login karyawan** pakai ID + PIN untuk absen (bukan pilih nama dari daftar terbuka)
- Absen **Masuk** & **Pulang**: foto kamera HP + titik GPS sebagai bukti/timestamp
- Deteksi otomatis **Telat** & **Pulang Cepat** berdasarkan jam shift & toleransi
- Cegah absen dobel per hari
- **Login Admin** (username + password, password di-hash) menuju **Dashboard**:
  - Setujui / Tolak pendaftaran karyawan baru
  - Kelola karyawan (edit data, nonaktifkan, reset PIN)
  - Kelola shift (tambah / edit / hapus)
  - Ganti password sendiri & tambah akun admin baru
  - Laporan: Absen Masuk, Telat, Tidak Hadir (per rentang tanggal, export CSV)

## Isi File
| File | Fungsi |
|---|---|
| `Code.gs` | Semua logika backend |
| `Index.html` | Halaman **Absen** — login ID+PIN, kamera, GPS |
| `Daftar.html` | Halaman **Pendaftaran** karyawan baru |
| `Admin.html` | **Dashboard Admin** — login + semua menu pengaturan & laporan |

## Cara Instalasi

1. Buka [script.google.com](https://script.google.com) → **New project**
2. Buat file dengan nama **persis sama**:
   - `Code.gs` (timpa isi bawaan)
   - `Index.html`, `Daftar.html`, `Admin.html` (klik ikon **+** → HTML untuk masing-masing)
3. Salin isi tiap file dari paket ini ke Apps Script Editor
4. Pilih fungsi **`setup`** di dropdown atas → klik **Run** (▶️)
   - Izinkan akses Sheets & Drive saat diminta
   - Otomatis membuat Sheet "Database Absensi", folder Drive "Absensi_Foto", dan **akun admin default**
5. **Deploy → New deployment**
   - Type: **Web app**, Execute as: **Me**, Who has access: **Anyone**
   - Klik **Deploy**, salin URL yang muncul
6. Buka URL tersebut di HP → itu halaman **Absen** (login ID+PIN)
   - Tambahkan `?page=daftar` → halaman **Pendaftaran** karyawan baru
   - Tambahkan `?page=admin` → halaman **Login Admin / Dashboard**

## Login Admin Default
```
Username: admin
Password: admin123
```
⚠️ **Segera ganti** lewat tab **Pengaturan** di Dashboard setelah pertama kali login.

## Alur Kerja
1. Karyawan baru buka `?page=daftar` → isi Nama, Departemen, pilih Shift, buat PIN → kirim → dapat **ID** dan status **Pending**
2. Admin login ke `?page=admin` → tab **Pendaftaran Baru** → klik **Setujui** (atau **Tolak**)
3. Setelah disetujui (status jadi **Aktif**), karyawan bisa login di halaman Absen pakai **ID + PIN**
4. Karyawan ambil foto selfie → GPS otomatis terdeteksi → klik **Absen Masuk** / **Absen Pulang**
5. Status **Telat** dihitung otomatis: jam absen masuk > (jam masuk shift + toleransi menit)
6. Admin bisa lihat semua laporan, kelola data karyawan/shift, reset PIN karyawan yang lupa, dan atur akun admin lain — semua dari Dashboard

## Data Awal (bawaan dari `setup()`)
**Sheet `Karyawan`**: 1 contoh karyawan aktif (ID 1001, PIN 1234) — silakan hapus/ganti
**Sheet `Shift`**: Shift Pagi (07:00–14:00), Siang (14:00–21:00), Malam (21:00–07:00), dan `LIBUR` (tidak dihitung "Tidak Hadir")
**Sheet `Admin`**: 1 akun admin default (lihat di atas)

Semua bisa diubah lewat Dashboard tanpa perlu edit Sheet manual (kecuali untuk audit/investigasi khusus).

## Catatan Keamanan & Privasi
- Password admin disimpan dalam bentuk **hash SHA-256**, bukan teks biasa
- PIN karyawan disimpan sebagai teks biasa di Sheet — batasi akses Sheet hanya untuk admin/HRD
- Foto absen tersimpan di Drive dengan akses "siapa saja yang punya link" — sesuaikan bila perlu lebih privat
- GPS bergantung pada izin lokasi HP karyawan (browser minta izin di awal)
- Setiap fungsi admin (kelola karyawan/shift, laporan) memverifikasi username+password di server setiap kali dipanggil — jadi selalu perlu memasukkan ulang kredensial yang valid, bukan sekadar sesi lokal

## Kustomisasi Lanjutan (opsional, tinggal minta)
- Notifikasi WhatsApp/Telegram otomatis saat ada yang Telat atau saat ada pendaftaran baru
- Rekap bulanan otomatis terkirim email tiap tanggal 1
- Absen berbasis QR code lokasi (anti titip absen)
- Riwayat absen pribadi yang bisa dilihat karyawan sendiri
