// ============================================================
// Config - ตั้งค่าระบบ
// ============================================================

const CONFIG = {
  // ⚠️ Spreadsheet ID ของ Google Sheets ที่ใช้เป็น Database
  SPREADSHEET_ID: '1X_lQTXUF8yLiCV-nkye7mfAmFyGjAdMuVvXk0jICAQA',
  SCRIPT_ID: '1XaxgmZ6vqLEGP_CIR_KI9H6cMzuOkZjuXYetmSQ816cWRU_fxV1YlMh-',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbydTMIeXgYK-sd_FT8h4BsEinZeFfW-f71Dh6kRggBRIvfT1sTPMy6FTyt-XMKgaqxVMA/exec',

  APP_NAME: 'ระบบบริหารงานกลุ่มบริหารกิจการนักเรียน',
  VERSION: '1.0.0',

  // ============================================================
  // ชื่อ Sheet tabs ทั้งหมด (ภาษาอังกฤษ)
  // ============================================================
  SHEET_NAMES: {
    STUDENTS:           'Students',
    PARENTS:            'Parents',
    USERS:              'Users',
    SCORE_LOGS:         'ScoreLogs',
    LEAVE_REQUESTS:     'LeaveRequests',
    INVITATION_LETTERS: 'InvitationLetters',
    TIMELINE:           'Timeline',
    LINE_BINDINGS:      'LineBindings',
    ANNOUNCEMENTS:      'Announcements',
    AUDIT_LOG:          'AuditLog',
    CONFIG:             'Config',
  },

  // ============================================================
  // ระบบสิทธิ์ (Roles) — ตามสเปกที่ล็อกไว้ 5 roles
  // ============================================================
  ROLES: {
    ADMIN:      'admin',
    DEPUTY:     'deputy',
    ADVISOR:    'advisor',
    DISCIPLINE: 'discipline',
    PATROL:     'patrol',
  },

  ROLE_LABELS: {
    admin:      'ผู้ดูแลระบบ',
    deputy:     'รองผู้อำนวยการ/ผู้บริหาร',
    advisor:    'ครูที่ปรึกษา',
    discipline: 'ครูฝ่ายปกครอง',
    patrol:     'คณะกรรมการสารวัตรนักเรียน',
  },

  // ตาราง permission ตามที่ล็อกไว้:
  // score / approveLeave / editDelete ทุก role ยกเว้น patrol (approveLeave, editDelete = false)
  // manageSystem เฉพาะ admin เท่านั้น
  PERMISSIONS: {
    admin:      { score: true,  approveLeave: true,  editDelete: true,  manageSystem: true  },
    deputy:     { score: true,  approveLeave: true,  editDelete: true,  manageSystem: false },
    advisor:    { score: true,  approveLeave: true,  editDelete: true,  manageSystem: false },
    discipline: { score: true,  approveLeave: true,  editDelete: true,  manageSystem: false },
    patrol:     { score: true,  approveLeave: false, editDelete: false, manageSystem: false },
  },

  // ============================================================
  // คะแนนความประพฤติ
  // ============================================================
  SCORE: {
    INITIAL_SCORE: 100,
    ALERT_INTERVAL: 20,
  },

  // ============================================================
  // Session
  // ============================================================
  // CacheService รองรับ TTL สูงสุด 6 ชม. (21,600 วินาที)
  // ระบบออกแบบให้ session หมดอายุใน 1 วัน แสดงว่าต้องใช้ PropertiesService
  // (อ่านด้านล่าง) — SESSION_DURATION_HOURS ที่นี่ใช้ควบคุมเฉพาะ cache TTL
  // ฝั่ง client จะถือเวลาหมดอายุเอง ถ้าหมดให้ redirect login ใหม่
  SESSION_DURATION_HOURS: 6,

  // ============================================================
  // Cache TTL (วินาที) — ข้อมูลที่เปลี่ยนไม่บ่อย
  // ============================================================
  CACHE_TTL: {
    USER_MAP:        10 * 60,   // 10 นาที — รายชื่อ user ทั้งหมด (lookup map)
    SESSION_VERSION: 30 * 60,   // 30 นาที — เวอร์ชัน session ต่อ user (PropertiesService เป็น source of truth)
    SHEET_META:      30 * 60,   // 30 นาที — ตำแหน่งคอลัมน์ headers ของแต่ละ sheet
    CONFIG_VALUE:    10 * 60,   // 10 นาที — ค่าตั้งค่าจาก Sheet Config
  },

  // ============================================================
  // ข้อมูลโรงเรียน (สำหรับหนังสือราชการ)
  // ============================================================
  SCHOOL_INFO: {
    NAME: 'โรงเรียนสมเด็จพิทยาคม',
    ADDRESS: 'อำเภอสมเด็จ จังหวัดกาฬสินธุ์',
    POSTAL_CODE: '๔๖๑๕๐',
    PHONE: '๐๘๖-๔๕๖๓๑๐๕',
    EMAIL: 'somdetpit.spk@gmail.com',
    MOTTO: 'เรียนดี มีคุณธรรม',
    DEPARTMENT: 'กลุ่มบริหารกิจการนักเรียน',
    LOCATION_DETAIL: 'ห้องกลุ่มบริหารกิจการนักเรียน อาคาร 2 ชั้น 2'
  },

  // ============================================================
  // ผู้ลงนาม (แก้ไขได้ภายหลังผ่าน Sheet Config โดยตรง)
  // ============================================================
  SIGNER_INFO: {
    NAME: 'นายธนวิทย์ ชารีรักษ์',
    POSITION: 'รองผู้อำนวยการสถานศึกษา ปฏิบัติราชการแทน\nผู้อำนวยการโรงเรียนสมเด็จพิทยาคม'
  }
}; // <-- ย้าย }; มาปิด Object CONFIG ที่ตรงนี้แทน

