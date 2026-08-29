# 📋 เอกสารสรุปภาพรวมโครงการ (Project Overview)

**Student Affairs System — ระบบบริหารงานกลุ่มบริหารกิจการนักเรียน**
เวอร์ชันเอกสาร: 1.0 | อัปเดตล่าสุด: 15 สิงหาคม 2569

---

## 1. บทนำ / วัตถุประสงค์

ระบบสารสนเทศสำหรับงาน **กลุ่มบริหารกิจการนักเรียน** ของโรงเรียน ใช้จัดการงานประจำวันของฝ่ายปกครอง ได้แก่

- บันทึกและติดตาม **คะแนนความประพฤติ** ของนักเรียน
- รับ-อนุมัติ **คำขออนุญาตออกนอกพื้นที่** (แทนคำว่า "ลาออก" เดิม)
- ออก **หนังสือเชิญผู้ปกครอง** อัตโนมัติ (หนังสือราชการ + ลายเซ็น)
- แจ้ง **ข่าวประชาสัมพันธ์** ถึงผู้ปกครอง
- ให้ผู้ปกครองตรวจสอบข้อมูลนักเรียนผ่าน **LINE LIFF** (คะแนน/คำร้อง/ข่าว/หนังสือ) และรับ **การแจ้งเตือนผ่าน LINE** แบบเรียลไทม์
- รายงานสรุปสำหรับผู้บริหาร (คะแนนรายห้อง/รายสาเหตุ, สถิติคำร้อง-หนังสือ)

ระบบพัฒนาแบบ **แยกติดตั้งต่อโรงเรียน (per-case)** — โฟลเดอร์นี้เป็น **Master** นำไป Clone + ตั้งค่าใหม่ต่อลูกค้า (ดู `docs/INSTALL_GUIDE.md`)

---

## 2. ผู้ใช้งานและบทบาท

| บทบาท | กลุ่ม | ความสามารถหลัก |
|---|---|---|
| **Admin** (ผู้ดูแลระบบ) | ทีม IT / ผู้ดูแล | จัดการผู้ใช้, ตั้งค่าระบบ, LINE, ภาคเรียน + ทุกสิทธิ์ของครู |
| **Deputy** (รองผู้อำนวยการ) | ผู้บริหาร | ดูรายงาน, บันทึกคะแนน, อนุมัติคำร้อง, แก้/ลบข้อมูล |
| **Advisor** (ครูที่ปรึกษา) | ครู | บันทึกคะแนน, อนุมัติคำร้อง, แก้/ลบข้อมูลนักเรียนในปกครอง |
| **Discipline** (ครูฝ่ายปกครอง) | ครู | บันทึกคะแนน, อนุมัติคำร้อง, แก้/ลบข้อมูล |
| **Patrol** (คณะกรรมการสารวัตรนักเรียน) | นักเรียน/กรรมการ | บันทึกคะแนนความประพฤติ **เฉพาะ** (อนุมัติคำร้อง/แก้ไข-ลบไม่ได้) |
| **ผู้ปกครอง / นักเรียน** | ภายนอก | ใช้งานผ่าน **LINE LIFF** — ผูกบัญชี (เบอร์โทร/เลขบัตร + PIN 6 หลัก), ดูคะแนน/ข่าว/หนังสือ/สถานะคำร้อง, ส่งคำร้อง |

---

## 3. ฟีเจอร์หลัก (Modules)

### 3.1 การจัดการนักเรียน (StudentService)
- เพิ่ม/แก้ไข/ลบ/ค้นหา/นำเข้า (Excel) นักเรียน พร้อมข้อมูลครบ (บัตรประชาชน, ครอบครัว, ที่อยู่, สุขภาพ)
- อัปโหลดรูปนักเรียน → เก็บใน Google Drive (แยกโฟลเดอร์ตามระดับชั้น/ห้อง)
- **ปิดบัง (mask) เลขบัตรประชาชน** ในรายการ/มุมมองที่ไม่มีสิทธิ์แก้ไข
- Timeline กิจกรรมย้อนหลังของนักเรียนแต่ละคน + Audit Log ทุกการแก้ไข

