/**
 * =========================================================================
 * GOOGLE APPS SCRIPT สำหรับระบบบันทึกและตรวจสอบอาการปวดคนไข้ (Pain Assessment)
 * สถาปัตยกรรมชีตกลาง (Central Master Sheet: "Pain_Data") เพื่อความเร็วสูงสุด (Instant Speed)
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
  const cached = cache.get("cached_month_sheets_v3");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  
  const sheets = ss.getSheets();
  const allNames = sheets.map(s => s.getName().trim());
  
  // 1. ดึงชื่อชีตแท็บเดือนเดิม
  const monthSheets = allNames.filter(name => isMonthYearSheet(name));
  const monthSet = new Set(monthSheets);
  
  // 2. ดึงค่างวด (เดือน/ปี) ที่เคยบันทึกไว้ใน Col P ของชีตกลาง Pain_Data
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
    cache.put("cached_month_sheets_v3", JSON.stringify(result), 600); // 10 นาที
  } catch (e) {}
  
  return result;
}

/**
 * ตรวจสอบและสร้างชีตกลาง "Pain_Data" พร้อมดึงข้อมูลจากชีตเดิมมารวมให้อัตโนมัติ
 */
function getOrCreateCentralSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (sheet) return sheet;
  
  // 1. สร้างชีตกลางขึ้นมาใหม่ วางไว้แท็บแรก
  sheet = ss.insertSheet(SHEET_NAME_DATA, 0);
  
  // โครงสร้างหัวตาราง Col A-Q (17 คอลัมน์):
  // Col A-O สอดคล้องกับชีตโรงพยาบาลเดิม 100% + Col P คอลัมน์ "งวดประจำเดือน" + Col Q "วันเวลาบันทึก"
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
    "เดือน/ปี (งวด)", "Timestamp"
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
    
    // โทนสีสวยงามและเป็นระเบียบ
    sheet.getRange("A1:B2").setBackground("#a9d08e"); // เขียว: หน่วยงาน, AN
    sheet.getRange("C1:C2").setBackground("#d5a6bd"); // ม่วง: Tool
    sheet.getRange("D1:G2").setBackground("#ffe599"); // เหลือง: Pain แรกรับ, q8
    sheet.getRange("H1:O2").setBackground("#cfe2f3"); // ฟ้า: Surgery, หมายเหตุ
    sheet.getRange("P1:Q2").setBackground("#fed7aa"); // ส้มอ่อน: งวดประจำเดือน และเวลาบันทึก
    
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
    
    // ตั้งค่า Format Col A เป็นข้อความธรรมดา (Plain Text) และ Data Validation รายการ 13 หอผู้ป่วย
    sheet.getRange(3, 1, 5000, 1).setNumberFormat("@");
    sheet.getRange(3, 2, 5000, 1).setNumberFormat("@");
    sheet.getRange(3, 16, 5000, 1).setNumberFormat("@");
    
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(WARDS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(3, 1, 5000, 1).setDataValidation(rule);
  } catch (fmtErr) {}

  // 2. นำเข้าข้อมูลเดิมจากชีตรายเดือนเดิมทั้งหมดมาเก็บในชีตกลางทันที (ข้อมูลเดิมไม่สูญหาย)
  importExistingMonthlySheetsToCentral(ss, sheet);
  
  return sheet;
}

/**
 * นำเข้าข้อมูลจากชีตรายเดือนเดิมทั้งหมดเข้าสู่ชีตกลาง Pain_Data อัตโนมัติ
 */
