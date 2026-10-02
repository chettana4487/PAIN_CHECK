/**
 * Pain Assessment & Tracking Web App - JavaScript Engine
 * ออกแบบเพื่อการใช้งานบนมือถือ แท็บเล็ต และคอมพิวเตอร์
 * โครงสร้างข้อมูลสอดคล้องกับ Google Sheet โรงพยาบาล 100% (14 คอลัมน์ Col A-N)
 */

// Dropdown Constants
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

// ข้อมูลตัวอย่างเริ่มต้นตามโครงสร้างชีตจริงของโรงพยาบาล
const INITIAL_DEMO_RECORDS = [
  {
    "_rowIndex": 3,
    "HN": "1292565",
    "Tool": "Numeric Rating Score",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "YES",
    "Pain q 8 hr : Nurse Note": "YES",
    "Pain ≥ 5**": "NO",
    "Intervention": "-",
    "Re-assessment": "-",
    "Operation Surgery": "YES",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "YES",
    "Pain post-op แรกรับ : Nurse Note": "YES",
    "Guideline Post-op": "YES",
    "หมายเหตุ": ""
  },
  {
    "_rowIndex": 4,
    "HN": "1600321",
    "Tool": "Numeric Rating Score",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "YES",
    "Pain q 8 hr : Nurse Note": "YES",
    "Pain ≥ 5**": "NO",
    "Intervention": "-",
    "Re-assessment": "-",
    "Operation Surgery": "NO",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "-",
    "Pain post-op แรกรับ : Nurse Note": "-",
    "Guideline Post-op": "-",
    "หมายเหตุ": ""
  },
  {
    "_rowIndex": 5,
    "HN": "768831",
    "Tool": "Numeric Rating Score",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "YES",
    "Pain q 8 hr : Nurse Note": "YES",
    "Pain ≥ 5**": "YES",
    "Intervention": "Medication",
    "Re-assessment": "YES",
    "Operation Surgery": "NO",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "-",
    "Pain post-op แรกรับ : Nurse Note": "-",
    "Guideline Post-op": "-",
    "หมายเหตุ": "ปวดแผลหน้าท้อง ให้ Morphine 3 mg iv"
  },
  {
    "_rowIndex": 6,
    "HN": "986172",
    "Tool": "Facial rating scale",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "YES",
    "Pain q 8 hr : Nurse Note": "YES",
    "Pain ≥ 5**": "NO",
    "Intervention": "-",
    "Re-assessment": "-",
    "Operation Surgery": "YES",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "YES",
    "Pain post-op แรกรับ : Nurse Note": "YES",
    "Guideline Post-op": "YES",
    "หมายเหตุ": ""
  },
  {
    "_rowIndex": 7,
    "HN": "773868",
    "Tool": "CPOT",
    "Pain แรกรับ : ฟอร์มปรอท": "YES",
    "Pain แรกรับ : Nurse note": "YES",
    "Pain q 8 hr : ฟอร์มปรอท": "NO",
    "Pain q 8 hr : Nurse Note": "NO",
    "Pain ≥ 5**": "NO",
    "Intervention": "-",
    "Re-assessment": "-",
    "Operation Surgery": "NO",
    "Pain post-op แรกรับ : ฟอร์มปรอท": "-",
    "Pain post-op แรกรับ : Nurse Note": "-",
    "Guideline Post-op": "-",
    "หมายเหตุ": "ย้ายไปทำหัตถการนอกตึก"
  }
];

/**
 * Smart Field Normalizer: ดึงค่าจาก Object แม้ชื่อหัวคอลัมน์ใน Google Sheet จะมีเว้นวรรคหรือสัญลักษณ์ต่างกัน
 */
function getSmartField(item, possibleKeys, fallback = "") {
  if (!item || typeof item !== "object") return fallback;
  
  // 1. Direct match
  for (const k of possibleKeys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== "") {
      return String(item[k]).trim();
    }
  }
  
  // 2. Clean exact match (ตัดช่องว่าง, โคลอน, สัญลักษณ์ และเทียบ case-insensitive)
  const itemEntries = Object.entries(item);
  for (const pattern of possibleKeys) {
    const cleanPattern = pattern.replace(/[\s:_\-–—*()]/g, "").toLowerCase();
    for (const [rawKey, val] of itemEntries) {
      if (val === undefined || val === null || String(val).trim() === "") continue;
      const cleanRaw = rawKey.replace(/[\s:_\-–—*()]/g, "").toLowerCase();
      if (cleanRaw === cleanPattern) {
        return String(val).trim();
      }
    }
  }
  
  return fallback;
}

/**
 * แปลงข้อมูลแถวจาก Google Sheet ให้อยู่ในโครงสร้างมาตรฐานของโรงพยาบาล
 */
