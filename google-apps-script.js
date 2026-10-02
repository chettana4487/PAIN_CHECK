/**
 * =========================================================================
 * GOOGLE APPS SCRIPT สำหรับระบบบันทึกและตรวจสอบอาการปวดคนไข้ (Pain Assessment)
 * ปรับปรุงให้สอดคล้องกับโครงสร้าง Google Sheet ของโรงพยาบาล 100%
 * =========================================================================
 */

const SPREADSHEET_ID = "1qawG_VPCRk23Rh-L4OrgySnIQnztjGSY6jwAYnTW-TQ";
const SHEET_NAME_SEARCH = "ค้นหา_AN";
const SHEET_NAME_DATA = "Pain_Data";

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
  
  if (name === SHEET_NAME_SEARCH) return false;
  if (/^(sheet\d+|ชีต\d+|setting|config|template|summary|สรุป|ค้นหา|dashboard)/i.test(name)) return false;
  
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(name);
  
  return hasMonth || hasDatePattern;
}

function getSheetNames(ss) {
  const sheets = ss.getSheets();
  const allNames = sheets.map(s => s.getName().trim());
  
  // 1. กรองเฉพาะชีตเดือน-ปี
  const monthSheets = allNames.filter(name => isMonthYearSheet(name));
  if (monthSheets.length > 0) return monthSheets;
  
  // 2. ถ้าไม่มี ให้ส่งชีตข้อมูลที่ใช้งานได้
  return allNames.filter(name => name !== SHEET_NAME_SEARCH);
}

/**
 * Handle GET Requests
 */
function doGet(e) {
  try {
    e = e || { parameter: {} };
    const action = (e.parameter && e.parameter.action) || "getData";
    const callback = e.parameter && e.parameter.callback;
    const targetSheetName = (e.parameter && e.parameter.sheet) || "";
    const ss = getSpreadsheet();
    const sheetList = getSheetNames(ss);
    
    // 1. ดึงรายชื่อแท็บชีตเดือน
    if (action === "getSheets") {
      return createJsonResponse({ status: "success", sheets: sheetList }, callback);
    }
    
    // 2. ดึงข้อมูล
    if (action === "getData") {
      let sheet = null;
      if (targetSheetName) {
        sheet = ss.getSheetByName(targetSheetName);
      }
      if (!sheet && sheetList.length > 0) {
        sheet = ss.getSheetByName(sheetList[0]);
      }
      if (!sheet) {
        sheet = ss.getSheets()[0];
      }
      
      const data = parseHospitalSheet(sheet);
      return createJsonResponse({ 
        status: "success", 
        currentSheet: sheet.getName(),
        sheets: sheetList,
        count: data.length,
        data: data 
      }, callback);
    }
    
    // 3. ค้นหาตาม HN/AN
    if (action === "search") {
      const q = ((e.parameter && (e.parameter.an || e.parameter.hn)) || "").trim().toLowerCase();
      let sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : null;
      if (!sheet && sheetList.length > 0) sheet = ss.getSheetByName(sheetList[0]);
      if (!sheet) sheet = ss.getSheets()[0];
      
      const allData = parseHospitalSheet(sheet);
      const filtered = allData.filter(item => {
        const itemHn = String(item["HN"] || item["AN"] || "").trim().toLowerCase();
        return itemHn === q || itemHn.includes(q);
      });
      return createJsonResponse({ status: "success", query: q, count: filtered.length, data: filtered }, callback);
    }
    
    return createJsonResponse({ status: "error", message: "Unknown action" }, callback);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, e && e.parameter && e.parameter.callback);
  }
}

/**
 * Handle POST Requests (บันทึกข้อมูลเข้าชีตของโรงพยาบาล)
 */
function doPost(e) {
  try {
    const ss = getSpreadsheet();
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter;
    }
    
    const sheetList = getSheetNames(ss);
    const targetSheetName = body.sheetName || body["sheetName"] || "";
    let sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : null;
    if (!sheet && sheetList.length > 0) sheet = ss.getSheetByName(sheetList[0]);
    if (!sheet) sheet = ss.getSheets()[0];
    
    // ดึงค่าตามโครงสร้างชีตจริง
    const hn = String(body["HN"] || body["AN"] || body["hn"] || body["an"] || "").trim();
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
    
    // บันทึกแถวใหม่ตามโครงสร้าง Col A-N ของชีตจริง
    const rowData = [
      hn,
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
      note
    ];
    
    // บันทึกต่อท้ายแถวที่มีข้อมูล
    sheet.appendRow(rowData);
    
    return createJsonResponse({
      status: "success",
      message: "บันทึกข้อมูลเรียบร้อยแล้ว",
      savedSheet: sheet.getName(),
      savedRow: rowData
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * แปลงข้อมูลจากชีตจริงของโรงพยาบาล (โครงสร้าง 14 คอลัมน์หลัก Col A-N)
 */
function parseHospitalSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 2) return [];
  
  // อ่านข้อมูลตั้งแต่แถวที่ 3 (ใต้ Header แถว 1 และ 2)
  const range = sheet.getRange(3, 1, lastRow - 2, Math.min(15, lastCol));
  const values = range.getValues();
  
  const results = [];
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const hn = String(row[0] || "").trim();
    
    // ข้ามแถวว่าง หรือแถวสรุปผล Total
    if (!hn || hn.includes("Total") || hn.includes("%") || hn.includes("รวม")) continue;
    
    const item = {
      _rowIndex: i + 3,
      _sheetName: sheet.getName(),
      "HN": hn,
      "AN": hn, // แมป AN ให้ตรงกับ HN
      "Tool": String(row[1] || "Numeric Rating Score").trim(),
      
      // Pain แรกรับ
      "Pain แรกรับ : ฟอร์มปรอท": String(row[2] || "-").trim(),
      "Pain แรกรับ : Nurse note": String(row[3] || "-").trim(),
      
      // Pain q 8 hr
      "Pain q 8 hr : ฟอร์มปรอท": String(row[4] || "-").trim(),
      "Pain q 8 hr : Nurse Note": String(row[5] || "-").trim(),
      
      // Pain >= 5
      "Pain ≥ 5**": String(row[6] || "NO").trim(),
      "Intervention": String(row[7] || "-").trim(),
      "Re-assessment": String(row[8] || "-").trim(),
      
      // ผ่าตัด
      "Operation Surgery": String(row[9] || "NO").trim(),
      "Pain post-op แรกรับ : ฟอร์มปรอท": String(row[10] || "-").trim(),
      "Pain post-op แรกรับ : Nurse Note": String(row[11] || "-").trim(),
      "Guideline Post-op": String(row[12] || "-").trim(),
      
      // หมายเหตุ
      "หมายเหตุ": String(row[13] || "").trim()
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
