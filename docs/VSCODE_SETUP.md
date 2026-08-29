# 🖥️ คู่มือติดตั้งสภาพแวดล้อมการพัฒนาใน VS Code

> สำหรับนักพัฒนาที่จะทำงานกับโปรเจกต์ **Student Affairs System** (Google Apps Script + clasp)
> เวลาติดตั้งครั้งแรกโดยประมาณ: **15–20 นาที**

---

## 0. ภาพรวมสิ่งที่ต้องติดตั้ง

| # | สิ่งที่ต้องมี | ทำไมต้องใช้ |
|---|---|---|
| 1 | **VS Code** | โปรแกรมเขียนโค้ดหลัก |
| 2 | **Node.js (v20 LTS)** | รัน clasp (เครื่องมืออัปโหลดโค้ดขึ้น GAS) |
| 3 | **clasp** (`@google/clasp`) | push/pull โค้ดระหว่าง VS Code ↔ Google Apps Script |
| 4 | **ส่วนขยาย VS Code** (Extension) | อัตโนมัติเติมโค้ด GAS, จัดรูปแบบโค้ด, จัดการ Git |

> 💡 สถานะเครื่องนี้: Node `v20.20.2` + clasp `2.5.0` ติดตั้งแล้ว — ถ้าเครื่องใหม่ทำตามหัวข้อ 2–4

---

## 1. ติดตั้ง VS Code

