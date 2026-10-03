/**
 * =========================================================================
 * GOOGLE APPS SCRIPT สำหรับระบบบันทึกและตรวจสอบอาการปวดคนไข้ (Pain Assessment)
 * ปรับปรุงให้สอดคล้องกับโครงสร้าง Google Sheet ของโรงพยาบาล 100%
 * =========================================================================
 */

const SPREADSHEET_ID = "1qawG_VPCRk23Rh-L4OrgySnIQnztjGSY6jwAYnTW-TQ";
const SHEET_NAME_SEARCH = "ค้นหา_AN";
const SHEET_NAME_DATA = "Pain_Data";

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
  
  if (name === SHEET_NAME_SEARCH) return false;
  if (/^(sheet\d+|ชีต\d+|setting|config|template|summary|สรุป|ค้นหา|dashboard)/i.test(name)) return false;
  
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(name);
  
  return hasMonth || hasDatePattern;
}

function getSheetNames(ss) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("cached_month_sheets");
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  
  const sheets = ss.getSheets();
  const allNames = sheets.map(s => s.getName().trim());
  
  // 1. กรองเฉพาะชีตเดือน-ปี
  const monthSheets = allNames.filter(name => isMonthYearSheet(name));
  const result = monthSheets.length > 0 ? monthSheets : allNames.filter(name => name !== SHEET_NAME_SEARCH);
  
  try {
    cache.put("cached_month_sheets", JSON.stringify(result), 1800); // แคชรายชื่อชีตไว้ 30 นาที
  } catch (e) {}
  
  return result;
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
 * เพิ่มคอลัมน์ "หน่วยงาน" ในคอลัมน์แรก พร้อมตั้งค่า Data Validation แบบ Dropdown 13 หอผู้ป่วย
 */
function ensureWardColumn(sheet) {
  if (!sheet) return;
  try {
    if (!hasWardColumn(sheet)) {
      sheet.insertColumnBefore(1);
      sheet.getRange("A1:A2").merge();
      sheet.getRange("A1").setValue("หน่วยงาน")
        .setBackground("#a9d08e")
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      sheet.setColumnWidth(1, 95);
    }
    
    // ตั้งค่า Format เป็นข้อความธรรมดา (Plain Text) และ Data Validation รายการ 13 หอผู้ป่วย (แถว 3 ถึง 1000)
    sheet.getRange(3, 1, 1000, 1).setNumberFormat("@");
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(WARDS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(3, 1, 1000, 1).setDataValidation(rule);
  } catch (e) {}
}

/**
 * ตรวจสอบและอัปเดตหัวคอลัมน์ AN ในชีตอัตโนมัติ (หากเดิมเป็น "HN")
 */
function ensureColumnAIsAN(sheet) {
  if (!sheet) return;
  try {
    const hasWard = hasWardColumn(sheet);
    const colIdx = hasWard ? 2 : 1;
    const val = String(sheet.getRange(1, colIdx).getValue() || "").trim();
    if (val.toUpperCase() === "HN") {
      sheet.getRange(1, colIdx).setValue("AN");
    }
  } catch (e) {}
}

/**
 * อัปเดตหัวตาราง Col A/B ของทุกชีตประจำเดือนใน Spreadsheet ให้เป็น "AN" ทั้งหมด
 */
function updateAllSheetsHeaderToAN(ss) {
  const sheets = ss.getSheets();
  const updated = [];
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    const name = s.getName().trim();
    if (name === SHEET_NAME_SEARCH) continue;
    try {
      const hasWard = hasWardColumn(s);
      const colIdx = hasWard ? 2 : 1;
      const val = String(s.getRange(1, colIdx).getValue() || "").trim();
      if (val.toUpperCase() === "HN") {
        s.getRange(1, colIdx).setValue("AN");
        updated.push(name);
      }
    } catch (e) {}
  }
  return updated;
}

/**
 * สร้างชีตประจำเดือนใหม่อัตโนมัติ พร้อมโครงสร้างคอลัมน์หน่วยงานและสไตล์ Col A-O (15 คอลัมน์)
 */
