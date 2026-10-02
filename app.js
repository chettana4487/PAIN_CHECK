/**
 * Pain Assessment & Tracking Web App - JavaScript Engine
 * ออกแบบเพื่อการใช้งานบนมือถือ แท็บเล็ต และคอมพิวเตอร์
 */

// Dropdown Constants
const WARDS = [
  "4/2", "3/2", "3/3", "3/4", "3/5", 
  "7/2", "7/3", "7/4", "7/5", "7/6", 
  "5/1", "5/4", "5/5"
];

const TOOLS = [
  "Numeric Rating Score",
  "Facial rating scale",
  "CPOT"
];

const INTERVENTIONS = [
  "Medication",
  "Non Medication",
  "No record"
];

// Initial Mock Records for instant preview & demonstration
const INITIAL_DEMO_RECORDS = [
  {
    "Record ID": "PID-20261002-140230-101",
    "วันที่และเวลา": "2026-10-02 14:00:00",
    "ผู้บันทึก": "พว. ศิริพร สมบูรณ์",
    "AN": "67001234",
    "หน่วยงาน": "4/2",
    "Tool": "Numeric Rating Score",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "YES",
    "Pain ≥ 5**": "YES",
    "Intervention": "Medication",
    "Re-assessment": "YES",
    "Operation Surgery": "YES",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "YES",
    "Pain post-op แรกรับ : Nurse Note": "YES",
    "Guideline Post-op": "YES",
    "หมายเหตุ": "ผู้ป่วยบ่นปวดแผลผ่าตัด Appendectomy ได้รับ Tramadol 50mg IV"
  }
];

/**
 * Smart Field Normalizer: ดึงค่าจาก Object แม้ชื่อหัวคอลัมน์ใน Google Sheet จะมีเว้นวรรคหรือเขียนต่างกัน
 */
function getSmartField(item, possibleKeys, fallback = "") {
  if (!item || typeof item !== "object") return fallback;
  
  // 1. Direct match
  for (const k of possibleKeys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== "") {
      return String(item[k]).trim();
    }
  }
  
  // 2. Fuzzy match (ตัดช่องว่าง, โคลอน, สัญลักษณ์ และเทียบ case-insensitive)
  const itemEntries = Object.entries(item);
  for (const pattern of possibleKeys) {
    const cleanPattern = pattern.replace(/[\s:_\-–—*()]/g, "").toLowerCase();
    for (const [rawKey, val] of itemEntries) {
      if (val === undefined || val === null || String(val).trim() === "") continue;
      const cleanRaw = rawKey.replace(/[\s:_\-–—*()]/g, "").toLowerCase();
      if (cleanRaw === cleanPattern || cleanRaw.includes(cleanPattern)) {
        return String(val).trim();
      }
    }
  }
  
  return fallback;
}

/**
 * แปลงข้อมูลแถวจาก Google Sheet ให้อยู่ในรูปแบบมาตรฐานของระบบ
 */
function normalizeRecord(item) {
  if (!item || typeof item !== "object") return {};
  
  const datetime = getSmartField(item, [
    "วันที่และเวลา", "วันและเวลา", "วัน/เวลา", "วันที่", "Timestamp", "Date", "DateTime", "Date/Time", "Date Time", "เวลา"
  ], "");
  
  const recorder = getSmartField(item, [
    "ผู้บันทึก", "ชื่อผู้บันทึก", "พยาบาลผู้บันทึก", "พยาบาล", "ผู้ประเมิน", "Recorder", "Staff", "Nurse", "ชื่อ"
  ], "");
  
  const an = getSmartField(item, [
    "AN", "เลข AN", "Admission Number", "HN", "เลขที่ผู้ป่วย"
  ], "");
  
  const ward = getSmartField(item, [
    "หน่วยงาน", "หอผู้ป่วย", "Ward", "ตึก", "แผนก", "Department"
  ], "");
  
  const tool = getSmartField(item, [
    "Tool", "เครื่องมือ", "Pain Tool", "แบบประเมิน"
  ], "");
  
  const painInitialThermo = getSmartField(item, [
    "Pain แรกรับ : ฟอร์มปรอท", "Pain แรกรับ ฟอร์มปรอท", "แรกรับ : ฟอร์มปรอท", "แรกรับ ฟอร์มปรอท", "แรกรับปรอท", "Pain แรกรับปรอท", "แรกรับปรอท"
  ], "-");
  
  const painInitialNote = getSmartField(item, [
    "Pain แรกรับ : Nurse note", "Pain แรกรับ : Nurse Note", "Pain แรกรับ Nurse note", "แรกรับ : Nurse note", "แรกรับ Nurse Note", "แรกรับ note"
  ], "-");
  
  const painQ8Thermo = getSmartField(item, [
    "Pain q 8 hr : ฟอร์มปรอท", "Pain q 8 hr ฟอร์มปรอท", "Pain q8 hr", "Pain q8", "q 8 hr", "q8hr", "q8 hr : ฟอร์มปรอท", "q8 ฟอร์มปรอท"
  ], "-");
  
  let painOver5 = getSmartField(item, [
    "Pain ≥ 5**", "Pain ≥ 5", "Pain >= 5", "Pain >= 5**", "Pain>5", "Pain ≥5", "Pain 5", "≥5", ">=5"
  ], "NO");
  if (String(painOver5).toUpperCase() === "YES" || painOver5 === "1" || painOver5 === "ใช่") {
    painOver5 = "YES";
  } else {
    painOver5 = "NO";
  }
  
  const intervention = getSmartField(item, [
    "Intervention", "การจัดการความปวด", "การพยาบาล", "การดูแล"
  ], "");
  
  const reassessment = getSmartField(item, [
    "Re-assessment", "Reassessment", "Re-assess", "ประเมินซ้ำ", "การประเมินซ้ำ"
  ], "");
  
  let opSurgery = getSmartField(item, [
    "Operation Surgery", "Operation", "Surgery", "ผ่าตัด", "การผ่าตัด"
  ], "NO");
  if (String(opSurgery).toUpperCase() === "YES" || opSurgery === "1" || opSurgery === "ใช่") {
    opSurgery = "YES";
  } else {
    opSurgery = "NO";
  }
  
  const painPostOpThermo = getSmartField(item, [
    "Pain post-op แรกรับ : ฟอร์มปรอท", "Pain post-op แรกรับ ฟอร์มปรอท", "Post-op แรกรับ : ฟอร์มปรอท", "Post-op ปรอท", "Postop ปรอท"
  ], "-");
  
  const painPostOpNote = getSmartField(item, [
    "Pain post-op แรกรับ : Nurse Note", "Pain post-op แรกรับ : Nurse note", "Post-op แรกรับ : Nurse Note", "Post-op Note", "Postop Note"
  ], "-");
  
  const guidelinePostOp = getSmartField(item, [
    "Guideline Post-op", "Guideline post-op", "Guideline", "Post-op Guideline", "แนวทาง Post-op"
  ], "-");
  
  const note = getSmartField(item, [
    "หมายเหตุ", "Note", "Remarks", "Remark", "รายละเอียดเพิ่มเติม", "Comment"
  ], "");
  
  const recordId = item["Record ID"] || item["recordId"] || ("PID-" + Math.floor(Math.random() * 1000000));
  
  return {
    ...item,
    "Record ID": recordId,
    "วันที่และเวลา": datetime,
    "ผู้บันทึก": recorder,
    "AN": an,
    "หน่วยงาน": ward,
    "Tool": tool,
    "Pain แรกรับ : ฟอร์มปรอท": painInitialThermo,
    "Pain แรกรับ : Nurse note": painInitialNote,
    "Pain q 8 hr : ฟอร์มปรอท": painQ8Thermo,
    "Pain ≥ 5**": painOver5,
    "Intervention": intervention,
    "Re-assessment": reassessment,
    "Operation Surgery": opSurgery,
    "Pain post-op แรกรับ : ฟอร์มปรอท": painPostOpThermo,
    "Pain post-op แรกรับ : Nurse Note": painPostOpNote,
    "Guideline Post-op": guidelinePostOp,
    "หมายเหตุ": note
  };
}

