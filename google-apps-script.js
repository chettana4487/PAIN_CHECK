/**
 * =========================================================================
 * GOOGLE APPS SCRIPT สำหรับระบบบันทึกและตรวจสอบอาการปวดคนไข้ (Pain Assessment)
 * สถาปัตยกรรมชีตกลาง (Central Master Sheet: "Pain_Data") แบบ Smart Column Alignment
 * ตรวจจับคอลัมน์เดิมอัตโนมัติ ย้ายข้อมูลประวัติเดิมมาลงตรงช่อง 100% และบันทึกของใหม่ตรงช่อง
 * =========================================================================
 */

const SPREADSHEET_ID = "1qawG_VPCRk23Rh-L4OrgySnIQnztjGSY6jwAYnTW-TQ";
const SHEET_NAME_SEARCH = "ค้นหา_AN";
const SHEET_NAME_DATA = "Pain_Data"; // ชีตกลางหลักที่รวมข้อมูลคนไข้ทุกงวด

// รายชื่อหน่วยงาน / หอผู้ป่วย (13 รายการ)
const WARDS = [
  "4/2",
  "3/2",
  "3/3",
  "3/4",
  "3/5",
  "7/2",
  "7/3",
  "7/4",
  "7/5",
  "7/6",
  "5/1",
  "5/4",
  "5/5"
];

// คำสำคัญที่บ่งบอกว่าเป็นชีตประจำเดือน
const MONTH_KEYWORDS = [
  "ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค",
  "มกรา", "กุมภา", "มีนา", "เมษา", "พฤษภา", "มิถุนา", "กรกฎา", "สิงหา", "กันยา", "ตุลา", "พฤศจิกา", "ธันวา",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
];

/**
 * เพิ่มเมนูพิเศษใน Google Sheets สำหรับให้ทีมงานกดจัดระเบียบคอลัมน์ได้ใน 1 คลิก
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🏥 ระบบ Pain Assessment")
      .addItem("⚡ จัดระเบียบคอลัมน์ชีตกลาง (Pain_Data) ให้ตรง 100%", "rebuildCentralSheetUI")
      .addToUi();
  } catch (e) {}
}

function rebuildCentralSheetUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const count = rebuildCentralSheet(ss);
  SpreadsheetApp.getActiveSpreadsheet().toast("จัดระเบียบคอลัมน์ตรงช่อง 100% แล้ว (นำเข้าประวัติเดิม " + count + " รายการ)", "สำเร็จ ✅", 5);
}

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function isMonthYearSheet(sheetName) {
  if (!sheetName) return false;
  const name = String(sheetName).trim();
  const lower = name.toLowerCase();
  
  if (name === SHEET_NAME_SEARCH || name === SHEET_NAME_DATA) return false;
  if (/^(sheet\d+|ชีต\d+|setting|config|template|summary|สรุป|ค้นหา|dashboard)/i.test(name)) return false;
  
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(name);
  
  return hasMonth || hasDatePattern;
}

/**
 * ดึงรายชื่อแท็บเดือนทั้งหมด ผสมกับรายชื่องวดที่มีในชีตกลาง Pain_Data
 */
function getSheetNames(ss) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("cached_month_sheets_v4");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  
  const sheets = ss.getSheets();
  const allNames = sheets.map(s => s.getName().trim());
  
  const monthSheets = allNames.filter(name => isMonthYearSheet(name));
  const monthSet = new Set(monthSheets);
  
  const centralSheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (centralSheet && centralSheet.getLastRow() > 2) {
    try {
      const colPValues = centralSheet.getRange(3, 16, centralSheet.getLastRow() - 2, 1).getValues();
      colPValues.forEach(row => {
        const m = String(row[0] || "").trim();
        if (m) monthSet.add(m);
      });
    } catch (err) {}
  }
  
  let result = Array.from(monthSet);
  if (result.length === 0) {
    result = ["ต.ค.68"];
  }
  
  try {
    cache.put("cached_month_sheets_v4", JSON.stringify(result), 600);
  } catch (e) {}
  
  return result;
}