### 3.2 คะแนนความประพฤติ (ScoreService)
- คะแนนเริ่มต้น 100 คะแนน/คน — เพิ่ม/ลดเป็น**จำนวนเต็ม 1–50** (ตรวจทั้ง client + server)
- **ห้ามหักเกินคะแนนคงเหลือ** (ติดลบไม่ได้)
- บันทึก **วัน/เวลาที่เกิดเหตุ** (EventTime) — ย้อนรอยเหตุการณ์ได้
- แจ้งเตือนอัตโนมัติทุก ๆ 20 คะแนนที่ลด (ระดับเตือน)
- แจ้งเตือน LINE เป็น **Flex Message** แสดง **คะแนนปัจจุบัน / คะแนนที่ตัด / คะแนนคงเหลือ**

### 3.3 คำขออนุญาตออกนอกพื้นที่ (LeaveService)
- นักเรียน/ผู้ปกครองส่งคำร้องผ่าน LIFF (วันที่ + เวลาออก + เวลากลับ)
- ครูอนุมัติ/ไม่อนุมัติ (พร้อมเหตุผล) — **LockService กัน race condition**
- บันทึก **เวลาออกจริง/เวลากลับจริง** (หน้างาน) + แจ้งเตือนผู้ปกครองทุกขั้นตอน
- ฝั่งครูเรียก "คำขอลา" ตามหน้าจอเดิม แต่เอกสาร/ข้อความในระบบใช้คำว่า **"ขออนุญาตออกนอกพื้นที่"** ตรงกันทั้งหมด

### 3.4 หนังสือเชิญผู้ปกครอง (LetterService)
- สร้างหนังสือราชการอัตโนมัติ (แบบฟอร์ม + เลขหนังสือ + วันที่ไทย)
- **สร้างฉบับร่างอัตโนมัติ** เมื่อคะแนนนักเรียนลดถึงเกณฑ์กำหนด
- แทรกลายเซ็น (สแกน) + Preview PDF → ยืนยัน/ออกเลขที่ → เก็บใน Drive

### 3.5 LINE OA + LIFF (LineService)
- **LIFF app** (หน้าเว็บผู้ปกครอง, โฮสต์ Netlify) — แท็บ: หน้าแรก (นักเรียนของฉัน), ข่าว, หนังสือ, คำร้อง, **ตั้งค่าระบบ** (เชื่อมบัญชี/เปลี่ยน PIN/ออกจากระบบ)
- **ยืนยันตัวตน LINE ด้วย ID Token จริง** — ส่ง token ไปตรวจที่ LINE API (`/oauth2/v2.1/verify`, RS256) + ตรวจ aud/iss → **ไม่เชื่อ userId จาก client**
- การ์ดเชื่อมบัญชี: ยืนยันด้วย **เบอร์โทรผู้ปกครอง หรือ เลขบัตรประชาชนนักเรียน** (Dropdown) + ตั้ง PIN 6 หลัก (เก็บเป็น hash)
- Push ข้อความแจ้งเตือน (Flex): คะแนน, คำร้อง, หนังสือ, ข่าวประชาสัมพันธ์ (Broadcast)
- หน้า admin: ตั้งค่า Token/LIFF ID (ล็อกด้วยรหัสผ่านก่อนแก้ไข), จัดการการเชื่อมต่อ, ทดสอบส่งข้อความ

### 3.6 รายงาน (ReportService)
- ภาพรวมคะแนนรายห้อง/รายสาเหตุ, สถิติคำร้อง-หนังสือ, ตามช่วงภาคเรียน (ตั้งค่าเปิด-ปิดภาคเรียนได้)
- Export **PDF / Excel** → เก็บไฟล์ใน Drive (เฉพาะผู้มีสิทธิ์ editDelete)

### 3.7 อื่น ๆ
- **Dashboard** สรุปภาพรวม (DashboardService)
- **การจัดการผู้ใช้** (UserService): เพิ่ม/ปิดใช้งาน/รีเซ็ตรหัส, เปลี่ยนรหัสของตนเอง
- **ข่าวประชาสัมพันธ์** (Announcements): สร้าง/ลบ + ส่ง LINE Broadcast
- **การตั้งค่า**: ภาคเรียน, เกณฑ์คะแนน, ข้อมูลโรงเรียน, ผู้ลงนาม (แก้ผ่านหน้าเว็บ/Sheet Config)

---

## 4. เทคโนโลยีที่ใช้ (Tech Stack)

