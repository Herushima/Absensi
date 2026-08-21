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
async function apiCall(action, data) {
  data = data || {};
  data.action = action;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Gagal menghubungi server: ' + err.message };
  }
}
