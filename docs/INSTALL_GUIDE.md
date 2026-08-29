# 📘 คู่มือติดตั้งระบบ Student Affairs System (ตั้งแต่ต้นจนจบ)

> สำหรับทีมงานที่นำโปรเจกต์นี้ไป **Clone** แล้วติดตั้งให้โรงเรียน/ลูกค้ารายใหม่
> เวลารวมโดยประมาณ: **45–60 นาที** (ส่วนใหญ่รอสร้าง/ยืนยันค่าใน Console ต่าง ๆ)

---

## ภาพรวมสถาปัตยกรรม

```
ผู้ปกครอง (LINE app)
    │  เปิด LIFF (liff.line.me/{LIFF_ID})
    ▼
หน้าเว็บ liff-web (Netlify) ──ส่ง idToken + action──▶ Google Apps Script (GAS) ──▶ Google Sheets
        ▲                                                    │
        │                    LINE Push API (ข้อความแจ้งเตือน) │
        └────────────────── LINE OA (Messaging API) ◀────────┘
```

| ส่วน | บทบาท | ต้องสร้างใหม่ต่อลูกค้า? |
|---|---|---|
| Google Sheets | Database (นักเรียน/ผู้ปกครอง/ผู้ใช้/คะแนน/คำร้อง) | ✅ ใหม่เสมอ |
| Google Apps Script (GAS) | Backend — ตรวจสิทธิ์ + อ่าน/เขียน Sheet | ✅ ใหม่เสมอ |
| หน้าเว็บ liff-web (Netlify) | UI ผู้ปกครองใน LINE | ✅ ใหม่ (copy + แก้ค่า) |
| LINE OA (Messaging API) | รับ/ส่งข้อความแจ้งเตือน (push) | ใช้ของลูกค้าที่มีอยู่ หรือสร้างใหม่ |
| LINE Login channel + LIFF | ยืนยันตัวตน LINE + โฮสต์หน้า LIFF | ✅ ใหม่เสมอ (ใต้ provider ของลูกค้า) |

---

## สิ่งที่ต้องเตรียม (ก่อนเริ่ม)

- [ ] **Google Account** ของลูกค้า/ทีม (ใช้สร้าง Sheets + GAS)
- [ ] **LINE Developers Console** — ลูกค้าเป็น Admin ของ Provider (ดู badge "Admin")
- [ ] **บัญชี Netlify** (ฟรี) — ไว้โฮสต์หน้า liff-web
- [ ] โปรเจกต์นี้บนเครื่อง (Clone แล้ว) + ติดตั้ง clasp แล้ว

```bash
git clone <repo-url> student-affairs-system
cd student-affairs-system
npm install -g @google/clasp   # ถ้ายังไม่มี
clasp login
```

---

## ขั้นตอนที่ 1 — สร้าง Google Sheets (Database)