| ชั้น | เทคโนโลยี |
|---|---|
| Backend | **Google Apps Script** (V8 runtime, ภาษา JavaScript) |
| Database | **Google Sheets** (11 ตาราง) + **CacheService** (session) |
| Frontend (Admin) | HTML + CSS + JavaScript (โฮสต์ใน GAS, `google.script.run`) |
| Frontend (ผู้ปกครอง) | **LIFF web** (`liff-web/`, SDK `@line/liff`) → โฮสต์ **Netlify** |
| LINE | LINE Login + LIFF, Messaging API (Push, Flex Message), ID Token verification |
| Cloud | Google Drive (รูปนักเรียน/หนังสือ/รายงาน), Google Docs (เทมเพลตหนังสือ) |
| CI/Dev | VS Code + **clasp**, Git/GitHub |

---

## 5. สถาปัตยกรรมระบบ

```
┌─────────────────┐      ┌──────────────────┐
│ ครู/ผู้บริหาร    │      │  ผู้ปกครอง/นักเรียน │
│  (Web App GAS)  │      │  (LINE app → LIFF)│
└────────┬────────┘      └────────┬─────────┘
         │ google.script.run      │ https://liff.line.me/{LIFF_ID}
         ▼                        ▼
┌──────────────────────────────────────────────┐
│   Google Apps Script (Backend)               │
│   doGet/doPost ── verify ID Token + session  │
│   └─ Service Layer: Student/Score/Leave/     │
│      Letter/Line/Report/User/Dashboard       │
└───────────────┬──────────────┬───────────────┘
                │              │ LINE Messaging API (Push/Flex)
                ▼              ▼
        Google Sheets    LINE OA (ผู้ปกครอง)
        (11 ตาราง)         + Google Drive
```

**Flow การเรียกใช้งาน:**
1. หน้า admin เรียกผ่าน `google.script.run` → `doPost` → ตรวจ **session** → ตรวจ **role/permission** → execute service
2. หน้า LIFF (Netlify) เรียก `GAS_API_URL` → `doPost` → ตรวจ **LINE ID Token** (LINE API) + ตรวจ binding → execute service → ตอบ JSON
3. เหตุการณ์สำคัญ (คะแนน/คำร้อง/หนังสือ/ข่าว) → `sendLinePush_()` → ผู้ปกครองได้รับ Flex Message

---

## 6. โครงสร้างโปรเจกต์

```
student-affairs-system/
├── src/                          ← โค้ด GAS (clasp push ทั้งโฟลเดอร์)
│   ├── appsscript.json           ← config GAS (timezone, scopes, webapp)
│   ├── Code.gs                   ← entry point: doGet / doPost / routing
│   ├── Config.gs                 ← ⚠️ ตั้งค่า: Spreadsheet ID, Script ID, URL, ชื่อโรงเรียน, roles, score
│   ├── Auth.gs                   ← login, PBKDF2 hash, session, rate limit, verify admin password
│   ├── Setup.gs                  ← setupAllSheets(): สร้าง 11 tabs + admin ตั้งต้น
│   ├── StudentService.gs         ← นักเรียน: CRUD/import/รูป/timeline/audit
│   ├── ScoreService.gs           ← คะแนน: add/history/event time
│   ├── LeaveService.gs           ← คำร้อง: สร้าง/อนุมัติ/เวลาจริง (LockService)
│   ├── LetterService.gs          ← หนังสือเชิญ: ร่างอัตโนมัติ/PDF/ลายเซ็น/เลขหนังสือ
│   ├── LineService.gs            ← LINE ทั้งหมด: LIFF API, verify ID token, push/Flex, bindings, ข่าว
│   ├── ReportService.gs          ← รายงาน + export PDF/Excel
│   ├── UserService.gs            ← ผู้ใช้: CRUD/เปลี่ยน-รีเซ็ตรหัส
│   ├── DashboardService.gs       ← สรุปภาพรวม
│   ├── DriveService.gs           ← โฟลเดอร์ Drive + config helpers
│   ├── SetupLetterAssets.gs      ← สร้างเทมเพลตหนังสือ/ลายเซ็นครั้งเดียว
│   ├── Index.html / CSS.html / JavaScript.html  ← UI Admin (ฝั่ง GAS)
│   └── Liff.html                 ← หน้า LIFF เก่า (โฮสต์ใน GAS — สำรอง)
├── liff-web/
│   └── index.html                ← ⚠️ หน้า LIFF v3 (Netlify): LIFF_ID + GAS_API_URL ต้องแก้
├── docs/
│   ├── INSTALL_GUIDE.md          ← คู่มือติดตั้ง (ขั้นตอน + ค่าที่ต้องเปลี่ยน)
│   ├── PROJECT_OVERVIEW.md       ← เอกสารนี้
│   ├── LINE_OA_SETUP.md          ← คู่มือตั้งค่า LINE ฉบับละเอียด
│   └── LIFF_PROBLEM_SUMMARY.md   ← สรุปการแก้ปัญหา LIFF
├── tools/
│   └── create_install_guide_doc.gs ← สคริปต์สร้าง Google Doc คู่มือติดตั้ง
├── .clasp.json                   ← ⚠️ scriptId ของ GAS project
└── README.md
```

