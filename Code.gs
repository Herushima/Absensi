/**
 * ====================================================================
 * SISTEM ABSENSI BERBASIS WEB - GOOGLE APPS SCRIPT (v2)
 * ====================================================================
 * Fitur:
 * - Karyawan baru bisa mendaftar sendiri (menunggu persetujuan admin)
 * - Login karyawan pakai ID + PIN untuk halaman Absen
 * - Login Admin (username + password) untuk Dashboard Pengaturan:
 *     - Setujui/Tolak pendaftaran karyawan baru
 *     - Kelola data karyawan (edit, nonaktifkan, reset PIN)
 *     - Kelola shift (tambah/edit/hapus)
 *     - Ganti password admin & tambah akun admin baru
 *     - Laporan: Absen Masuk, Telat, Tidak Hadir
 * - Absen Masuk & Pulang dengan foto kamera + GPS
 *
 * CARA DEPLOY: lihat README.md
 * ====================================================================
 */

// ============ KONFIGURASI ============
var SHEET_KARYAWAN = 'Karyawan';
var SHEET_SHIFT = 'Shift';
var SHEET_ABSENSI = 'Absensi';
var SHEET_ADMIN = 'Admin';
var FOLDER_NAME = 'Absensi_Foto';

// Kolom Karyawan: ID(0) Nama(1) Departemen(2) ShiftID(3) PIN(4) Status(5) TanggalDaftar(6)
// Status: Pending | Aktif | Nonaktif | Ditolak
// Kolom Admin: Username(0) PasswordHash(1) Nama(2) TanggalDibuat(3)

// ============ SETUP AWAL ============
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('Database Absensi');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }

  var shKar = ss.getSheetByName(SHEET_KARYAWAN) || ss.insertSheet(SHEET_KARYAWAN);
  if (shKar.getLastRow() === 0) {
    shKar.appendRow(['ID', 'Nama', 'Departemen', 'ShiftID', 'PIN', 'Status', 'TanggalDaftar']);
    shKar.appendRow(['1001', 'Contoh Nama', 'Rawat Inap', 'S1', '1234', 'Aktif', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')]);
    shKar.setFrozenRows(1);
  }

  var shShift = ss.getSheetByName(SHEET_SHIFT) || ss.insertSheet(SHEET_SHIFT);
  if (shShift.getLastRow() === 0) {
    shShift.appendRow(['ShiftID', 'NamaShift', 'JamMasuk', 'JamPulang', 'ToleransiMenit']);
    shShift.appendRow(['S1', 'Shift Pagi', '07:00', '14:00', 15]);
    shShift.appendRow(['S2', 'Shift Siang', '14:00', '21:00', 15]);
    shShift.appendRow(['S3', 'Shift Malam', '21:00', '07:00', 15]);
    shShift.appendRow(['LIBUR', 'Libur', '', '', 0]);
    shShift.setFrozenRows(1);
  }

  var shAbs = ss.getSheetByName(SHEET_ABSENSI) || ss.insertSheet(SHEET_ABSENSI);
  if (shAbs.getLastRow() === 0) {
    shAbs.appendRow(['Timestamp', 'Tanggal', 'ID', 'Nama', 'Tipe', 'JamAbsen', 'FotoURL',
      'Latitude', 'Longitude', 'Akurasi(m)', 'Alamat', 'Status', 'ShiftNama']);
    shAbs.setFrozenRows(1);
  }

  var shAdmin = ss.getSheetByName(SHEET_ADMIN) || ss.insertSheet(SHEET_ADMIN);
  if (shAdmin.getLastRow() === 0) {
    shAdmin.appendRow(['Username', 'PasswordHash', 'Nama', 'TanggalDibuat']);
    shAdmin.appendRow(['admin', hashPassword_('admin123'), 'Administrator',
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')]);
    shAdmin.setFrozenRows(1);
  }

  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  PropertiesService.getScriptProperties().setProperty('FOLDER_ID', folder.getId());

  Logger.log('Setup selesai. Spreadsheet: ' + ss.getUrl());
  Logger.log('Login admin default -> username: admin | password: admin123 (SEGERA GANTI lewat menu Pengaturan)');
}

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============ SERVE HALAMAN WEB ============
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'absen';
  var file = 'Index';
  var title = 'Absensi Karyawan';
  if (page === 'admin') { file = 'Admin'; title = 'Dashboard Admin'; }
  else if (page === 'daftar') { file = 'Daftar'; title = 'Pendaftaran Karyawan'; }

  return HtmlService.createTemplateFromFile(file).evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============ UTIL ============
function hashPassword_(pass) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pass));
  return Utilities.base64Encode(digest);
}

