# ส่งต่องาน BanMeaw Trainee ให้ Claude

เริ่มจาก branch `codex/banmeaw-handoff` ซึ่งรวมโค้ดล่าสุดจาก workspace ไว้เหนือ `main` ที่ `1e51b24` โปรเจกต์ใช้ HTML, CSS และ JavaScript ES modules ใน `dist/`, Cloudflare Worker ใน `src/` และ Neon PostgreSQL กับ Neon Auth

[GitHub](https://github.com/engsasikan/BanMeaw-Trainee) · [เว็บที่ใช้งานอยู่](https://banmeaw-trainee.sasikan-esm.workers.dev) · [คู่มือตั้งค่า](SETUP.md)

## งานที่อยู่ในโค้ดชุดนี้

| ส่วน | พฤติกรรมที่ควรรักษา | ไฟล์หลัก |
| --- | --- | --- |
| หน้าโปรแกรมฝึก | ปฏิทิน MON–SUN ใช้เลือกวันและเปลี่ยนสัปดาห์ แสดงการ์ดแผนส่วนตัวและแผนทีมตามวันพร้อมจำนวนท่า กดการ์ดเพื่อเปิดแผนและเริ่มฝึก แถบวันที่หลักซ่อนเฉพาะตอนเปิดแท็บโปรแกรมฝึก | `dist/plans.mjs`, `dist/app.js`, `dist/look.css`, `src/worker.mjs` |
| จัดโปรแกรม | จัดแผนส่วนตัวได้ทั้งผู้มีทีมและไม่มีทีม เทรนเนอร์จัดให้สมาชิกหรือทั้งทีมได้ เลือกช่วงเริ่ม–สิ้นสุดและท่าตามวันประจำสัปดาห์ แก้แผนเดิมและเรียงท่าใหม่ได้ มีร่างแผนส่วนตัวในเครื่องแยกตามบัญชี | `dist/plans.mjs`, `src/plans.mjs`, `db/001_initial.sql` |
| เพิ่มท่าและ Super set | ค้นชื่อท่าหรือพิมพ์ชื่อเองได้ ใช้รูปแบบการกรอกคล้ายหน้าฝึก เพิ่มท่าใน Super set ขณะแก้ไขได้ แผนและบันทึกรองรับ kg/lb | `dist/plans.mjs`, `dist/workout-pairs.mjs`, `dist/weight-units.mjs`, `src/plans.mjs` |
| ฝึกตามแผน | บันทึกผลทีละเซ็ต กลับมาฝึกต่อ ดูผลเดิมและสรุปผลได้ ตัวจับเวลาขึ้นหลังบันทึกสำเร็จ ใช้เวลาตามแผนหรือ 60 วินาทีถ้ายังไม่ได้ตั้ง กดข้ามได้ ถ้าตั้ง 0 จะไม่เริ่มนับ ครบเวลาแล้วมีข้อความกับการสั่นบนเครื่องที่รองรับ | `dist/training-session.mjs`, `dist/diary-tools.mjs`, `dist/progress.mjs` |
| คัดลอกท่าจากสมาชิก | คัดลอกท่าเดียว ทั้ง Super set หรือทั้งรายการได้ เก็บลำดับและกลุ่ม ตั้งค่าเซ็ตและครั้งจากรายการต้นทางแล้วแก้ได้ น้ำหนักเริ่มว่าง เลือก kg/lb ได้ และแสดงน้ำหนักครั้งล่าสุดของบัญชีตัวเองไว้ช่วยกรอก | `dist/team-workout-copy.mjs`, `dist/team.mjs`, `dist/workout-pairs.mjs`, `dist/weight-units.mjs` |
| หน้าทีม | ปุ่มสร้างทีมขนาดเล็กเปิดฟอร์มเมื่อกด จัดการ์ดลูกเทรนและเทรนเนอร์ให้โล่งขึ้น แสดงรูปสมาชิก เจ้าของทีมเปลี่ยนรูปทีมและสร้าง QR คำเชิญให้ผู้รับสแกนเข้าทีมได้ | `dist/team.mjs`, `dist/team.css`, `dist/team-layout.mjs`, `src/member-qr.mjs`, `src/worker.mjs` |
| โปรไฟล์และ InBody | นำเข้า CSV ของ InBody ไปยังฟอร์มวัดร่างกาย ตรวจค่าก่อนบันทึก หน้าโปรไฟล์จัดกลุ่มการทำงานใหม่และแสดงสถานะระหว่างโหลด/บันทึก | `dist/body.mjs`, `dist/inbody-csv.mjs`, `dist/profile.mjs`, `dist/look.css` |
| ค้นหาท่าและการแสดงผล | ปรับ picker และแผนผังกล้ามเนื้อ ใช้ GIF จาก ExerciseDB เมื่อมีสื่อที่ตรงท่า และคงตัวเลือกดู 3D ตามที่ UI รองรับ | `dist/exercise-picker.mjs`, `dist/anatomy-picker.mjs`, `dist/exercise-preview.mjs` |
| ประวัติและภาพรวม | ปรับข้อความสรุป กราฟประวัติท่า สถิติส่วนตัว และโครงสร้างหน้าประวัติสุขภาพ โดยชุดนี้เปลี่ยน `health-ui.mjs` มาที่ `initHealthHistory` | `dist/history-text.mjs`, `dist/exercise-history.mjs`, `dist/personal-record.mjs`, `dist/today.mjs`, `dist/health-ui.mjs` |

## ข้อมูลและจุดที่ต้องระวังเมื่อทำต่อ

- `GET /api/plans?day=YYYY-MM-DD` คืนแผนรายวัน ส่วน `range=week` คืนวันที่เริ่มต้นที่ส่งมาและอีกหกวัน หน้าเว็บคำนวณวันจันทร์ก่อนเรียก API ทั้งสองแบบใช้สิทธิ์การอ่านแผนของบัญชีเดียวกัน
- `/api/personal-plans` และ `/api/teams/:id/plans` ใช้ตรรกะแผนจาก `src/plans.mjs` แผนส่วนตัวมี `team_id = NULL` และ schema เพิ่ม `team_wide` ให้แผนทั้งทีม
- Schema เพิ่มรูปทีมและข้อมูล QR ที่หมดอายุใน `trainer_teams` คงการตรวจสิทธิ์เจ้าของทีมและสมาชิกที่ตอบรับแล้วเมื่อแก้เส้นทางทีม
- รูปแบบข้อมูลผลฝึกผูกกับ `planId` และ `planExerciseIndex` ควรตรวจผลต่อบันทึกเดิมเมื่อเปลี่ยนวิธีเรียงท่าหรือแก้แผนที่เริ่มฝึกแล้ว
- โปรแกรมวันพฤหัสในเดือนพฤศจิกายน 2569 ที่เคยเพิ่มเป็นข้อมูลในบัญชีบนเว็บ แยกจาก Git
- อัปเดตเวอร์ชัน `?v=` ในจุด import และ `dist/index.html` เมื่อเปลี่ยนไฟล์หน้าเว็บที่มี cache key
- `scripts/build.mjs` สร้าง `dist/account.js`, `dist/body3d.js` และ `dist/member-qr.mjs` ไฟล์อื่นหลายไฟล์ใน `dist/` คือซอร์สหน้าเว็บที่ต้องเก็บใน Git

## วิธีเริ่มและตรวจงาน

```sh
git fetch origin
git switch --track origin/codex/banmeaw-handoff
npm ci
npm run build
npm test
npm run dev
```

ทดสอบบนมือถือหลังล็อกอินด้วย โดยลองสลับแท็บโปรแกรมฝึกกับบันทึกผล เลือกวันข้ามสัปดาห์ เปิดแผนส่วนตัวและแผนทีม และบันทึกเซ็ตเพื่อดูตัวจับเวลาพัก รวมถึงลองคัดลอก Super set นำเข้า InBody และใช้ QR ด้วยบัญชีทดสอบ

การเผยแพร่ล่าสุดที่ยืนยันจาก Wrangler คือเวอร์ชัน `fd6e6097-af2b-4d34-ac86-3b50fb443b72` หลังปรับตัวจับเวลาพัก สำหรับเผยแพร่รอบถัดไปใช้ `npm run deploy` ตามการตั้งค่าใน `wrangler.jsonc` เก็บค่า `DATABASE_URL` และข้อมูลบัญชีไว้ในระบบ secrets ของ Cloudflare