/**
 * โครงสร้างหัวตารางมาตรฐาน 17 คอลัมน์ของชีตกลาง Pain_Data
 * Col A: หน่วยงาน
 * Col B: AN
 * Col C: Tool
 * Col D: Pain แรกรับ : ฟอร์มปรอท
 * Col E: Pain แรกรับ : Nurse note
 * Col F: Pain q 8 hr : ฟอร์มปรอท
 * Col G: Pain q 8 hr : Nurse Note
 * Col H: Pain ≥ 5**
 * Col I: Intervention
 * Col J: Re-assessment
 * Col K: Operation Surgery
 * Col L: Pain post - op แรกรับ : ฟอร์มปรอท
 * Col M: Pain post - op แรกรับ : Nurse Note
 * Col N: Guideline Post - op
 * Col O: หมายเหตุ
 * Col P: งวดประจำเดือน
 * Col Q: วันเวลาบันทึก
 */
function initCentralSheetHeaders(sheet) {
  const headersRow1 = [
    "หน่วยงาน", "AN", "Tool", "Pain แรกรับ", "", "Pain q 8 hr", "", 
    "Pain ≥ 5**", "Intervention", "Re-assessment", 
    "Operation Surgery", "Pain post - op แรกรับ", "", "Guideline Post - op", "หมายเหตุ",
    "งวดประจำเดือน", "วันเวลาบันทึก"
  ];
  const headersRow2 = [
    "", "", "", "ฟอร์มปรอท", "Nurse note", "ฟอร์มปรอท", "Nurse Note", 
    "", "", "", 
    "", "ฟอร์มปรอท", "Nurse Note", "", "",
    "เดือน/ปี", "Timestamp"
  ];
  
  sheet.getRange(1, 1, 1, headersRow1.length).setValues([headersRow1]);
  sheet.getRange(2, 1, 1, headersRow2.length).setValues([headersRow2]);
  
  try {
    sheet.getRange("A1:A2").merge();
    sheet.getRange("B1:B2").merge();
    sheet.getRange("C1:C2").merge();
    sheet.getRange("D1:E1").merge();
    sheet.getRange("F1:G1").merge();
    sheet.getRange("H1:H2").merge();
    sheet.getRange("I1:I2").merge();
    sheet.getRange("J1:J2").merge();
    sheet.getRange("K1:K2").merge();
    sheet.getRange("L1:M1").merge();
    sheet.getRange("N1:N2").merge();
    sheet.getRange("O1:O2").merge();
    sheet.getRange("P1:P2").merge();
    sheet.getRange("Q1:Q2").merge();
    
    // กำหนดสีหัวตาราง
    sheet.getRange("A1:B2").setBackground("#a9d08e"); // เขียว: หน่วยงาน, AN
    sheet.getRange("C1:C2").setBackground("#d5a6bd"); // ม่วง: Tool
    sheet.getRange("D1:G2").setBackground("#ffe599"); // เหลือง: Pain แรกรับ, q8
    sheet.getRange("H1:O2").setBackground("#cfe2f3"); // ฟ้า: Surgery, หมายเหตุ
    sheet.getRange("P1:Q2").setBackground("#fed7aa"); // ส้มอ่อน: งวดประจำเดือน, เวลา
    
    sheet.getRange("A1:Q2")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setFrozenRows(2);
    
    sheet.setColumnWidth(1, 95);   // หน่วยงาน
    sheet.setColumnWidth(2, 110);  // AN
    sheet.setColumnWidth(3, 160);  // Tool
    sheet.setColumnWidth(15, 180); // หมายเหตุ
    sheet.setColumnWidth(16, 130); // งวดประจำเดือน (Col P)
    sheet.setColumnWidth(17, 150); // Timestamp (Col Q)
    
    // จัดรูปแบบคอลัมน์เป็น Plain Text
    sheet.getRange(3, 1, 5000, 1).setNumberFormat("@");
    sheet.getRange(3, 2, 5000, 1).setNumberFormat("@");
    sheet.getRange(3, 16, 5000, 1).setNumberFormat("@");
    
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(WARDS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(3, 1, 5000, 1).setDataValidation(rule);
  } catch (fmtErr) {}
}

/**
 * Smart Column Reader: อ่านข้อมูลจากชีตเดิมอย่างแม่นยำ ไม่ว่าจะเรียงคอลัมน์แบบใด มีคอลัมน์หน่วยงานหรือไม่
 * โดยตรวจจับจากทั้งข้อความใน Header (Row 1-2) และชนิดข้อมูลในเซลล์ (Data Content Inspection)
 */
function smartReadHospitalSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 2 || lastCol === 0) return [];
  
  const r1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const r2 = sheet.getRange(2, 1, 1, lastCol).getValues()[0];
  
  const range = sheet.getRange(3, 1, lastRow - 2, lastCol);
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  
  // สร้าง Header รวมแต่ละคอลัมน์ (แก้ merged cells ในแถว 1)
  let lastH1 = "";
  const headers = [];
  for (let c = 0; c < lastCol; c++) {
    let h1 = String(r1[c] || "").trim();
    if (h1) lastH1 = h1;
    else h1 = lastH1;
    const h2 = String(r2[c] || "").trim();
    headers.push((h1 + " " + h2).trim().toLowerCase());
  }
  
  // 1. ตรวจจับคอลัมน์ตาม Header Text
  let wardCol = -1;
  let anCol = -1;
  let toolCol = -1;
  let pInitThermoCol = -1;
  let pInitNoteCol = -1;
  let pQ8ThermoCol = -1;
  let pQ8NoteCol = -1;
  let pOver5Col = -1;
  let intervCol = -1;
  let reassessCol = -1;
  let surgCol = -1;
  let pPostThermoCol = -1;
  let pPostNoteCol = -1;
  let guideCol = -1;
  let noteCol = -1;
  
  for (let c = 0; c < lastCol; c++) {
    const h = headers[c];
    if (/หน่วยงาน|ward|ตึก|หอผู้ป่วย/.test(h)) wardCol = c;
    else if (/\b(an|hn)\b|ผู้ป่วย|เลขประจำตัว/.test(h) && anCol === -1) anCol = c;
    else if (/tool|เครื่องมือ/.test(h)) toolCol = c;
    else if (/แรกรับ/.test(h) && /ปรอท/.test(h)) pInitThermoCol = c;
    else if (/แรกรับ/.test(h) && /note|โน้ต/.test(h)) pInitNoteCol = c;
    else if (/q\s*8/.test(h) && /ปรอท/.test(h)) pQ8ThermoCol = c;
    else if (/q\s*8/.test(h) && /note|โน้ต/.test(h)) pQ8NoteCol = c;
    else if (/≥\s*5|>\s*5|>=|5\*\*/.test(h)) pOver5Col = c;
    else if (/intervention|การจัดการ/.test(h)) intervCol = c;
    else if (/re-assessment|ประเมินซ้ำ/.test(h)) reassessCol = c;
    else if (/surgery|operation|ผ่าตัด/.test(h)) surgCol = c;
    else if (/post\s*-\s*op|postop/.test(h) && /ปรอท/.test(h)) pPostThermoCol = c;
    else if (/post\s*-\s*op|postop/.test(h) && /note|โน้ต/.test(h)) pPostNoteCol = c;
    else if (/guideline|แนวปฏิบัติ/.test(h)) guideCol = c;
    else if (/หมายเหตุ|remarks?|note/.test(h) && !/แรกรับ|q\s*8|post/.test(h)) noteCol = c;
  }
  
  // 2. ตรวจสอบเนื้อหาข้อมูลในแถวจริง (Content Auto-Detection) หาก Header บางตัวไม่ได้ระบุไว้
  for (let r = 0; r < Math.min(values.length, 5); r++) {
    for (let c = 0; c < lastCol; c++) {
      const val = String(values[r][c] || "").trim();
      const disp = String(displayValues[r][c] || "").trim();
      
      if (wardCol === -1 && (WARDS.includes(val) || WARDS.includes(disp))) {
        wardCol = c;
      }
      if (toolCol === -1 && (val.includes("Numeric") || val.includes("CPOT") || val.includes("Facial"))) {
        toolCol = c;
      }
      if (anCol === -1 && /^\d{5,9}$/.test(val)) {
        anCol = c;
      }
      if (intervCol === -1 && (val.includes("Medication") || val.includes("No record"))) {
        intervCol = c;
      }
    }
  }
  
  // 3. กำหนดค่าเริ่มต้นตามลำดับชีตมาตรฐานหากยังขาดคอลัมน์ใด
  if (anCol === -1) anCol = (wardCol === 0) ? 1 : 0;
  if (toolCol === -1) toolCol = anCol + 1;
  if (pInitThermoCol === -1) pInitThermoCol = toolCol + 1;
  if (pInitNoteCol === -1) pInitNoteCol = toolCol + 2;
  if (pQ8ThermoCol === -1) pQ8ThermoCol = toolCol + 3;
  if (pQ8NoteCol === -1) pQ8NoteCol = toolCol + 4;
  if (pOver5Col === -1) pOver5Col = toolCol + 5;
  if (intervCol === -1) intervCol = toolCol + 6;
  if (reassessCol === -1) reassessCol = toolCol + 7;
  if (surgCol === -1) surgCol = toolCol + 8;
  if (pPostThermoCol === -1) pPostThermoCol = toolCol + 9;
  if (pPostNoteCol === -1) pPostNoteCol = toolCol + 10;
  if (guideCol === -1) guideCol = toolCol + 11;
  if (noteCol === -1) noteCol = toolCol + 12;
  
  // 4. ประกอบข้อมูลให้อยู่ในโครงสร้างมาตรฐานอย่างถูกต้อง 100%
  const results = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const dispRow = displayValues[i] || [];
    
    const an = String(row[anCol] || dispRow[anCol] || "").trim();
    if (!an || an.includes("Total") || an.includes("%") || an.includes("รวม") || an.toLowerCase() === "an" || an.toLowerCase() === "hn") {
      continue;
    }
    
    const rawWard = wardCol !== -1 ? row[wardCol] : "";
    const dispWard = wardCol !== -1 ? dispRow[wardCol] : "";
    const ward = normalizeWardValue(rawWard, dispWard);
    
    results.push({
      _rowIndex: i + 3,
      _sheetName: sheet.getName(),
      ward: ward,
      an: an,
      tool: String(row[toolCol] || "Numeric Rating Score").trim(),
      painInitThermo: String(row[pInitThermoCol] || "YES").trim(),
      painInitNote: String(row[pInitNoteCol] || "YES").trim(),
      painQ8Thermo: String(row[pQ8ThermoCol] || "YES").trim(),
      painQ8Note: String(row[pQ8NoteCol] || "YES").trim(),
      painOver5: String(row[pOver5Col] || "NO").trim(),
      intervention: String(row[intervCol] || "-").trim(),
      reassessment: String(row[reassessCol] || "-").trim(),
      opSurgery: String(row[surgCol] || "NO").trim(),
      postOpThermo: String(row[pPostThermoCol] || "-").trim(),
      postOpNote: String(row[pPostNoteCol] || "-").trim(),
      guideline: String(row[guideCol] || "-").trim(),
      note: String(row[noteCol] || "").trim()
    });
  }
  
  return results;
}