function tambahMenit_(jamStr, menit) {
  var parts = jamStr.split(':');
  var d = new Date(2000, 0, 1, Number(parts[0]), Number(parts[1]) || 0, 0);
  d.setMinutes(d.getMinutes() + menit);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// ============ AUTH ADMIN ============
function adminLogin(username, password) {
  var sh = getSS().getSheetByName(SHEET_ADMIN);
  var data = sh.getDataRange().getValues();
  var hash = hashPassword_(password);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(username) && data[i][1] === hash) {
      return { success: true, nama: data[i][2] };
    }
  }
  return { success: false, message: 'Username atau password admin salah.' };
}

function checkAdminAuth_(username, password) {
  return adminLogin(username, password).success;
}

function changeAdminPassword(username, oldPassword, newPassword) {
  if (!checkAdminAuth_(username, oldPassword)) {
    return { success: false, message: 'Password lama salah.' };
  }
  if (!newPassword || String(newPassword).length < 6) {
    return { success: false, message: 'Password baru minimal 6 karakter.' };
  }
  var sh = getSS().getSheetByName(SHEET_ADMIN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(username)) {
      sh.getRange(i + 1, 2).setValue(hashPassword_(newPassword));
      return { success: true, message: 'Password berhasil diganti.' };
    }
  }
  return { success: false, message: 'Akun tidak ditemukan.' };
}

function addAdminAccount(creatorUsername, creatorPassword, newUsername, newPassword, newNama) {
  if (!checkAdminAuth_(creatorUsername, creatorPassword)) {
    return { success: false, message: 'Autentikasi admin gagal.' };
  }
  if (!newUsername || !newPassword || String(newPassword).length < 6) {
    return { success: false, message: 'Username wajib diisi & password minimal 6 karakter.' };
  }
  var sh = getSS().getSheetByName(SHEET_ADMIN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(newUsername)) {
      return { success: false, message: 'Username sudah dipakai.' };
    }
  }
  sh.appendRow([newUsername, hashPassword_(newPassword), newNama || newUsername,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')]);
  return { success: true, message: 'Akun admin baru berhasil dibuat.' };
}

function getAdminList(username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  var sh = getSS().getSheetByName(SHEET_ADMIN);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    out.push({ username: data[i][0], nama: data[i][2], tanggal: data[i][3] });
  }
  return { success: true, data: out };
}

// ============ PENDAFTARAN KARYAWAN BARU ============
function getShiftListPublic() {
  var sh = getSS().getSheetByName(SHEET_SHIFT);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] !== 'LIBUR') out.push({ id: data[i][0], nama: data[i][1] });
  }
  return out;
}

function registerEmployee(nama, departemen, shiftId, pin, pinKonfirmasi) {
  if (!nama || !departemen || !shiftId) {
    return { success: false, message: 'Semua kolom wajib diisi.' };
  }
  if (!pin || pin.length < 4) {
    return { success: false, message: 'PIN minimal 4 digit.' };
  }
  if (pin !== pinKonfirmasi) {
    return { success: false, message: 'Konfirmasi PIN tidak sama.' };
  }

  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  var maxId = 1000;
  for (var i = 1; i < data.length; i++) {
    var idNum = parseInt(data[i][0], 10);
    if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
  }
  var newId = String(maxId + 1);
  var tgl = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  sh.appendRow([newId, nama, departemen, shiftId, pin, 'Pending', tgl]);

  return {
    success: true,
    id: newId,
    message: 'Pendaftaran berhasil dikirim. ID Anda: ' + newId + '. Mohon tunggu persetujuan admin sebelum bisa login absen.'
  };
}

// ============ LOGIN KARYAWAN (untuk halaman Absen) ============
function loginEmployee(id, pin) {
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) && String(data[i][4]) === String(pin)) {
      var status = String(data[i][5]);
      if (status === 'Pending') return { success: false, message: 'Akun Anda masih menunggu persetujuan admin.' };
      if (status === 'Ditolak') return { success: false, message: 'Pendaftaran Anda ditolak admin. Hubungi HRD.' };
      if (status === 'Nonaktif') return { success: false, message: 'Akun nonaktif. Hubungi admin.' };
      return { success: true, id: String(data[i][0]), nama: data[i][1], departemen: data[i][2], shiftId: data[i][3] };
    }
  }
  return { success: false, message: 'ID atau PIN salah.' };
}

