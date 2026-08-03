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

role พยาบาลแยกตามหน่วยงานจริงในไฟล์บุคลากร (กลุ่มงานการพยาบาลมี 6 หน่วยย่อย):

| role | หน่วยงาน | โซนที่เห็น |
|---|---|---|
| `NURSE` | บริหารกลุ่มการพยาบาล (หัวหน้าพยาบาล) | งานพยาบาลทุกหน่วยด้านล่างรวมกันทั้งหมด |
| `NURSE_OPD` | งานการพยาบาลผู้ป่วยนอก | ผลิตภาพ OPD, R9 เวลาบริการ, ตรวจสุขภาพประจำปี |
| `NURSE_IPD` | งานการพยาบาลผู้ป่วยใน | ผลิตภาพ IPD, IMC |
| `NURSE_ER` | งานการพยาบาลอุบัติเหตุฉุกเฉินและนิติเวช | ผลิตภาพ ER, อุบัติเหตุ, Stroke, ACS, หัตถการเสี่ยงสูง, Sepsis |
| `NURSE_LR` | งานการพยาบาลผู้คลอดและทารกแรกเกิด | ผลิตภาพ LR, งานการพยาบาลผู้คลอด (ANC), ANC Anemia Map, งานเคลม ANC ฝากครรภ์ |
| `NURSE_IC` | หน่วยควบคุมการติดเชื้อและงานจ่ายกลาง | วัณโรค (TB), Sepsis |
| `PSYCH` | งานสุขภาพจิตและยาเสพติด | ผู้ป่วยยาเสพติด, มินิธัญญารักษ์, Home Ward ยาเสพติด |
| `DENTIST` | ฝ่ายทันตสาธารณสุข | ทันตกรรม, UC ต่างจังหวัดที่มาทำฟัน |
| `PHARMACY` | ฝ่ายเภสัชกรรมชุมชน | RDU, กลุ่มยาเสพติด |
| `PT` | ฝ่ายเวชกรรมฟื้นฟู (กายภาพ) | กายภาพบำบัด, IMC |
| `TTM` | งานแพทย์แผนไทย | แพทย์แผนไทย |
| `FINANCE` | การเงิน/บัญชี, ศูนย์ประกันสุขภาพ, เวชระเบียน | กลุ่มงานเคลมทั้งหมด (ANC เคลม, MOPH CLAIM, DMTB, KTB, STM, Medical Coding) + รายงานสิทธิ์การรักษา |
| `PUBLIC_HEALTH` | กลุ่มงานบริการด้านปฐมภูมิและองค์รวม | ปฐมภูมิทั้งหมด, PPA, รายงาน, TB |
| `USER` (หรือ `NULL`) | หน่วยที่ยังไม่มี dashboard ของตัวเอง (รังสี, LAB, โภชนศาสตร์, บริหารทั่วไป ฯลฯ) | เฉพาะภาพรวมกลาง (Overview, สถานะแผนก, สถิติเวร, IP & Home Ward, ตั้งค่า) |

> "ภาพรวมกลาง" (CORE) เปิดให้ทุก role ที่ login แล้ว เพราะเป็นจอสรุปของ
> โรงพยาบาลที่แขวนทีวีอยู่แล้ว — ถ้าต้องการปิดก็เอา feature `CORE` ออกจาก
> role นั้นใน `ROLE_FEATURES`

## วิธีตั้ง role

> **ใช้ไฟล์ `docs/sql/assign_roles.sql` เป็นหลัก** — สร้างจากไฟล์บุคลากร
> (INFOMATION_PERSON.xlsx ส.ค. 2569) จับคู่ชื่อกับ username แล้ว 149 บัญชี
> แยกตามหน่วยงานจริง รันทั้งไฟล์ได้เลย
> แถวที่มี `[ตรวจ]` คือคนที่นามสกุลในระบบไม่ตรงกับไฟล์บุคลากร (เปลี่ยนนามสกุล)
> ช่วยยืนยันก่อนรัน

ส่วนด้านล่างนี้เป็นวิธีตั้งเองรายคน/รายกลุ่ม เผื่อมีคนใหม่หรือย้ายหน่วย:

ตั้งเป็นรายคนด้วย `user` (username ที่ใช้ login):

```sql
-- ผอ.
UPDATE ppchos.users SET role = 'DIRECTOR' WHERE `user` = 'xxxx';

-- ตั้งทีละหลายคน
UPDATE ppchos.users SET role = 'FINANCE' WHERE `user` IN ('aaa', 'bbb', 'ccc');
```