function normalizeRecord(item) {
  if (!item || typeof item !== "object") return {};
  
  const hn = getSmartField(item, [
    "HN", "เลข HN", "HN ผู้ป่วย", "เลขที่ผู้ป่วย", "AN", "เลข AN", "Admission Number"
  ], "ไม่ระบุ");
  
  const tool = getSmartField(item, [
    "Tool", "เครื่องมือ", "Pain Tool", "แบบประเมิน"
  ], "Numeric Rating Score");
  
  const painInitialThermo = getSmartField(item, [
    "Pain แรกรับ : ฟอร์มปรอท", "Pain แรกรับ ฟอร์มปรอท", "แรกรับ : ฟอร์มปรอท", "แรกรับ ฟอร์มปรอท", "แรกรับปรอท", "Pain แรกรับปรอท"
  ], "-");
  
  const painInitialNote = getSmartField(item, [
    "Pain แรกรับ : Nurse note", "Pain แรกรับ : Nurse Note", "Pain แรกรับ Nurse note", "แรกรับ : Nurse note", "แรกรับ Nurse Note", "แรกรับ note"
  ], "-");
  
  const painQ8Thermo = getSmartField(item, [
    "Pain q 8 hr : ฟอร์มปรอท", "Pain q 8 hr ฟอร์มปรอท", "Pain q8 hr", "Pain q8", "q 8 hr", "q8hr", "q8 hr : ฟอร์มปรอท"
  ], "-");

  const painQ8Note = getSmartField(item, [
    "Pain q 8 hr : Nurse Note", "Pain q 8 hr : Nurse note", "Pain q8 hr Nurse Note", "q 8 hr : Nurse Note", "q8 Nurse Note"
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
  ], "-");
  
  const reassessment = getSmartField(item, [
    "Re-assessment", "Reassessment", "Re-assess", "ประเมินซ้ำ", "การประเมินซ้ำ"
  ], "-");
  
  let opSurgery = getSmartField(item, [
    "Operation Surgery", "Operation Surgery**", "Operation", "Surgery", "ผ่าตัด", "การผ่าตัด"
  ], "NO");
  if (String(opSurgery).toUpperCase() === "YES" || opSurgery === "1" || opSurgery === "ใช่") {
    opSurgery = "YES";
  } else {
    opSurgery = "NO";
  }
  
  const painPostOpThermo = getSmartField(item, [
    "Pain post - op แรกรับ : ฟอร์มปรอท", "Pain post-op แรกรับ : ฟอร์มปรอท", "Pain post-op แรกรับ ฟอร์มปรอท", "Post-op แรกรับ : ฟอร์มปรอท", "Post-op ปรอท"
  ], "-");
  
  const painPostOpNote = getSmartField(item, [
    "Pain post - op แรกรับ : Nurse Note", "Pain post-op แรกรับ : Nurse Note", "Pain post-op แรกรับ : Nurse note", "Post-op แรกรับ : Nurse Note", "Post-op Note"
  ], "-");
  
  const guidelinePostOp = getSmartField(item, [
    "Guideline Post - op", "Guideline Post-op", "Guideline post-op", "Guideline", "Post-op Guideline", "แนวทาง Post-op"
  ], "-");
  
  const note = getSmartField(item, [
    "หมายเหตุ", "Remarks", "Remark", "รายละเอียดเพิ่มเติม", "Comment"
  ], "");
  
  return {
    ...item,
    "HN": hn,
    "AN": hn,
    "Tool": tool,
    "Pain แรกรับ : ฟอร์มปรอท": painInitialThermo,
    "Pain แรกรับ : Nurse note": painInitialNote,
    "Pain q 8 hr : ฟอร์มปรอท": painQ8Thermo,
    "Pain q 8 hr : Nurse Note": painQ8Note,
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

// ========================================================
// Google Apps Script Web App URL เริ่มต้น
// (หากใส่ URL ไว้ที่นี่ พยาบาลและทุกคนที่เปิดเว็บจะเชื่อมต่อชีตให้อัตโนมัติทันที ไม่ต้องตั้งค่าในมือถือแต่ละเครื่อง)
// ========================================================
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw-rC3DdTBCiCLNz_cE3IqJLvLRFdXrAVW6c3-1A8GfJlMELrNTenJr4QP86acUzwKq/exec";

// App State with LocalStorage persistence for instant 0.05s load
let cachedSheets = [];
try {
  const s = localStorage.getItem("painApp_sheets");
  if (s) cachedSheets = JSON.parse(s);
} catch (e) {}

let cachedCurrentSheet = localStorage.getItem("painApp_currentSheet") || (cachedSheets[0] || "ต.ค.68");

let state = {
  records: [],
  sheets: cachedSheets.length > 0 ? cachedSheets : ["ต.ค.68"],
  currentSheet: cachedCurrentSheet,
  activeFilter: "all", // "all" | "severe" | "surgery" | "incomplete"
  viewMode: "cards",   // "cards" | "table"
  activeSearchHN: "",
  googleScriptUrl: localStorage.getItem("painApp_scriptUrl") || DEFAULT_SCRIPT_URL,
  currentTab: "form",  // "form" | "history" | "dashboard"
  isOnlineSyncing: false
};

// DOM Elements Container
const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  initDOMElements();
  initDropdownOptions();
  loadStoredRecords();
  populateSheetDropdowns(state.sheets, state.currentSheet);
  bindEvents();
  document.body.setAttribute("data-active-tab", "form");
  renderKPIs();
  
  // ตรวจสอบ Tab จาก URL Hash หรือ Query Params (เช่น #history หรือ ?tab=history)
  const urlTab = window.location.hash.replace("#", "") || new URLSearchParams(window.location.search).get("tab");
  if (urlTab && ["form", "history", "dashboard"].includes(urlTab)) {
    switchTab(urlTab);
  } else {
    renderHistoryView();
  }
  
  updatePainConditionUI();
  updateSurgeryConditionUI();
  updateSyncStatusBadge();
  
  // โหลดข้อมูลล่าสุดเบื้องหลังแบบ Single Request (ไม่บล็อกหน้าจอ)
  fetchFromGoogleSheet(state.currentSheet, true);
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
  
  // Search & Filters
  elements.searchANInput = document.getElementById("searchANInput");
  elements.btnSearchAN = document.getElementById("btnSearchAN");
  elements.btnClearSearch = document.getElementById("btnClearSearch");
  elements.historyResultsContainer = document.getElementById("historyResultsContainer");
  elements.historySearchTitle = document.getElementById("historySearchTitle");
  elements.historyShowingSummary = document.getElementById("historyShowingSummary");
  elements.btnQuickCheckHN = document.getElementById("btnQuickCheckHN");
  
  // History Top Controls
  elements.selectHistoryMonth = document.getElementById("selectHistoryMonth");
  elements.btnRefreshHistorySheets = document.getElementById("btnRefreshHistorySheets");
  elements.inputHistorySearch = document.getElementById("inputHistorySearch");
  elements.btnClearHistorySearch = document.getElementById("btnClearHistorySearch");
  
  // View Switchers
  elements.btnViewCards = document.getElementById("btnViewCards");
  elements.btnViewTable = document.getElementById("btnViewTable");
  elements.filterChips = document.querySelectorAll(".filter-chip");
  
  // Form Inputs
  elements.inputAN = document.getElementById("inputAN");
  elements.selectTool = document.getElementById("selectTool");
  elements.painInitialThermo = document.getElementById("painInitialThermo");
  elements.painInitialNote = document.getElementById("painInitialNote");
  elements.painQ8Thermo = document.getElementById("painQ8Thermo");
  elements.painQ8Note = document.getElementById("painQ8Note");
  
  elements.painOver5Select = document.getElementById("painOver5Select");
  elements.groupIntervention = document.getElementById("groupIntervention");
  elements.selectIntervention = document.getElementById("selectIntervention");
  elements.groupReassessment = document.getElementById("groupReassessment");
  elements.selectReassessment = document.getElementById("selectReassessment");
  
  elements.selectSurgery = document.getElementById("selectSurgery");
  elements.surgeryDetailsGroup = document.getElementById("surgeryDetailsGroup");
  elements.painPostOpThermo = document.getElementById("painPostOpThermo");
  elements.painPostOpNote = document.getElementById("painPostOpNote");
  elements.guidelinePostOp = document.getElementById("guidelinePostOp");
  elements.inputRemarks = document.getElementById("inputRemarks");
  
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
  if (elements.selectTool) {
    elements.selectTool.innerHTML = `<option value="">เลือก Tool การประเมิน</option>` + 
      TOOLS.map(t => `<option value="${t}">${t}</option>`).join("");
    elements.selectTool.value = TOOLS[0];
  }
    
  if (elements.selectIntervention) {
    elements.selectIntervention.innerHTML = `<option value="">เลือก Intervention</option>` + 
      INTERVENTIONS.map(i => `<option value="${i}">${i}</option>`).join("");
  }
}

function bindEvents() {
  // Navigation Tabs
  elements.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab-target");
      switchTab(target);
    });
  });
  
  // Sheet Selector
  if (elements.selectSheetMonth) {
    elements.selectSheetMonth.addEventListener("change", (e) => {
      const selected = e.target.value;
      if (selected) {
        state.currentSheet = selected;
        if (elements.formTargetSheet) elements.formTargetSheet.value = selected;
        fetchFromGoogleSheet(selected);
      }
    });
  }
  
  if (elements.btnRefreshSheets) {
    elements.btnRefreshSheets.addEventListener("click", () => {
      fetchSheetList(true);
    });
  }
  
  if (elements.formTargetSheet) {
    elements.formTargetSheet.addEventListener("change", (e) => {
      state.currentSheet = e.target.value;
      if (elements.selectSheetMonth) elements.selectSheetMonth.value = e.target.value;
      if (elements.selectHistoryMonth) elements.selectHistoryMonth.value = e.target.value;
    });
  }

  // Integrated History Month Selector
  if (elements.selectHistoryMonth) {
    elements.selectHistoryMonth.addEventListener("change", (e) => {
      const selected = e.target.value;
      if (selected) {
        state.currentSheet = selected;
        if (elements.selectSheetMonth) elements.selectSheetMonth.value = selected;
        if (elements.formTargetSheet) elements.formTargetSheet.value = selected;
        fetchFromGoogleSheet(selected);
      }
    });
  }

  if (elements.btnRefreshHistorySheets) {
    elements.btnRefreshHistorySheets.addEventListener("click", () => {
      fetchSheetList(true);
    });
  }

  // Integrated History Search Input
  if (elements.inputHistorySearch) {
    elements.inputHistorySearch.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      state.activeSearchHN = val;
      if (elements.searchANInput) elements.searchANInput.value = val;
      if (elements.btnClearHistorySearch) {
        elements.btnClearHistorySearch.style.display = val ? "flex" : "none";
      }
      renderHistoryView();
    });
  }

  if (elements.btnClearHistorySearch) {
    elements.btnClearHistorySearch.addEventListener("click", () => {
      if (elements.inputHistorySearch) elements.inputHistorySearch.value = "";
      if (elements.searchANInput) elements.searchANInput.value = "";
      elements.btnClearHistorySearch.style.display = "none";
      state.activeSearchHN = "";
      renderHistoryView();
    });
  }

  // Quick Check HN in Form
  if (elements.btnQuickCheckHN) {
    elements.btnQuickCheckHN.addEventListener("click", () => {
      const q = (elements.inputAN.value || "").trim();
      if (!q) {
        showToast("กรุณากรอกเลข HN ก่อนตรวจประวัติ", "warning");
        elements.inputAN.focus();
        return;
      }
      checkHNInCurrentSheet(q);
    });
  }

  // Search in History (Sidebar)
  if (elements.btnSearchAN) {
    elements.btnSearchAN.addEventListener("click", () => {
      executeSearch();
    });
  }
  
  if (elements.searchANInput) {
    elements.searchANInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSearch();
      }
    });
  }
  
  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener("click", () => {
      if (elements.searchANInput) elements.searchANInput.value = "";
      if (elements.inputHistorySearch) elements.inputHistorySearch.value = "";
      if (elements.btnClearHistorySearch) elements.btnClearHistorySearch.style.display = "none";
      state.activeSearchHN = "";
      renderHistoryView();
    });
  }

  // Filter Chips
  if (elements.filterChips) {
    elements.filterChips.forEach(chip => {
      chip.addEventListener("click", () => {
        elements.filterChips.forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.activeFilter = chip.getAttribute("data-filter") || "all";
        renderHistoryView();
      });
    });
  }

  // View Mode Switcher
  if (elements.btnViewCards) {
    elements.btnViewCards.addEventListener("click", () => {
      state.viewMode = "cards";
      elements.btnViewCards.classList.add("active");
      if (elements.btnViewTable) elements.btnViewTable.classList.remove("active");
      renderHistoryView();
    });
  }

  if (elements.btnViewTable) {
    elements.btnViewTable.addEventListener("click", () => {
      state.viewMode = "table";
      elements.btnViewTable.classList.add("active");
      if (elements.btnViewCards) elements.btnViewCards.classList.remove("active");
      renderHistoryView();
    });
  }
  
  // Form Logic
  if (elements.painOver5Select) {
    elements.painOver5Select.addEventListener("change", updatePainConditionUI);
  }
  
  if (elements.selectSurgery) {
    elements.selectSurgery.addEventListener("change", updateSurgeryConditionUI);
  }
  
  if (elements.painForm) {
    elements.painForm.addEventListener("submit", handleFormSubmit);
    elements.painForm.addEventListener("reset", () => {
      setTimeout(() => {
        if (elements.selectTool) elements.selectTool.value = TOOLS[0];
        updatePainConditionUI();
        updateSurgeryConditionUI();
        if (elements.formTargetSheet) elements.formTargetSheet.value = state.currentSheet;
      }, 50);
    });
  }
  
  // Settings Modal
  if (elements.btnOpenSettings) {
    elements.btnOpenSettings.addEventListener("click", openSettingsModal);
  }
  
  if (elements.btnCloseModal) {
    elements.btnCloseModal.addEventListener("click", closeSettingsModal);
  }
  
  if (elements.settingsModal) {
    elements.settingsModal.addEventListener("click", (e) => {
      if (e.target === elements.settingsModal) closeSettingsModal();
    });
  }
  
  if (elements.btnSaveSettings) {
    elements.btnSaveSettings.addEventListener("click", saveSettings);
  }
  
  if (elements.btnTestSync) {
    elements.btnTestSync.addEventListener("click", testConnection);
  }
}