1. เปิด **https://sheets.new** ด้วย Google Account ของลูกค้า → สร้าง Spreadsheet ใหม่
2. ตั้งชื่อ เช่น `StudentAffairs_<ชื่อโรงเรียน>` → **ปิดหน้าต่าง**
3. คัดลอก **Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/1X_lQTXUF8.../edit
                                          └─── Spreadsheet ID ───┘
   ```
   > ยังไม่ต้องสร้าง tab ใด ๆ — ระบบสร้างให้อัตโนมัติในขั้นตอนที่ 4

---

## ขั้นตอนที่ 2 — สร้าง Google Apps Script Project

1. เปิด **https://script.google.com** → **New project** → ตั้งชื่อ เช่น `StudentAffairs_<ชื่อโรงเรียน>`
2. **Settings** (⚙️) → ตรวจ:
   - Time zone: `(GMT+07:00) Asia/Bangkok`
   - Runtime: `V8`
3. **Project Settings** → คัดลอก **Script ID** (ตัวเลข/ขีดยาว ๆ ใต้หัวข้อ "IDs")
4. บันทึก 2 ค่าลงไฟล์ในโปรเจกต์โค้ด (รายละเอียดในขั้นตอนที่ 3):
   - **Script ID** → ใส่ใน `.clasp.json`
   - **URL** → ยังได้ทีหลัง (หลัง Deploy)

---

## ขั้นตอนที่ 3 — ⚠️ เปลี่ยนค่าที่สำคัญในโค้ด (หัวใจของคู่มือนี้)

> **ค่าต่อไปนี้ต้องแก้ทุกครั้งที่รับลูกค้าใหม่** — เปิดไฟล์แล้วแทนที่ค่าเดิม:

### 3.1 `src/Config.gs`

| บรรทัด/คีย์ | เปลี่ยนเป็น | ตัวอย่าง |
|---|---|---|
| `CONFIG.SPREADSHEET_ID` | Spreadsheet ID จากขั้นตอนที่ 1 | `'1X_lQTXUF8yLiCV...'` |
| `CONFIG.SCRIPT_ID` | Script ID จากขั้นตอนที่ 2 | `'1XaxgmZ6vqLEGP...'` |
| `CONFIG.WEB_APP_URL` | URL หลัง Deploy (ขั้นตอนที่ 5) — ใส่ทีหลังได้ | `'https://script.google.com/macros/s/AKfycb.../exec'` |
| `CONFIG.APP_NAME` | ชื่อระบบของลูกค้า | `'ระบบบริหารงานกลุ่มบริหารกิจการนักเรียน'` |
| `CONFIG.SCHOOL_INFO.*` | ข้อมูลโรงเรียน (ชื่อ/ที่อยู่/รหัสไปรษณีย์/เบอร์/อีเมล/คำขวัญ/แผนก) | ตามโรงเรียนลูกค้า |
| `CONFIG.SIGNER_INFO.*` | ผู้ลงนามหนังสือราชการ (ชื่อ + ตำแหน่ง) | ตามโรงเรียนลูกค้า |

> หมายเหตุ: `SHEET_NAMES`, `ROLES`, `PERMISSIONS`, `SCORE`, `SESSION_DURATION_HOURS` — **ไม่ต้องแก้** (เป็นโครงสร้างกลางของระบบ)

### 3.2 `.clasp.json`

| คีย์ | เปลี่ยนเป็น |
|---|---|
| `scriptId` | Script ID จากขั้นตอนที่ 2 (ต้องตรงกับ `CONFIG.SCRIPT_ID`) |

### 3.3 `liff-web/index.html` (บรรทัด ~764-765)

```js
var LIFF_ID = "2011098537-oAL9uwZt";   // ← เปลี่ยนเป็น LIFF App ID ของลูกค้า (ได้ในขั้นตอนที่ 6)
var GAS_API_URL = "https://script.google.com/macros/s/AKfycbxhq.../exec";  // ← เปลี่ยนเป็น URL GAS ของลูกค้า
```

### 3.4 ตารางสรุป "ค่าที่ต้องเปลี่ยน" (พิมพ์แปะติดไว้)

| ไฟล์ | ค่า | ได้จากที่ไหน | ตอนไหน |
|---|---|---|---|
| `src/Config.gs` | `SPREADSHEET_ID` | URL ของ Sheets | ขั้นตอน 1 |
| `src/Config.gs` | `SCRIPT_ID` + `.clasp.json` `scriptId` | Project Settings ของ GAS | ขั้นตอน 2 |
| `src/Config.gs` | `WEB_APP_URL` | หลัง Deploy Web App | ขั้นตอน 5 |
| `src/Config.gs` | `APP_NAME`, `SCHOOL_INFO`, `SIGNER_INFO` | ข้อมูลโรงเรียนลูกค้า | ตอนตั้งค่า |
| `liff-web/index.html` | `LIFF_ID` | LINE Login channel → แท็บ LIFF | ขั้นตอน 6 |
| `liff-web/index.html` | `GAS_API_URL` | หลัง Deploy Web App | ขั้นตอน 5 |

---

## ขั้นตอนที่ 4 — Push โค้ดขึ้น GAS + สร้าง Sheet อัตโนมัติ

```bash
clasp push        # อัปโหลด src/ ทั้งหมดขึ้น Apps Script project
```

จากนั้น:
1. เปิด GAS Editor: `clasp open`
2. เลือกฟังก์ชัน **`setupAllSheets`** (ในไฟล์ `Setup.gs`) → กด **Run**
3. ยอมรับการอนุญาต (scopes: Sheets/Docs/Drive/External request) → ระบบสร้าง Sheet ทั้ง 11 tab + Admin ตั้งต้นอัตโนมัติ
   - ตรวจใน Sheets: ต้องมี tab `Students, Parents, Users, ScoreLogs, LeaveRequests, InvitationLetters, Timeline, LineBindings, Announcements, AuditLog, Config`
4. เปิดชีต **Users** → แก้รหัสผ่าน Admin ตั้งต้น (`Admin@1234`) ทันที หรือล็อกอินแล้วเปลี่ยนผ่านหน้าเว็บ (แนะนำ)

> ⚠️ อย่าลืม: แก้รหัส admin ตั้งต้นก่อนใช้งานจริง — เป็นจุดเสี่ยงด้านความปลอดภัย

---

## ขั้นตอนที่ 5 — Deploy Web App (GAS)

1. ใน GAS Editor → **Deploy → New deployment** → ประเภท **Web app**
2. ตั้งค่า:
   - **Execute as**: `Me (อีเมลที่ deploy)` — ระบบจะทำงานด้วยสิทธิ์ของบัญชีนี้
   - **Who has access**: `Anyone` (ระบบตรวจสิทธิ์ด้วย Username/Password + LINE ID token เองอยู่แล้ว)
3. กด **Deploy** → คัดลอก **Web app URL** (`.../exec`) → นำไปใส่:
   - `CONFIG.WEB_APP_URL` ใน `src/Config.gs`
   - `GAS_API_URL` ใน `liff-web/index.html`
4. `clasp push` อีกครั้ง (เพื่อให้ Config ใหม่ขึ้น GAS) → Deploy → **Manage deployments** → ✏️ → **New version** → Deploy

> ทุกครั้งที่แก้โค้ด GAS หลังจากนี้: `clasp push` → Manage deployments → ✏️ → **New version** → Deploy

---

## ขั้นตอนที่ 6 — ตั้งค่า LINE (ลูกค้า)

> รายละเอียดเต็ม + ไฟล์ Word ส่งลูกค้า: `คู่มือ_ตั้งค่า_LINE_OA_LIFF_ลูกค้า.docx` / `docs/` — สรุปสั้น ๆ ที่นี่:

### 6.1 Messaging API channel (ตัว OA — ส่งข้อความ)
- มีอยู่แล้ว → ข้ามไป 6.2 ได้
- ยังไม่มี → Console → Provider ของลูกค้า → **Create → Messaging API** → ลิงก์ OA เดิมถ้ามี
- คัดลอก: **Channel ID** + **Channel Secret** (Basic settings) + **Channel Access Token (long-lived)** (Messaging API → Message delivery → Issue — เห็นครั้งเดียว)

### 6.2 LINE Login channel (โฮสต์ LIFF)
- ⚠️ LIFF ต้องอยู่ใต้ **LINE Login** channel เท่านั้น (สร้างใต้ Messaging API ไม่ได้)
- Provider เดียวกัน → **Create → LINE Login** → ตั้ง **Linked LINE Official Account** = OA ใน 6.1

### 6.3 สร้าง LIFF App
- LINE Login channel → แท็บ **LIFF → Add**:
  - **Endpoint URL** = URL หน้าเว็บ Netlify ของลูกค้า (ต้องเป็น **https**) — ยังไม่มี? ไปทำขั้นตอน 7 ก่อน แล้วกลับมาใส่
  - **Scope**: `openid` + `profile`
  - **Add friend option**: แนะนำ `On (optional)`
- ได้ **LIFF App ID** (เช่น `2001234567-xxxx`) → กด **Publish** (Developing → Published) — ไม่งั้นผู้ปกครองเปิดไม่ได้

### 6.4 ข้อมูลที่ลูกค้าต้องส่งให้ทีม
| # | ค่า | จาก |
|---|---|---|
| 1 | Channel ID | Messaging API → Basic settings |
| 2 | Channel Secret | Messaging API → Basic settings → 👁 |
| 3 | Channel Access Token (Long-lived) | Messaging API → Message delivery → Issue |
| 4 | LIFF App ID | LINE Login channel → แท็บ LIFF |

> 🔒 ข้อ 3 เป็นความลับ — รับผ่านช่องทางปลอดภัย

---

## ขั้นตอนที่ 7 — Deploy หน้าเว็บผู้ปกครอง (Netlify)

1. **ก่อน deploy**: แก้ `liff-web/index.html`:
   - `LIFF_ID` = LIFF App ID จากขั้นตอน 6.3
   - `GAS_API_URL` = Web app URL จากขั้นตอน 5
2. ลากโฟลเดอร์ **`liff-web/`** วางทับบน **Netlify → Sites → Add new site → Deploy manually** (หรือ Drag & Drop)
3. ได้ URL เช่น `https://xxx.netlify.app` → **กลับไปขั้นตอน 6.3 ใส่ Endpoint URL = URL นี้** (ถ้ายังไม่ได้สร้าง LIFF)
4. เปิด LIFF ทดสอบ: `https://liff.line.me/{LIFF_ID}` → ต้องเห็น "web v3" (เช็คว่าโหลดเวอร์ชันใหม่)