// App State
let state = {
  records: [],
  sheets: ["Pain_Data"],
  currentSheet: "Pain_Data",
  googleScriptUrl: localStorage.getItem("painApp_scriptUrl") || "",
  currentTab: "form", // "form" | "history" | "dashboard"
  activeSearchAN: "",
  savedRecorder: localStorage.getItem("painApp_recorder") || "",
  isOnlineSyncing: false
};

// DOM Elements
const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  initDOMElements();
  initDropdownOptions();
  loadStoredRecords();
  initFormDateTime();
  bindEvents();
  document.body.setAttribute("data-active-tab", "form");
  renderKPIs();
  updatePainConditionUI();
  updateSurgeryConditionUI();
  updateSyncStatusBadge();
  fetchSheetList();
});

function initDOMElements() {
  elements.painForm = document.getElementById("painForm");
  elements.btnSubmit = document.getElementById("btnSubmit");
  elements.btnReset = document.getElementById("btnReset");
  
  // Tabs
  elements.tabBtns = document.querySelectorAll("[data-tab-target]");
  elements.tabPanels = {
    form: document.getElementById("panelForm"),
    history: document.getElementById("panelHistory"),
    dashboard: document.getElementById("panelDashboard")
  };
  
  // Monthly Sheet Selectors
  elements.selectSheetMonth = document.getElementById("selectSheetMonth");
  elements.btnRefreshSheets = document.getElementById("btnRefreshSheets");
  elements.formTargetSheet = document.getElementById("formTargetSheet");
  
  // Search
  elements.searchANInput = document.getElementById("searchANInput");
  elements.btnSearchAN = document.getElementById("btnSearchAN");
  elements.btnClearSearch = document.getElementById("btnClearSearch");
  elements.historyResultsContainer = document.getElementById("historyResultsContainer");
  elements.historySearchTitle = document.getElementById("historySearchTitle");
  elements.btnSearchNewEntry = document.getElementById("btnSearchNewEntry");
  
  // Dynamic fields
  elements.inputDatetime = document.getElementById("inputDatetime");
  elements.inputRecorder = document.getElementById("inputRecorder");
  elements.inputAN = document.getElementById("inputAN");
  elements.selectWard = document.getElementById("selectWard");
  elements.selectTool = document.getElementById("selectTool");
  
  elements.painOver5Select = document.getElementById("painOver5Select");
  elements.groupIntervention = document.getElementById("groupIntervention");
  elements.selectIntervention = document.getElementById("selectIntervention");
  elements.groupReassessment = document.getElementById("groupReassessment");
  elements.selectReassessment = document.getElementById("selectReassessment");
  
  elements.selectSurgery = document.getElementById("selectSurgery");
  elements.surgeryDetailsGroup = document.getElementById("surgeryDetailsGroup");
  
  // Modal Settings
  elements.btnOpenSettings = document.getElementById("btnOpenSettings");
  elements.settingsModal = document.getElementById("settingsModal");
  elements.btnCloseModal = document.getElementById("btnCloseModal");
  elements.scriptUrlInput = document.getElementById("scriptUrlInput");
  elements.btnSaveSettings = document.getElementById("btnSaveSettings");
  elements.btnTestSync = document.getElementById("btnTestSync");
  elements.syncStatusText = document.getElementById("syncStatusText");
}

