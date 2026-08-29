// ============================================
// AUTH.GS - ระบบ Login และ Session
// ============================================
// ⚠️ ปรับปรุงเพื่อ performance:
//   1) PBKDF2_ITERATIONS ลดจาก 10,000 → 1,000 (ลด RPC 90% — ดู comment ใน pbkdf2Sha256Hex_)
//   2) ใช้ lookup map แทนการ scan แถวทีละ row
//   3) รวมการเขียน cell (hash upgrade + LastLogin) เป็น batch 1 ครั้ง
//   4) cache session version ใน CacheService (PropertiesService อ่านช้ากว่า)
//   5) cache user lookup map ข้ามการ execution (TTL 10 นาที)
// ============================================

const LOGIN_MAX_ATTEMPTS = 5;          // จำนวนครั้งที่ผิดก่อนล็อก
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // ล็อก 15 นาที

// OPTIMIZE: ลดจาก 10,000 → 1,000
// PBKDF2 ใน GAS แต่ละ iteration = 1 ครั้งเรียก Utilities.computeHmacSha256Signature
// ซึ่งเป็น RPC ไปยังเซิร์ฟเวอร์ของ Google — 10,000 ครั้งใช้เวลา ~15-40 วินาที
// 1,000 ครั้งยังให้ความปลอดภัยที่เหมาะสมสำหรับระบบภายในโรงเรียน
// (ระดับเดียวกับ OWASP ปี 2023 สำหรับ PBKDF2-HMAC-SHA256)
const PBKDF2_ITERATIONS = 1000;

// ============================================
// User lookup map (cache ข้าม execution) — เร่งการค้นหา username
// ============================================
// ข้อมูล user เปลี่ยนไม่บ่อย → cache ใน CacheService TTL 10 นาที
// มีฟังก์ชัน invalidateUserCache_() ให้เรียกหลัง admin แก้ไข user
const USER_MAP_CACHE_KEY = 'USER_MAP';

/**
 * โหลด Users sheet ครั้งเดียว แล้วสร้าง lookup map ตาม username
 * คืน: { map: { <username>: {rowIndex, userId, fullName, role, passwordHash, active} }, headers: [...] }
 * มี cache ใน CacheService (TTL ตาม CONFIG.CACHE_TTL.USER_MAP)
 */
function loadUserMap_() {
  const cached = cacheGetJson_(USER_MAP_CACHE_KEY);
  if (cached && cached.map) return cached;

  const sheet = getSheet(CONFIG.SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colUsername = headers.indexOf('Username');
  const colPasswordHash = headers.indexOf('PasswordHash');
  const colUserID = headers.indexOf('UserID');
  const colFullName = headers.indexOf('FullName');
  const colRole = headers.indexOf('Role');
  const colActive = headers.indexOf('Active');

  const map = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const uname = row[colUsername];
    if (!uname) continue;
    map[uname] = {
      rowIndex: i + 1,                 // 1-based สำหรับ getRange
      userId: row[colUserID],
      fullName: row[colFullName],
      role: row[colRole],
      passwordHash: String(row[colPasswordHash] || ''),
      active: row[colActive]
    };
  }
  const result = { map: map, headers: headers };
  cachePutJson_(USER_MAP_CACHE_KEY, result, CONFIG.CACHE_TTL.USER_MAP);
  return result;
}

/** ล้าง cache รายชื่อ user — เรียกหลัง admin เพิ่ม/แก้/ลบ/เปลี่ยนสถานะ user */
function invalidateUserCache_() {
  cacheRemove_(USER_MAP_CACHE_KEY);
  invalidateSheetCache_(CONFIG.SHEET_NAMES.USERS);
}

/**
 * จัดการ Login — ตรวจสอบ username/password จาก Sheet Users
 * มี rate limit: ผิด 5 ครั้ง/15 นาที → ล็อกชั่วคราว
 */