**ขนาดโค้ดรวม:** ~12,500 บรรทัด (src + liff-web)

---

## 7. โมเดลข้อมูล (Google Sheets — 11 ตาราง)

| ตาราง | ข้อมูลหลัก |
|---|---|
| `Students` | StudentID, CitizenID, ชื่อ-นามสกุล, ห้อง/เลขที่, DOB, ที่อยู่, CurrentScore, รูป, LineLinked |
| `Parents` | StudentID, ชื่อผู้ปกครอง, ความสัมพันธ์, อาชีพ, **ParentPhone** (ต้องมีเลข 0 นำหน้า) |
| `Users` | Username, **PasswordHash (PBKDF2+salt)**, FullName, Role, Active, LastLogin |
| `ScoreLogs` | LogID, StudentID, Type (+/-), Amount, Reason, ผู้บันทึก, Timestamp, **EventTime** |
| `LeaveRequests` | RequestID, StudentID, เหตุผล, วันที่/เวลาออก/เวลากลับ, Status, ผู้อนุมัติ, **เวลาออก/กลับจริง** |
| `InvitationLetters` | LetterID, เลขหนังสือ, StudentID, เรื่อง, Status, ลายเซ็น, PdfFileID |
| `Timeline` | เหตุการณ์ของนักเรียนแต่ละคน (ย้อนหลัง) |
| `LineBindings` | StudentID, LineUserID, ชื่อผู้ปกครอง, BoundAt, Active, **PinCode (hash)** |
| `Announcements` | หัวข้อ/เนื้อหา/ประเภท/Active/ผู้สร้าง |
| `AuditLog` | บันทึกการแก้ไขทุกครั้ง (ใคร/อะไร/ก่อน-หลัง/เวลา) |
| `Config` | Key/Value: ภาคเรียน, คะแนนเริ่มต้น, เกณฑ์เตือน, LINE Token, LIFF ID |

---

## 8. ระบบสิทธิ์ (Permission Matrix)

| | score | approveLeave | editDelete | manageSystem |
|---|---|---|---|---|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Deputy** | ✅ | ✅ | ✅ | ❌ |
| **Advisor** | ✅ | ✅ | ✅ | ❌ |
| **Discipline** | ✅ | ✅ | ✅ | ❌ |
| **Patrol** | ✅ | ❌ | ❌ | ❌ |

> ทุก endpoint ตรวจสิทธิ์ **ฝั่ง backend** (ไม่ใช่แค่ซ่อน UI) — รวมถึงการ mask ข้อมูลอ่อนไหวตาม role

---

## 9. ความปลอดภัย (สรุปจาก QA Audit)

| หมวด | มาตรการที่ติดตั้ง |
|---|---|
| **รหัสผ่าน** | PBKDF2-HMAC-SHA256 + salt (10,000 รอบ); รองรับ hash เก่า + ยกระดับอัตโนมัติ; PIN 6 หลักบังคับใหม่ |
| **Session** | อายุ 6 ชม. (CacheService), session version — เปลี่ยนรหัส = session เก่าตายทันที |
| **Brute-force** | ล็อกอินผิด 5 ครั้ง → ล็อก 15 นาที (นับต่อบัญชี) |
| **LINE Identity** | ตรวจ **ID Token ผ่าน LINE API** (RS256) + aud/iss — ไม่เชื่อ userId จาก client |
| **สิทธิ์/IDOR** | ตรวจ role ทุก endpoint; mask เลขบัตร; Channel Token/LIFF ID มองเห็นเฉพาะ admin; export เฉพาะ editDelete |
| **Concurrency** | LockService ครอบ: อนุมัติคำร้อง, เวลาจริง, บันทึกคะแนน, ผูก LINE |
| **Input/XSS** | escapeHtml ทุกจุดแสดงผล (admin + liff-web); validation คะแนน 1–50 client+server |
| **Error leak** | ทุก catch → log ภายใน + ข้อความทั่วไป (ไม่รั่วโครงสร้าง/stack) |
| **ข้อมูลอ่อนไหว** | เลขบัตรถูก mask ใน API; PIN/รหัสผ่านเก็บ hash เท่านั้น |