function initDropdownOptions() {
  // Populate Wards
  elements.selectWard.innerHTML = `<option value="">เลือกหน่วยงาน</option>` + 
    WARDS.map(w => `<option value="${w}">${w}</option>`).join("");
    
  // Populate Tools
  elements.selectTool.innerHTML = `<option value="">เลือก Tool การประเมิน</option>` + 
    TOOLS.map(t => `<option value="${t}">${t}</option>`).join("");
    
  // Populate Intervention
  elements.selectIntervention.innerHTML = `<option value="">เลือก Intervention</option>` + 
    INTERVENTIONS.map(i => `<option value="${i}">${i}</option>`).join("");
}

function initFormDateTime() {
  // Set current local datetime in format yyyy-MM-ddTHH:mm
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  elements.inputDatetime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  
  // Set remembered recorder
  if (state.savedRecorder) {
    elements.inputRecorder.value = state.savedRecorder;
  }
}

function loadStoredRecords() {
  const localData = localStorage.getItem("painApp_records");
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      state.records = Array.isArray(parsed) ? parsed.map(normalizeRecord) : INITIAL_DEMO_RECORDS;
    } catch (e) {
      state.records = INITIAL_DEMO_RECORDS;
    }
  } else {
    state.records = INITIAL_DEMO_RECORDS;
    saveRecordsToLocal();
  }
  
  // If Google Script URL is present, attempt fetching remote data
  if (state.googleScriptUrl) {
    fetchFromGoogleSheet();
  }
}

function saveRecordsToLocal() {
  localStorage.setItem("painApp_records", JSON.stringify(state.records));
}

function bindEvents() {
  // Tab switching
  elements.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabTarget;
      switchTab(target);
    });
  });
  
  // Pain >= 5 condition change
  elements.painOver5Select.addEventListener("change", updatePainConditionUI);
  
  // Surgery condition change
  elements.selectSurgery.addEventListener("change", updateSurgeryConditionUI);
  
  // Form submission
  elements.painForm.addEventListener("submit", handleFormSubmit);
  
  // Reset button
  elements.btnReset.addEventListener("click", () => {
    setTimeout(() => {
      initFormDateTime();
      updatePainConditionUI();
      updateSurgeryConditionUI();
    }, 50);
  });
  
  // Monthly Worksheet Change
  if (elements.selectSheetMonth) {
    elements.selectSheetMonth.addEventListener("change", (e) => {
      const selected = e.target.value;
      if (selected) {
        state.currentSheet = selected;
        fetchFromGoogleSheet(selected);
        if (elements.formTargetSheet) {
          elements.formTargetSheet.value = selected;
        }
      }
    });
  }

  if (elements.btnRefreshSheets) {
    elements.btnRefreshSheets.addEventListener("click", () => {
      fetchSheetList(true);
    });
  }
  
  // Search actions
  elements.btnSearchAN.addEventListener("click", () => {
    performSearchAN(elements.searchANInput.value.trim());
  });
  
  elements.searchANInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearchAN(elements.searchANInput.value.trim());
    }
  });
  
  elements.btnClearSearch.addEventListener("click", () => {
    elements.searchANInput.value = "";
    performSearchAN("");
  });
  
  // Settings Modal
  elements.btnOpenSettings.addEventListener("click", () => {
    elements.scriptUrlInput.value = state.googleScriptUrl;
    elements.settingsModal.classList.add("active");
  });
  
  elements.btnCloseModal.addEventListener("click", () => {
    elements.settingsModal.classList.remove("active");
  });
  
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.remove("active");
    }
  });
  
  elements.btnSaveSettings.addEventListener("click", () => {
    const url = elements.scriptUrlInput.value.trim();
    state.googleScriptUrl = url;
    localStorage.setItem("painApp_scriptUrl", url);
    showToast("บันทึกการตั้งค่า Google Sheet เรียบร้อย", "success");
    elements.settingsModal.classList.remove("active");
    updateSyncStatusBadge();
    if (url) {
      fetchFromGoogleSheet();
    }
  });
  
  elements.btnTestSync.addEventListener("click", () => {
    const testUrl = elements.scriptUrlInput.value.trim();
    if (!testUrl) {
      showToast("กรุณากรอก Web App URL ก่อนทดสอบ", "warning");
      return;
    }
    testGoogleSheetConnection(testUrl);
  });
}

