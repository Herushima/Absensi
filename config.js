// ====================================================================
// KONFIGURASI API - GANTI SESUAI URL DEPLOYMENT GOOGLE APPS SCRIPT ANDA
// ====================================================================
// Cara dapat URL ini: script.google.com -> project Anda -> Deploy ->
// Manage deployments -> copy "Web app URL" (diakhiri /exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbwqQlEwk5N3tTOi9XLWdWn2uqizplhzkNeT-RcvWT-Vee0ytvxLQ5V_VTtEYZTvHcxH/exec';

// Helper pemanggil API. Selalu POST dengan Content-Type text/plain
// (bukan application/json) supaya browser TIDAK mengirim preflight
// OPTIONS request dulu -- Google Apps Script tidak menangani OPTIONS,
// jadi kalau pakai application/json biasa akan gagal karena CORS.
//
// CATATAN: Apps Script kadang me-redirect request ke domain lain
// (script.googleusercontent.com) sebelum diproses. Kalau ini terjadi,
// sebagian browser "membuang" isi body dari request POST tadi, jadi
// server menerima data kosong. Untuk jaga-jaga, data (kalau ukurannya
// kecil, misalnya login/daftar/laporan) DIKIRIM DUA JALUR SEKALIGUS:
// lewat body POST seperti biasa, DAN diselipkan di URL (?payload=...).
// Kalau body-nya hilang di jalan, server masih bisa membaca dari URL.
// Untuk data besar (foto absen), hanya dikirim lewat body karena
// tidak muat di URL.
async function apiCall(action, data) {
  data = data || {};
  data.action = action;
  const payload = JSON.stringify(data);

  var url = API_URL;
  if (payload.length < 6000) {
    url += (API_URL.indexOf('?') === -1 ? '?' : '&') + 'payload=' + encodeURIComponent(payload);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Gagal menghubungi server: ' + err.message };
  }
}