function createMonthSheet(ss, sheetName) {
  const cleanName = String(sheetName || "").trim();
  if (!cleanName) return null;
  
  let sheet = ss.getSheetByName(cleanName);
  if (sheet) return sheet;
  
  // 1. พยายามคัดลอก (copyTo) จากชีตประจำเดือนเดิมที่มีอยู่ เพื่อรักษารูปแบบ สี ฟอนต์ ขนาดคอลัมน์ และการผสานเซลล์ไว้ 100%
  const allSheets = ss.getSheets();
  let templateSheet = null;
  for (let i = 0; i < allSheets.length; i++) {
    const s = allSheets[i];
    const name = s.getName().trim();
    if (name !== SHEET_NAME_SEARCH && isMonthYearSheet(name)) {
      templateSheet = s;
      break;
    }
  }
  if (!templateSheet && allSheets.length > 0) {
    templateSheet = allSheets[0];
  }
  
  if (templateSheet) {
    try {
      sheet = templateSheet.copyTo(ss);
      sheet.setName(cleanName);
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(ss.getNumSheets());
      
      // ตรวจสอบและเพิ่มคอลัมน์ "หน่วยงาน" อัตโนมัติสำหรับชีตใหม่
      ensureWardColumn(sheet);
      
      // ปรับหัวตารางให้เป็น AN
      ensureColumnAIsAN(sheet);

      // ล้างข้อมูลเดิมตั้งแต่แถวที่ 3 ลงไป (คงแถวหัวตารางที่ 1 และ 2 ไว้)
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow > 2 && lastCol > 0) {
        sheet.getRange(3, 1, lastRow - 2, lastCol).clearContent();
      }
    } catch (copyErr) {
      sheet = null;
    }
  }
  
  // 2. หากคัดลอกไม่สำเร็จ ให้สร้างชีตใหม่พร้อมสร้างโครงสร้าง Header 15 คอลัมน์ (หน่วยงาน, HN/AN, Tool...)
  if (!sheet) {
    sheet = ss.insertSheet(cleanName);
    const headersRow1 = [
      "หน่วยงาน", "HN", "Tool", "Pain แรกรับ", "", "Pain q 8 hr", "", 
      "Pain ≥ 5**", "Intervention", "Re-assessment", 
      "Operation Surgery", "Pain post - op แรกรับ", "", "Guideline Post - op", "หมายเหตุ"
    ];
    const headersRow2 = [
      "", "", "", "ฟอร์มปรอท", "Nurse note", "ฟอร์มปรอท", "Nurse Note", 
      "", "", "", 
      "", "ฟอร์มปรอท", "Nurse Note", "", ""
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
      
      // กำหนดสีหัวตารางตามรูปแบบจริงในภาพ
      sheet.getRange("A1:B2").setBackground("#a9d08e"); // สีเขียว: หน่วยงาน, HN
      sheet.getRange("C1:C2").setBackground("#d5a6bd"); // สีม่วง: Tool
      sheet.getRange("D1:G2").setBackground("#ffe599"); // สีเหลืองทอง: Pain แรกรับ, q8
      sheet.getRange("H1:O2").setBackground("#cfe2f3"); // สีฟ้าอ่อน: ข้อมูลผ่าตัดและหมายเหตุ
      
      sheet.getRange("A1:O2")
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      sheet.setFrozenRows(2);
      sheet.setColumnWidth(1, 95);
      sheet.setColumnWidth(2, 100);
      sheet.setColumnWidth(3, 160);
      
      // ตั้งค่า Format เป็นข้อความธรรมดา (Plain Text) และ Data Validation สำหรับคอลัมน์ A (หน่วยงาน)
      sheet.getRange(3, 1, 1000, 1).setNumberFormat("@");
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(WARDS, true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(3, 1, 1000, 1).setDataValidation(rule);
    } catch (fmtErr) {}
  }
  
  // ล้างแคชรายชื่อชีตเพื่อให้ระบบตรวจพบชีตใหม่ทันที
  try {
    const cache = CacheService.getScriptCache();
    cache.remove("cached_month_sheets");
  } catch (cErr) {}
  
  return sheet;
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
    
    // 1. ดึงรายชื่อแท็บชีตเดือน (พร้อม High-Speed Cache)
    if (action === "getSheets") {
      const ss = getSpreadsheet();
      const sheetList = getSheetNames(ss);
      return createJsonResponse({ status: "success", sheets: sheetList }, callback);
    }

    // 1.1 สร้างชีตใหม่ตามสั่ง
    if (action === "createSheet") {
      const newSheetName = (e.parameter && (e.parameter.sheet || e.parameter.sheetName || e.parameter.name)) || "";
      if (!newSheetName) {
        return createJsonResponse({ status: "error", message: "กรุณาระบุชื่อชีตที่ต้องการสร้าง" }, callback);
      }
      const ss = getSpreadsheet();
      const created = createMonthSheet(ss, newSheetName);
      const updatedSheets = getSheetNames(ss);
      return createJsonResponse({ 
        status: "success", 
        message: "สร้างชีต " + created.getName() + " เรียบร้อยแล้ว",
        sheetName: created.getName(),
        sheets: updatedSheets 
      }, callback);
    }

    // 1.2 อัปเดตหัวคอลัมน์ A ในทุกชีตจาก "HN" เป็น "AN"
    if (action === "updateHeaderToAN" || action === "convertHeaderToAN" || action === "fixHeader") {
      const ss = getSpreadsheet();
      const updated = updateAllSheetsHeaderToAN(ss);
      return createJsonResponse({ 
        status: "success", 
        message: "อัปเดตหัวคอลัมน์ A เป็น AN เรียบร้อยแล้วใน " + updated.length + " ชีต",
        updatedSheets: updated 
      }, callback);
    }
    
    // 2. ดึงข้อมูล (High-Speed CacheService: ส่งผลลัพธ์กลับในเสี้ยววินาที)
    if (action === "getData" || action === "getAll") {
      const cache = CacheService.getScriptCache();
      const cacheKey = "cache_data_" + (targetSheetName ? targetSheetName.replace(/\s+/g, "_") : "default");
      const cachedPayload = cache.get(cacheKey);
      
      // ถ้ามีใน Memory Cache ของ Google ให้ส่งกลับทันทีใน 100-300ms!
      if (cachedPayload && !e.parameter.nocache) {
        return createJsonResponse(JSON.parse(cachedPayload), callback);
      }
      
      const ss = getSpreadsheet();
      const sheetList = getSheetNames(ss);
      
      let sheet = null;
      if (targetSheetName) {
        sheet = ss.getSheetByName(targetSheetName);
      }

      // หากระบุชื่อชีตมาแต่ยังไม่มีใน Spreadsheet ให้ส่งกลับเป็น 0 รายการ (ไม่ดึงชีตอื่นมาปน)
      if (!sheet && targetSheetName) {
        return createJsonResponse({
          status: "success",
          currentSheet: targetSheetName,
          sheets: sheetList,
          count: 0,
          data: [],
          isNewSheet: true
        }, callback);
      }

      if (!sheet && sheetList.length > 0) {
        sheet = ss.getSheetByName(sheetList[0]);
      }
      if (!sheet) {
        sheet = ss.getSheets()[0];
      }
      
      // ตรวจสอบและปรับหัวคอลัมน์ A ให้เป็น AN
      ensureColumnAIsAN(sheet);
      
      const data = parseHospitalSheet(sheet);
      const responsePayload = { 
        status: "success", 
        currentSheet: sheet.getName(),
        sheets: sheetList,
        count: data.length,
        data: data 
      };
      
      // เก็บลง Memory Cache ของ Google ไว้นาน 10 นาที (600 วินาที)
      try {
        cache.put(cacheKey, JSON.stringify(responsePayload), 600);
      } catch (cacheErr) {}
      
      return createJsonResponse(responsePayload, callback);
    }
    
    // 3. ค้นหาประวัติ HN/AN ย้อนหลังทุกชีตประจำเดือน (Search Across All Months)
    if (action === "search" || action === "searchAll") {
      const ss = getSpreadsheet();
      const sheetList = getSheetNames(ss);
      const q = ((e.parameter && (e.parameter.an || e.parameter.hn || e.parameter.q)) || "").trim().toLowerCase();
      const searchTargetSheet = (e.parameter && (e.parameter.sheet || e.parameter.sheetName)) || "";
      
      let allMatches = [];
      
      // กรณีระบุชีตเป้าหมาย
      if (searchTargetSheet) {
        const sheet = ss.getSheetByName(searchTargetSheet);
        if (sheet) {
          const data = parseHospitalSheet(sheet);
          allMatches = data.filter(item => {
            const itemHn = String(item["HN"] || item["AN"] || "").trim().toLowerCase();
            return q ? (itemHn === q || itemHn.includes(q)) : true;
          });
        }
      } else {
        // ค้นหาประวัติย้อนหลังทุกเดือนในทุกชีต!
        for (let s = 0; s < sheetList.length; s++) {
          const sName = sheetList[s];
          const sheet = ss.getSheetByName(sName);
          if (!sheet) continue;
          
          const data = parseHospitalSheet(sheet);
          const matched = data.filter(item => {
            const itemHn = String(item["HN"] || item["AN"] || "").trim().toLowerCase();
            return q ? (itemHn === q || itemHn.includes(q)) : true;
          });
          allMatches = allMatches.concat(matched);
        }
      }
      
      return createJsonResponse({ 
        status: "success", 
        query: q, 
        searchedAllMonths: !searchTargetSheet,
        totalSheetsSearched: searchTargetSheet ? 1 : sheetList.length,
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
 * Handle POST Requests (บันทึกข้อมูลเข้าชีตของโรงพยาบาล)
 * หากไม่มีชีตเป้าหมาย จะสร้างชีตใหม่อัตโนมัติทันที
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
    const targetSheetName = String(body.sheetName || body["sheetName"] || "").trim();
    let sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : null;
    let isNewSheetCreated = false;
    
    // **หากข้อมูลที่จะบันทึกไม่มีชีตนั้น ให้เพิ่มอัตโนมัติ**
    if (!sheet && targetSheetName) {
      sheet = createMonthSheet(ss, targetSheetName);
      isNewSheetCreated = true;
    }
    
    if (!sheet && sheetList.length > 0) sheet = ss.getSheetByName(sheetList[0]);
    if (!sheet) sheet = ss.getSheets()[0];
    
    // ตรวจสอบและปรับหัวคอลัมน์ A ให้เป็น AN
    ensureColumnAIsAN(sheet);

    // ดึงค่าตามโครงสร้างชีตจริง
    const hasWard = hasWardColumn(sheet);
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
    
    // บันทึกแถวใหม่ตามโครงสร้าง (หากชีตมีคอลัมน์หน่วยงาน Col A = หน่วยงาน, Col B = AN/HN)
    let rowData = [];
    if (hasWard) {
      rowData = [
        "'" + ward, // ใส่ ' เพื่อให้ Google Sheets บันทึกเป็น Plain Text ป้องกันแปลง 5/1 หรือ 3/2 เป็นวันที่
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
        note
      ];
    } else {
      rowData = [
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
        note
      ];
    }
    
    // บันทึกต่อท้ายแถวที่มีข้อมูล
    sheet.appendRow(rowData);

    // ป้องกัน Google Sheets แปลง 5/1 เป็นวันที่ โดยบังคับให้เป็น Plain Text
    if (hasWard) {
      try {
        const lastRowNum = sheet.getLastRow();
        sheet.getRange(lastRowNum, 1).setNumberFormat("@").setValue("'" + ward);
      } catch (wErr) {}
    }
    
    // ล้างแคชของชีตนี้และแคชรายชื่อชีต
    try {
      const cache = CacheService.getScriptCache();
      cache.remove("cache_data_" + sheet.getName().replace(/\s+/g, "_"));
      cache.remove("cache_data_default");
      cache.remove("cached_month_sheets");
    } catch (cErr) {}
    
    const updatedSheets = getSheetNames(ss);
    
    return createJsonResponse({
      status: "success",
      message: isNewSheetCreated 
        ? `สร้างชีตใหม่ "${sheet.getName()}" และบันทึกข้อมูลเรียบร้อยแล้ว` 
        : `บันทึกข้อมูลลงชีต "${sheet.getName()}" เรียบร้อยแล้ว`,
      savedSheet: sheet.getName(),
      createdNewSheet: isNewSheetCreated,
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

  // หากเป็น Date หรือสตริงวันที่ เช่น "Mon Jan 05 2026..."
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
 * แปลงข้อมูลจากชีตจริงของโรงพยาบาล (รองรับทั้งชีตที่มีคอลัมน์ "หน่วยงาน" และชีตเดิม)
 */
function parseHospitalSheet(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 2) return [];
  
  const hasWard = hasWardColumn(sheet);
  const o = hasWard ? 1 : 0; // offset ถ้ามีคอลัมน์หน่วยงาน

  // อ่านข้อมูลตั้งแต่แถวที่ 3 (ใต้ Header แถว 1 และ 2)
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
    
    // ข้ามแถวว่าง หรือแถวสรุปผล Total
    if (!hn || hn.includes("Total") || hn.includes("%") || hn.includes("รวม")) continue;
    
    const item = {
      _rowIndex: i + 3,
      _sheetName: sheet.getName(),
      "หน่วยงาน": ward,
      "Ward": ward,
      "HN": hn,
      "AN": hn, // แมป AN ให้ตรงกับ HN
      "Tool": String(row[o + 1] || "Numeric Rating Score").trim(),
      
      // Pain แรกรับ
      "Pain แรกรับ : ฟอร์มปรอท": String(row[o + 2] || "-").trim(),
      "Pain แรกรับ : Nurse note": String(row[o + 3] || "-").trim(),
      
      // Pain q 8 hr
      "Pain q 8 hr : ฟอร์มปรอท": String(row[o + 4] || "-").trim(),
      "Pain q 8 hr : Nurse Note": String(row[o + 5] || "-").trim(),
      
      // Pain >= 5
      "Pain ≥ 5**": String(row[o + 6] || "NO").trim(),
      "Intervention": String(row[o + 7] || "-").trim(),
      "Re-assessment": String(row[o + 8] || "-").trim(),
      
      // ผ่าตัด
      "Operation Surgery": String(row[o + 9] || "NO").trim(),
      "Pain post-op แรกรับ : ฟอร์มปรอท": String(row[o + 10] || "-").trim(),
      "Pain post-op แรกรับ : Nurse Note": String(row[o + 11] || "-").trim(),
      "Guideline Post-op": String(row[o + 12] || "-").trim(),
      
      // หมายเหตุ
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