function switchTab(tabKey) {
  state.currentTab = tabKey;
  document.body.setAttribute("data-active-tab", tabKey);
  
  // Update header buttons
  elements.tabBtns.forEach(btn => {
    if (btn.dataset.tabTarget === tabKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  
  // Toggle panel visibility
  Object.keys(elements.tabPanels).forEach(key => {
    if (key === tabKey) {
      elements.tabPanels[key].classList.remove("hidden");
    } else {
      elements.tabPanels[key].classList.add("hidden");
    }
  });
  
  if (tabKey === "dashboard") {
    renderDashboardAnalytics();
  } else if (tabKey === "history") {
    if (elements.searchANInput.value.trim()) {
      performSearchAN(elements.searchANInput.value.trim());
    } else {
      renderAllHistory();
    }
  }
}

/**
 * เงื่อนไขของ Pain ≥ 5:
 * เมื่อเลือก Pain ≥ 5** = YES
 *  - Intervention ต้องเลือก
 *  - Re-assessment ต้องเลือก
 * เมื่อเลือก Pain ≥ 5** = NO
 *  - ช่อง Intervention และ Re-assessment สามารถเว้นว่างได้
 *  - ควรทำให้ช่องเป็นสีเทาเพื่อแสดงว่าไม่จำเป็นต้องกรอก
 */
function updatePainConditionUI() {
  const val = elements.painOver5Select.value;
  const isYes = val === "YES";
  
  if (isYes) {
    // Enable & Mark required
    elements.groupIntervention.classList.remove("is-disabled");
    elements.groupReassessment.classList.remove("is-disabled");
    elements.selectIntervention.removeAttribute("disabled");
    elements.selectReassessment.removeAttribute("disabled");
    elements.selectIntervention.setAttribute("required", "required");
    elements.selectReassessment.setAttribute("required", "required");
    
    // Alert background visual hint
    document.getElementById("sectionPainAlert").style.borderColor = "#f59e0b";
  } else {
    // Disable, Gray out & Clear required
    elements.groupIntervention.classList.add("is-disabled");
    elements.groupReassessment.classList.add("is-disabled");
    elements.selectIntervention.setAttribute("disabled", "disabled");
    elements.selectReassessment.setAttribute("disabled", "disabled");
    elements.selectIntervention.removeAttribute("required");
    elements.selectReassessment.removeAttribute("required");
    elements.selectIntervention.value = "";
    elements.selectReassessment.value = "";
    
    document.getElementById("sectionPainAlert").style.borderColor = "#e2e8f0";
  }
}

function updateSurgeryConditionUI() {
  const isOp = elements.selectSurgery.value === "YES";
  if (isOp) {
    elements.surgeryDetailsGroup.classList.remove("hidden");
  } else {
    elements.surgeryDetailsGroup.classList.add("hidden");
  }
}

/**
 * Submit Form & Save Record
 * ทุกครั้งที่บันทึก ระบบจะเก็บเป็นประวัติรายการใหม่ โดยไม่เขียนทับข้อมูลเดิม
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const rawDatetime = elements.inputDatetime.value; // yyyy-MM-ddTHH:mm
  const formattedDatetime = rawDatetime.replace("T", " ") + ":00";
  const recorder = elements.inputRecorder.value.trim();
  const an = elements.inputAN.value.trim();
  const ward = elements.selectWard.value;
  const tool = elements.selectTool.value;
  
  if (!an || !ward || !tool || !recorder) {
    showToast("กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน", "warning");
    return;
  }
  
  const painOver5 = elements.painOver5Select.value;
  let intervention = elements.selectIntervention.value;
  let reassessment = elements.selectReassessment.value;
  
  if (painOver5 === "YES") {
    if (!intervention || !reassessment) {
      showToast("เมื่อเลือก Pain ≥ 5 เป็น YES จำเป็นต้องระบุ Intervention และ Re-assessment", "error");
      return;
    }
  } else {
    intervention = "";
    reassessment = "";
  }
  
  const opSurgery = elements.selectSurgery.value;
  const painInitialThermo = document.getElementById("painInitialThermo").value;
  const painInitialNote = document.getElementById("painInitialNote").value;
  const painQ8Thermo = document.getElementById("painQ8Thermo").value;
  
  const painPostOpThermo = opSurgery === "YES" ? document.getElementById("painPostOpThermo").value : "NO";
  const painPostOpNote = opSurgery === "YES" ? document.getElementById("painPostOpNote").value : "NO";
  const guidelinePostOp = opSurgery === "YES" ? document.getElementById("guidelinePostOp").value : "NO";
  const note = document.getElementById("inputRemarks").value.trim();
  
  // Generate Unique Record ID
  const timestampStr = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
  const recordId = `PID-${timestampStr}-${Math.floor(100 + Math.random() * 900)}`;
  
  const newRecord = {
    "Record ID": recordId,
    "วันที่และเวลา": formattedDatetime,
    "ผู้บันทึก": recorder,
    "AN": an,
    "หน่วยงาน": ward,
    "Tool": tool,
    "Pain แรกรับ : ฟอร์มปรอท": painInitialThermo,
    "Pain แรกรับ : Nurse note": painInitialNote,
    "Pain q 8 hr : ฟอร์มปรอท": painQ8Thermo,
    "Pain ≥ 5**": painOver5,
    "Intervention": intervention,
    "Re-assessment": reassessment,
    "Operation Surgery": opSurgery,
    "Pain post-op แรกรับ : ฟอร์มปรอท": painPostOpThermo,
    "Pain post-op แรกรับ : Nurse Note": painPostOpNote,
    "Guideline Post-op": guidelinePostOp,
    "หมายเหตุ": note,
    "sheetName": elements.formTargetSheet ? elements.formTargetSheet.value : (state.currentSheet || "Pain_Data")
  };
  
  // 1. จำชื่อผู้บันทึก
  state.savedRecorder = recorder;
  localStorage.setItem("painApp_recorder", recorder);
  
  // 2. บันทึกลง Local Memory (เพิ่มเป็นรายการใหม่ที่หัวแถว)
  state.records.unshift(newRecord);
  saveRecordsToLocal();
  renderKPIs();
  
  // 3. ปิดการคลิกซ้ำขณะส่งข้อมูล
  elements.btnSubmit.disabled = true;
  elements.btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...`;
  
  // 4. ส่งข้อมูลไปยัง Google Sheet API ถ้ามีการตั้งค่า
  if (state.googleScriptUrl) {
    try {
      await sendRecordToGoogleSheet(newRecord);
      showToast(`บันทึกข้อมูล AN ${an} ลง Google Sheet สำเร็จ!`, "success");
    } catch (err) {
      console.warn("Sheet save error:", err);
      showToast(`บันทึกลงเครื่องแล้ว (ส่งเข้า Google Sheet ไม่สำเร็จ: ${err.message})`, "warning");
    }
  } else {
    showToast(`บันทึกข้อมูล AN ${an} สำเร็จ (โหมดออฟไลน์/ทดสอบ)`, "success");
  }
  
  // รีเซ็ตปุ่มและฟอร์มบางส่วน
  elements.btnSubmit.disabled = false;
  elements.btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล`;
  
  // เคลียร์ฟอร์ม ยกเว้นชื่อผู้บันทึก และอัปเดตเวลาใหม่
  elements.painForm.reset();
  initFormDateTime();
  updatePainConditionUI();
  updateSurgeryConditionUI();
  
  // หากต้องการดูประวัติทันที สามารถสลับไปหน้าประวัติ AN ได้
  elements.searchANInput.value = an;
  switchTab("history");
  performSearchAN(an);
}

/**
 * ส่งข้อมูลเข้า Google Apps Script ผ่าน POST
 */
async function sendRecordToGoogleSheet(record) {
  const url = state.googleScriptUrl;
  if (!url) return;
  
  // Google Apps Script Web App รองรับ POST with JSON payload หรือ urlencoded
  const response = await fetch(url, {
    method: "POST",
    mode: "no-cors", // เพื่อป้องกัน CORS Block จาก Google Script redirect
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(record)
  });
  
  return response;
}

/**
 * JSONP Loader สำหรับข้าม CORS ของ Google Apps Script ได้ 100%
 */
function fetchJsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_cb_" + Math.round(100000 * Math.random());
    const queryParams = new URLSearchParams({ ...params, callback: callbackName, _t: Date.now() });
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}${queryParams.toString()}`;
    
    const script = document.createElement("script");
    script.src = fullUrl;
    
    // ตั้ง timeout 10 วินาที
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("เชื่อมต่อ Google Sheet นานเกินไป (Timeout)"));
    }, 10000);
    
    function cleanup() {
      if (window[callbackName]) delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    }
    
    window[callbackName] = function(data) {
      cleanup();
      resolve(data);
    };
    
    script.onerror = function() {
      cleanup();
      reject(new Error("การเชื่อมต่อถูกปฏิเสธ (ตรวจสอบสิทธิ์ 'Anyone' ใน Web App Deployment)"));
    };
    
    document.head.appendChild(script);
  });
}

// คำสำคัญที่บ่งบอกว่าเป็นชีตประจำเดือน
const MONTH_KEYWORDS = [
  "ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค",
  "มกรา", "กุมภา", "มีนา", "เมษา", "พฤษภา", "มิถุนา", "กรกฎา", "สิงหา", "กันยา", "ตุลา", "พฤศจิกา", "ธันวา",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
];

function isMonthYearSheetName(name) {
  if (!name) return false;
  const str = String(name).trim();
  const lower = str.toLowerCase();
  
  // ตัดชีตระบบและชีตที่ไม่ใช่เดือนทิ้ง
  if (lower === "pain_data" || lower === "ค้นหา_an" || lower.startsWith("sheet") || lower.startsWith("ชีต")) return false;
  if (/^(setting|config|template|summary|สรุป|dashboard|temp)/i.test(str)) return false;
  
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(str);
  
  return hasMonth || hasDatePattern;
}

/**
 * จัดการรายชื่อ Work Sheet / แท็บประจำเดือน (แสดงเฉพาะ เดือน ปี เท่านั้น)
 */
function populateSheetDropdowns(sheets, activeSheet = "") {
  let filteredSheets = [];
  
  if (Array.isArray(sheets)) {
    // 1. กรองเฉพาะชีตที่เป็น "เดือน ปี" เท่านั้น
    filteredSheets = sheets.filter(s => isMonthYearSheetName(s));
  }
  
  // ถ้าในชีตยังไม่มีชีตเดือนเลย ให้แสดงรายการเดือนภาษาไทยเริ่มต้น
  if (filteredSheets.length === 0) {
    filteredSheets = ["ตุลาคม 2567", "กันยายน 2567", "สิงหาคม 2567", "กรกฎาคม 2567"];
  }
  
  state.sheets = filteredSheets;
  
  // เลือกว่าจะ active ชีตไหน
  if (!activeSheet || !filteredSheets.includes(activeSheet)) {
    activeSheet = filteredSheets[0];
  }
  state.currentSheet = activeSheet;
  
  const optionsHtml = filteredSheets.map(s => `
    <option value="${s}" ${s === activeSheet ? 'selected' : ''}>
      📅 ${s}
    </option>
  `).join("");
  
  if (elements.selectSheetMonth) {
    elements.selectSheetMonth.innerHTML = optionsHtml;
    elements.selectSheetMonth.value = activeSheet;
  }
  if (elements.formTargetSheet) {
    elements.formTargetSheet.innerHTML = optionsHtml;
    elements.formTargetSheet.value = activeSheet;
  }
}

async function fetchSheetList(forceRefresh = false) {
  if (!state.googleScriptUrl) {
    // โหมดออฟไลน์: ใส่รายชื่อเดือนเริ่มต้น
    populateSheetDropdowns(["ตุลาคม 2567", "กันยายน 2567", "สิงหาคม 2567", "กรกฎาคม 2567"]);
    return;
  }
  
  try {
    let result = null;
    try {
      const res = await fetch(`${state.googleScriptUrl}?action=getSheets&_t=${Date.now()}`);
      result = await res.json();
    } catch (e) {
      result = await fetchJsonp(state.googleScriptUrl, { action: "getSheets" });
    }
    
    if (result && result.status === "success" && Array.isArray(result.sheets)) {
      populateSheetDropdowns(result.sheets, state.currentSheet);
      if (forceRefresh) {
        showToast(`อัปเดตรายชื่อเดือนเรียบร้อย (พบ ${state.sheets.length} เดือน)`, "success");
      }
    }
  } catch (err) {
    console.warn("Could not fetch sheet list:", err);
  }
}

/**
 * ดึงข้อมูลทั้งหมดจาก Google Sheet ตาม Work Sheet ที่เลือก (ลองทั้ง Fetch และ JSONP)
 */
async function fetchFromGoogleSheet(targetSheet = "") {
  const sheetToFetch = targetSheet || state.currentSheet || "";
  
  if (!state.googleScriptUrl) {
    // โหมดออฟไลน์ / ทดสอบ: กรองหรือจำลองข้อมูลตามเดือนที่เลือก
    state.currentSheet = sheetToFetch;
    
    // จำลองชุดข้อมูลตามเดือนที่เลือกเพื่อให้เห็นการเปลี่ยนแปลงชัดเจน
    if (sheetToFetch.includes("กันยา")) {
      state.records = INITIAL_DEMO_RECORDS.slice(1, 3);
    } else if (sheetToFetch.includes("สิงหา")) {
      state.records = INITIAL_DEMO_RECORDS.slice(2, 4);
    } else if (sheetToFetch.includes("กรกฎา")) {
      state.records = INITIAL_DEMO_RECORDS.slice(3, 5);
    } else {
      state.records = INITIAL_DEMO_RECORDS;
    }
    
    saveRecordsToLocal();
    renderKPIs();
    if (state.currentTab === "dashboard") {
      renderDashboardAnalytics();
    } else if (state.currentTab === "history") {
      performSearchAN(elements.searchANInput.value.trim());
    }
    showToast(`อัปเดตข้อมูลเดือน ${sheetToFetch} แล้ว (พบ ${state.records.length} รายการ)`, "success");
    return;
  }
  
  state.isOnlineSyncing = true;
  updateSyncStatusBadge();
  
  try {
    let result = null;
    const params = { action: "getData" };
    if (sheetToFetch) params.sheet = sheetToFetch;
    
    // ลองด้วย Fetch ปกติก่อน
    try {
      const queryStr = new URLSearchParams({ ...params, _t: Date.now() }).toString();
      const fetchUrl = `${state.googleScriptUrl}?${queryStr}`;
      const response = await fetch(fetchUrl);
      result = await response.json();
    } catch (fetchErr) {
      // ถ้า fetch ติด CORS ให้ fallback ไปใช้ JSONP
      result = await fetchJsonp(state.googleScriptUrl, params);
    }
    
    if (result && result.status === "success") {
      if (Array.isArray(result.sheets) && result.sheets.length > 0) {
        populateSheetDropdowns(result.sheets, result.currentSheet || sheetToFetch);
      }
      
      if (Array.isArray(result.data)) {
        state.records = result.data.map(normalizeRecord);
        saveRecordsToLocal();
        renderKPIs();
        
        // อัปเดตหน้าปัจจุบันตามข้อมูลเดือนใหม่ทันที
        if (state.currentTab === "dashboard") {
          renderDashboardAnalytics();
        } else if (state.currentTab === "history") {
          performSearchAN(elements.searchANInput.value.trim());
        }
        
        const sheetLabel = result.currentSheet || sheetToFetch;
        showToast(`อัปเดตข้อมูลเดือน ${sheetLabel} สำเร็จ! (${result.data.length} รายการ)`, "success");
      }
    }
  } catch (e) {
    console.log("Could not fetch remote sheet data:", e);
    showToast(`ไม่สามารถดึงข้อมูลเดือน ${sheetToFetch}: ${e.message}`, "warning");
  } finally {
    state.isOnlineSyncing = false;
    updateSyncStatusBadge();
  }
}

async function testGoogleSheetConnection(url) {
  // 1. ตรวจสอบรูปแบบ URL เบื้องต้น
  if (!url.startsWith("https://script.google.com/macros/s/")) {
    showToast("URL ต้องขึ้นต้นด้วย https://script.google.com/macros/s/...", "error");
    return;
  }
  
  if (url.includes("/edit") || !url.endsWith("/exec")) {
    showToast("URL ต้องลงท้ายด้วย /exec (ได้จากปุ่ม Deploy > New Deployment > Web app)", "error");
    return;
  }

  elements.btnTestSync.disabled = true;
  elements.btnTestSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบ...`;
  
  try {
    let result = null;
    
    try {
      const testUrl = `${url}?action=getData&_t=${Date.now()}`;
      const response = await fetch(testUrl);
      result = await response.json();
    } catch (e) {
      // ลองผ่าน JSONP fallback
      result = await fetchJsonp(url, { action: "getData" });
    }
    
    if (result && result.status === "success") {
      const count = result.data ? result.data.length : 0;
      showToast(`เชื่อมต่อ Google Sheet สำเร็จ! 🎉 (พบข้อมูล ${count} รายการ)`, "success");
    } else {
      showToast(`เชื่อมต่อได้แต่ระบบตอบกลับผิดปกติ: ${result?.message || 'ไม่ทราบสาเหตุ'}`, "warning");
    }
  } catch (err) {
    showToast(err.message || "ไม่สามารถเชื่อมต่อได้: โปรดตรวจสอบว่าเลือก 'Anyone' ใน Web App", "error");
  } finally {
    elements.btnTestSync.disabled = false;
    elements.btnTestSync.innerHTML = `<i class="fa-solid fa-plug-circle-check"></i> ทดสอบการเชื่อมต่อ`;
  }
}

function updateSyncStatusBadge() {
  if (!elements.syncStatusText) return;
  
  if (!state.googleScriptUrl) {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-database"></i> ฐานข้อมูลในเครื่อง (พร้อมต่อ Google Sheet)`;
    elements.syncStatusText.style.background = "#f1f5f9";
    elements.syncStatusText.style.color = "#64748b";
  } else if (state.isOnlineSyncing) {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin"></i> กำลังซิงค์ Google Sheet...`;
    elements.syncStatusText.style.background = "#fef3c7";
    elements.syncStatusText.style.color = "#b45309";
  } else {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> เชื่อมต่อ Google Sheet แล้ว`;
    elements.syncStatusText.style.background = "#d1fae5";
    elements.syncStatusText.style.color = "#065f46";
  }
}

/**
 * ระบบค้นหาประวัติ AN (สอดคล้องกับชีต ค้นหา_AN)
 * แสดงประวัติทั้งหมดของ AN นั้น เรียงจากรายการล่าสุดไปเก่าสุด
 */
function performSearchAN(anQuery) {
  state.activeSearchAN = anQuery;
  
  if (!anQuery) {
    renderAllHistory();
    return;
  }
  
  const filtered = state.records.filter(r => 
    String(r["AN"] || "").trim().toLowerCase() === anQuery.toLowerCase()
  );
  
  // เรียงจากล่าสุดไปเก่าสุด
  filtered.sort((a, b) => new Date(b["วันที่และเวลา"] || 0) - new Date(a["วันที่และเวลา"] || 0));
  
  renderHistoryView(anQuery, filtered);
}

function renderAllHistory() {
  const sorted = [...state.records].sort((a, b) => new Date(b["วันที่และเวลา"] || 0) - new Date(a["วันที่และเวลา"] || 0));
  renderHistoryView("", sorted);
}

function renderHistoryView(anQuery, list) {
  const container = elements.historyResultsContainer;
  
  if (!container) return;
  
  if (anQuery) {
    elements.historySearchTitle.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span class="an-pill"><i class="fa-solid fa-user"></i> AN: ${anQuery} (${list.length} รายการประเมิน)</span>
        <button class="btn-add-for-an" id="btnAddForSearchedAN" data-an="${anQuery}">
          <i class="fa-solid fa-circle-plus"></i> บันทึกข้อมูลเพิ่มสำหรับ AN นี้
        </button>
      </div>
    `;
    
    // Bind click to auto-fill form for this AN
    const btnAdd = document.getElementById("btnAddForSearchedAN");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        fillFormForAN(anQuery, list[0] || null);
      });
    }
  } else {
    elements.historySearchTitle.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h4 style="font-weight:700; color:#1e1b4b;"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติการประเมินทั้งหมด (${list.length} รายการล่าสุด)</h4>
      </div>
    `;
  }
  
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        <p style="font-weight:600; font-size:1rem; color:#475569;">ไม่พบประวัติการประเมินสำหรับ AN: ${anQuery}</p>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">หากต้องการบันทึกเป็นคนไข้รายใหม่ สามารถกดเริ่มกรอกแบบฟอร์มได้ทันที</p>
        <button class="btn-primary" style="margin-top:16px;" onclick="fillFormForAN('${anQuery}', null)">
          <i class="fa-solid fa-plus"></i> เริ่มบันทึก AN ${anQuery}
        </button>
      </div>
    `;
    return;
  }
  
  let html = `<div class="timeline-list">`;
  
  list.forEach(item => {
    const isSevere = item["Pain ≥ 5**"] === "YES";
    const isSurgery = item["Operation Surgery"] === "YES";
    const datetimeStr = item["วันที่และเวลา"] || "ไม่ระบุเวลา";
    
    html += `
      <div class="timeline-item ${isSevere ? 'severe-pain' : ''}">
        <div class="timeline-top">
          <div class="timeline-time">
            <i class="fa-regular fa-calendar-check" style="color:#4f46e5;"></i>
            ${datetimeStr}
          </div>
          <div class="timeline-recorder">
            <i class="fa-solid fa-user-nurse"></i> ${item["ผู้บันทึก"] || "ไม่ระบุ"}
          </div>
        </div>
        
        <div class="timeline-badges">
          <span class="badge badge-ward"><i class="fa-solid fa-hospital-user"></i> หอผู้ป่วย ${item["หน่วยงาน"]}</span>
          <span class="badge badge-tool"><i class="fa-solid fa-ruler-combined"></i> ${item["Tool"]}</span>
          
          ${isSevere 
            ? `<span class="badge badge-pain-alert"><i class="fa-solid fa-triangle-exclamation"></i> Pain ≥ 5</span>` 
            : `<span class="badge badge-ok"><i class="fa-solid fa-check"></i> Pain &lt; 5</span>`}
            
          ${isSurgery 
            ? `<span class="badge badge-surgery"><i class="fa-solid fa-syringe"></i> ผ่าตัด (Surgery)</span>` 
            : ``}
        </div>
        
        <div class="timeline-details-grid">
          <div class="detail-cell">
            <span class="d-label">Pain แรกรับ (ปรอท / Nurse Note)</span>
            <span class="d-val">${item["Pain แรกรับ : ฟอร์มปรอท"] || '-'} / ${item["Pain แรกรับ : Nurse note"] || '-'}</span>
          </div>
          
          <div class="detail-cell">
            <span class="d-label">Pain q 8 hr (ฟอร์มปรอท)</span>
            <span class="d-val">${item["Pain q 8 hr : ฟอร์มปรอท"] || '-'}</span>
          </div>
          
          ${isSevere ? `
            <div class="detail-cell" style="background:#fff7ed; padding:4px 6px; border-radius:4px;">
              <span class="d-label" style="color:#c2410c;">Intervention</span>
              <span class="d-val" style="color:#9a3412;">${item["Intervention"] || '-'}</span>
            </div>
            <div class="detail-cell" style="background:#fff7ed; padding:4px 6px; border-radius:4px;">
              <span class="d-label" style="color:#c2410c;">Re-assessment</span>
              <span class="d-val" style="color:#9a3412;">${item["Re-assessment"] || '-'}</span>
            </div>
          ` : ''}
          
          ${isSurgery ? `
            <div class="detail-cell" style="background:#f0fdf4; padding:4px 6px; border-radius:4px;">
              <span class="d-label" style="color:#15803d;">Post-op ปรอท / Note</span>
              <span class="d-val" style="color:#166534;">${item["Pain post-op แรกรับ : ฟอร์มปรอท"] || '-'} / ${item["Pain post-op แรกรับ : Nurse Note"] || '-'}</span>
            </div>
            <div class="detail-cell" style="background:#f0fdf4; padding:4px 6px; border-radius:4px;">
              <span class="d-label" style="color:#15803d;">Guideline Post-op</span>
              <span class="d-val" style="color:#166534;">${item["Guideline Post-op"] || '-'}</span>
            </div>
          ` : ''}
        </div>
        
        ${item["หมายเหตุ"] ? `
          <div style="margin-top:8px; font-size:0.8rem; color:#475569; background:#fff1f2; padding:6px 10px; border-radius:6px; border-left:3px solid #f43f5e;">
            <strong style="color:#be123c;"><i class="fa-regular fa-comment-dots"></i> หมายเหตุ:</strong> ${item["หมายเหตุ"]}
          </div>
        ` : ''}
        
        <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
          <small style="font-size:0.7rem; color:#94a3b8; font-family:monospace;">${item["Record ID"] || ''}</small>
          <button class="btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:12px;" onclick="fillFormForAN('${item["AN"]}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-clone"></i> ลงข้อมูลต่อจากรอบนี้
          </button>
        </div>
      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

/**
 * เติมข้อมูล AN ในฟอร์มเพื่อบันทึกแถวใหม่
 * (ไม่แก้ทับรายการเดิม เพราะ AN เดียวกันอาจมีการประเมินหลายช่วงเวลา)
 */
window.fillFormForAN = function(an, latestRecord = null) {
  switchTab("form");
  
  elements.inputAN.value = an;
  if (latestRecord) {
    if (latestRecord["หน่วยงาน"]) elements.selectWard.value = latestRecord["หน่วยงาน"];
    if (latestRecord["Tool"]) elements.selectTool.value = latestRecord["Tool"];
    if (latestRecord["Operation Surgery"]) elements.selectSurgery.value = latestRecord["Operation Surgery"];
  }
  
  // อัปเดตเวลาเป็นเวลาปัจจุบันเสมอ เพื่อพร้อมบันทึกเป็นแถวใหม่
  initFormDateTime();
  updatePainConditionUI();
  updateSurgeryConditionUI();
  
  // เลื่อนหน้าจอไปยังส่วนฟอร์ม
  document.getElementById("panelForm").scrollIntoView({ behavior: "smooth" });
  
  showToast(`ระบบเตรียมฟอร์มสำหรับ AN ${an} แล้ว (จะบันทึกเป็นแถวใหม่เสมอ)`, "success");
};

/**
 * Render KPI Cards ด้านบน
 */
function renderKPIs() {
  const total = state.records.length;
  const painFirstYes = state.records.filter(r => r["Pain แรกรับ : ฟอร์มปรอท"] === "YES" || r["Pain แรกรับ : Nurse note"] === "YES").length;
  const painQ8Yes = state.records.filter(r => r["Pain q 8 hr : ฟอร์มปรอท"] === "YES").length;
  const surgeryYes = state.records.filter(r => r["Operation Surgery"] === "YES").length;
  const guidelineYes = state.records.filter(r => r["Guideline Post-op"] === "YES").length;
  const painOver5Yes = state.records.filter(r => r["Pain ≥ 5**"] === "YES").length;
  
  const elTotal = document.getElementById("kpiTotal");
  const elPainFirst = document.getElementById("kpiPainFirst");
  const elPainQ8 = document.getElementById("kpiPainQ8");
  const elSurgery = document.getElementById("kpiSurgery");
  const elGuideline = document.getElementById("kpiGuideline");
  const elPainOver5 = document.getElementById("kpiPainOver5");
  
  if (elTotal) elTotal.innerText = total;
  if (elPainFirst) elPainFirst.innerText = painFirstYes;
  if (elPainQ8) elPainQ8.innerText = painQ8Yes;
  if (elSurgery) elSurgery.innerText = surgeryYes;
  if (elGuideline) elGuideline.innerText = guidelineYes;
  if (elPainOver5) elPainOver5.innerText = painOver5Yes;
}

/**
 * Render Dashboard Analytics
 */
function renderDashboardAnalytics() {
  const total = state.records.length;
  if (total === 0) return;
  
  // 1. สรุปแยกตามหน่วยงาน (Wards)
  const wardCounts = {};
  WARDS.forEach(w => wardCounts[w] = 0);
  state.records.forEach(r => {
    if (r["หน่วยงาน"]) {
      wardCounts[r["หน่วยงาน"]] = (wardCounts[r["หน่วยงาน"]] || 0) + 1;
    }
  });
  
  const wardContainer = document.getElementById("wardStatsContainer");
  if (wardContainer) {
    let wardHtml = "";
    Object.keys(wardCounts).sort((a,b) => wardCounts[b] - wardCounts[a]).forEach(w => {
      const cnt = wardCounts[w];
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      wardHtml += `
        <div class="stat-bar-row">
          <div class="stat-bar-header">
            <span>หอผู้ป่วย ${w}</span>
            <span>${cnt} รายการ (${pct}%)</span>
          </div>
          <div class="stat-bar-bg">
            <div class="stat-bar-fill" style="width: ${pct}%; background: #6366f1;"></div>
          </div>
        </div>
      `;
    });
    wardContainer.innerHTML = wardHtml;
  }
  
  // 2. สรุปเครื่องมือประเมิน (Tools)
  const toolCounts = {};
  TOOLS.forEach(t => toolCounts[t] = 0);
  state.records.forEach(r => {
    if (r["Tool"]) {
      toolCounts[r["Tool"]] = (toolCounts[r["Tool"]] || 0) + 1;
    }
  });
  
  const toolContainer = document.getElementById("toolStatsContainer");
  if (toolContainer) {
    let toolHtml = "";
    TOOLS.forEach((t, idx) => {
      const cnt = toolCounts[t] || 0;
      const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
      const colors = ["#ec4899", "#8b5cf6", "#0284c7"];
      toolHtml += `
        <div class="stat-bar-row">
          <div class="stat-bar-header">
            <span>${t}</span>
            <span>${cnt} รายการ (${pct}%)</span>
          </div>
          <div class="stat-bar-bg">
            <div class="stat-bar-fill" style="width: ${pct}%; background: ${colors[idx % colors.length]};"></div>
          </div>
        </div>
      `;
    });
    toolContainer.innerHTML = toolHtml;
  }
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="font-size:1.1rem; color: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'};"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