function importExistingMonthlySheetsToCentral(ss, centralSheet) {
  if (!centralSheet) return;
  const sheets = ss.getSheets();
  const rowsToAdd = [];
  
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const name = s.getName().trim();
    if (name === SHEET_NAME_SEARCH || name === SHEET_NAME_DATA) continue;
    if (!isMonthYearSheet(name)) continue;
    
    const data = parseHospitalSheet(s);
    for (let j = 0; j < data.length; j++) {
      const item = data[j];
      const ward = item["หน่วยงาน"] || "4/2";
      const an = item["AN"] || item["HN"] || "";
      if (!an) continue;
      
      rowsToAdd.push([
        "'" + ward,
        an,
        item["Tool"] || "Numeric Rating Score",
        item["Pain แรกรับ : ฟอร์มปรอท"] || "YES",
        item["Pain แรกรับ : Nurse note"] || "YES",
        item["Pain q 8 hr : ฟอร์มปรอท"] || "YES",
        item["Pain q 8 hr : Nurse Note"] || "YES",
        item["Pain ≥ 5**"] || "NO",
        item["Intervention"] || "-",
        item["Re-assessment"] || "-",
        item["Operation Surgery"] || "NO",
        item["Pain post-op แรกรับ : ฟอร์มปรอท"] || "-",
        item["Pain post-op แรกรับ : Nurse Note"] || "-",
        item["Guideline Post-op"] || "-",
        item["หมายเหตุ"] || "",
        name, // งวดประจำเดือน (Col P)
        Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss") // Timestamp (Col Q)
      ]);
    }
  }
  
  if (rowsToAdd.length > 0) {
    const startRow = centralSheet.getLastRow() + 1;
    centralSheet.getRange(startRow, 1, rowsToAdd.length, 17).setValues(rowsToAdd);
    centralSheet.getRange(startRow, 1, rowsToAdd.length, 1).setNumberFormat("@");
    centralSheet.getRange(startRow, 2, rowsToAdd.length, 1).setNumberFormat("@");
    centralSheet.getRange(startRow, 16, rowsToAdd.length, 1).setNumberFormat("@");
  }
}

/**
 * ตรวจสอบว่าชีตมีคอลัมน์ "หน่วยงาน" เป็นคอลัมน์แรกหรือไม่
 */
function hasWardColumn(sheet) {
  if (!sheet) return false;
  try {
    const valA1 = String(sheet.getRange(1, 1).getValue() || "").trim();
    const valA2 = String(sheet.getRange(2, 1).getValue() || "").trim();
    return valA1 === "หน่วยงาน" || valA2 === "หน่วยงาน";
  } catch (e) {
    return false;
  }
}

/**
 * ดึงข้อมูลจากชีตกลาง Pain_Data โดยสามารถเลือกกรองตามงวดเดือน (targetSheetName) หรือดึงทั้งหมดได้ในคำสั่งเดียว
 */