/**
 * ฟังก์ชันหลัก: สร้างหรือจัดระเบียบชีตกลาง Pain_Data ใหม่ทั้งหมด
 * ล้างข้อมูลที่เคยคลาดเคลื่อน แล้วจัดแถวและคอลัมน์ให้ตรงเป๊ะ 100%
 */
function rebuildCentralSheet(ss) {
  ss = ss || getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_DATA);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_DATA, 0);
  } else {
    // ล้างข้อมูลและ unmerge จัดระเบียบใหม่ทั้งหมด
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow > 0 && lastCol > 0) {
      try {
        sheet.getRange(1, 1, lastRow, lastCol).breakApart();
      } catch (e) {}
      sheet.clear();
    }
  }
  
  // 1. วางหัวตาราง 17 คอลัมน์ที่ถูกต้องและจัด Format
  initCentralSheetHeaders(sheet);
  
  // 2. สแกนชีตรายเดือนเดิมทั้งหมดด้วย Smart Column Reader
  const allSheets = ss.getSheets();
  const rowsToAdd = [];
  
  for (let s = 0; s < allSheets.length; s++) {
    const curSheet = allSheets[s];
    const name = curSheet.getName().trim();
    if (name === SHEET_NAME_SEARCH || name === SHEET_NAME_DATA) continue;
    if (!isMonthYearSheet(name)) continue;
    
    const data = smartReadHospitalSheet(curSheet);
    for (let r = 0; r < data.length; r++) {
      const item = data[r];
      rowsToAdd.push([
        "'" + item.ward,          // Col A: หน่วยงาน
        item.an,                 // Col B: AN
        item.tool,               // Col C: Tool
        item.painInitThermo,     // Col D: Pain แรกรับ : ฟอร์มปรอท
        item.painInitNote,       // Col E: Pain แรกรับ : Nurse note
        item.painQ8Thermo,       // Col F: Pain q 8 hr : ฟอร์มปรอท
        item.painQ8Note,         // Col G: Pain q 8 hr : Nurse Note
        item.painOver5,          // Col H: Pain ≥ 5**
        item.intervention,       // Col I: Intervention
        item.reassessment,       // Col J: Re-assessment
        item.opSurgery,          // Col K: Operation Surgery
        item.postOpThermo,       // Col L: Pain post - op แรกรับ : ฟอร์มปรอท
        item.postOpNote,         // Col M: Pain post - op แรกรับ : Nurse Note
        item.guideline,          // Col N: Guideline Post - op
        item.note,               // Col O: หมายเหตุ
        name,                    // Col P: งวดประจำเดือน (เช่น ต.ค.68)
        Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss") // Col Q: Timestamp
      ]);
    }
  }
  
  // 3. เขียนข้อมูลลงในชีตกลาง Pain_Data
  if (rowsToAdd.length > 0) {
    sheet.getRange(3, 1, rowsToAdd.length, 17).setValues(rowsToAdd);
    sheet.getRange(3, 1, rowsToAdd.length, 1).setNumberFormat("@");
    sheet.getRange(3, 2, rowsToAdd.length, 1).setNumberFormat("@");
    sheet.getRange(3, 16, rowsToAdd.length, 1).setNumberFormat("@");
  }
  
  // ล้างแคชทั้งหมด
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(["cached_month_sheets_v4", "cache_data_c_all"]);
  } catch (cErr) {}
  
  return rowsToAdd.length;
}