/**
 * สลับแท็บการทำงาน
 */
function switchTab(tabId) {
  state.currentTab = tabId;
  document.body.setAttribute("data-active-tab", tabId);
  
  document.querySelectorAll("[data-tab-target]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab-target") === tabId);
  });
  
  Object.keys(elements.tabPanels).forEach(key => {
    if (elements.tabPanels[key]) {
      elements.tabPanels[key].classList.toggle("hidden", key !== tabId);
    }
  });
  
  if (tabId === "history") {
    renderHistoryView();
  } else if (tabId === "dashboard") {
    renderAnalytics();
  }
}

function updatePainConditionUI() {
  if (!elements.painOver5Select) return;
  const isOver5 = elements.painOver5Select.value === "YES";
  
  if (isOver5) {
    elements.groupIntervention.classList.remove("is-disabled");
    elements.groupReassessment.classList.remove("is-disabled");
    elements.selectIntervention.removeAttribute("disabled");
    elements.selectReassessment.removeAttribute("disabled");
    elements.selectIntervention.setAttribute("required", "required");
    elements.selectReassessment.setAttribute("required", "required");
    
    document.getElementById("sectionPainAlert").style.borderColor = "#f97316";
  } else {
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
  if (!elements.selectSurgery || !elements.surgeryDetailsGroup) return;
  const isOp = elements.selectSurgery.value === "YES";
  if (isOp) {
    elements.surgeryDetailsGroup.classList.remove("hidden");
  } else {
    elements.surgeryDetailsGroup.classList.add("hidden");
  }
}

/**
 * บันทึกข้อมูลเข้า Google Sheet
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const hn = (elements.inputAN.value || "").trim();
  const tool = elements.selectTool.value;
  
  if (!hn || !tool) {
    showToast("กรุณากรอกเลข HN และเลือก Tool การประเมิน", "warning");
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
    intervention = "-";
    reassessment = "-";
  }
  
  const opSurgery = elements.selectSurgery.value;
  const painInitialThermo = elements.painInitialThermo ? elements.painInitialThermo.value : "YES";
  const painInitialNote = elements.painInitialNote ? elements.painInitialNote.value : "YES";
  const painQ8Thermo = elements.painQ8Thermo ? elements.painQ8Thermo.value : "YES";
  const painQ8Note = elements.painQ8Note ? elements.painQ8Note.value : "YES";
  
  const painPostOpThermo = opSurgery === "YES" ? (elements.painPostOpThermo ? elements.painPostOpThermo.value : "YES") : "-";
  const painPostOpNote = opSurgery === "YES" ? (elements.painPostOpNote ? elements.painPostOpNote.value : "YES") : "-";
  const guidelinePostOp = opSurgery === "YES" ? (elements.guidelinePostOp ? elements.guidelinePostOp.value : "YES") : "-";
  const note = (elements.inputRemarks ? elements.inputRemarks.value : "").trim();
  
  const targetSheet = elements.formTargetSheet ? elements.formTargetSheet.value : (state.currentSheet || "");
  
  const newRecord = {
    "_sheetName": targetSheet,
    "HN": hn,
    "AN": hn,
    "Tool": tool,
    "Pain แรกรับ : ฟอร์มปรอท": painInitialThermo,
    "Pain แรกรับ : Nurse note": painInitialNote,
    "Pain q 8 hr : ฟอร์มปรอท": painQ8Thermo,
    "Pain q 8 hr : Nurse Note": painQ8Note,
    "Pain ≥ 5**": painOver5,
    "Intervention": intervention,
    "Re-assessment": reassessment,
    "Operation Surgery": opSurgery,
    "Pain post-op แรกรับ : ฟอร์มปรอท": painPostOpThermo,
    "Pain post-op แรกรับ : Nurse Note": painPostOpNote,
    "Guideline Post-op": guidelinePostOp,
    "หมายเหตุ": note
  };
  
  // บันทึกลงหน่วยความจำชั่วคราว
  state.records.unshift(newRecord);
  saveRecordsToLocal();
  renderKPIs();
  
  // ปิดปุ่มระหว่างส่งข้อมูล
  const origBtnText = elements.btnSubmit.innerHTML;
  elements.btnSubmit.disabled = true;
  elements.btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึกลงชีต...`;
  
  if (state.googleScriptUrl) {
    try {
      const payload = {
        sheetName: targetSheet,
        HN: hn,
        AN: hn,
        Tool: tool,
        "Painแรกรับ_ฟอร์มปรอท": painInitialThermo,
        "Painแรกรับ_NurseNote": painInitialNote,
        "PainQ8_ฟอร์มปรอท": painQ8Thermo,
        "PainQ8_NurseNote": painQ8Note,
        "Pain ≥ 5**": painOver5,
        "Intervention": intervention,
        "Re-assessment": reassessment,
        "Operation Surgery": opSurgery,
        "PainPostOp_ฟอร์มปรอท": painPostOpThermo,
        "PainPostOp_NurseNote": painPostOpNote,
        "Guideline": guidelinePostOp,
        "หมายเหตุ": note
      };
      
      const response = await fetch(state.googleScriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      
      showToast(`บันทึกข้อมูล HN ${hn} ลงชีต "${targetSheet}" เรียบร้อยแล้ว!`, "success");
      
      // ดึงข้อมูลใหม่อีกครั้ง
      setTimeout(() => {
        fetchFromGoogleSheet(targetSheet);
      }, 1000);
      
    } catch (err) {
      console.error("Error submitting to Google Sheets:", err);
      showToast(`บันทึกในเครื่องเรียบร้อยแล้ว (การเชื่อมต่อชีตขัดข้อง: ${err.message})`, "warning");
    } finally {
      elements.btnSubmit.disabled = false;
      elements.btnSubmit.innerHTML = origBtnText;
    }
  } else {
    setTimeout(() => {
      elements.btnSubmit.disabled = false;
      elements.btnSubmit.innerHTML = origBtnText;
      showToast(`บันทึกข้อมูล HN ${hn} สำเร็จ (โหมดออฟไลน์)`, "success");
    }, 400);
  }
  
  // ล้างฟอร์มบางส่วนเพื่อพร้อมบันทึกรายถัดไป
  elements.inputAN.value = "";
  if (elements.inputRemarks) elements.inputRemarks.value = "";
  elements.inputAN.focus();
}

/**
 * ตรวจสอบ HN ในชีตปัจจุบันแบบรวดเร็ว
 */
function checkHNInCurrentSheet(hn) {
  const match = state.records.filter(r => String(r["HN"] || "").toLowerCase() === hn.toLowerCase());
  if (match.length > 0) {
    showToast(`พบประวัติเดิมของ HN ${hn} ในชีตนี้แล้ว ${match.length} รายการ`, "info");
    elements.searchANInput.value = hn;
    switchTab("history");
    executeSearch();
  } else {
    showToast(`ไม่พบประวัติเดิมของ HN ${hn} ในชีตเดือนนี้ (สามารถลงบันทึกเป็นคนไข้รายใหม่ได้ทันที)`, "success");
  }
}

/**
 * ค้นหาประวัติ HN
 */
function executeSearch() {
  const q = (elements.searchANInput ? elements.searchANInput.value : "").trim();
  state.activeSearchHN = q;
  switchTab("history");
  renderHistoryView();
}

/**
 * Render รายการประวัติ (มุมมองการ์ด หรือ ตารางชีต)
 */
function renderHistoryView() {
  const container = elements.historyResultsContainer;
  if (!container) return;
  
  let list = [...state.records];
  
  // กรองแถวว่าง หรือแถวที่ไม่มี HN ออก (ป้องกันแถวหัวตารางหรือแถวเปล่า)
  list = list.filter(item => item && item.HN && item.HN !== "ไม่ระบุ" && item.HN !== "HN" && item._rowIndex !== 2);
  
  // 1. กรองตาม Search HN
  if (state.activeSearchHN) {
    const q = state.activeSearchHN.toLowerCase();
    list = list.filter(item => {
      const hn = String(item["HN"] || item["AN"] || "").toLowerCase();
      return hn.includes(q);
    });
  }
  
  // 2. กรองตาม Filter Chip
  if (state.activeFilter === "severe") {
    list = list.filter(item => String(item["Pain ≥ 5**"]).toUpperCase() === "YES");
  } else if (state.activeFilter === "surgery") {
    list = list.filter(item => String(item["Operation Surgery"]).toUpperCase() === "YES");
  } else if (state.activeFilter === "incomplete") {
    list = list.filter(item => 
      String(item["Pain แรกรับ : ฟอร์มปรอท"]).toUpperCase() !== "YES" || 
      String(item["Pain แรกรับ : Nurse note"]).toUpperCase() !== "YES"
    );
  }
  
  // อัปเดตตัวเลขใน Filter Chips
  updateFilterChipCounts();
  
  // Header bar
  if (elements.historySearchTitle) {
    const totalInSheet = state.records.length;
    const sheetName = state.currentSheet || "ข้อมูลปัจจุบัน";
    elements.historySearchTitle.innerHTML = `
      <div>
        <h4 style="font-size:1.05rem; font-weight:700; color:#1e1b4b; display:flex; align-items:center; gap:8px;">
          <i class="fa-regular fa-folder-open" style="color:#4f46e5;"></i> ชีต: ${sheetName}
        </h4>
        <span style="font-size:0.8rem; color:#64748b;">
          ${state.activeSearchHN ? `ผลการค้นหา HN: <strong>${state.activeSearchHN}</strong> (${list.length} รายการ)` : `ผู้ป่วยทั้งหมดในชีตนี้ ${totalInSheet} รายการ`}
        </span>
      </div>
      <div>
        <button class="btn-primary" style="padding:6px 14px; font-size:0.82rem;" onclick="switchTab('form')">
          <i class="fa-solid fa-plus"></i> บันทึกคนไข้ใหม่
        </button>
      </div>
    `;
  }
  
  if (elements.historyShowingSummary) {
    elements.historyShowingSummary.textContent = `แสดง ${list.length} จากทั้งหมด ${state.records.length} คนไข้`;
  }
  
  // แสดงผลกรณีไม่พบข้อมูล
  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 16px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1;">
        <i class="fa-regular fa-folder-open" style="font-size:2rem; color:#94a3b8; margin-bottom:10px; display:block;"></i>
        <p style="font-weight:700; font-size:1rem; color:#475569;">ไม่พบข้อมูลผู้ป่วยที่ค้นหา</p>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:4px;">กรุณาตรวจสอบเลข HN หรือสลับดู Work Sheet ประจำเดือนอื่น</p>
        <button class="btn-primary" style="margin-top:14px;" onclick="switchTab('form')">
          <i class="fa-solid fa-plus"></i> เริ่มบันทึก HN ใหม่
        </button>
      </div>
    `;
    return;
  }
  
  // สลับการแสดงผลตาม View Mode
  if (state.viewMode === "table") {
    renderSpreadsheetTableView(list, container);
  } else {
    renderCardView(list, container);
  }
}

/**
 * แสดงผลแบบการ์ด (Card View - สวยหรู สบายตาบนมือถือ ไม่ล้นจอ)
 */
function renderCardView(list, container) {
  let html = `<div style="display:flex; flex-direction:column; gap:10px;">`;
  
  list.forEach((item, idx) => {
    const isSevere = String(item["Pain ≥ 5**"]).toUpperCase() === "YES";
    const isSurgery = String(item["Operation Surgery"]).toUpperCase() === "YES";
    const hnDisplay = item["HN"] || item["AN"] || "ไม่ระบุ";
    const toolDisplay = item["Tool"] || "Numeric Rating Score";
    const rowNum = idx + 1;
    
    html += `
      <div class="patient-history-card ${isSevere ? 'is-severe' : ''}">
        
        <!-- Header การ์ด -->
        <div class="patient-card-header">
          <div class="patient-card-top-row">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="row-num-tag">#${rowNum}</span>
              <span class="hn-tag">HN ${hnDisplay}</span>
              <button class="icon-btn-sm" title="คัดลอก HN" onclick="copyHN('${hnDisplay}')">
                <i class="fa-regular fa-copy"></i>
              </button>
            </div>
            
            <button class="btn-continue-entry" onclick="fillFormForAN('${hnDisplay}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <i class="fa-solid fa-clone"></i> บันทึกต่อ
            </button>
          </div>
          
          <div class="patient-card-badges-row">
            <span class="badge badge-tool"><i class="fa-solid fa-ruler"></i> ${toolDisplay}</span>
            ${isSevere ? `<span class="badge badge-pain-alert"><i class="fa-solid fa-triangle-exclamation"></i> Pain ≥ 5</span>` : `<span class="badge badge-ok"><i class="fa-solid fa-check"></i> Pain &lt; 5</span>`}
            ${isSurgery ? `<span class="badge badge-surgery"><i class="fa-solid fa-syringe"></i> ผ่าตัด</span>` : ``}
          </div>
        </div>
        
        <!-- รายละเอียดประเมิน Grid สไตล์ Responsive -->
        <div class="patient-card-grid">
          <div class="patient-grid-item">
            <span class="d-label" style="font-size:0.75rem; color:#64748b; font-weight:600;">Pain แรกรับ (ปรอท / Note):</span>
            <div class="d-val-badges">
              <span class="${item["Pain แรกรับ : ฟอร์มปรอท"] === 'YES' ? 'val-pill-yes' : 'val-pill-no'}">
                ปรอท: ${item["Pain แรกรับ : ฟอร์มปรอท"] || '-'}
              </span>
              <span class="${item["Pain แรกรับ : Nurse note"] === 'YES' ? 'val-pill-yes' : 'val-pill-no'}">
                Note: ${item["Pain แรกรับ : Nurse note"] || '-'}
              </span>
            </div>
          </div>

          <div class="patient-grid-item">
            <span class="d-label" style="font-size:0.75rem; color:#64748b; font-weight:600;">Pain q 8 hr (ปรอท / Note):</span>
            <div class="d-val-badges">
              <span class="${item["Pain q 8 hr : ฟอร์มปรอท"] === 'YES' ? 'val-pill-yes' : 'val-pill-no'}">
                ปรอท: ${item["Pain q 8 hr : ฟอร์มปรอท"] || '-'}
              </span>
              <span class="${item["Pain q 8 hr : Nurse Note"] === 'YES' ? 'val-pill-yes' : 'val-pill-no'}">
                Note: ${item["Pain q 8 hr : Nurse Note"] || '-'}
              </span>
            </div>
          </div>
          
          ${isSevere ? `
            <div class="patient-grid-item alert-box-severe">
              <span style="font-size:0.75rem; color:#c2410c; font-weight:700; display:block;">
                <i class="fa-solid fa-triangle-exclamation"></i> การจัดการความปวดรุนแรง:
              </span>
              <div style="color:#9a3412; font-size:0.8rem; margin-top:2px;">
                Intervention: <strong>${item["Intervention"] || '-'}</strong> | 
                ประเมินซ้ำ: <strong class="${item["Re-assessment"] === 'YES' ? 'text-yes' : ''}">${item["Re-assessment"] || '-'}</strong>
              </div>
            </div>
          ` : ''}

          ${isSurgery ? `
            <div class="patient-grid-item alert-box-surgery">
              <span style="font-size:0.75rem; color:#15803d; font-weight:700; display:block;">
                <i class="fa-solid fa-syringe"></i> การดูแลหลังผ่าตัด (Post-op):
              </span>
              <div style="color:#166534; font-size:0.8rem; margin-top:2px;">
                ปรอท: <strong>${item["Pain post-op แรกรับ : ฟอร์มปรอท"] || '-'}</strong> | 
                Note: <strong>${item["Pain post-op แรกรับ : Nurse Note"] || '-'}</strong> | 
                Guideline: <strong class="${item["Guideline Post-op"] === 'YES' ? 'text-yes' : ''}">${item["Guideline Post-op"] || '-'}</strong>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${item["หมายเหตุ"] ? `
          <div class="patient-card-remark">
            <strong style="color:#be123c;"><i class="fa-regular fa-comment-dots"></i> หมายเหตุ:</strong> ${item["หมายเหตุ"]}
          </div>
        ` : ''}

      </div>
    `;
  });
  
  html += `</div>`;
  container.innerHTML = html;
}