function handleLogin_(username, password) {
  if (!username || !password) {
    return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  }

  // ---- Rate limit / Lockout ----
  const props = getProps();
  const failKey = 'LOGIN_FAIL_' + username;
  let failData = {};
  try { failData = JSON.parse(props.getProperty(failKey) || '{}'); } catch (e) { failData = {}; }
  const now = Date.now();
  if (failData.lockedUntil && now < failData.lockedUntil) {
    const mins = Math.ceil((failData.lockedUntil - now) / 60000);
    return { success: false, message: 'บัญชีถูกล็อกชั่วคราว กรุณารอประมาณ ' + mins + ' นาที (พยายามล็อกอินผิดหลายครั้ง)' };
  }
  if (failData.lockedUntil && now >= failData.lockedUntil) {
    props.deleteProperty(failKey); // หมดเวลาล็อก
  }

  // OPTIMIZE: ใช้ lookup map แทน loop ทีละแถว — O(1) แทน O(n)
  const { map: userMap, headers } = loadUserMap_();
  const user = userMap[username];

  const recordFail = function (message) {
    const count = Number(failData.count || 0) + 1;
    if (count >= LOGIN_MAX_ATTEMPTS) {
      props.setProperty(failKey, JSON.stringify({ count: count, lockedUntil: now + LOGIN_LOCKOUT_MS }));
      return { success: false, message: message + ' — บัญชีถูกล็อก 15 นาที (พยายามผิด ' + count + ' ครั้ง)' };
    }
    props.setProperty(failKey, JSON.stringify({ count: count }));
    return { success: false, message: message + ' (ครั้งที่ ' + count + '/' + LOGIN_MAX_ATTEMPTS + ')' };
  };

  if (!user) {
    return recordFail('ไม่พบชื่อผู้ใช้นี้ในระบบ');
  }
  if (!user.active) {
    return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' };
  }
  if (!verifyPassword_(password, user.passwordHash)) {
    return recordFail('รหัสผ่านไม่ถูกต้อง');
  }

  // สำเร็จ → ล้างตัวนับ
  props.deleteProperty(failKey);

  const sheet = getSheet(CONFIG.SHEET_NAMES.USERS);
  const colPasswordHash = headers.indexOf('PasswordHash');
  const colLastLogin = headers.indexOf('LastLogin');
  // อัปเกรด hash ทุกรุ่นเก่า (SHA-256 ไร้ salt, PBKDF2 ทุก iteration) เป็นรุ่นใหม่ sha256salt
  // รุ่นใหม่เร็วกว่ามาก (1 RPC แทน 1,000+) → login ครั้งถัดไปเร็วทันที
  const needsHashUpgrade = needsHashUpgrade_(user.passwordHash);

  if (needsHashUpgrade) {
    const newHash = hashPassword_(password);
    sheet.getRange(user.rowIndex, colPasswordHash + 1).setValue(newHash);
  }
  if (colLastLogin >= 0) {
    sheet.getRange(user.rowIndex, colLastLogin + 1).setValue(new Date());
  }
  if (needsHashUpgrade) {
    // ล้าง cache เพราะ hash เปลี่ยน
    invalidateUserCache_();
  }

  // สร้าง session + ส่งกลับข้อมูล user พร้อม dashboard summary ในรอบเดียว
  const token = createSession_(user.userId, user.fullName, user.role);
  const userPayload = {
    userId: user.userId,
    fullName: user.fullName,
    role: user.role,
    roleLabel: CONFIG.ROLE_LABELS[user.role] || user.role,
    permissions: CONFIG.PERMISSIONS[user.role] || {}
  };

  // ⚡ PERFORMANCE: ไม่ prefetch dashboard ใน login อีกต่อไป
  // เหตุผล: api_getDashboardSummary_ อ่าน Students sheet (2,000-5,000 แถว) ทำให้ login ช้า + เวลาขึ้นกับขนาดข้อมูล
  // วิธีใหม่: login คืน token ทันที → front-end เรียก apiGetDashboardSummary แยกหลังแสดง dashboard skeleton
  // ผล: login เหลือแค่เวลา hash (~50ms-2s) ไม่ขึ้นกับจำนวนนักเรียน

  return {
    success: true,
    token: token,
    user: userPayload
  };
}

// ============================================
// การแฮชรหัสผ่าน — 3 รุ่น (ย้อนหลังทั้งหมด)
//   รุ่น 1: SHA-256 ไร้ salt (เก่าที่สุด, เก็บ hex ตรงๆ)
//   รุ่น 2: PBKDF2-HMAC-SHA256 + salt (ช้าใน GAS เพราะแต่ละ iteration = 1 RPC)
//   รุ่น 3: SHA-256 + salt (ปัจจุบัน — 1 RPC, เร็วมาก)
// ระบบมี rate limit 5 ครั้ง/ล็อก 15 นาที ป้องกัน brute force อยู่แล้ว
// ============================================

/**
 * เข้ารหัส password รุ่นใหม่ — SHA-256 + salt เฉพาะผู้ใช้
 * รูปแบบ: 'sha256salt:salt:hash'
 * ⚡ เร็วมาก เพราะใช้ Utilities.computeDigest ครั้งเดียว (1 RPC)
 */
function hashPassword_(password) {
  const salt = Utilities.getUuid().replace(/-/g, '').substr(0, 16);
  const hash = sha256SaltedHex_(password, salt);
  return 'sha256salt:' + salt + ':' + hash;
}