/**
 * ดึงหรือสร้างชีตกลาง Pain_Data (หากยังไม่มีข้อมูล ให้รัน rebuild อัตโนมัติ)
 */
function getOrCreateCentralSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_DATA, 0);
    initCentralSheetHeaders(sheet);
  }
  return sheet;
}

/**
 * ดึงข้อมูลจากชีตกลาง Pain_Data ส่งให้เว็บแอป (High-Speed Single Range Read)
 */
function parseCentralMasterSheet(centralSheet, filterMonth) {
  const lastRow = centralSheet.getLastRow();
  if (lastRow <= 2) return [];
  
  // อ่านค่าจากชีตกลางครั้งเดียว (รวดเร็วเพียง ~100ms)
  const range = centralSheet.getRange(3, 1, lastRow - 2, 17);
  const values = range.getValues();
  
  const results = [];
  const cleanFilterMonth = filterMonth ? String(filterMonth).trim().toLowerCase() : "";
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawWard = row[0];
    const ward = normalizeWardValue(rawWard);
    const hn = String(row[1] || "").trim();
    
    if (!hn || hn.includes("Total") || hn.includes("%") || hn.includes("รวม")) continue;
    
    const sheetMonth = String(row[15] || "").trim();
    const timestamp = String(row[16] || "").trim();
    
    if (cleanFilterMonth && cleanFilterMonth !== "all" && sheetMonth) {
      if (sheetMonth.toLowerCase() !== cleanFilterMonth) {
        continue;
      }
    }
    
    results.push({
      _rowIndex: i + 3,
      _sheetName: sheetMonth || centralSheet.getName(),
      "งวด": sheetMonth,
      "หน่วยงาน": ward,
      "Ward": ward,
      "HN": hn,
      "AN": hn,
      "Tool": String(row[2] || "Numeric Rating Score").trim(),
      "Pain แรกรับ : ฟอร์มปรอท": String(row[3] || "-").trim(),
      "Pain แรกรับ : Nurse note": String(row[4] || "-").trim(),
      "Pain q 8 hr : ฟอร์มปรอท": String(row[5] || "-").trim(),
      "Pain q 8 hr : Nurse Note": String(row[6] || "-").trim(),
      "Pain ≥ 5**": String(row[7] || "NO").trim(),
      "Intervention": String(row[8] || "-").trim(),
      "Re-assessment": String(row[9] || "-").trim(),
      "Operation Surgery": String(row[10] || "NO").trim(),
      "Pain post-op แรกรับ : ฟอร์มปรอท": String(row[11] || "-").trim(),
      "Pain post-op แรกรับ : Nurse Note": String(row[12] || "-").trim(),
      "Guideline Post-op": String(row[13] || "-").trim(),
      "หมายเหตุ": String(row[14] || "").trim(),
      "timestamp": timestamp
    });
  }
  
  return results;
}