> เอกสารฉบับเต็ม: `QA_Audit_Report_StudentAffairsSystem_2026-08-14.docx`

---

## 10. การติดตั้ง / Deploy (สรุป)

| องค์ประกอบ | วิธี | เอกสารอ้างอิง |
|---|---|---|
| GAS Backend | `clasp push` → Deploy → New version (Execute as: Me, Access: Anyone) | `docs/INSTALL_GUIDE.md` |
| Database | รัน `setupAllSheets()` → สร้าง 11 tabs + admin ตั้งต้น | `docs/INSTALL_GUIDE.md` |
| หน้าเว็บผู้ปกครอง | แก้ `LIFF_ID` + `GAS_API_URL` ใน `liff-web/index.html` → อัปโหลด Netlify | `docs/INSTALL_GUIDE.md` |
| LINE | ตั้งค่าในหน้า "การแจ้งเตือน LINE": Access Token + LIFF App ID | `คู่มือ_ตั้งค่า_LINE_OA_LIFF_ลูกค้า.docx` |

**ค่าที่ต้องเปลี่ยนเมื่อ Clone (สำคัญ):** `src/Config.gs` (SPREADSHEET_ID, SCRIPT_ID, WEB_APP_URL, SCHOOL_INFO), `.clasp.json` (scriptId), `liff-web/index.html` (LIFF_ID, GAS_API_URL) — รายละเอียดครบใน `docs/INSTALL_GUIDE.md` §5

---

## 11. เอกสารที่เกี่ยวข้อง

| เอกสาร | ไฟล์ |
|---|---|
| คู่มือติดตั้งระบบ (Markdown / Word / Google Doc) | `docs/INSTALL_GUIDE.md` / `คู่มือ_ติดตั้ง_ระบบ_StudentAffairs.docx` |
| คู่มือตั้งค่า LINE สำหรับลูกค้า (Word) | `คู่มือ_ตั้งค่า_LINE_OA_LIFF_ลูกค้า.docx` |
| รายงาน QA Audit | `QA_Audit_Report_StudentAffairsSystem_2026-08-14.docx` |
| คู่มือตั้งค่า LINE ฉบับละเอียด | `docs/LINE_OA_SETUP.md` |
| สรุปการแก้ปัญหา LIFF | `docs/LIFF_PROBLEM_SUMMARY.md` |

---

## 12. ประวัติการพัฒนา (Git — ช่วงสำคัญ)

| Commit | รายการ |
|---|---|
| `9f1e185` | หน้า LIFF v3 — แท็บตั้งค่าระบบ + ยืนยันตัวตนด้วยเลขบัตร/เบอร์โทร |
| `172ef48` | ตรวจ LINE ID Token ผ่าน LINE API (RS256) แทน HS256 |
| `24850fe` | ความปลอดภัยตาม QA audit 14 จุด (hash/rate limit/XSS/สิทธิ์/LockService) |
| `a9d6fe1` | บันทึกวัน/เวลาที่เกิดเหตุของคะแนน (ย้อนรอยเหตุการณ์) |
| `223cc3f` | Flex แจ้งเตือนคะแนนแสดงคะแนนปัจจุบัน/ที่ตัด/คงเหลือ |
| `7699ac6` | คำร้องขออนุญาตออกนอกพื้นที่ + ล็อกตั้งค่า LINE |
| `8c27b51` ~ ก่อนหน้า | พื้นฐาน: LIFF, import ข้อมูล, OA setup, ระบบงานหลัก |

---

## 13. สถานะปัจจุบัน / แผนต่อ

- ✅ ระบบหลักครบทุกโมดูล + ความปลอดภัย QA ผ่าน (pending: ลด oauthScopes หลังเทสต์ export)
- ✅ LIFF v3 พร้อมใช้ (ต้อง deploy GAS + Netlify ใหม่หลังแก้โค้ดทุกครั้ง)
- 📌 เอกสารนี้เป็น **Master** — ทุกครั้งที่รับโรงเรียนใหม่ ทำตาม `docs/INSTALL_GUIDE.md`
- 📌 รายงาน QA ยังไม่ได้ commit ขึ้น GitHub (ตัดสินใจได้ว่าจะเก็บใน repo หรือเก็บนอก)