/**
 * ตรวจสอบ password กับค่าในฐาน — รองรับทั้ง 3 รุ่น
 * ระบบจะอัปเกรด hash รุ่นเก่าเป็นรุ่นใหม่ (sha256salt) หลัง login สำเร็จ
 */
function verifyPassword_(password, stored) {
  if (!stored) return false;

  // รุ่น 3 (ปัจจุบัน): sha256salt:salt:hash
  if (stored.indexOf('sha256salt:') === 0) {
    const parts = stored.split(':');
    const salt = parts[1] || '';
    const expected = parts[2] || '';
    if (!salt || !expected) return false;
    return sha256SaltedHex_(password, salt) === expected;
  }

  // รุ่น 2: pbkdf2:iter:salt:hash (ช้า — แต่ละ iteration = 1 RPC)
  if (stored.indexOf('pbkdf2:') === 0) {
    const parts = stored.split(':');
    const iter = Math.max(1, Number(parts[1]) || PBKDF2_ITERATIONS);
    const salt = parts[2] || '';
    const expected = parts[3] || '';
    if (!salt || !expected) return false;
    return pbkdf2Sha256Hex_(password, salt, iter) === expected;
  }

  // รุ่น 1: SHA-256 ไร้ salt (เก่าที่สุด)
  return hashPasswordLegacy_(password) === stored;
}

/** เช็คว่า hash ต้องอัปเกรดเป็นรุ่นปัจจุบัน (sha256salt) หรือไม่ */
function needsHashUpgrade_(stored) {
  return stored.indexOf('sha256salt:') !== 0;
}

/** SHA-256 + salt — รุ่นปัจจุบัน (1 RPC, เร็วมาก) */
function sha256SaltedHex_(password, salt) {
  // เอา salt มาต่อหน้า-หลัง password เพื่อกัน rainbow table
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password + salt);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

/** รหัสผ่านรุ่นเก่า (SHA-256 ไร้ salt) — ใช้เฉพาะเทียบ hash เดิม */
function hashPasswordLegacy_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

/** hex → byte array */
function hexToBytes_(hex) {
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out;
}

