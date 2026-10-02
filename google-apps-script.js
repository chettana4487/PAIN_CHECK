/**
 * =========================================================================
 * GOOGLE APPS SCRIPT สำหรับระบบบันทึกและตรวจสอบอาการปวดคนไข้ (Pain Assessment)
 * =========================================================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ของท่าน: https://docs.google.com/spreadsheets/d/1qawG_VPCRk23Rh-L4OrgySnIQnztjGSY6jwAYnTW-TQ/edit
 * 2. ไปที่เมนู ส่วนขยาย (Extensions) > Apps Script
 * 3. ลบโค้ดเดิมทั้งหมดในไฟล์ Code.gs แล้วคัดลอกโค้ดนี้ไปวางแทนที่
 * 4. กดบันทึก (ไอคอนแผ่นดิสก์)
 * 5. กดปุ่ม "การทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 6. เลือกประเภท: "เว็บแอป" (Web app)
 * 7. ตั้งค่า:
 *    - คำอธิบาย: Pain Assessment API v1
 *    - ดำเนินการในฐานะ: ฉัน (Me / บัญชีของคุณ)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)  <--- สำคัญมาก เพื่อให้เว็บแอปเรียกบันทึกและอ่านข้อมูลได้
 * 8. กด "ทำให้ใช้งานได้" (Deploy) และให้สิทธิ์การเข้าถึง (Authorize access)
 * 9. คัดลอก "URL ของเว็บแอป" (Web app URL) ที่ลงท้ายด้วย /exec
 * 10. นำ URL นั้นไปกรอกในหน้า "ตั้งค่าเชื่อมต่อ Google Sheet" ในระบบเว็บแอป
 */

const SPREADSHEET_ID = "1qawG_VPCRk23Rh-L4OrgySnIQnztjGSY6jwAYnTW-TQ";
const SHEET_NAME_DATA = "Pain_Data";
const SHEET_NAME_SEARCH = "ค้นหา_AN";

/**
 * ดึง Spreadsheet อัตโนมัติ (รองรับทั้งเปิดจากชีตโดยตรง และ Standalone Script)
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId()) return active;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// โครงสร้างคอลัมน์มาตรฐานตามข้อกำหนด
const HEADERS = [
  "Record ID",
  "วันที่และเวลา",
  "ผู้บันทึก",
  "AN",
  "หน่วยงาน",
  "Tool",
  "Pain แรกรับ : ฟอร์มปรอท",
  "Pain แรกรับ : Nurse note",
  "Pain q 8 hr : ฟอร์มปรอท",
  "Pain ≥ 5**",
  "Intervention",
  "Re-assessment",
  "Operation Surgery",
  "Pain post-op แรกรับ : ฟอร์มปรอท",
  "Pain post-op แรกรับ : Nurse Note",
  "Guideline Post-op",
  "หมายเหตุ"
];

/**
 * ฟังก์ชันเตรียมชีตอัตโนมัติ (จะสร้างชีตและใส่ Header ให้อัตโนมัติหากยังไม่มี)
 */
function setupSheets() {
  const ss = getSpreadsheet();
  
  // 1. ตรวจสอบ/สร้างชีต Pain_Data
  let dataSheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(SHEET_NAME_DATA);
    dataSheet.appendRow(HEADERS);
    formatHeaderRow(dataSheet);
  } else if (dataSheet.getLastRow() === 0) {
    dataSheet.appendRow(HEADERS);
    formatHeaderRow(dataSheet);
  }
  
  // 2. ตรวจสอบ/สร้างชีต ค้นหา_AN
  let searchSheet = ss.getSheetByName(SHEET_NAME_SEARCH);
  if (!searchSheet) {
    searchSheet = ss.insertSheet(SHEET_NAME_SEARCH);
    setupSearchSheet(searchSheet);
  }
  
  return { dataSheet, searchSheet };
}