---

## ขั้นตอนที่ 8 — ตั้งค่าในระบบ (หน้า admin)

1. เปิด Web app URL ในเบราว์เซอร์ → ล็อกอินด้วย `admin` / รหัสที่ตั้งใหม่
2. ไปหน้า **"การแจ้งเตือน LINE"** → กรอก:
   - **Channel Access Token** (จาก 6.4)
   - **LIFF App ID** (จาก 6.4) ← จำเป็น — ระบบจะบังคับตรวจยืนยันตัวตน LINE (ID token) ทุกคำขอ LIFF
   - Channel Secret — **ไม่ต้องกรอก** (ระบบตรวจผ่าน LINE API แทน — RS256)
3. บันทึก → ระบบล็อกออกรอบเดียว (session version) → ล็อกอินใหม่

---

## ขั้นตอนที่ 9 — ทดสอบก่อนใช้งานจริง (Checklist)

- [ ] ล็อกอิน admin + เปลี่ยนรหัสผ่านตั้งต้น
- [ ] เพิ่มนักเรียน (ชีต Students หรือหน้าเว็บ) — เลขบัตรถูกต้อง
- [ ] เพิ่มผู้ปกครอง + เบอร์โทร (ParentPhone ต้องมีเลข 0 นำหน้า — ระบบ fix ให้อัตโนมัติ)
- [ ] บันทึก/ลดคะแนน (1–50, ไม่ติดลบ) → ผู้ปกครองที่ผูก LINE ได้รับ push
- [ ] อนุมัติคำขอลา → ผู้ปกครองได้รับแจ้งเตือน
- [ ] เปิด LIFF ในแอป LINE จริง: ผูกบัญชี (เบอร์โทร **หรือ** เลขบัตร + PIN 6 หลัก) → ดูคะแนน/ข่าว/หนังสือ
- [ ] เปลี่ยน PIN / ยกเลิกการเชื่อม / ออกจากระบบ (แท็บ ตั้งค่าระบบ)
- [ ] ลองล็อกอินผิด 5 ครั้ง → โดนล็อก 15 นาที (rate limit ทำงาน)