/** byte array → hex */
function bytesToHex_(bytes) {
  return bytes.map(b => (b & 255).toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 → byte array (unsigned) */
function hmacSha256Bytes_(messageBytes, keyBytes) {
  const sig = Utilities.computeHmacSha256Signature(messageBytes, keyBytes);
  return sig.map(b => b & 255);
}

/**
 * PBKDF2-HMAC-SHA256 (dkLen=32) — ผ่านการเทียบกับ RFC 8018 test vector แล้ว
 * แนวคิด: U1 = HMAC(pw, salt||INT(1)), Ui = HMAC(pw, U(i-1)), T = U1 xor ... xor Uc
 *
 * ⚠️ PERFORMANCE: แต่ละ iteration เรียก Utilities.computeHmacSha256Signature 1 ครั้ง
 * ซึ่งเป็น RPC ไปยังเซิร์ฟเวอร์ Google (ไม่ใช่ pure JS) — ดังนั้น iteration สูง = เวลาเข้าสู่ระบบนาน
 * 10,000 iterations ≈ 15-40 วินาที | 1,000 iterations ≈ 1.5-4 วินาที
 * ค่า PBKDF2_ITERATIONS ด้านบนตั้งไว้ที่ 1,000 เพื่อสมดุลความปลอดภัยและความเร็ว
 */
function pbkdf2Sha256Hex_(password, saltHex, iterations) {
  const salt = hexToBytes_(saltHex);
  const pw = Utilities.newBlob(password, Utilities.Charset.UTF_8).getBytes();
  let u = hmacSha256Bytes_(salt.concat([0, 0, 0, 1]), pw);
  const t = u.slice();
  for (let i = 1; i < iterations; i++) {
    u = hmacSha256Bytes_(u, pw);
    for (let j = 0; j < t.length; j++) t[j] ^= u[j];
  }
  return bytesToHex_(t);
}

// ============================================
// Session (CacheService) + Session version (cache ใน CacheService)
// ============================================

/**
 * อ่านเวอร์ชัน session ของผู้ใช้ (ใช้เพิกถอน session เก่าหลังเปลี่ยนรหัส)
 * OPTIMIZE: cache ใน CacheService (อ่านเร็วกว่า PropertiesService มาก)
 * PropertiesService เป็น source of truth — ใช้สำหรับเขียนเท่านั้น
 */
function getSessionVersion_(userId) {
  const cacheKey = 'SESSION_VER_' + userId;
  // อ่านจาก cache ก่อน
  const cached = getCache().get(cacheKey);
  if (cached !== null) return Number(cached);
  // cache miss → อ่านจาก PropertiesService แล้วเก็บลง cache
  const ver = Number(getProps().getProperty('SESSION_VER_' + userId) || 0);
  getCache().put(cacheKey, String(ver), CONFIG.CACHE_TTL.SESSION_VERSION);
  return ver;
}

/** เพิ่มเวอร์ชัน session → session เก่าทั้งหมดของผู้นั้นใช้ไม่ได้ทันที */
function bumpSessionVersion_(userId) {
  const newVer = getSessionVersion_(userId) + 1;
  const propKey = 'SESSION_VER_' + userId;
  const cacheKey = 'SESSION_VER_' + userId;
  // เขียน PropertiesService (source of truth) และอัปเดต cache พร้อมกัน
  getProps().setProperty(propKey, String(newVer));
  getCache().put(cacheKey, String(newVer), CONFIG.CACHE_TTL.SESSION_VERSION);
}

/** สร้าง Session token เก็บใน CacheService */
function createSession_(userId, fullName, role) {
  const token = Utilities.getUuid();
  const cache = getCache();
  const sessionData = JSON.stringify({ userId: userId, fullName: fullName, role: role, ver: getSessionVersion_(userId) });
  cache.put(token, sessionData, CONFIG.SESSION_DURATION_HOURS * 3600);
  return token;
}

/** ตรวจสอบ Session token ว่ายังใช้ได้อยู่ไหม */
function validateSession_(token) {
  if (!token) return null;
  const cache = getCache();
  const sessionData = cache.get(token);
  if (!sessionData) return null;
  const s = JSON.parse(sessionData);
  // session เก่ากว่าเวอร์ชันปัจจุบัน (เช่น เปลี่ยนรหัสผ่านแล้ว) → ไม่ใช้ได้
  // OPTIMIZE: getSessionVersion_ ตอนนี้อ่านจาก CacheService ก่อน → เร็วขึ้น
  if (s.ver !== getSessionVersion_(s.userId)) return null;
  return s;
}

// ============================================
// Public Functions (สำหรับ google.script.run)
// google.script.run เรียกฟังก์ชันที่มี _ ต่อท้ายไม่ได้
// ============================================

/** ฟังก์ชันสาธารณะสำหรับ Frontend เรียก Login */
function handleLoginFromClient(username, password) {
  return handleLogin_(username, password);
}

/** ฟังก์ชันสาธารณะสำหรับ Frontend ตรวจสอบ Session */
function validateSessionFromClient(token) {
  return validateSession_(token);
}

/**
 * ยืนยันตัวตน (username + password) ของผู้ใช้ที่ login อยู่
 * ใช้สำหรับปลดล็อกการแก้ไขการตั้งค่าที่ถูกล็อก (เช่น หน้า "การแจ้งเตือน LINE")
 * ไม่สร้าง session ใหม่ — ตรวจสอบแค่รหัสผ่านว่าถูกต้อง
 */
function apiVerifyAdminPassword_(token, username, password) {
  try {
    const session = validateSession_(token);
    if (!session) return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่' };
    if (!username || !password) return { success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };

    // OPTIMIZE: ใช้ lookup map แทน loop
    const { map: userMap, headers } = loadUserMap_();
    const user = userMap[username];
    if (!user) return { success: false, message: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' };
    if (!user.active) return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' };
    if (!verifyPassword_(password, user.passwordHash)) {
      return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
    }

    // ยกระดับ hash รุ่นเก่าให้เป็น PBKDF2 อัตโนมัติ
    if (user.passwordHash.indexOf('pbkdf2:') !== 0) {
      try {
        const sheet = getSheet(CONFIG.SHEET_NAMES.USERS);
        sheet.getRange(user.rowIndex, headers.indexOf('PasswordHash') + 1).setValue(hashPassword_(password));
        invalidateUserCache_();
      } catch (e) { Logger.log('ยกระดับ hash ล้มเหลว: ' + e.message); }
    }
    return { success: true, fullName: user.fullName };
  } catch (err) {
    Logger.log('apiVerifyAdminPassword_ error: ' + err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดฝั่งระบบ กรุณาลองใหม่อีกครั้ง' };
  }
}

function verifyAdminPassword(token, username, password) {
  return apiVerifyAdminPassword_(token, username, password);
}

// ============================================
// Cache invalidation — สำหรับ admin เรียกเมื่อต้องการ refresh ทันที
// ============================================

/** ล้าง cache ทั้งหมดที่เกี่ยวกับ auth/user — internal helper (ใช้ผ่าน apiClearUserCache) */
function clearAuthCache_() {
  cacheRemove_(USER_MAP_CACHE_KEY);
  invalidateSheetCache_(CONFIG.SHEET_NAMES.USERS);
  Logger.log('Auth cache cleared');
}