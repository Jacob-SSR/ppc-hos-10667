// app/pages/d506-dashboard/Form506.tsx
// แบบรายงานผู้ป่วย รง.506 (พิมพ์ได้) — พอร์ตจาก openPrintForm() ใน D506_Dashboard.html
"use client";

import type { D506Row } from "@/lib/d506Sheets.service";
import type { D506FormExtra } from "@/lib/d506Form.service";

// checkbox: ☑ ถ้า code506 ตรงกับรหัสของโรคนั้น
function useChk(code: string) {
  return (c: string | string[]) =>
    (Array.isArray(c) ? c.includes(code) : code === c) ? "☑" : "☐";
}

const parts = (s: string) => {
  const [d = "", m = "", y = ""] = (s || "").split("/");
  return { d, m, y };
};

/** ช่องที่ HOSxP เป็นเจ้าของข้อมูล (ที่อยู่ วันเกิด รหัสโรค ฯลฯ) — เอา HOSxP ก่อน
 *  เพราะทะเบียนในชีตกรอกมือ สลับคอลัมน์/พิมพ์ตกได้ ส่วนชีตเป็นตัวสำรอง */
const hos = (hosxp: string | undefined, sheet: string | undefined) =>
  (hosxp || "").trim() || (sheet || "").trim();

/** เดาเพศจากคำนำหน้าชื่อ — ทะเบียนบางแถวเว้นช่องเพศไว้ แต่คำนำหน้าบอกอยู่แล้ว
 *  ลำดับสำคัญ: "นางสาว"/"น.ส." ต้องตรวจก่อน "นาง" ไม่งั้นจับเป็นหญิงมีสามีหมด
 *  (ทั้งคู่เป็นหญิงเหมือนกัน แต่ยังจับก่อนไว้กันพลาดตอนเพิ่มเงื่อนไขทีหลัง) */
function sexFromPrefix(prefix: string): "" | "ชาย" | "หญิง" {
  const p = (prefix || "").replace(/[.\s]/g, "");
  if (!p) return "";
  // หญิง
  if (/^(นางสาว|นส|ดญ|เด็กหญิง|นาง|แม่ชี|ชี)/.test(p)) return "หญิง";
  // ชาย (พระ/สามเณร นับเป็นชายตามแบบ รง.506)
  if (/^(นาย|ดช|เด็กชาย|พระ|พระภิกษุ|ภิกษุ|สามเณร|เณร|ว่าที่)/.test(p)) return "ชาย";
  return "";
}

/** อายุ ปี/เดือน จากวันเกิด "DD/MM/พ.ศ." */
function ageParts(dobStr: string): { y: string; m: string } {
  const { d, m, y } = parts(dobStr);
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!yy || !mm || !dd) return { y: "", m: "" };
  const born = new Date(yy > 2500 ? yy - 543 : yy, mm - 1, dd);
  if (Number.isNaN(born.getTime())) return { y: "", m: "" };
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months--;
  if (months < 0) return { y: "", m: "" };
  return { y: String(Math.floor(months / 12)), m: String(months % 12) };
}