function findEmployeeAktif_(id, pin) {
  var res = loginEmployee(id, pin);
  return res.success ? res : null;
}

function getShiftMap_() {
  var sh = getSS().getSheetByName(SHEET_SHIFT);
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    map[data[i][0]] = { nama: data[i][1], jamMasuk: data[i][2], jamPulang: data[i][3], toleransi: Number(data[i][4]) || 0 };
  }
  return map;
}

// ============ PROSES ABSEN (MASUK / PULANG) ============
function saveAttendance(employeeId, pin, tipe, photoBase64, lat, lng, akurasi, alamat) {
  var emp = findEmployeeAktif_(employeeId, pin);
  if (!emp) {
    return { success: false, message: 'Sesi login tidak valid, silakan login ulang.' };
  }

  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var tanggal = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var jamAbsen = Utilities.formatDate(now, tz, 'HH:mm:ss');

  var sh = getSS().getSheetByName(SHEET_ABSENSI);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] == emp.id && data[i][1] === tanggal && data[i][4] === tipe) {
      return { success: false, message: 'Anda sudah melakukan absen ' + tipe + ' hari ini pukul ' + data[i][5] + '.' };
    }
  }

  var fotoUrl = '';
  try {
    var folderId = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
    var folder = DriveApp.getFolderById(folderId);
    var base64Data = photoBase64.split(',')[1] || photoBase64;
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg',
      emp.id + '_' + tipe + '_' + tanggal + '_' + jamAbsen.replace(/:/g, '-') + '.jpg');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fotoUrl = 'https://drive.google.com/uc?id=' + file.getId();
  } catch (err) {
    fotoUrl = 'Gagal upload: ' + err.message;
  }

  var shiftMap = getShiftMap_();
  var shift = shiftMap[emp.shiftId] || { nama: '-', jamMasuk: '', jamPulang: '', toleransi: 0 };
  var status = 'Normal';

  if (tipe === 'Masuk' && shift.jamMasuk) {
    var batasTelat = tambahMenit_(shift.jamMasuk, shift.toleransi);
    status = (jamAbsen > batasTelat) ? 'Telat' : 'Tepat Waktu';
  } else if (tipe === 'Pulang' && shift.jamPulang) {
    status = (jamAbsen < shift.jamPulang) ? 'Pulang Cepat' : 'Normal';
  }

  sh.appendRow([now, tanggal, emp.id, emp.nama, tipe, jamAbsen, fotoUrl, lat, lng, akurasi,
    alamat || '', status, shift.nama]);

  return { success: true, message: 'Absen ' + tipe + ' berhasil dicatat.', nama: emp.nama, jam: jamAbsen, status: status, shift: shift.nama };
}

// ============ ADMIN: KELOLA PENDAFTARAN & KARYAWAN ============
function getKaryawanAdmin(username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    out.push({ id: String(data[i][0]), nama: data[i][1], departemen: data[i][2], shiftId: data[i][3], status: data[i][5], tanggal: data[i][6] });
  }
  return { success: true, data: out };
}

function setStatusKaryawan_(id, statusBaru) {
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.getRange(i + 1, 6).setValue(statusBaru);
      return true;
    }
  }
  return false;
}

function approveEmployee(id, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  return setStatusKaryawan_(id, 'Aktif') ? { success: true, message: 'Karyawan disetujui.' } : { success: false, message: 'ID tidak ditemukan.' };
}

function rejectEmployee(id, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  return setStatusKaryawan_(id, 'Ditolak') ? { success: true, message: 'Pendaftaran ditolak.' } : { success: false, message: 'ID tidak ditemukan.' };
}

function updateKaryawanAdmin(id, nama, departemen, shiftId, status, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.getRange(i + 1, 2, 1, 4).setValues([[nama, departemen, shiftId, status]]);
      return { success: true, message: 'Data karyawan diperbarui.' };
    }
  }
  return { success: false, message: 'ID tidak ditemukan.' };
}