/**
 * แสดงผลแบบตาราง Google Sheet (Spreadsheet Table View)
 */
function renderSpreadsheetTableView(list, container) {
  let html = `
    <div class="sheet-table-wrapper">
      <table class="sheet-table">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>HN</th>
            <th>Tool</th>
            <th>แรกรับ:ปรอท</th>
            <th>แรกรับ:Note</th>
            <th>q8:ปรอท</th>
            <th>q8:Note</th>
            <th>Pain ≥ 5</th>
            <th>Intervention</th>
            <th>Re-assess</th>
            <th>Surgery</th>
            <th>Post-op ปรอท</th>
            <th>Post-op Note</th>
            <th>Guideline</th>
            <th>หมายเหตุ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  list.forEach((item, idx) => {
    const isSevere = String(item["Pain ≥ 5**"]).toUpperCase() === "YES";
    const rowNum = idx + 1;
    const hn = item["HN"] || item["AN"] || "-";
    
    html += `
      <tr class="${isSevere ? 'row-severe' : ''}">
        <td style="font-weight:700; color:#64748b;">${rowNum}</td>
        <td><span class="hn-tag">${hn}</span></td>
        <td>${item["Tool"] || "-"}</td>
        <td><span class="${badgeTagClass(item["Pain แรกรับ : ฟอร์มปรอท"])}">${item["Pain แรกรับ : ฟอร์มปรอท"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Pain แรกรับ : Nurse note"])}">${item["Pain แรกรับ : Nurse note"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Pain q 8 hr : ฟอร์มปรอท"])}">${item["Pain q 8 hr : ฟอร์มปรอท"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Pain q 8 hr : Nurse Note"])}">${item["Pain q 8 hr : Nurse Note"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Pain ≥ 5**"], true)}">${item["Pain ≥ 5**"] || "NO"}</span></td>
        <td>${item["Intervention"] || "-"}</td>
        <td><span class="${badgeTagClass(item["Re-assessment"])}">${item["Re-assessment"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Operation Surgery"])}">${item["Operation Surgery"] || "NO"}</span></td>
        <td><span class="${badgeTagClass(item["Pain post-op แรกรับ : ฟอร์มปรอท"])}">${item["Pain post-op แรกรับ : ฟอร์มปรอท"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Pain post-op แรกรับ : Nurse Note"])}">${item["Pain post-op แรกรับ : Nurse Note"] || "-"}</span></td>
        <td><span class="${badgeTagClass(item["Guideline Post-op"])}">${item["Guideline Post-op"] || "-"}</span></td>
        <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis;" title="${item["หมายเหตุ"] || ''}">${item["หมายเหตุ"] || "-"}</td>
        <td>
          <button class="icon-btn" style="width:28px; height:28px; font-size:0.75rem;" title="ลงข้อมูลต่อจาก HN นี้" onclick="fillFormForAN('${hn}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}

function badgeTagClass(val, isSevereColumn = false) {
  const v = String(val || "").toUpperCase();
  if (v === "YES") return isSevereColumn ? "badge badge-pain-alert" : "badge-tag-yes";
  if (v === "NO") return "badge-tag-no";
  return "badge-tag-dash";
}

function updateFilterChipCounts() {
  const all = state.records.length;
  const severe = state.records.filter(r => String(r["Pain ≥ 5**"]).toUpperCase() === "YES").length;
  const surgery = state.records.filter(r => String(r["Operation Surgery"]).toUpperCase() === "YES").length;
  const incomplete = state.records.filter(r => 
    String(r["Pain แรกรับ : ฟอร์มปรอท"]).toUpperCase() !== "YES" || 
    String(r["Pain แรกรับ : Nurse note"]).toUpperCase() !== "YES"
  ).length;
  
  const elAll = document.getElementById("countAll");
  const elSevere = document.getElementById("countSevere");
  const elSurgery = document.getElementById("countSurgery");
  const elIncomplete = document.getElementById("countIncomplete");
  
  if (elAll) elAll.textContent = all;
  if (elSevere) elSevere.textContent = severe;
  if (elSurgery) elSurgery.textContent = surgery;
  if (elIncomplete) elIncomplete.textContent = incomplete;
}

/**
 * เติมข้อมูล HN ในฟอร์มเพื่อบันทึกแถวใหม่
 */
window.fillFormForAN = function(hn, latestRecord = null) {
  switchTab("form");
  elements.inputAN.value = hn;
  
  if (latestRecord) {
    if (latestRecord["Tool"] && elements.selectTool) elements.selectTool.value = latestRecord["Tool"];
    if (latestRecord["Operation Surgery"] && elements.selectSurgery) elements.selectSurgery.value = latestRecord["Operation Surgery"];
  }
  
  updatePainConditionUI();
  updateSurgeryConditionUI();
  
  document.getElementById("panelForm").scrollIntoView({ behavior: "smooth" });
  showToast(`ระบบเตรียมฟอร์มสำหรับ HN ${hn} แล้ว`, "success");
};

window.copyHN = function(hn) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(hn).then(() => {
      showToast(`คัดลอก HN ${hn} แล้ว`, "info");
    });
  }
};

/**
 * Render KPI Cards ด้านบน
 */
function renderKPIs() {
  const total = state.records.length;
  
  // Pain แรกรับ YES ทั้งคู่ (ปรอท + Note)
  const painFirstYes = state.records.filter(r => 
    String(r["Pain แรกรับ : ฟอร์มปรอท"]).toUpperCase() === "YES" && 
    String(r["Pain แรกรับ : Nurse note"]).toUpperCase() === "YES"
  ).length;
  
  // Pain q 8 hr YES ทั้งคู่
  const painQ8Yes = state.records.filter(r => 
    String(r["Pain q 8 hr : ฟอร์มปรอท"]).toUpperCase() === "YES" && 
    String(r["Pain q 8 hr : Nurse Note"]).toUpperCase() === "YES"
  ).length;
  
  const surgeryYes = state.records.filter(r => 
    String(r["Operation Surgery"]).toUpperCase() === "YES"
  ).length;
  
  const guidelineYes = state.records.filter(r => 
    String(r["Guideline Post-op"]).toUpperCase() === "YES"
  ).length;
  
  const painOver5Yes = state.records.filter(r => 
    String(r["Pain ≥ 5**"]).toUpperCase() === "YES"
  ).length;
  
  const elTotal = document.getElementById("kpiTotal");
  const elPainFirst = document.getElementById("kpiPainFirst");
  const elPainQ8 = document.getElementById("kpiPainQ8");
  const elSurgery = document.getElementById("kpiSurgery");
  const elGuideline = document.getElementById("kpiGuideline");
  const elPainOver5 = document.getElementById("kpiPainOver5");
  
  if (elTotal) elTotal.textContent = total;
  if (elPainFirst) elPainFirst.textContent = total > 0 ? `${painFirstYes} (${Math.round((painFirstYes / total) * 100)}%)` : "0";
  if (elPainQ8) elPainQ8.textContent = total > 0 ? `${painQ8Yes} (${Math.round((painQ8Yes / total) * 100)}%)` : "0";
  if (elSurgery) elSurgery.textContent = surgeryYes;
  if (elGuideline) elGuideline.textContent = surgeryYes > 0 ? `${guidelineYes} (${Math.round((guidelineYes / surgeryYes) * 100)}%)` : (total > 0 ? `${guidelineYes}` : "0");
  if (elPainOver5) elPainOver5.textContent = total > 0 ? `${painOver5Yes} (${Math.round((painOver5Yes / total) * 100)}%)` : "0";
}

/**
 * Render QA Analytics ในแท็บสรุปผล
 */
function renderAnalytics() {
  const total = state.records.length;
  const containerQA = document.getElementById("qaMetricsContainer");
  const containerTools = document.getElementById("toolStatsContainer");
  
  if (!containerQA) return;
  
  if (total === 0) {
    containerQA.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem;">ยังไม่มีข้อมูลในเดือนนี้</p>`;
    return;
  }
  
  // 1. ตัวชี้วัดคุณภาพ QA
  const firstYes = state.records.filter(r => 
    String(r["Pain แรกรับ : ฟอร์มปรอท"]).toUpperCase() === "YES" && 
    String(r["Pain แรกรับ : Nurse note"]).toUpperCase() === "YES"
  ).length;
  const pctFirst = Math.round((firstYes / total) * 100);
  
  const q8Yes = state.records.filter(r => 
    String(r["Pain q 8 hr : ฟอร์มปรอท"]).toUpperCase() === "YES" && 
    String(r["Pain q 8 hr : Nurse Note"]).toUpperCase() === "YES"
  ).length;
  const pctQ8 = Math.round((q8Yes / total) * 100);
  
  const severeList = state.records.filter(r => String(r["Pain ≥ 5**"]).toUpperCase() === "YES");
  const severeCount = severeList.length;
  const pctSevere = Math.round((severeCount / total) * 100);
  
  const severeReassess = severeList.filter(r => String(r["Re-assessment"]).toUpperCase() === "YES").length;
  const pctReassess = severeCount > 0 ? Math.round((severeReassess / severeCount) * 100) : 100;
  
  const surgeryList = state.records.filter(r => String(r["Operation Surgery"]).toUpperCase() === "YES");
  const surgeryCount = surgeryList.length;
  const pctSurgery = Math.round((surgeryCount / total) * 100);
  
  const surgeryGuide = surgeryList.filter(r => String(r["Guideline Post-op"]).toUpperCase() === "YES").length;
  const pctGuide = surgeryCount > 0 ? Math.round((surgeryGuide / surgeryCount) * 100) : 100;
  
  containerQA.innerHTML = `
    <div class="qa-metric-row">
      <div class="qa-metric-top">
        <div class="qa-metric-info">
          <div class="qa-metric-title">1. การประเมินแรกรับครบถ้วน</div>
          <div class="qa-metric-sub">ฟอร์มปรอท และ Nurse Note = YES</div>
        </div>
        <div class="qa-metric-badge ${pctFirst >= 90 ? 'badge-good' : 'badge-warn'}">
          <span class="qa-badge-pct">${pctFirst}%</span>
          <span class="qa-badge-fraction">${firstYes}/${total} เคส</span>
        </div>
      </div>
      <div class="qa-progress-bg">
        <div class="qa-progress-fill ${pctFirst >= 90 ? 'fill-good' : 'fill-warn'}" style="width:${pctFirst}%;"></div>
      </div>
    </div>

    <div class="qa-metric-row">
      <div class="qa-metric-top">
        <div class="qa-metric-info">
          <div class="qa-metric-title">2. การประเมิน Pain q 8 hr ครบถ้วน</div>
          <div class="qa-metric-sub">ฟอร์มปรอท และ Nurse Note = YES</div>
        </div>
        <div class="qa-metric-badge ${pctQ8 >= 90 ? 'badge-good' : 'badge-warn'}">
          <span class="qa-badge-pct">${pctQ8}%</span>
          <span class="qa-badge-fraction">${q8Yes}/${total} เคส</span>
        </div>
      </div>
      <div class="qa-progress-bg">
        <div class="qa-progress-fill ${pctQ8 >= 90 ? 'fill-good' : 'fill-warn'}" style="width:${pctQ8}%;"></div>
      </div>
    </div>

    <div class="qa-metric-row">
      <div class="qa-metric-top">
        <div class="qa-metric-info">
          <div class="qa-metric-title">3. อัตราเกิด Pain ≥ 5 (ปวดรุนแรง)</div>
          <div class="qa-metric-sub">ผู้ป่วยที่มีอาการปวดคะแนน 5 ขึ้นไป</div>
        </div>
        <div class="qa-metric-badge badge-danger">
          <span class="qa-badge-pct">${pctSevere}%</span>
          <span class="qa-badge-fraction">${severeCount}/${total} เคส</span>
        </div>
      </div>
      <div class="qa-progress-bg">
        <div class="qa-progress-fill fill-danger" style="width:${pctSevere}%;"></div>
      </div>
    </div>

    <div class="qa-metric-row">
      <div class="qa-metric-top">
        <div class="qa-metric-info">
          <div class="qa-metric-title">4. การประเมินซ้ำ (Re-assessment)</div>
          <div class="qa-metric-sub">ในกลุ่มเคสที่ปวดรุนแรง Pain ≥ 5</div>
        </div>
        <div class="qa-metric-badge ${pctReassess >= 90 ? 'badge-good' : 'badge-warn'}">
          <span class="qa-badge-pct">${pctReassess}%</span>
          <span class="qa-badge-fraction">${severeReassess}/${severeCount || 1} เคส</span>
        </div>
      </div>
      <div class="qa-progress-bg">
        <div class="qa-progress-fill ${pctReassess >= 90 ? 'fill-good' : 'fill-warn'}" style="width:${pctReassess}%;"></div>
      </div>
    </div>

    <div class="qa-metric-row">
      <div class="qa-metric-top">
        <div class="qa-metric-info">
          <div class="qa-metric-title">5. ปฏิบัติตาม Guideline ผ่าตัด</div>
          <div class="qa-metric-sub">ผู้ป่วยผ่าตัดที่ได้รับการดูแลตามแนวทาง</div>
        </div>
        <div class="qa-metric-badge ${pctGuide >= 90 ? 'badge-good' : 'badge-warn'}">
          <span class="qa-badge-pct">${pctGuide}%</span>
          <span class="qa-badge-fraction">${surgeryGuide}/${surgeryCount || 1} เคส</span>
        </div>
      </div>
      <div class="qa-progress-bg">
        <div class="qa-progress-fill ${pctGuide >= 90 ? 'fill-good' : 'fill-warn'}" style="width:${pctGuide}%;"></div>
      </div>
    </div>
  `;
  
  // 2. สัดส่วน Tools
  if (containerTools) {
    const toolCounts = {};
    state.records.forEach(r => {
      const t = r["Tool"] || "Numeric Rating Score";
      toolCounts[t] = (toolCounts[t] || 0) + 1;
    });
    
    containerTools.innerHTML = Object.entries(toolCounts).map(([toolName, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div class="stat-bar-row">
          <div class="stat-bar-header">
            <span>${toolName}</span>
            <span><strong>${count} ราย</strong> (${pct}%)</span>
          </div>
          <div class="qa-progress-bg">
            <div class="qa-progress-fill" style="width:${pct}%; background:#0284c7;"></div>
          </div>
        </div>
      `;
    }).join("");
  }
}

/**
 * คำสำคัญที่บ่งบอกว่าเป็นชีตประจำเดือน
 */
const MONTH_KEYWORDS = [
  "ม.ค", "ก.พ", "มี.ค", "เม.ย", "พ.ค", "มิ.ย", "ก.ค", "ส.ค", "ก.ย", "ต.ค", "พ.ย", "ธ.ค",
  "มกรา", "กุมภา", "มีนา", "เมษา", "พฤษภา", "มิถุนา", "กรกฎา", "สิงหา", "กันยา", "ตุลา", "พฤศจิกา", "ธันวา",
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"
];

function isMonthYearSheetName(name) {
  if (!name) return false;
  const str = String(name).trim();
  const lower = str.toLowerCase();
  
  // ตัดชีตระบบทิ้ง
  if (lower === "pain_data" || lower === "ค้นหา_an" || lower.startsWith("sheet") || lower.startsWith("ชีต")) return false;
  if (/^(setting|config|template|summary|สรุป|dashboard|temp)/i.test(str)) return false;
  
  const hasMonth = MONTH_KEYWORDS.some(kw => lower.includes(kw));
  const hasDatePattern = /\b(25\d{2}|20\d{2}|\d{2})[-_\/.]\d{1,2}\b|\b\d{1,2}[-_\/.](25\d{2}|20\d{2}|\d{2})\b/.test(str);
  
  return hasMonth || hasDatePattern;
}

function populateSheetDropdowns(sheets, activeSheet = "") {
  let filteredSheets = [];
  
  if (Array.isArray(sheets)) {
    filteredSheets = sheets.filter(s => isMonthYearSheetName(s));
  }
  
  if (filteredSheets.length === 0) {
    filteredSheets = ["ตุลาคม 2567", "กันยายน 2567", "สิงหาคม 2567"];
  }
  
  state.sheets = filteredSheets;
  
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
  if (elements.selectHistoryMonth) {
    elements.selectHistoryMonth.innerHTML = optionsHtml;
    elements.selectHistoryMonth.value = activeSheet;
  }
}

async function fetchSheetList(forceRefresh = false) {
  return fetchFromGoogleSheet(state.currentSheet, !forceRefresh);
}

/**
 * ดึงข้อมูลผู้ป่วยจากชีตประจำเดือนที่เลือก (Single Request + Instant Cache)
 */
async function fetchFromGoogleSheet(targetSheet = "", isInitial = false) {
  const sheetToFetch = targetSheet || state.currentSheet || "";
  
  // 1. Instant Render from LocalStorage Cache (ถ้าเคยโหลดไว้แล้ว ดึงขึ้นมาแสดงผลทันทีใน 0.05 วินาที)
  const cachedForThisSheet = localStorage.getItem("painApp_sheet_cache_" + sheetToFetch);
  if (cachedForThisSheet) {
    try {
      const parsed = JSON.parse(cachedForThisSheet);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.records = parsed
          .map(r => normalizeRecord(r))
          .filter(r => r && r.HN && r.HN !== "ไม่ระบุ" && r.HN !== "HN" && r._rowIndex !== 2);
        state.currentSheet = sheetToFetch;
        renderKPIs();
        renderHistoryView();
      }
    } catch (e) {}
  }
  
  if (!state.googleScriptUrl) return;
  
  state.isOnlineSyncing = true;
  updateSyncStatusBadge();
  
  try {
    let result = null;
    const url = `${state.googleScriptUrl}?action=getData&sheet=${encodeURIComponent(sheetToFetch)}&sheetName=${encodeURIComponent(sheetToFetch)}&_t=${Date.now()}`;
    
    try {
      const res = await fetch(url);
      result = await res.json();
    } catch (fetchErr) {
      result = await fetchJsonp(state.googleScriptUrl, { 
        action: "getData", 
        sheet: sheetToFetch,
        sheetName: sheetToFetch 
      });
    }
    
    if (result && result.status === "success") {
      // 1. อัปเดตรายชื่อชีตประจำเดือนที่ได้มาพร้อมกันในรอบเดียว (ไม่ต้องยิง 2 requests ซ้ำซ้อน)
      if (Array.isArray(result.sheets) && result.sheets.length > 0) {
        state.sheets = result.sheets;
        localStorage.setItem("painApp_sheets", JSON.stringify(result.sheets));
        populateSheetDropdowns(result.sheets, result.currentSheet || sheetToFetch);
      }
      
      // 2. อัปเดตข้อมูลผู้ป่วย
      if (Array.isArray(result.data)) {
        state.records = result.data
          .map(r => normalizeRecord(r))
          .filter(r => r && r.HN && r.HN !== "ไม่ระบุ" && r.HN !== "HN" && r._rowIndex !== 2);
        state.currentSheet = result.currentSheet || sheetToFetch;
        saveRecordsToLocal();
        renderKPIs();
        renderHistoryView();
        
        if (!isInitial) {
          showToast(`ซิงค์ข้อมูลชีต "${state.currentSheet}" สำเร็จ (${state.records.length} รายการ)`, "success");
        }
      }
    } else {
      throw new Error(result ? result.message : "ข้อมูลไม่ถูกต้อง");
    }
    
  } catch (err) {
    console.warn("Failed to fetch from Google Sheet:", err);
    if (!isInitial) {
      showToast(`เชื่อมต่อชีตไม่ได้: ${err.message}`, "warning");
    }
  } finally {
    state.isOnlineSyncing = false;
    updateSyncStatusBadge();
  }
}

function fetchJsonp(url, params = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const callbackName = "jsonp_cb_" + Math.round(100000 * Math.random());
    const query = new URLSearchParams({ ...params, callback: callbackName, _t: Date.now() });
    const fullUrl = url.includes("?") ? `${url}&${query.toString()}` : `${url}?${query.toString()}`;
    
    const script = document.createElement("script");
    script.src = fullUrl;
    
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("การเชื่อมต่อหมดเวลา (Timeout)"));
    }, timeout);
    
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

function updateSyncStatusBadge() {
  if (!elements.syncStatusText) return;
  
  if (state.isOnlineSyncing) {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#4f46e5;"></i> กำลังเชื่อมต่อชีต...`;
    elements.syncStatusText.style.background = "#eef2ff";
    elements.syncStatusText.style.color = "#4338ca";
  } else if (state.googleScriptUrl) {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-cloud-arrow-down" style="color:#10b981;"></i> Google Sheet: ออนไลน์`;
    elements.syncStatusText.style.background = "#dcfce7";
    elements.syncStatusText.style.color = "#065f46";
  } else {
    elements.syncStatusText.innerHTML = `<i class="fa-solid fa-database" style="color:#64748b;"></i> ข้อมูลตัวอย่าง (ออฟไลน์)`;
    elements.syncStatusText.style.background = "#f1f5f9";
    elements.syncStatusText.style.color = "#475569";
  }
}

function saveRecordsToLocal() {
  try {
    localStorage.setItem("painApp_records_v2", JSON.stringify(state.records));
    if (state.currentSheet) {
      localStorage.setItem("painApp_sheet_cache_" + state.currentSheet, JSON.stringify(state.records));
      localStorage.setItem("painApp_currentSheet", state.currentSheet);
    }
    if (Array.isArray(state.sheets) && state.sheets.length > 0) {
      localStorage.setItem("painApp_sheets", JSON.stringify(state.sheets));
    }
  } catch (e) {}
}

function loadStoredRecords() {
  try {
    localStorage.removeItem("painApp_records");
    
    const cachedSheet = localStorage.getItem("painApp_currentSheet") || state.currentSheet;
    const raw = (cachedSheet ? localStorage.getItem("painApp_sheet_cache_" + cachedSheet) : null) || localStorage.getItem("painApp_records_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .map(r => normalizeRecord(r))
          .filter(r => r && r.HN && r.HN !== "ไม่ระบุ" && r.HN !== "HN" && r._rowIndex !== 2);
        if (valid.length > 0) {
          state.records = valid;
          if (cachedSheet) state.currentSheet = cachedSheet;
          return;
        }
      }
    }
  } catch (e) {}
  state.records = INITIAL_DEMO_RECORDS.map(r => normalizeRecord(r));
}

// Settings Modal
function openSettingsModal() {
  if (elements.scriptUrlInput) {
    elements.scriptUrlInput.value = state.googleScriptUrl;
  }
  if (elements.settingsModal) {
    elements.settingsModal.classList.add("active");
  }
}

function closeSettingsModal() {
  if (elements.settingsModal) {
    elements.settingsModal.classList.remove("active");
  }
}

function saveSettings() {
  const url = (elements.scriptUrlInput ? elements.scriptUrlInput.value : "").trim();
  if (url && !url.startsWith("https://script.google.com/macros/s/")) {
    showToast("URL ต้องขึ้นต้นด้วย https://script.google.com/macros/s/...", "error");
    return;
  }
  
  state.googleScriptUrl = url;
  localStorage.setItem("painApp_scriptUrl", url);
  closeSettingsModal();
  updateSyncStatusBadge();
  
  if (url) {
    showToast("บันทึกการตั้งค่าแล้ว กำลังดึงรายชื่อชีต...", "success");
    fetchSheetList(true).then(() => {
      fetchFromGoogleSheet();
    });
  } else {
    showToast("ล้างการเชื่อมต่อ Google Sheet แล้ว", "info");
  }
}

async function testConnection() {
  const url = (elements.scriptUrlInput ? elements.scriptUrlInput.value : "").trim();
  if (!url) {
    showToast("กรุณากรอก Google Apps Script Web App URL", "warning");
    return;
  }
  
  const origBtnText = elements.btnTestSync.innerHTML;
  elements.btnTestSync.disabled = true;
  elements.btnTestSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบ...`;
  
  try {
    let result = null;
    try {
      const res = await fetch(`${url}?action=getSheets&_t=${Date.now()}`);
      result = await res.json();
    } catch (e) {
      result = await fetchJsonp(url, { action: "getSheets" });
    }
    
    if (result && result.status === "success") {
      showToast(`เชื่อมต่อสำเร็จ! พบ ${result.sheets ? result.sheets.length : 0} ชีตในไฟล์`, "success");
    } else {
      throw new Error(result ? result.message : "ไม่ได้รับข้อมูลที่ถูกต้อง");
    }
  } catch (err) {
    showToast(`เชื่อมต่อไม่สำเร็จ: ${err.message}`, "error");
  } finally {
    elements.btnTestSync.disabled = false;
    elements.btnTestSync.innerHTML = origBtnText;
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 4000);
}