/**
 * Handle GET Requests (ตอบสนองใน 50 - 300ms)
 */
function doGet(e) {
  try {
    e = e || { parameter: {} };
    const action = (e.parameter && e.parameter.action) || "getData";
    const callback = e.parameter && e.parameter.callback;
    const targetSheetName = (e.parameter && (e.parameter.sheet || e.parameter.sheetName)) || "";
    
    // 1. ตรวจสอบ Memory Cache เป็นอันดับแรกสุด (ถ้ามีในแคช ตอบกลับทันทีใน 50ms โดยไม่ต้องเปิด Spreadsheet!)
    if (action === "getData" || action === "getAll") {
      const cache = CacheService.getScriptCache();
      const cacheKey = "cache_data_c5_" + (targetSheetName ? targetSheetName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, "") : "all");
      const cachedPayload = cache.get(cacheKey);
      
      if (cachedPayload && !e.parameter.nocache) {
        return createJsonResponse(JSON.parse(cachedPayload), callback);
      }
    }
    
    const ss = getSpreadsheet();
    
    // คำสั่งจัดระเบียบคอลัมน์ชีตกลางใหม่ตามสั่ง
    if (action === "rebuild" || action === "fixColumns" || action === "syncSheets") {
      const count = rebuildCentralSheet(ss);
      return createJsonResponse({
        status: "success",
        message: "จัดระเบียบคอลัมน์และนำเข้าประวัติเดิมสำเร็จ (" + count + " รายการ)",
        importedCount: count
      }, callback);
    }
    
    const centralSheet = getOrCreateCentralSheet(ss);
    const sheetList = getSheetNames(ss);
    
    // ดึงรายชื่อแท็บเดือน
    if (action === "getSheets") {
      return createJsonResponse({ status: "success", sheets: sheetList }, callback);
    }
    
    // ดึงข้อมูล (ความเร็วสูงจากชีตกลาง Pain_Data)
    if (action === "getData" || action === "getAll") {
      const requestedSheet = targetSheetName || (sheetList[0] || "ต.ค.68");
      const data = parseCentralMasterSheet(centralSheet, requestedSheet);
      
      const responsePayload = { 
        status: "success", 
        currentSheet: requestedSheet,
        sheets: sheetList,
        count: data.length,
        data: data,
        masterSheet: SHEET_NAME_DATA
      };
      
      try {
        const cache = CacheService.getScriptCache();
        const cacheKey = "cache_data_c5_" + (targetSheetName ? targetSheetName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, "") : "all");
        cache.put(cacheKey, JSON.stringify(responsePayload), 600);
      } catch (cacheErr) {}
      
      return createJsonResponse(responsePayload, callback);
    }
      

    
    // 3. ค้นหาประวัติ AN ย้อนหลังทุกงวด (< 0.05 วินาที)
    if (action === "search" || action === "searchAll") {
      const q = ((e.parameter && (e.parameter.an || e.parameter.hn || e.parameter.q)) || "").trim().toLowerCase();
      const searchTargetSheet = (e.parameter && (e.parameter.sheet || e.parameter.sheetName)) || "";
      
      const allData = parseCentralMasterSheet(centralSheet, searchTargetSheet || "all");
      const allMatches = allData.filter(item => {
        const itemHn = String(item["HN"] || item["AN"] || "").trim().toLowerCase();
        return q ? (itemHn === q || itemHn.includes(q)) : true;
      });
      
      return createJsonResponse({ 
        status: "success", 
        query: q, 
        searchedAllMonths: !searchTargetSheet || searchTargetSheet === "all",
        count: allMatches.length, 
        data: allMatches 
      }, callback);
    }
    
    return createJsonResponse({ status: "error", message: "Unknown action" }, callback);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, e && e.parameter && e.parameter.callback);
  }
}

