// ============================================
// DASHBOARDSERVICE.GS - สรุปข้อมูลภาพรวมสำหรับ Dashboard
// ============================================
// ⚡ ปรับปรุงเพื่อ performance:
//   1) ใช้ getDataRange().getValues() ครั้งเดียว (1 RPC) แล้วเลือกคอลัมน์ใน JS
//      — เดิมใช้ minCol-maxCol range ทำให้อ่านคอลัมน์โดยรอบด้วย (อาจ 28 คอลัมน์แทนที่จะ 7)
//   2) Timeline อ่านแค่ 200 แถวล่าสุด แทนทั้ง sheet
//   3) Cache ผลลัพธ์ summary ทั้งก้อน TTL 5 นาที — ลด cost เมื่อหลายคน login ใกล้กัน
// ============================================

// Cache key สำหรับ dashboard summary
const DASHBOARD_CACHE_KEY = 'DASHBOARD_SUMMARY';
const DASHBOARD_CACHE_TTL = 300; // 5 นาที (300 วินาที)

/** ล้าง cache ของ dashboard — เรียกเมื่อมีการเพิ่ม/แก้คะแนนหรือ event ใหม่ */
function invalidateDashboardCache_() {
  cacheRemove_(DASHBOARD_CACHE_KEY);
}

function api_getDashboardSummary_(token) {
  try {
    const session = validateSession_(token);
    if (!session) return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่' };

    // ⚡ Cache: ลองอ่านจาก cache ก่อน — dashboard ไม่จำเป็นต้อง real-time ทุกครั้ง
    const cached = cacheGetJson_(DASHBOARD_CACHE_KEY);
    if (cached && cached.success) {
      cached._fromCache = true;
      return cached;
    }

    // ---- Students: อ่านทั้ง sheet ครั้งเดียว (1 RPC) แล้วเลือกคอลัมน์ใน JS ----
    // วิธีนี้ดีกว่า getRange(2, minCol, rows, maxCol-minCol+1) เพราะ:
    //   - ถ้าคอลัมน์ที่ต้องการกระจายห่างกัน (col 1 ถึง col 28) range จะอ่าน 28 คอลัมน์ทั้งหมด
    //   - getDataRange ก็อ่าน 28 คอลัมน์เหมือนกัน แต่เป็น 1 RPC ที่ GAS optimize ไว้แล้ว
    //   - แล้วเลือกเฉพาะคอลัมน์ที่ต้องการใน JS (ไม่มี RPC เพิ่ม)
    const studentSheet = getSheet(CONFIG.SHEET_NAMES.STUDENTS);
    const sHeaders = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn()).getValues()[0];
    const colMap = {};
    ['StudentID', 'Prefix', 'FirstName', 'LastName', 'Grade', 'CurrentScore', 'LineLinked'].forEach(function (h) {
      colMap[h] = sHeaders.indexOf(h);
    });

    const lastRow = studentSheet.getLastRow();
    let totalStudents = 0, atRisk = 0, lineLinked = 0;
    const nameMap = {};
    const gradeOrder = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    const gradeCounts = {};
    gradeOrder.forEach(g => gradeCounts[g] = 0);

    if (lastRow > 1) {
      // ⚡ 1 RPC: อ่านทั้ง sheet ครั้งเดียว
      const allData = studentSheet.getDataRange().getValues();

      for (let i = 1; i < allData.length; i++) {  // i=1 ข้าม header
        const row = allData[i];
        const sid = row[colMap['StudentID']];
        const grade = row[colMap['Grade']];
        const score = Number(row[colMap['CurrentScore']]);
        const linked = row[colMap['LineLinked']];

        totalStudents++;
        if (score < 70) atRisk++;
        if (linked === true) lineLinked++;
        if (gradeCounts.hasOwnProperty(grade)) gradeCounts[grade]++;
        nameMap[sid] = (row[colMap['Prefix']] || '') + (row[colMap['FirstName']] || '') + ' ' + (row[colMap['LastName']] || '');
      }
    }

    // ---- Timeline: อ่านแค่ 200 แถวล่าสุด ----
    const timelineSheet = getSheet(CONFIG.SHEET_NAMES.TIMELINE);
    const tLastRow = timelineSheet.getLastRow();
    let recentTimeline = [];
    let todayEvents = 0;
    const todayStr = new Date().toDateString();

    if (tLastRow > 1) {
      const tHeaders = timelineSheet.getRange(1, 1, 1, timelineSheet.getLastColumn()).getValues()[0];
      const colEventType = tHeaders.indexOf('EventType');
      const colStudentID = tHeaders.indexOf('StudentID');
      const colTitle = tHeaders.indexOf('Title');
      const colDesc = tHeaders.indexOf('Description');
      const colTimestamp = tHeaders.indexOf('Timestamp');

      // อ่านสูงสุด 200 แถวล่าสุด
      const readCount = Math.min(200, tLastRow - 1);
      const startRow = tLastRow - readCount + 1;
      const tData = timelineSheet.getRange(startRow, 1, readCount, timelineSheet.getLastColumn()).getValues();

      const events = [];
      for (let i = 0; i < tData.length; i++) {
        const ts = tData[i][colTimestamp];
        if (ts && new Date(ts).toDateString() === todayStr) todayEvents++;
        events.push({
          EventType: tData[i][colEventType],
          StudentID: tData[i][colStudentID],
          Title: tData[i][colTitle],
          Description: tData[i][colDesc],
          Timestamp: ts
        });
      }

      events.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp));
      recentTimeline = events.slice(0, 8).map(ev => ({
        EventType: ev.EventType,
        Title: (nameMap[ev.StudentID] ? nameMap[ev.StudentID] + ' — ' : '') + ev.Title,
        Description: ev.Description,
        Timestamp: ev.Timestamp
      }));
    }

    const result = {
      success: true,
      summary: { totalStudents, atRisk, lineLinked, todayEvents },
      gradeDistribution: { labels: gradeOrder, counts: gradeOrder.map(g => gradeCounts[g]) },
      recentTimeline
    };

    // ⚡ Cache ผลลัพธ์ 5 นาที — ลด cost เมื่อหลายคน login ใกล้กัน
    cachePutJson_(DASHBOARD_CACHE_KEY, result, DASHBOARD_CACHE_TTL);

    return result;
  } catch (err) {
    Logger.log('API error: ' + err.message);
    return { success: false, message: 'เกิดข้อผิดพลาดฝั่งระบบ กรุณาลองใหม่อีกครั้ง' };
  }
}

// ============================================
// Public Function (สำหรับ google.script.run)
// ============================================
function apiGetDashboardSummary(token) {
  return api_getDashboardSummary_(token);
}