1. ดาวน์โหลดจาก **https://code.visualstudio.com** → ติดตั้ง (เลือกติ๊ก **"Add to PATH"** — จำเป็นสำหรับคำสั่ง `code` ในหัวข้อ 2)
2. เปิด VS Code ครั้งแรก → เปิด Terminal ในตัว: เมนู **Terminal → New Terminal** (หรือ `Ctrl+` `)

---

## 2. ติดตั้ง Node.js + clasp

### 2.1 Node.js (แนะนำผ่าน nvm — สลับเวอร์ชันได้)

```bash
# macOS (ติดตั้ง nvm ก่อน: https://github.com/nvm-sh/nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 20
nvm use 20
```

```bash
# Windows — ดาวน์โหลดตัวติดตั้งจาก https://nodejs.org (เลือก LTS v20)
# ตรวจว่าได้เวอร์ชันถูกต้อง:
node --version    # ควรขึ้น v20.x.x
```

### 2.2 ติดตั้ง clasp แบบ global

```bash
npm install -g @google/clasp
clasp --version   # ตรวจว่าติดตั้งสำเร็จ (ควรขึ้น 2.x)
```

---

## 3. ติดตั้งส่วนขยาย (Extensions) ที่แนะนำ

เปิด **Extensions** ใน VS Code (`Ctrl+Shift+X`) แล้วค้นหา/ติดตั้งตามนี้ — หรือรันคำสั่งใน Terminal ทีละบรรทัด:

```bash
# 1) Google Apps Script Extension Pack (สำคัญที่สุด!)
#    - อัตโนมัติเติมโค้ด (autocomplete) สำหรับ SpreadsheetApp/DocumentApp/UrlFetchApp...
#    - ตรวจ syntax + ดีบักฟังก์ชันได้ในตัว
code --install-extension labnol.google-apps-script

# 2) Prettier — จัดรูปแบบโค้ดอัตโนมัติ (บันทึกแล้วจัดให้)
code --install-extension esbenp.prettier-vscode

# 3) ESLint — จับบั๊ก/โค้ดไม่ดีใน JavaScript
code --install-extension dbaeumer.vscode-eslint

# 4) GitLens — ดูประวัติ/ผู้แก้โค้ดแต่ละบรรทัดในตัว
code --install-extension eamodio.gitlens

# 5) Code Runner — รัน JavaScript ทดสอบด่วน (เช่น ตรวจ logic)
code --install-extension formulahendry.code-runner

# (เลือก) ธีมภาษาไทย/ธีมสี: thai-language-pack, zhuangtongfa.material-theme
```

> ติดตั้ง `labnol.google-apps-script` แล้ว VS Code จะรู้จักไฟล์ `.gs` ทันที (ไฮไลต์สี + autocomplete ของ GAS services)

---

## 4. Clone โปรเจกต์ + ล็อกอิน clasp

```bash
# เปิด Terminal ใน VS Code แล้ว:
git clone <repo-url> student-affairs-system
cd student-affairs-system

# ล็อกอิน clasp (เปิดเบราว์เซอร์ให้ยืนยันบัญชี Google)
clasp login
```

- หลังล็อกอินสำเร็จ clasp จะสร้างไฟล์ **`.clasprc.json`** ในโฟลเดอร์บ้าน
  - ⚠️ ไฟล์นี้มี token สำคัญ — โปรเจกต์ได้ **gitignore ไว้แล้ว** ไม่ขึ้น GitHub
- เปิดโปรเจกต์ใน VS Code: `code .` (หรือ File → Open Folder)

---

## 5. ตรวจไฟล์ `.clasp.json` (เชื่อม GAS project)

ไฟล์ `.clasp.json` ที่รากโปรเจกต์ ต้องมี `scriptId` ตรงกับ Apps Script project:

```json
{
  "scriptId": "1XaxgmZ6vqLEGP_CIR_KI9H6cMzuOkZjuXYetmSQ816cWRU_fxV1YlMh-",
  "rootDir": "src",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"]
}
```

- `rootDir: "src"` = clasp push โค้ดในโฟลเดอร์ `src/` ขึ้น GAS
- ถ้า `scriptId` ยังไม่ถูกต้อง (รับลูกค้าใหม่) → แก้เป็น Script ID ของลูกค้า (ดู `docs/INSTALL_GUIDE.md`)

**ทดสอบการเชื่อมต่อ:**
```bash
clasp status      # ควรแสดงรายการไฟล์ที่ sync กับ GAS
clasp pull        # ดึงโค้ดจาก GAS ลงเครื่อง (ครั้งแรก)
```

---

## 6. ตั้งค่า VS Code ให้เหมาะกับโปรเจกต์

สร้างโฟลเดอร์ `.vscode/` ในรากโปรเจกต์ แล้วสร้างไฟล์ `settings.json`:

```jsonc
{
  // แจ้ง VS Code ว่าไฟล์ .gs คือ JavaScript
  "files.associations": {
    "*.gs": "javascript"
  },
  // บันทึกไฟล์แล้วจัดรูปแบบอัตโนมัติ (Prettier)
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  // กัน VS Code สร้าง .clasprc.json เผลอโดน push
  "files.exclude": {
    "**/.clasprc.json": true
  }
}
```

> ⚠️ `.vscode/settings.json` ถูก gitignore ของโปรเจกต์แล้ว (เป็นค่าส่วนตัวแต่ละเครื่อง) — ส่วนแนะนำ extensions ใช้ `.vscode/extensions.json` ซึ่ง commit ได้ (มีให้แล้วในโปรเจกต์)

---

## 7. Workflow ปกติ (วนลูปการพัฒนา)

```bash
# 1) แก้โค้ดใน VS Code (src/*.gs หรือ src/*.html หรือ liff-web/index.html)

# 2) ตรวจ syntax ไฟล์ .gs ก่อน push (กันพลาดทีหลัง)
node --check src/Config.gs          # .gs ตรวจได้เหมือน .js (copy เป็น .js ก่อนถ้าจำเป็น)
# หรือใช้ Code Runner กดปุ่ม ▶ รันทดสอบ logic ตรง ๆ

# 3) อัปโหลดขึ้น Google Apps Script
clasp push

# 4) เปิด GAS Editor ในเบราว์เซอร์ (รัน setup / deploy / ดู log)
clasp open
```

**หลัง deploy (ทุกครั้งที่แก้ GAS):** ในเบราว์เซอร์ → **Deploy → Manage deployments → ✏ → New version → Deploy**

**Git workflow:**
```bash
git add <ไฟล์ที่แก้>
git commit -m "ข้อความสรุป"
git push
```

---

## 8. ปัญหาที่พบบ่อย + วิธีแก้

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `clasp: command not found` | ติดตั้ง Node ยังไม่เสร็จ หรือ PATH ไม่เข้า → รัน `npm install -g @google/clasp` ใหม่ / เปิด VS Code ใหม่ |
| `Cannot read properties of undefined (reading 'scriptId')` | `.clasp.json` ไม่ถูกต้อง/ไม่มี `scriptId` → แก้ให้ตรงกับ Script ID |
| `clasp push` error permission | `scriptId` ผิด (คนละโปรเจกต์) หรือล็อกอินผิดบัญชี → ตรวจ `.clasp.json` + `clasp login` ใหม่ |
| ล็อกอินเปิดเบราว์เซอร์ไม่ขึ้น | รัน `clasp login --no-localhost` แล้วก๊อป URL ไปเปิดเอง |
| autocomplete GAS ไม่ขึ้น | ติดตั้ง `labnol.google-apps-script` แล้วรีโหลดหน้าต่าง (`Ctrl+Shift+P` → Reload Window) |
| `node --check` ไม่เห็น error แต่ deploy ยังพัง | ตรวจว่าแก้ครบทุกไฟล์จริง (`clasp push` แล้วดู output) + ดู log ที่ `clasp open` → Executions |
| ใช้หลายบัญชี Google | `clasp logout` → `clasp login` สลับบัญชี; หรือเก็บ `.clasprc.json` แยกต่อโปรเจกต์ |
| Port ชนกันตอนเปิด web app | ตรวจ `lsof -i :8000` ก่อนรัน — clasp ไม่ใช้พอร์ตถาวร ชนกันแล้วปิดตัวที่ค้าง |

---

## 9. Checklist ติดตั้งเสร็จ

- [ ] `code --version` / `node --version` (v20) / `clasp --version` (2.x) ผ่าน
- [ ] ติดตั้ง extension ครบชุด (โดยเฉพาะ `labnol.google-apps-script`)
- [ ] `clasp login` สำเร็จ (มี `.clasprc.json` ที่โฮม)
- [ ] `clasp status` แสดงไฟล์ที่ sync กับ GAS project ถูกต้อง
- [ ] `.vscode/settings.json` สร้างแล้ว + `.vscode/extensions.json` มีอยู่
- [ ] ทดสอบวงจร: แก้โค้ด → `node --check` → `clasp push` → เปิดหน้าเว็บดูผล

---

## เอกสารอ้างอิง

- คู่มือติดตั้งระบบเต็มรูปแบบ: `docs/INSTALL_GUIDE.md`
- เอกสาร clasp ทางการ: https://github.com/google/clasp
- Extension Pack GAS: https://marketplace.visualstudio.com/items?itemName=labnol.google-apps-script