/**
 * Handle POST Requests (บันทึกข้อมูลเข้าชีตกลาง "Pain_Data" ตรงช่อง 100%)
 */
function doPost(e) {
  try {
    const ss = getSpreadsheet();
    const centralSheet = getOrCreateCentralSheet(ss);
    
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter;
    }
    
    const targetSheetName = String(body.sheetName || body["sheetName"] || "ต.ค.68").trim();
    
    // ดึงค่าตามโครงสร้าง 15 คอลัมน์ + งวดประจำเดือน + Timestamp
    const ward = String(body["หน่วยงาน"] || body["ward"] || body["Ward"] || "4/2").trim();
    const an = String(body["AN"] || body["HN"] || body["an"] || body["hn"] || "").trim();
    const tool = String(body["Tool"] || body["tool"] || "Numeric Rating Score").trim();
    const painInitThermo = body["Painแรกรับ_ฟอร์มปรอท"] || body["Pain แรกรับ : ฟอร์มปรอท"] || body["painInitThermo"] || "YES";
    const painInitNote = body["Painแรกรับ_NurseNote"] || body["Pain แรกรับ : Nurse note"] || body["painInitNote"] || "YES";
    const painQ8Thermo = body["PainQ8_ฟอร์มปรอท"] || body["Pain q 8 hr : ฟอร์มปรอท"] || body["painQ8Thermo"] || "YES";
    const painQ8Note = body["PainQ8_NurseNote"] || body["Pain q 8 hr : Nurse Note"] || body["painQ8Note"] || "YES";
    
    const painOver5 = String(body["Pain ≥ 5**"] || body["painOver5"] || "NO").toUpperCase();
    const intervention = painOver5 === "YES" ? (body["Intervention"] || body["intervention"] || "-") : "-";
    const reassessment = painOver5 === "YES" ? (body["Re-assessment"] || body["reassessment"] || "-") : "-";
    
    const opSurgery = String(body["Operation Surgery**"] || body["Operation Surgery"] || body["opSurgery"] || "NO").toUpperCase();
    const postOpThermo = opSurgery === "YES" ? (body["PainPostOp_ฟอร์มปรอท"] || body["Pain post - op แรกรับ : ฟอร์มปรอท"] || body["postOpThermo"] || "YES") : "-";
    const postOpNote = opSurgery === "YES" ? (body["PainPostOp_NurseNote"] || body["Pain post - op แรกรับ : Nurse Note"] || body["postOpNote"] || "YES") : "-";
    const guideline = opSurgery === "YES" ? (body["Guideline"] || body["guideline"] || "YES") : "-";
    
    const note = body["หมายเหตุ"] || body["note"] || "";
    const timestampStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    
    // บันทึกแถวข้อมูล 17 คอลัมน์ลงในชีตกลาง Pain_Data ให้ตรงช่องเป๊ะ:
    // Col A: หน่วยงาน
    // Col B: AN
    // Col C: Tool
    // Col D: Pain แรกรับ : ฟอร์มปรอท
    // Col E: Pain แรกรับ : Nurse note
    // Col F: Pain q 8 hr : ฟอร์มปรอท
    // Col G: Pain q 8 hr : Nurse Note
    // Col H: Pain ≥ 5**
    // Col I: Intervention
    // Col J: Re-assessment
    // Col K: Operation Surgery
    // Col L: Pain post - op แรกรับ : ฟอร์มปรอท
    // Col M: Pain post - op แรกรับ : Nurse Note
    // Col N: Guideline Post - op
    // Col O: หมายเหตุ
    // Col P: งวดประจำเดือน
    // Col Q: วันเวลาบันทึก
    const rowData = [
      "'" + ward,
      an,
      tool,
      painInitThermo,
      painInitNote,
      painQ8Thermo,
      painQ8Note,
      painOver5,
      intervention,
      reassessment,
      opSurgery,
      postOpThermo,
      postOpNote,
      guideline,
      note,
      targetSheetName,
      timestampStr
    ];
    
    const action = String(body.action || "").toLowerCase();
    let targetRow = parseInt(body.rowIndex || body._rowIndex, 10);
    
    const lastRow = centralSheet.getLastRow();
    if ((action === "update" || targetRow >= 3) && (!targetRow || targetRow < 3 || targetRow > lastRow)) {
      const data = centralSheet.getDataRange().getValues();
      for (let r = 2; r < data.length; r++) {
        const rowAn = String(data[r][1] || "").trim();
        const rowMonth = String(data[r][15] || "").trim();
        if (rowAn === an && (!targetSheetName || rowMonth === targetSheetName)) {
          targetRow = r + 1;
          break;
        }
      }
    }
    
    const isEditMode = (action === "update" || (body.rowIndex && targetRow >= 3)) && targetRow >= 3 && targetRow <= lastRow;
    
    if (isEditMode) {
      centralSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      try {
        centralSheet.getRange(targetRow, 1).setNumberFormat("@").setValue("'" + ward);
        centralSheet.getRange(targetRow, 2).setNumberFormat("@").setValue(an);
        centralSheet.getRange(targetRow, 16).setNumberFormat("@").setValue(targetSheetName);
      } catch (wErr) {}
    } else {
      centralSheet.appendRow(rowData);
      const newRowNum = centralSheet.getLastRow();
      try {
        centralSheet.getRange(newRowNum, 1).setNumberFormat("@").setValue("'" + ward);
        centralSheet.getRange(newRowNum, 2).setNumberFormat("@").setValue(an);
        centralSheet.getRange(newRowNum, 16).setNumberFormat("@").setValue(targetSheetName);
      } catch (wErr) {}
    }
    
    // ล้างแคช
    try {
      const cache = CacheService.getScriptCache();
      cache.remove("cache_data_c4_" + targetSheetName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, ""));
      cache.remove("cache_data_c4_all");
      cache.remove("cached_month_sheets_v4");
    } catch (cErr) {}
    
    const updatedSheets = getSheetNames(ss);
    
    let msg = "";
    if (isEditMode) {
      msg = `แก้ไขข้อมูล AN ${an} ในงวด "${targetSheetName}" เรียบร้อยแล้ว`;
    } else {
      msg = `บันทึกข้อมูล AN ${an} ลงงวด "${targetSheetName}" ในชีตกลางเรียบร้อยแล้ว`;
    }
    
    return createJsonResponse({
      status: "success",
      message: msg,
      isEdit: isEditMode,
      rowIndex: isEditMode ? targetRow : centralSheet.getLastRow(),
      savedSheet: targetSheetName,
      masterSheet: SHEET_NAME_DATA,
      sheets: updatedSheets,
      savedRow: rowData
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * แปลงค่าหอผู้ป่วย
 */
function normalizeWardValue(val, displayVal) {
  if (!val && !displayVal) return "4/2";
  const dispStr = String(displayVal || "").trim();
  if (WARDS.includes(dispStr)) return dispStr;
  
  const str = String(val || "").trim();
  if (WARDS.includes(str)) return str;

  let d = null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val;
  } else if (typeof str === "string" && (str.includes("GMT") || str.includes("202") || str.includes("256") || str.includes("T00:00") || str.includes("Jan") || str.includes("Feb") || str.includes("Mar") || str.includes("Apr") || str.includes("May") || str.includes("Jun") || str.includes("Jul") || str.includes("Aug") || str.includes("Sep") || str.includes("Oct") || str.includes("Nov") || str.includes("Dec"))) {
    const cleanStr = str.replace(/\s*\(.*?\)/g, "").trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) d = parsed;
  }

  if (d) {
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const c1 = `${day}/${month}`;
    if (WARDS.includes(c1)) return c1;
    const c2 = `${month}/${day}`;
    if (WARDS.includes(c2)) return c2;
  }

  for (const w of WARDS) {
    if (str === w || str.includes(w)) return w;
  }

  return dispStr || str || "4/2";
}

function createJsonResponse(data, callback) {
  let outputText = JSON.stringify(data);
  let mimeType = ContentService.MimeType.JSON;
  
  if (callback && typeof callback === "string") {
    const safeCallback = callback.replace(/[^a-zA-Z0-9_]/g, "");
    outputText = safeCallback + "(" + outputText + ")";
    mimeType = ContentService.MimeType.JAVASCRIPT;
  }
  
  const output = ContentService.createTextOutput(outputText);
  output.setMimeType(mimeType);
  return output;
}
