# สิทธิ์เข้าดู Dashboard ตามสายงาน (Role-Based Access)

> ที่มา: req ให้ **แพทย์และ ผอ. ดูได้ทุกอย่าง** ส่วนคนอื่นดูได้เฉพาะ dashboard
> ของสายงานตัวเอง

## จุดที่เกี่ยวข้องในโค้ด

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/permissions.ts` | **จุดเดียว**ที่กำหนดว่า role ไหนเห็น path ไหน (แก้ mapping ที่นี่) |
| `proxy.ts` | บังคับสิทธิ์ฝั่ง server — ทั้งหน้าเว็บ (`/pages/*`) และข้อมูล (`/api/*`) |
| `app/components/sidebar/Sidebar.tsx` | ซ่อนเมนูที่ role นั้นไม่มีสิทธิ์ |

role เก็บในคอลัมน์ `ppchos.users.role` และถูกฝังใน JWT ตอน login
(เปลี่ยน role แล้วต้อง **login ใหม่** ถึงจะมีผลกับ proxy — `/api/me` เห็นทันที)

## รายชื่อ role

### เห็นทุกอย่าง

| role | ใคร |
|---|---|
| `DIRECTOR` | ผู้อำนวยการ |
| `DOCTOR` | แพทย์ทุกคน |
| `ADMIN` | ผู้ดูแลระบบ |
| `IT` | งาน IT (เห็นเมนู "บันทึกงาน IT" และ "สถานะเซิร์ฟเวอร์" เพิ่ม) |

### เห็นเฉพาะสายงานตัวเอง (+ ภาพรวมกลางเสมอ)

| role | สายงาน | โซนที่เห็น |
|---|---|---|
| `NURSE` | พยาบาล | ผลิตภาพ LR/ER/IPD/OPD, เวลาบริการ R9, ตรวจสุขภาพ, ANC ผู้คลอด, อุบัติเหตุ/Stroke/ACS/Sepsis/หัตถการเสี่ยงสูง, TB, ยาเสพติด/มินิธัญญารักษ์/Home Ward, IMC |
| `DENTIST` | ทันตกรรม | ทันตกรรม, UC ต่างจังหวัดที่มาทำฟัน |
| `PHARMACY` | เภสัชกรรม | RDU, กลุ่มยาเสพติด |
| `PT` | กายภาพบำบัด | กายภาพบำบัด, IMC |
| `TTM` | แพทย์แผนไทย | แพทย์แผนไทย |
| `FINANCE` | การเงิน / งานประกัน / เวชระเบียน | กลุ่มงานเคลมทั้งหมด (ANC เคลม, MOPH CLAIM, DMTB, KTB, STM, Medical Coding) + รายงานสิทธิ์การรักษา |
| `PUBLIC_HEALTH` | นักวิชาการสาธารณสุข / ปฐมภูมิ | ปฐมภูมิทั้งหมด, PPA, รายงาน, TB |
| `USER` (หรือ `NULL`) | ยังไม่จัดสายงาน | เฉพาะภาพรวมกลาง (Overview, สถานะแผนก, สถิติเวร, IP & Home Ward, ตั้งค่า) |

> "ภาพรวมกลาง" (CORE) เปิดให้ทุก role ที่ login แล้ว เพราะเป็นจอสรุปของ
> โรงพยาบาลที่แขวนทีวีอยู่แล้ว — ถ้าต้องการปิดก็เอา feature `CORE` ออกจาก
> role นั้นใน `ROLE_FEATURES`

## วิธีตั้ง role (ตอนได้รายชื่อมา)

ตั้งเป็นรายคนด้วย `user` (username ที่ใช้ login):

```sql
-- ผอ.
UPDATE ppchos.users SET role = 'DIRECTOR' WHERE `user` = 'xxxx';

-- ตั้งทีละหลายคน
UPDATE ppchos.users SET role = 'FINANCE' WHERE `user` IN ('aaa', 'bbb', 'ccc');
```

หรือตั้งกลุ่มใหญ่จากตำแหน่ง (`position`) ก่อน แล้วค่อยเก็บรายคน:

```sql
-- แพทย์ (กันชื่อตำแหน่งชน ทันตแพทย์ / แพทย์แผนไทย)
UPDATE ppchos.users SET role = 'DOCTOR'
WHERE role IS NULL
  AND (position LIKE '%นายแพทย์%' OR position LIKE '%นายเเพทย์%'
       OR position LIKE 'แพทย์%')
  AND position NOT LIKE '%ทันต%'
  AND position NOT LIKE '%แผนไทย%';

UPDATE ppchos.users SET role = 'DENTIST'
WHERE role IS NULL AND (position LIKE '%ทันตแพทย์%' OR position LIKE '%ทันตแพย์%');

UPDATE ppchos.users SET role = 'NURSE'
WHERE role IS NULL AND position LIKE '%พยาบาล%';

UPDATE ppchos.users SET role = 'PHARMACY'
WHERE role IS NULL AND (position LIKE '%เภสัช%');

UPDATE ppchos.users SET role = 'PT'
WHERE role IS NULL AND position LIKE '%กายภาพ%';

UPDATE ppchos.users SET role = 'TTM'
WHERE role IS NULL AND position LIKE '%แผนไทย%';

UPDATE ppchos.users SET role = 'FINANCE'
WHERE role IS NULL
  AND (position LIKE '%การเงิน%' OR position LIKE '%บัญชี%'
       OR position LIKE '%เวชสถิติ%');

UPDATE ppchos.users SET role = 'PUBLIC_HEALTH'
WHERE role IS NULL
  AND (position LIKE '%สาธารณสุข%' OR position LIKE '%สาธาณสุข%');

-- ตรวจผล
SELECT role, COUNT(*) FROM ppchos.users GROUP BY role;
SELECT `user`, name, position, role FROM ppchos.users ORDER BY role;
```

คนที่เหลือ `role = NULL` จะถูกระบบมองเป็น `USER` (เห็นเฉพาะภาพรวมกลาง) โดยอัตโนมัติ

## พฤติกรรมเมื่อไม่มีสิทธิ์

- เปิดหน้าเว็บนอกสายงาน → เด้งกลับไป `/pages/dashboard`
- ยิง API นอกสายงาน → `403 {"error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้ (นอกสายงาน)"}`
- เมนูใน Sidebar โชว์เฉพาะรายการที่ role นั้นเข้าได้ (กลุ่มไหนว่างจะซ่อนทั้งกลุ่ม)
- Guest (ไม่ login) เหมือนเดิม: เห็นเฉพาะจอ Overview กลาง