function formatHeaderRow(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground("#4f46e5");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function setupSearchSheet(sheet) {
  sheet.clear();
  sheet.getRange("A1").setValue("ระบบค้นหาประวัติ AN ใน Google Sheet").setFontWeight("bold").setFontSize(14);
  sheet.getRange("A2").setValue("ใส่เลข AN ที่ต้องการค้นหาในช่อง B3:");
  sheet.getRange("A3").setValue("ค้นหา AN:").setFontWeight("bold").setBackground("#e0e7ff");
  sheet.getRange("B3").setValue(""); // ที่สำหรับผู้ใช้กรอก AN
  sheet.getRange("B3").setBackground("#fef3c7").setFontWeight("bold");
  
  // สร้างหัวตารางแสดงผลลัพธ์
  const resultHeadersRange = sheet.getRange(5, 1, 1, HEADERS.length);
  resultHeadersRange.setValues([HEADERS]);
  resultHeadersRange.setBackground("#059669");
  resultHeadersRange.setFontColor("#ffffff");
  resultHeadersRange.setFontWeight("bold");
  sheet.setFrozenRows(5);
  
  // ใส่สูตร FILTER เพื่อดึงข้อมูลอัตโนมัติจาก Pain_Data
  // หากกรอก AN ใน B3 จะแสดงข้อมูลทั้งหมดเรียงจากล่าสุดไปเก่าสุด
  const formula = `=IF(B3="","", IFERROR(SORT(FILTER(Pain_Data!A2:Q, Pain_Data!D2:D=B3), 2, FALSE), "ไม่พบข้อมูล AN นี้"))`;
  sheet.getRange("A6").setFormula(formula);
}

// คำสำคัญที่บ่งบอกว่าเป็นชีตประจำเดือน
const MONTH_KEYWORDS = [
  "ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค",
  "มกรา", "กุมภา", "มีนา", "เมษา", "พฤษภา", "มิถุนา", "กรกฎา", "สิงหา", "กันยา", "ตุลา", "พฤศจิกา", "ธันวา",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
];

function isMonthYearSheet(sheetName) {
  if (!sheetName) return false;
  const name = String(sheetName).trim();
  const lower = name.toLowerCase();
  
  // ยกเว้นชีตระบบและชีตที่ไม่ใช่รายเดือน
  if (name === SHEET_NAME_SEARCH || name === SHEET_NAME_DATA) return false;
  if (/^(sheet\d+|ชีต\d+|setting|config|template|summary|สรุป|ค้นหา|dashboard)/i.test(name)) return false;
  
  // ตรวจสอบว่ามีชื่อเดือน
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  // หรือมีรูปแบบตัวเลข ปี/เดือน เช่น 2567-10, 10/2567, 2024-10, 67_10
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(name);
  
  return hasMonth || hasDatePattern;
}

/**
 * ดึงรายชื่อ Worksheet เฉพาะที่เป็น "เดือน ปี" เท่านั้น
 */
function getSheetNames(ss) {
  const sheets = ss.getSheets();
  const allNames = sheets.map(s => s.getName().trim());
  
  // 1. กรองเฉพาะชีตที่ตรงกับ เดือน ปี เท่านั้น
  const monthSheets = allNames.filter(name => isMonthYearSheet(name));
  
  if (monthSheets.length > 0) {
    return monthSheets;
  }
  
  // หากยังไม่มีชีตเดือน ให้ส่งชีตข้อมูลที่ใช้งานได้
  return allNames.filter(name => name !== SHEET_NAME_SEARCH);
}

/**
 * Handle GET Requests (สำหรับดึงข้อมูล)
 * ?action=getSheets -> ดึงรายชื่อ Work Sheet รายเดือนเท่านั้น
 * ?action=getData&sheet=XXXX -> ดึงข้อมูลจากชีตเดือนที่เลือก
 * ?action=search&an=XXXX -> ดึงข้อมูลเฉพาะ AN นั้น
 */
function doGet(e) {
  try {
    setupSheets();
    e = e || { parameter: {} };
    const action = (e.parameter && e.parameter.action) || "getData";
    const callback = e.parameter && e.parameter.callback;
    const targetSheetName = (e.parameter && e.parameter.sheet) || "";
    const ss = getSpreadsheet();
    const sheetList = getSheetNames(ss);
    
    // 1. ดึงรายชื่อแท็บชีตเดือน-ปี
    if (action === "getSheets") {
      return createJsonResponse({ status: "success", sheets: sheetList }, callback);
    }
    
    // 2. ดึงข้อมูลตามชีตที่เลือก
    if (action === "getData") {
      let sheet = null;
      if (targetSheetName) {
        sheet = ss.getSheetByName(targetSheetName);
      }
      
      // ถ้าไม่ได้ระบุ ให้เลือกชีตแรกในรายการเดือน หรือ Pain_Data
      if (!sheet && sheetList.length > 0) {
        sheet = ss.getSheetByName(sheetList[0]);
      }
      if (!sheet) {
        sheet = ss.getSheetByName(SHEET_NAME_DATA) || ss.getSheets()[0];
      }
      
      const data = getAllData(sheet);
      return createJsonResponse({ 
        status: "success", 
        currentSheet: sheet.getName(),
        sheets: sheetList,
        count: data.length,
        data: data 
      }, callback);
    }
    
    // 3. ค้นหาประวัติ AN (ค้นหาข้ามทุกชีต หรือค้นหาชีตที่เลือก)
    if (action === "search") {
      const anQuery = ((e.parameter && e.parameter.an) || "").trim();
      let sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : (ss.getSheetByName(SHEET_NAME_DATA) || ss.getSheets()[0]);
      const allData = getAllData(sheet);
      const filtered = allData.filter(item => String(item["AN"] || "").trim().toLowerCase() === anQuery.toLowerCase());
      filtered.sort((a, b) => new Date(b["วันที่และเวลา"]) - new Date(a["วันที่และเวลา"]));
      return createJsonResponse({ status: "success", an: anQuery, count: filtered.length, data: filtered }, callback);
    }
    
    return createJsonResponse({ status: "error", message: "Unknown action" }, callback);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() }, e && e.parameter && e.parameter.callback);
  }
}