---

## 🔁 งานบำรุงรักษาประจำ (ทุกครั้งที่แก้โค้ด)

```bash
# GAS
clasp push
# แล้วใน Console: Deploy → Manage deployments → ✏️ → New version → Deploy

# หน้าเว็บ
# ลาก liff-web/ ขึ้น Netlify ใหม่ (Rollback ได้ 1 คลิก ถ้าผิดพลาด)
```

> ⚠️ ระบบนี้เป็นแบบ **แยกต่อลูกค้า (per-case)** — แก้บั๊กครั้งหนึ่งต้อง deploy ทุกสำเนา
> ใช้ตารางบันทึก "ลูกค้าไหน deploy เวอร์ชันไหนแล้ว" เพื่อไม่ให้ตกแพตช์

---

## ❓ แก้ปัญหาเบื้องต้น

| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| เปิด LIFF แล้ว error "ไม่สามารถยืนยันตัวตน LINE ได้" | LIFF ID ผิด/ยังไม่ Publish / aud ไม่ตรง channel → ตรวจ 6.3 + `LINE_LIFF_ID` ในหน้า ตั้งค่า LINE |
| Push ข้อความไม่ถึงผู้ปกครอง | channel ต่าง provider กัน หรือผู้ปกครองยังไม่ Add friend OA |
| ผูกบัญชีไม่ได้ "ไม่พบนักเรียน" | รหัสนักเรียน/เบอร์โทร/เลขบัตรไม่ตรงข้อมูลใน Sheets |
| หน้าเว็บค้าง "web v2" | โหลด Netlify เวอร์ชันเก่า → อัปโหลดใหม่ + ล้าง cache |
| ระบบล็อกอินไม่ได้หลัง deploy | session version เปลี่ยน → ล็อกอินใหม่อีกครั้ง |