// ============================================================
// Helper Functions — พร้อม request-scoped caching
// ============================================================
// OPTIMIZE: เก็บ Spreadsheet/Sheet object ไว้ในตัวแปร global ของ execution ปัจจุบัน
// เพื่อกันการเปิดซ้ำในคำขอเดียวกัน (openById แต่ละครั้งคือ RPC 1 ครั้ง)
// ค่านี้อยู่ใน memory เฉพาะ execution ปัจจุบันเท่านั้น หมดอายุเมื่อ function จบ
let _ssCache = null;
const _sheetCache = {};

/**
 * เปิด Spreadsheet หลักของระบบ — cache ใน request scope (เปิดครั้งเดียวต่อคำขอ)
 */
function getSpreadsheet() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('กรุณาตั้งค่า SPREADSHEET_ID ใน Config.gs');
  }
  if (!_ssCache) {
    _ssCache = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return _ssCache;
}

/**
 * เปิด Sheet ตามชื่อที่กำหนด — cache ใน request scope
 */
function getSheet(sheetName) {
  if (_sheetCache[sheetName]) return _sheetCache[sheetName];
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`ไม่พบ Sheet ชื่อ: ${sheetName}`);
  }
  _sheetCache[sheetName] = sheet;
  return sheet;
}

/** ล้าง cache ของ Spreadsheet/Sheet ใน request ปัจจุบัน — เรียกหลังแก้ไขข้อมูลใน sheet นั้น */
function invalidateSheetCache_(sheetName) {
  if (sheetName) {
    delete _sheetCache[sheetName];
  } else {
    _ssCache = null;
    for (const k in _sheetCache) delete _sheetCache[k];
  }
}

// ============================================================
// CacheService helpers — สำหรับข้อมูลที่เปลี่ยนไม่บ่อย (ข้ามการ execution)
// ============================================================
function getCache() { return CacheService.getScriptCache(); }
function getProps() { return PropertiesService.getScriptProperties(); }

function cacheGetJson_(key) {
  const raw = getCache().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cachePutJson_(key, value, ttlSeconds) {
  getCache().put(key, JSON.stringify(value), ttlSeconds);
}

function cacheRemove_(key) {
  getCache().remove(key);
}