/**
 * Handle POST Requests (สำหรับบันทึกข้อมูลแถวใหม่เสมอ - ไม่เขียนทับ)
 */
function doPost(e) {
  try {
    setupSheets();
    const ss = getSpreadsheet();
    
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.parameter;
    }
    
    // เลือกว่าจะบันทึกลงชีตไหน (ถ้าส่ง sheetName มา หรือใช้ Pain_Data)
    const targetSheetName = body.sheetName || body["sheetName"] || "";
    let sheet = targetSheetName ? ss.getSheetByName(targetSheetName) : null;
    if (!sheet) {
      sheet = ss.getSheetByName(SHEET_NAME_DATA) || ss.getSheets()[0];
    }
    
    // สร้าง Record ID หากยังไม่มี
    const recordId = body["Record ID"] || body["recordId"] || "PID-" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd-HHmmss") + "-" + Math.floor(100 + Math.random() * 900);
    const timestamp = body["วันที่และเวลา"] || body["datetime"] || Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
    
    const rowData = [
      recordId,
      timestamp,
      body["ผู้บันทึก"] || body["recorder"] || "",
      body["AN"] || body["an"] || "",
      body["หน่วยงาน"] || body["ward"] || "",
      body["Tool"] || body["tool"] || "",
      body["Pain แรกรับ : ฟอร์มปรอท"] || body["painInitialThermo"] || "",
      body["Pain แรกรับ : Nurse note"] || body["painInitialNote"] || "",
      body["Pain q 8 hr : ฟอร์มปรอท"] || body["painQ8Thermo"] || "",
      body["Pain ≥ 5**"] || body["painOver5"] || "NO",
      body["Intervention"] || body["intervention"] || "",
      body["Re-assessment"] || body["reassessment"] || "",
      body["Operation Surgery"] || body["operationSurgery"] || "NO",
      body["Pain post-op แรกรับ : ฟอร์มปรอท"] || body["painPostOpThermo"] || "",
      body["Pain post-op แรกรับ : Nurse Note"] || body["painPostOpNote"] || "",
      body["Guideline Post-op"] || body["guidelinePostOp"] || "",
      body["หมายเหตุ"] || body["note"] || ""
    ];
    
    // บันทึกต่อท้ายแถวใหม่เสมอ
    sheet.appendRow(rowData);
    
    return createJsonResponse({
      status: "success",
      message: "บันทึกข้อมูลเรียบร้อยแล้ว",
      recordId: recordId,
      savedRow: rowData
    });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * ดึงข้อมูลทั้งหมดจากชีตแล้วแปลงเป็น Array of Objects
 */
function getAllData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow <= 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  return rows.map((row, index) => {
    const item = { _rowIndex: index + 2 };
    headers.forEach((header, colIndex) => {
      let val = row[colIndex];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
      }
      item[header.trim()] = val;
    });
    return item;
  });
}

function createJsonResponse(data, callback) {
  let outputText = JSON.stringify(data);
  let mimeType = ContentService.MimeType.JSON;
  
  if (callback && typeof callback === "string") {
    // ป้องกัน XSS ในชื่อฟังก์ชัน callback
    const safeCallback = callback.replace(/[^a-zA-Z0-9_]/g, "");
    outputText = safeCallback + "(" + outputText + ")";
    mimeType = ContentService.MimeType.JAVASCRIPT;
  }
  
  const output = ContentService.createTextOutput(outputText);
  output.setMimeType(mimeType);
  return output;
}