function resetPinKaryawan(id, pinBaru, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  if (!pinBaru || String(pinBaru).length < 4) return { success: false, message: 'PIN minimal 4 digit.' };
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sh.getRange(i + 1, 5).setValue(String(pinBaru));
      return { success: true, message: 'PIN berhasil direset.' };
    }
  }
  return { success: false, message: 'ID tidak ditemukan.' };
}

// ============ ADMIN: KELOLA SHIFT ============
function getShiftAdmin(username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  var sh = getSS().getSheetByName(SHEET_SHIFT);
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    out.push({ id: data[i][0], nama: data[i][1], jamMasuk: data[i][2], jamPulang: data[i][3], toleransi: data[i][4] });
  }
  return { success: true, data: out };
}

function saveShiftAdmin(shiftId, nama, jamMasuk, jamPulang, toleransi, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  if (!shiftId || !nama) return { success: false, message: 'ID Shift & nama wajib diisi.' };
  var sh = getSS().getSheetByName(SHEET_SHIFT);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(shiftId)) {
      sh.getRange(i + 1, 2, 1, 4).setValues([[nama, jamMasuk, jamPulang, Number(toleransi) || 0]]);
      return { success: true, message: 'Shift diperbarui.' };
    }
  }
  sh.appendRow([shiftId, nama, jamMasuk, jamPulang, Number(toleransi) || 0]);
  return { success: true, message: 'Shift baru ditambahkan.' };
}

function deleteShiftAdmin(shiftId, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };
  var sh = getSS().getSheetByName(SHEET_SHIFT);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(shiftId)) {
      sh.deleteRow(i + 1);
      return { success: true, message: 'Shift dihapus.' };
    }
  }
  return { success: false, message: 'Shift tidak ditemukan.' };
}

// ============ LAPORAN ============
function getReport(startDate, endDate, filterType, username, password) {
  if (!checkAdminAuth_(username, password)) return { success: false, message: 'Autentikasi admin gagal.' };

  var sh = getSS().getSheetByName(SHEET_ABSENSI);
  var data = sh.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var tgl = data[i][1];
    if (tgl >= startDate && tgl <= endDate) {
      records.push({
        tanggal: tgl, id: String(data[i][2]), nama: data[i][3], tipe: data[i][4],
        jam: data[i][5], foto: data[i][6], lat: data[i][7], lng: data[i][8],
        alamat: data[i][10], status: data[i][11], shift: data[i][12]
      });
    }
  }

  var hadir = records.filter(function (r) { return r.tipe === 'Masuk'; });
  var telat = hadir.filter(function (r) { return r.status === 'Telat'; });
  var tidakHadir = hitungTidakHadir_(startDate, endDate, hadir);

  var hasil;
  if (filterType === 'hadir') hasil = hadir;
  else if (filterType === 'telat') hasil = telat;
  else if (filterType === 'tidak_hadir') hasil = tidakHadir;
  else hasil = records;

  return {
    success: true,
    data: hasil,
    ringkasan: { totalHadir: hadir.length, totalTelat: telat.length, totalTidakHadir: tidakHadir.length }
  };
}

function hitungTidakHadir_(startDate, endDate, hadirRecords) {
  var sh = getSS().getSheetByName(SHEET_KARYAWAN);
  var karyawanData = sh.getDataRange().getValues();
  var employees = [];
  for (var i = 1; i < karyawanData.length; i++) {
    if (String(karyawanData[i][5]) === 'Aktif') {
      employees.push({ id: String(karyawanData[i][0]), nama: karyawanData[i][1], shiftId: karyawanData[i][3] });
    }
  }

  var shiftMap = getShiftMap_();
  var hadirSet = {};
  hadirRecords.forEach(function (r) { hadirSet[r.tanggal + '|' + r.id] = true; });

  var tidakHadir = [];
  var d0 = new Date(startDate + 'T00:00:00');
  var d1 = new Date(endDate + 'T00:00:00');
  for (var d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    var tglStr = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    employees.forEach(function (emp) {
      var shift = shiftMap[emp.shiftId];
      var isLibur = !shift || emp.shiftId === 'LIBUR';
      if (!isLibur && !hadirSet[tglStr + '|' + emp.id]) {
        tidakHadir.push({ tanggal: tglStr, id: emp.id, nama: emp.nama, shift: shift ? shift.nama : '-', status: 'Tidak Hadir' });
      }
    });
  }
  return tidakHadir;
}