export default function Form506({
  row,
  extra,
}: {
  row: D506Row;
  /** ข้อมูลจาก HOSxP (/api/d506-form) — ใช้เติมช่องที่ทะเบียนในชีตไม่มี */
  extra?: D506FormExtra | null;
}) {
  const code = hos(extra?.code506, row.code506);
  const chk = useChk(code);
  // เพศ: ใช้ช่องในชีตก่อน → ไม่มีค่อยเดาจากคำนำหน้า → ท้ายสุดใช้ patient.sex ของ HOSxP
  const sexRaw = (row.sex || "").trim();
  const sex =
    /^(ช|ชาย|M|1)$/i.test(sexRaw) ? "ชาย" :
    /^(ญ|หญิง|F|2)$/i.test(sexRaw) ? "หญิง" :
    (extra?.sex ?? "") ||
    sexFromPrefix(row.prefix) ||
    sexFromPrefix(extra?.prefix ?? "");
  const sexM = sex === "ชาย";
  const sexF = sex === "หญิง";
  const ptype = hos(extra?.ptype, row.ptype).toUpperCase();
  const status = hos(extra?.status, row.status);
  const outcome = (row.outcome || "").trim();

  // ช่องวันที่: ชีตเป็นหลัก ว่างแล้วใช้ HOSxP (ทั้งคู่รูปแบบ DD/MM/ปี)
  const dobStr = hos(extra?.dob, row.dob);
  const dob = parts(dobStr);
  const ons = parts(hos(extra?.onsetDate, row.onsetDate));
  const rpt = parts(hos(extra?.reportDate, row.reportDate));
  const dth = parts(extra?.deathDate ?? "");
  const age = ageParts(dobStr);

  // ภาวะสมรส / สัญชาติ / เขตปกครอง — มีแต่ใน HOSxP
  const marital = extra?.marital ?? "";
  const mChk = (v: string) => (marital && marital === v ? "☑" : "☐");
  const thai = extra?.thai ?? null;
  const muni = extra?.municipality ?? "";
  const dead =
    status.includes("เสียชีวิต") || status.includes("ตาย") ||
    row.death === "ใช่" || Boolean(extra?.deathDate);

  const fullName = `${row.prefix || ""}${row.fname || ""} ${row.lname || ""}`.trim();
  const disease = (row.disease || "").trim();
  const icd10 = hos(extra?.icd10, row.icd10);
  const addr = hos(
    [extra?.house, extra?.moo && `หมู่ ${extra.moo}`].filter(Boolean).join(" "),
    row.addr,
  );
  const tambon = hos(extra?.tambon, row.tambon);
  const amphoe = hos(extra?.amphoe, row.amphoe);
  const province = hos(extra?.province, row.province);

  const printedOn = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const line: React.CSSProperties = { borderBottom: "1px solid #000" };
  const cell: React.CSSProperties = {
    border: "1px solid #000",
    padding: "3px 5px",
    verticalAlign: "top",
  };

  return (
    <div
      id="rng506"
      style={{
        color: "#000",
        fontFamily:
          "'TH SarabunPSK','Sarabun','Cordia New','Segoe UI',sans-serif",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>บัตรรายงานผู้ป่วย</div>
          <div style={{ fontSize: 17, fontWeight: 700, margin: "2px 0" }}>แบบ รง. 506</div>
          <div style={{ fontSize: 12 }}>ข่ายงานเฝ้าระวังโรค สำนักระบาดวิทยา กรมควบคุมโรค กระทรวงสาธารณสุข</div>
          <div style={{ fontSize: 12 }}>โทร. 0-2590-1787 , 0-2590-1785</div>
        </div>
        <div style={{ border: "1px solid #000", padding: "4px 8px", fontSize: 11, minWidth: 180, lineHeight: 1.8 }}>
          <div>เลขที่อ้างอิง 0 ของ สสจ. ……………………</div>
          <div>เลขที่อ้างอิง 1 ของ สสจ. ……………………</div>
          <div style={{ borderTop: "1px solid #999", marginTop: 2, paddingTop: 2 }}>เลขที่อ้างอิง 0 ของ สสอ. ……………………</div>
          <div>เลขที่อ้างอิง 1 ของ สสอ. ……………………</div>
          <div style={{ borderTop: "1px solid #999", marginTop: 2, paddingTop: 2 }}>เลขที่อ้างอิง 0 ของ รพ./สอ. ………………</div>
          <div>เลขที่อ้างอิง 1 ของ รพ./สอ. ………………</div>
        </div>
      </div>

      {/* DISEASE GRID */}
      <div style={{ border: "1.5px solid #000", padding: "5px 6px", marginBottom: 5 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>โรค</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 6px", fontSize: 11.5, lineHeight: 1.65 }}>
          <div>
            {chk("01")} อหิวาตกโรค 01<br />
            {chk("02")} อุจจาระร่วง 02<br />
            {chk("03")} อาหารเป็นพิษ 03<br />
            {chk("04")} บิด Dysentery, unspecified 04<br />
            &nbsp;&nbsp;{chk("05")} Bacillary (Shigellosis) 05<br />
            &nbsp;&nbsp;{chk("06")} Amoebic 06<br />
            {chk("07")} Enteric fever 07<br />
            &nbsp;&nbsp;{chk("08")} Typhoid 08<br />
            &nbsp;&nbsp;{chk("09")} Paratyphoid 09<br />
            {chk("10")} ตับอักเสบ (Hepatitis, unspecified) 10<br />
            &nbsp;&nbsp;{chk("11")} A 11 &nbsp; {chk("69")} D 69<br />
            &nbsp;&nbsp;{chk("12")} B 12 &nbsp; {chk("70")} E 70<br />
            &nbsp;&nbsp;{chk("13")} C 13<br />
            {chk("14")} โรคตาแดง (haemorrhagic conjunctivitis) 14<br />
            {chk("15")} ไข้หวัดใหญ่ 15<br />
            {chk("16")} หัดเยอรมัน 16<br />
            {chk("17")} สุกใส 17<br />
            {chk("18")} ไข้หรือไข้ไม่ทราบสาเหตุ 18<br />
            {chk("19")} ไข้กาฬหลังแอ่น 19<br />
            {chk("20")} โปลิโอมัยเอไลติส 20<br />
            {chk("21")} หัด 21<br />
            {chk("22")} หัดที่มีโรคแทรก (ระบุ)………………… 22<br />
            {chk("23")} ไข้คอตีบ 23<br />
          </div>
          <div>
            {chk("24")} ไอกรน 24<br />
            {chk("25")} บาดทะยัก 25<br />
            {chk("53")} บาดทะยักในทารกแรกเกิด 53<br />
            {chk("66")} ไข้เดงกี (Dengue fever) 66<br />
            {chk("26")} ไข้เลือดออก (DHF) 26<br />
            {chk("27")} ไข้เลือดออก (DSS) 27<br />
            {chk("28")} ไข้สมองอักเสบ (Encephalitis) 28<br />
            {chk("29")} Japanese encephalitis 29<br />
            {chk("30")} มาลาเรีย PV □ PM □ PF □ MIXED 30<br />
            {chk("31")} ปอดบวม (Pneumonia) 31<br />
            {chk("32")} วัณโรคปอด (ที่ตรวจพบเชื้อ) 32<br />
            {chk("33")} เยื่อหุ้มสมอง (TB. meningitis) 33<br />
            □ ระบุอื่นๆ ……………………………… 34<br />
            {chk("35")} โรคเรื้อน 35<br />
            {chk("36")} คุดทะราด 36<br />
            {chk("37")} ซิฟิลิส (ระบุ) ระยะ………………… 37<br />
            {chk("38")} หนองใน 38<br />
            {chk("39")} หนองในเทียม 39<br />
            {chk("40")} แผลริมอ่อน 40<br />
            {chk("41")} ฝีมะม่วง 41<br />
            {chk("79")} เริ่มที่อวัยวะเพศ 79<br />
            {chk("80")} หูดอวัยวะเพศและทวารหนัก 80<br />
            □ โรคติดต่อทางเพศสัมพันธ์อื่นๆ (ระบุ)…81<br />
          </div>
          <div>
            {chk("42")} พิษสุนัขบ้า 42<br />
            {chk("43")} Leptospirosis 43<br />
            {chk("44")} สครับไทฟัส 44<br />
            {chk("45")} แอนแทรกซ์ 45<br />
            {chk("46")} ทริคิโนสิส 46<br />
            <span style={{ fontSize: 10.5 }}>โรคจากการประกอบอาชีพ</span><br />
            □ ถูกพิษสารเคมีกำจัดศัตรูพืช (ระบุ)…47<br />
            □ พิษจากโลหะหนัก (ระบุ)……………48-49<br />
            □ พิษจากสารตัวทำละลาย (ระบุ)…………50<br />
            □ พิษจากแก๊สสารไอระเหย (ระบุ)……51<br />
            □ โรคปอดจากการประกอบอาชีพ (ระบุ)…64<br />
            {chk("65")} กล้ามเนื้ออ่อนปวกเปียก (AFP) 65<br />
            {chk("52")} คาราทูม 52<br />
            □ อาการภายหลังได้รับวัคซีน (AEFI)…<br />
            &nbsp;&nbsp;(ระบุ)……………………………………<br />
            {chk("71")} Hand Foot Mouth disease (HFMD) 71<br />
            {chk("72")} Melioidosis 72<br />
            □ โรคอื่น ๆ (ระบุ)……………………<br />
            <br />
            <div style={{ fontSize: 11, marginTop: 4 }}>
              <b>โรคที่วินิจฉัย:</b> <u>{disease}</u>
            </div>
            <div style={{ fontSize: 11 }}>
              <b>รหัส 506:</b> <u>{code}</u> &nbsp; <b>ICD-10:</b> <u>{icd10}</u>
            </div>
          </div>
        </div>
      </div>

      {/* PATIENT INFO */}
      <div style={{ border: "1.5px solid #000", borderTop: "none", padding: "4px 6px", fontSize: 12 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 3 }}>
          <span>ชื่อผู้ป่วย</span>
          <span style={{ ...line, flex: 1, padding: "0 4px", fontWeight: 700 }}>{fullName}</span>
          <span style={{ whiteSpace: "nowrap" }}>H.N.</span>
          <span style={{ ...line, width: 130, padding: "0 4px", fontFamily: "monospace" }}>{row.hn || ""}</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <span>ชื่อบิดา–มารดาหรือผู้ปกครอง (สำหรับผู้ป่วยเด็กที่มีอายุต่ำกว่า 15 ปี)</span>
          <span style={{ ...line, flex: 1 }} />
          <span>อาชีพของบิดา–มารดา</span>
          <span style={{ ...line, width: 100 }} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 4 }}>
          <tbody>
            <tr>
              <td style={{ ...cell, width: 80 }}>
                <b>เพศ</b><br />
                {sexM ? "☑" : "☐"} ชาย<br />
                {sexF ? "☑" : "☐"} หญิง
              </td>
              <td style={cell}>
                <b>อายุ</b><br />
                ปี <u>{age.y || row.age || ""}</u> &nbsp; เดือน <u>{age.m || "………"}</u> &nbsp;
                วันที่ <u>{dob.d}</u> เดือน <u>{dob.m}</u> ปี <u>{dob.y}</u>
              </td>
              <td style={cell}>
                <b>ภาวะสมรส</b><br />
                {mChk("โสด")}&nbsp;1 โสด &nbsp; {mChk("คู่")}&nbsp;2 คู่<br />
                {mChk("หย่าร้าง")}&nbsp;3 หย่าร้าง &nbsp; {mChk("หม้าย")}&nbsp;4 หม้าย
              </td>
              <td style={cell}>
                <b>สัญชาติ</b><br />
                {thai === true ? "☑" : "☐"} คนไทย<br />
                {thai === false ? "☑" : "☐"} คนต่างชาติ ประเภท □1 □2
                <div style={{ fontSize: 10 }}>
                  ระบุสัญชาติ{" "}
                  <u>{thai === false ? extra?.nationalityName || "…………………" : "…………………"}</u>
                </div>
              </td>
              <td style={cell}>
                <b>งานที่ทำ</b><br />
                <u style={{ display: "block", minHeight: 30 }}>{extra?.occupation || ""}</u>
                (□□)
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: 3 }}><b>ที่อยู่ขณะเริ่มป่วย</b></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 12 }}>
          <span>บ้านเลขที่/หมู่</span>
          <span style={{ ...line, flex: 1, padding: "0 4px" }}>{addr}</span>
          <span>ตำบล</span>
          <span style={{ ...line, flex: 1, padding: "0 4px" }}>{tambon}</span>
          <span>อำเภอ</span>
          <span style={{ ...line, flex: 1, padding: "0 4px" }}>{amphoe}</span>
          <span>จังหวัด</span>
          <span style={{ ...line, flex: 1, padding: "0 4px" }}>{province}</span>
          <span style={{ whiteSpace: "nowrap", fontSize: 10 }}>
            {muni === "1" ? "☑" : "□"}1 ในเขตเทศบาล<br />
            {muni === "2" ? "☑" : "□"}2 อบต.
          </span>
        </div>
      </div>

      {/* TREATMENT */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1.5px solid #000", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: 130 }}>
              <b>วันที่เริ่มป่วย</b><br />
              วันที่ <u>{ons.d}</u> เดือน <u>{ons.m}</u> พ.ศ. <u>{ons.y}</u>
            </td>
            <td style={{ ...cell, width: 130 }}>
              <b>วันพบผู้ป่วย</b><br />
              วันที่ <u>{rpt.d}</u> เดือน <u>{rpt.m}</u> พ.ศ. <u>{rpt.y}</u>
            </td>
            <td style={cell}>
              <b>สถานที่รักษา</b><br />
              □1 รพ.ศูนย์ &nbsp; □4 คลินิกของราชการ &nbsp; □7 คลินิก รพ.เอกชน<br />
              □2 รพ.ทั่วไป &nbsp; □5 สอ. &nbsp; □8 บ้าน<br />
              ☑3 รพ.ชุมชน &nbsp; □6 รพ.ราชการใน กทม.
            </td>
            <td style={{ ...cell, width: 90, textAlign: "center" }}>
              <b>ประเภทผู้ป่วย</b><br />
              {ptype === "OPD" ? <u>☑</u> : "☐"} OPD<br />
              {ptype === "IPD" ? <u>☑</u> : "☐"} IPD
            </td>
          </tr>
        </tbody>
      </table>

      {/* OUTCOME */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1.5px solid #000", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: 180 }}>
              <b>สภาพผู้ป่วย</b><br />
              {outcome.includes("หาย") || outcome.includes("ดีขึ้น") || status.includes("หาย")
                ? "☑" : "☐"} หาย &nbsp; {status.includes("ไม่ทราบ") ? "☑" : "☐"} ไม่ทราบ<br />
              {dead ? "☑" : "☐"} ตาย &nbsp; {!dead && status.includes("มีชีวิต") ? "☑" : "☐"} ยังมีชีวิตอยู่<br />
              {status.includes("รักษาอยู่") || status.includes("ยังรักษา") ? "☑" : "☐"} ยังรักษาอยู่
            </td>
            <td style={{ ...cell, width: 160 }}>
              <b>วันที่ตาย</b><br />
              วันที่ <u>{dth.d || "………"}</u> เดือน <u>{dth.m || "………"}</u> พ.ศ. <u>{dth.y || "…………"}</u>
            </td>
            <td style={cell}>
              <b>ชื่อผู้รายงาน</b> <u>{extra?.reporter || "………………………………"}</u>{" "}
              <b>สถานที่ทำงาน</b> โรงพยาบาลพลับพลาชัย
            </td>
            <td style={{ ...cell, width: 100 }}>
              <b>จังหวัด</b> บุรีรัมย์<br />(□□)
            </td>
            <td style={{ ...cell, width: 130 }}>
              <b>วันที่เขียนรายงาน</b><br />
              วันที่ <u>{rpt.d}</u> เดือน <u>{rpt.m}</u> พ.ศ. <u>{rpt.y}</u>
            </td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER STAMPS */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, border: "1.5px solid #000", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={cell}><b>วันที่รับรายงานของ สสจ.</b><br />………………(□□□□□□)</td>
            <td style={cell}><b>วันที่รับรายงานของ สสอ.</b><br />………………(□□□□□□)</td>
            <td style={cell}><b>วันที่รับรายงานของสำนักระบาดวิทยา</b><br />………………(□□□□□□)</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10, color: "#555", marginTop: 6, lineHeight: 1.4 }}>
        ให้ทำเครื่องหมาย x ในช่อง □ หน้าข้อความที่ต้องการ และกรอกรายละเอียดในช่องว่างให้ครบถ้วนและชัดเจน ยกเว้นใน □□<br />
        <b>* นิยาม</b> ต่างชาติประเภท 1 คือ ชาวต่างชาติที่เข้ามาขายแรงงานในประเทศไทย ไม่มีใบต่างด้าว / ต่างชาติประเภท 2 คือ ชาวต่างชาติหรือนักท่องเที่ยวต่างชาติที่เข้ามารักษาในประเทศไทย เมื่อหายแล้วกลับประเทศตน
      </div>

      <div style={{ textAlign: "right", fontSize: 10, color: "#888", marginTop: 4 }}>
        พิมพ์จาก D506 Dashboard · {printedOn}
      </div>
    </div>
  );
}