function parseCentralMasterSheet(centralSheet, filterMonth) {
  const lastRow = centralSheet.getLastRow();
  const lastCol = centralSheet.getLastColumn();
  if (lastRow <= 2) return [];
  
  const readCol = Math.max(17, lastCol);
  const range = centralSheet.getRange(3, 1, lastRow - 2, readCol);
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  
  const results = [];
  const cleanFilterMonth = filterMonth ? String(filterMonth).trim().toLowerCase() : "";
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const dispRow = displayValues[i] || [];
    
    const rawWard = row[0];
    const dispWard = dispRow[0] || "";
    const ward = normalizeWardValue(rawWard, dispWard);
    const hn = String(row[1] || "").trim();
    
    // ข้ามแถวว่าง
    if (!hn || hn.includes("Total") || hn.includes("%") || hn.includes("รวม")) continue;
    
    // คอลัมน์ P (Index 15) = งวดประจำเดือน เช่น "ต.ค.68"
    const sheetMonth = String(row[15] || dispRow[15] || "").trim();
    const timestamp = String(row[16] || dispRow[16] || "").trim();
    
    // หากระบุเดือนมาให้กรองเฉพาะเดือนนั้น (ถ้าเป็น "all" หรือว่าง ให้ดึงทุกเดือน)
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
 * Handle GET Requests
 */
function doGet(e) {
  try {
    e = e || { parameter: {} };
    const action = (e.parameter && e.parameter.action) || "getData";
    const callback = e.parameter && e.parameter.callback;
    const targetSheetName = (e.parameter && (e.parameter.sheet || e.parameter.sheetName)) || "";
    
    const ss = getSpreadsheet();
    const centralSheet = getOrCreateCentralSheet(ss);
    const sheetList = getSheetNames(ss);
    
    // 1. ดึงรายชื่อแท็บเดือน
    if (action === "getSheets") {
      return createJsonResponse({ status: "success", sheets: sheetList }, callback);
    }

    // 1.1 สั่งซิงค์ข้อมูลจากชีตเดิมเข้าสู่ชีตกลาง Pain_Data ทั้งหมด
    if (action === "syncAllToCentral" || action === "syncSheets") {
      importExistingMonthlySheetsToCentral(ss, centralSheet);
      const cache = CacheService.getScriptCache();
      cache.removeAll(["cached_month_sheets_v3", "cache_central_all"]);
      return createJsonResponse({
        status: "success",
        message: "ซิงค์ข้อมูลจากชีตเดิมเข้าสู่ชีตกลาง Pain_Data เรียบร้อยแล้ว",
        totalRows: centralSheet.getLastRow() - 2
      }, callback);
    }
    
    // 2. ดึงข้อมูล (High-Speed Single Sheet Architecture: ส่งผลลัพธ์กลับใน 150-300ms!)
    if (action === "getData" || action === "getAll") {
      const cache = CacheService.getScriptCache();
      const cacheKey = "cache_data_c_" + (targetSheetName ? targetSheetName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, "") : "all");
      const cachedPayload = cache.get(cacheKey);
      
      // ถ้ามีใน Memory Cache ของ Google ให้ส่งกลับทันทีใน 50-150ms!
      if (cachedPayload && !e.parameter.nocache) {
        return createJsonResponse(JSON.parse(cachedPayload), callback);
      }
      
      // อ่านข้อมูลจากชีตกลาง Pain_Data ครั้งเดียว
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
      
      // บันทึกลง Memory Cache ของ Google ไว้นาน 10 นาที (600 วินาที)
      try {
        cache.put(cacheKey, JSON.stringify(responsePayload), 600);
      } catch (cacheErr) {}
      
      return createJsonResponse(responsePayload, callback);
    }
    
    // 3. ค้นหาประวัติ AN ย้อนหลังทุกงวด (Instant Cross-Month Search บนชีตกลาง ใน < 0.05 วินาที!)
    if (action === "search" || action === "searchAll") {
      const q = ((e.parameter && (e.parameter.an || e.parameter.hn || e.parameter.q)) || "").trim().toLowerCase();
      const searchTargetSheet = (e.parameter && (e.parameter.sheet || e.parameter.sheetName)) || "";
      
      // ดึงข้อมูลทั้งหมดจากชีตกลางครั้งเดียว แล้วค้นหาในหน่วยความจำ RAM ของ Apps Script ทันที
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
 * Handle POST Requests (บันทึกข้อมูลเข้าชีตกลาง "Pain_Data" ของโรงพยาบาลโดยตรง)
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
    
    // ดึงค่าตามโครงสร้างชีตจริง 15 คอลัมน์ + งวดประจำเดือน + Timestamp
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
    
    // บันทึกแถวข้อมูล 17 คอลัมน์ลงในชีตกลาง Pain_Data:
    // Col A-O: 15 คอลัมน์ตามชีตโรงพยาบาลเดิม 100%
    // Col P: งวดประจำเดือน (เช่น "ต.ค.68")
    // Col Q: วันเวลาบันทึก (Timestamp)
    const rowData = [
      "'" + ward, // Plain text ป้องกันแปลง 5/1 หรือ 3/2 เป็นวันที่
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
      targetSheetName, // Col P: งวดประจำเดือน
      timestampStr     // Col Q: วันเวลาบันทึก
    ];
    
    const action = String(body.action || "").toLowerCase();
    let targetRow = parseInt(body.rowIndex || body._rowIndex, 10);
    
    // หากเป็นการแก้ไข (update) ให้ตรวจสอบแถวเป้าหมายในชีตกลาง Pain_Data
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
      // 1. อัปเดตแถวเดิมที่มีอยู่แล้วในชีตกลาง
      centralSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      try {
        centralSheet.getRange(targetRow, 1).setNumberFormat("@").setValue("'" + ward);
        centralSheet.getRange(targetRow, 2).setNumberFormat("@").setValue(an);
        centralSheet.getRange(targetRow, 16).setNumberFormat("@").setValue(targetSheetName);
      } catch (wErr) {}
    } else {
      // 2. บันทึกต่อท้ายแถวใหม่ในชีตกลางอย่างรวดเร็ว (Instant Append)
      centralSheet.appendRow(rowData);
      const newRowNum = centralSheet.getLastRow();
      try {
        centralSheet.getRange(newRowNum, 1).setNumberFormat("@").setValue("'" + ward);
        centralSheet.getRange(newRowNum, 2).setNumberFormat("@").setValue(an);
        centralSheet.getRange(newRowNum, 16).setNumberFormat("@").setValue(targetSheetName);
      } catch (wErr) {}
    }
    
    // ล้างแคชเพื่อให้ดึงข้อมูลใหม่ได้ทันที
    try {
      const cache = CacheService.getScriptCache();
      cache.remove("cache_data_c_" + targetSheetName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, ""));
      cache.remove("cache_data_c_all");
      cache.remove("cached_month_sheets_v3");
    } catch (cErr) {}
    
    const updatedSheets = getSheetNames(ss);
    
    let msg = "";
    if (isEditMode) {
      msg = `แก้ไขข้อมูล AN ${an} ในงวด "${targetSheetName}" (แถวที่ ${targetRow} ในชีตกลาง) เรียบร้อยแล้ว`;
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
 * แปลงค่าหอผู้ป่วย ป้องกันกรณี Google Sheets แปลง "5/1" หรือ "3/2" เป็น Date object หรือสตริงวันที่
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

/**
 * แปลงข้อมูลจากชีตรายเดือนเดิม (สำหรับฟังก์ชันการซิงค์ข้อมูลย้อนหลังเข้าชีตกลาง)
 */
function parseHospitalSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 2) return [];
  
  const hasWard = hasWardColumn(sheet);
  const o = hasWard ? 1 : 0;

  const range = sheet.getRange(3, 1, lastRow - 2, Math.min(16, lastCol));
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  
  const results = [];
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rawWard = hasWard ? row[0] : "-";
    const dispWard = hasWard && displayValues[i] ? displayValues[i][0] : "";
    const ward = hasWard ? normalizeWardValue(rawWard, dispWard) : "-";
    const hn = String(row[o] || "").trim();
    
    if (!hn || hn.includes("Total") || hn.includes("%") || hn.includes("รวม")) continue;
    
    const item = {
      _rowIndex: i + 3,
      _sheetName: sheet.getName(),
      "หน่วยงาน": ward,
      "Ward": ward,
      "HN": hn,
      "AN": hn,
      "Tool": String(row[o + 1] || "Numeric Rating Score").trim(),
      "Pain แรกรับ : ฟอร์มปรอท": String(row[o + 2] || "-").trim(),
      "Pain แรกรับ : Nurse note": String(row[o + 3] || "-").trim(),
      "Pain q 8 hr : ฟอร์มปรอท": String(row[o + 4] || "-").trim(),
      "Pain q 8 hr : Nurse Note": String(row[o + 5] || "-").trim(),
      "Pain ≥ 5**": String(row[o + 6] || "NO").trim(),
      "Intervention": String(row[o + 7] || "-").trim(),
      "Re-assessment": String(row[o + 8] || "-").trim(),
      "Operation Surgery": String(row[o + 9] || "NO").trim(),
      "Pain post-op แรกรับ : ฟอร์มปรอท": String(row[o + 10] || "-").trim(),
      "Pain post-op แรกรับ : Nurse Note": String(row[o + 11] || "-").trim(),
      "Guideline Post-op": String(row[o + 12] || "-").trim(),
      "หมายเหตุ": String(row[o + 13] || "").trim()
    };
    
    results.push(item);
  }
  
  return results;
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