### แพทย์ — ดูจากคำนำหน้าชื่อ (นพ. / น.พ. / พญ. / นายแพทย์)

```sql
-- แพทย์: จับจากคำนำหน้าชื่อ หรือตำแหน่งนายแพทย์
-- (ระวัง: ทพ./ทพญ. = ทันตแพทย์, พท. = แพทย์แผนไทย — ไม่ใช่ DOCTOR)
UPDATE ppchos.users SET role = 'DOCTOR'
WHERE role IS NULL
  AND (name LIKE 'นพ.%' OR name LIKE 'น.พ.%'
       OR name LIKE 'พญ.%' OR name LIKE 'นายแพทย์%'
       OR position LIKE '%นายแพทย์%' OR position LIKE '%นายเเพทย์%'
       OR position = 'แพทย์' OR position LIKE 'แพทย์ปฏิบัติการ%')
  AND position NOT LIKE '%ทันต%'
  AND position NOT LIKE '%แผนไทย%';
```

รายชื่อแพทย์ที่พบในระบบตอนนี้ (จากข้อมูล users ณ ส.ค. 2569) — ตั้งตรงๆ รายคน:

```sql
UPDATE ppchos.users SET role = 'DOCTOR' WHERE `user` IN (
  '2329900022631', -- นพ.ปฐวี บุญไพศาลบันดาล
  '63960',         -- นพ.ปฐมพงศ์ นัยวิกุล
  '68861',         -- พญ.กัณฐิกา สุริยะรัมย์
  '73365',         -- น.พ.ณัฐชนก เชาวกิจเจริญ
  '74994',         -- ฐิติชญา อารีย์วัฒนานนท์ (ตำแหน่ง: แพทย์)
  '75432',         -- กิตติภัทร์ คันธะมาลย์ (นายแพทย์ปฏิบัติการ)
  '75435',         -- นายแพทย์ปมนตร์ธรรม สนิทจันทร์
  '75437',         -- พญ.ศศิตนันทน์ ฤทธิ์ไธสง
  '76139',         -- นพ.ธนัชชา มีตุวงศ์
  '77128',         -- ทัตพงศ์ วิชาพร (นายแพทย์ปฏิบัติการ)
  '78280',         -- นพ.ต้นสาย สรวลสันต์
  '78511',         -- นพ.คุณานนต์ ปานวงษ์
  'jarlim',        -- นพ.เจษฎาภรณ์ คงนันทะ
  'Jomjamwiriya',  -- พญ.วิริยา เพ็ชร์ณรงค์
  'Krichpaphop',   -- นพ.กฤชปภพ เรืองสุวรรณ
  'krissth',       -- นพ.กฤษฎา สุวัณณุสส์
  'lalita',        -- พญ.ลลิตา ชุตินิรันดร์
  'Nitidch98',     -- นพ.นิธิศ เจริญศรี
  'onmed',         -- พญ.อรภัทร วิริยอุดมศิริ (นายแพทย์ชำนาญการพิเศษ)
  'pheeraphat',    -- นพ.พีรพัฒน์ ภู่พิบูลย์
  'puchit'         -- นพ.ภูชิต สุวิชาเชิดชู
);

-- ⚠️ 'sasi1998' ชื่อ "พญ.ศศิวิมล ชาติประสพ" แต่ตำแหน่ง/ทะเบียน doctor เป็น
-- ทพญ. (ทันตแพทย์ปฏิบัติการ) → จัดเป็น DENTIST ไม่ใช่ DOCTOR

-- ผอ. = พญ.อรภัทร วิริยอุดมศิริ (นายแพทย์ชำนาญการพิเศษ)
UPDATE ppchos.users SET role = 'DIRECTOR' WHERE `user` = 'onmed';
```

### สายงานอื่น — ตั้งกลุ่มใหญ่จากตำแหน่ง (`position`) แล้วค่อยเก็บรายคน

```sql

-- ทันตแพทย์: คำนำหน้า ทพ./ทพญ. หรือตำแหน่งทันตแพทย์ (รวมที่สะกด ทันตแพย์)
UPDATE ppchos.users SET role = 'DENTIST'
WHERE role IS NULL
  AND (name LIKE 'ทพ.%' OR name LIKE 'ทพญ.%'
       OR position LIKE '%ทันตแพทย์%' OR position LIKE '%ทันตแพย์%');

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
