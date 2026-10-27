import * as THREE from "./vendor/three.module.js";

"use strict";

const DB_NAME = "navu-platform";
const DB_VERSION = 3;
const ROLE_LABELS = {
  student: ["طالب", "Student"],
  faculty: ["عضو هيئة تدريس", "Faculty member"],
  facilities_staff: ["موظف الخدمات اللوجستية والمرافق", "Logistics and facilities staff"],
  transport_staff: ["موظف نقل وحركة", "Transportation staff"]
};
const STATUS_LABELS = {
  submitted: ["مُرسل", "Submitted"],
  review: ["قيد المراجعة", "Under review"],
  awaiting: ["بانتظار الموافقة", "Awaiting approval"],
  approved: ["معتمد", "Approved"],
  "in-progress": ["قيد التنفيذ", "In progress"],
  completed: ["مكتمل", "Completed"],
  rejected: ["مرفوض", "Rejected"],
  cancelled: ["ملغى", "Cancelled"],
};
const STATUS_FLOW = ["submitted", "review", "awaiting", "approved", "in-progress", "completed", "rejected", "cancelled"];
const DEPARTMENTS = {
  student: "student",
  faculty: "faculty",
  facilities_staff: "facilities",
  transport_staff: "transportation"
};
const ROOM_TYPES = ["classroom", "training", "theater", "laboratory"];
const BUS_MODEL_CAPACITIES = [15, 30, 45, 60];
const COLLEGES = {
  "الكليات العلمية": [
"علوم الحاسب ونظم المعلومات", "كلية الهندسة", "كلية العلوم والآداب"  ],
  "الكليات الصحية": [
    "كلية التمريض", "كلية الطب", "كلية الصيدلة", "كلية العلوم الطبية التطبيقية", "كلية طب الأسنان"
  ],
  "الكليات الإنسانية": [
    "الكلية التطبيقية", "كلية إدارة الأعمال", "كلية التربية", "كلية الشريعة وأصول الدين", "كلية اللغات والترجمة"
  ]
};
const COLLEGE_EN = {
  "كلية علوم الحاسب و نظم المعلومات": "College of Engineering",
 "كلية الهندسة": "College of Computer Science and Information Systems",
  "كلية العلوم والآداب": "College of Science and Arts",
  "كلية التمريض": "College of Nursing",
  "كلية الطب": "College of Medicine",
  "كلية الصيدلة": "College of Pharmacy",
  "كلية العلوم الطبية التطبيقية": "College of Applied Medical Sciences",
  "كلية طب الأسنان": "College of Dentistry",
  "الكلية التطبيقية": "Applied College",
  "كلية إدارة الأعمال": "College of Business Administration",
  "كلية التربية": "College of Education",
  "كلية الشريعة وأصول الدين": "College of Sharia and Fundamentals of Religion",
  "كلية اللغات والترجمة": "College of Languages and Translation"
};
const LOCATION_EN = {
};
const EQUIPMENT_EN = {
  "جهاز عرض": "Projector",
  "سبورة": "Whiteboard",
  "شاشة عرض": "Display",
  "مؤتمرات مرئية": "Video conferencing",
  "ميكروفونان": "Two microphones",
  "محطات عمل": "Workstations"
};
const MAINTENANCE_EN = {
  "كهرباء": "Electrical",
  "تكييف": "Air conditioning",
  "أثاث": "Furniture",
  "أجهزة": "Equipment",
  "سباكة": "Plumbing",
  "أخرى": "Other"
};
const RESOURCE_TYPES = {
  classroom: ["قاعة دراسية", "Classroom"],
  training: ["قاعة تدريب", "Training room"],
  theater: ["مسرح", "Theater"],
  laboratory: ["مختبر", "Laboratory"],
  vehicle: ["مركبة", "Vehicle"],
  equipment: ["أجهزة", "Equipment"]
};
const PAGE_INFO = {
  dashboard: ["نظرة عامة", "Overview"],
  planner: ["مخطط القاعات الافتراضي", "Virtual room planner"],
  resources: ["دليل الموارد", "Resource directory"],
  requests: ["طلباتي", "My requests"],
  services: ["الخدمات", "Services"],
  maintenance: ["الصيانة", "Maintenance"],
  transportation: ["النقل الجامعي", "Transportation"],
  notifications: ["الإشعارات", "Notifications"],
  profile: ["الملف الشخصي", "Personal profile"],
  login: ["تسجيل الدخول", "Sign in"],
  register: ["إنشاء حساب", "Create account"]
};
const NAV_ITEMS = [
  ["dashboard", "⌂"], ["planner", "▦"], ["resources", "◈"], ["requests", "≡"],
  ["services", "+"], ["maintenance", "⚒"], ["transportation", "↗"], ["notifications", "♧"], ["profile", "◉"]
];
const page = document.body.dataset.page || "dashboard";
const app = document.querySelector("#app");
let db;
let currentUser;
let currentResources = [];
let active3DViewers = [];
let language = readLanguage();

function isStudentRole(role) {
  return role === "student" || role === "faculty";
}

function isStaffRole(role) {
  return role === "facilities_staff" || role === "transport_staff";
}

function roomResources(resources = currentResources) {
  return resources.filter((resource) => ROOM_TYPES.includes(resource.type));
}

function vehicleResources(resources = currentResources) {
  return resources.filter((resource) => resource.type === "vehicle");
}

function busModelCapacities() {
  return [...new Set([...BUS_MODEL_CAPACITIES, ...vehicleResources().map((vehicle) => Number(vehicle.capacity)).filter(Number.isInteger)])].sort((a, b) => a - b);
}

function t(ar, en) {
  return language === "en" ? en : ar;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function readLanguage() {
  try {
    return sessionStorage.getItem("navu-language") === "en" ? "en" : "ar";
  } catch (error) {
    console.error("Language preference is unavailable.", error);
    return "ar";
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Browser storage is unavailable."));
      return;
    }
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = (event) => {
      const database = opening.result;
      const previousVersion = event.oldVersion;
      if (!database.objectStoreNames.contains("users")) {
        const users = database.createObjectStore("users", { keyPath: "id" });
        users.createIndex("email", "email", { unique: true });
        users.createIndex("universityId", "universityId", { unique: true });
      }
      if (!database.objectStoreNames.contains("requests")) {
        const requests = database.createObjectStore("requests", { keyPath: "id" });
        requests.createIndex("ownerId", "ownerId");
        requests.createIndex("department", "department");
      }
      if (!database.objectStoreNames.contains("notifications")) {
        const notifications = database.createObjectStore("notifications", { keyPath: "id" });
        notifications.createIndex("recipientId", "recipientId");
      }
      if (!database.objectStoreNames.contains("resources")) {
        const resources = database.createObjectStore("resources", { keyPath: "id" });
        resources.createIndex("type", "type");
      }
      if (previousVersion > 0 && previousVersion < 3) {
        opening.transaction.objectStore("resources").clear();
      }
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error || new Error("Could not open browser storage."));
    opening.onblocked = () => reject(new Error("Close other NavU tabs to finish a storage update."));
  });
}

function dbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Database operation failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Database transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Database transaction was cancelled."));
  });
}

async function getAll(storeName) {
  const tx = db.transaction(storeName, "readonly");
  const values = await dbRequest(tx.objectStore(storeName).getAll());
  await transactionDone(tx);
  return values;
}

async function getById(storeName, id) {
  const tx = db.transaction(storeName, "readonly");
  const value = await dbRequest(tx.objectStore(storeName).get(id));
  await transactionDone(tx);
  return value;
}

function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.error("Session storage is unavailable.", error);
    return null;
  }
}

function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    throw new Error(t("تعذر حفظ جلسة الدخول في هذا المتصفح.", "Could not save the sign-in session in this browser."));
  }
}

function sessionRemove(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error("Could not clear the current session.", error);
  }
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("");
}

function roleName(role) {
  const labels = ROLE_LABELS[role];
  if (!labels) return t("دور غير معيّن", "Unassigned role");
  return labels[language === "en" ? 1 : 0];
}

function statusName(status) {
  const labels = STATUS_LABELS[status] || STATUS_LABELS.submitted;
  return labels[language === "en" ? 1 : 0];
}

function departmentName(department) {
  const names = {
    facilities: ["الخدمات اللوجستية والمرافق", "Logistics and facilities"],
    transportation: ["النقل والحركة", "Transportation"],
    student: ["خدمات الطلاب", "Student services"],
    faculty: ["الخدمات الأكاديمية", "Academic services"]
  };
  const value = names[department] || names.facilities;
  return value[language === "en" ? 1 : 0];
}

function profileDepartmentName(value) {
  if (language !== "en") return value;
  const departments = {
    "الخدمات اللوجستية والمرافق": "Logistics and facilities",
    "النقل والحركة": "Transportation"
  };
  return COLLEGE_EN[value] || departments[value] || value;
}

function requestTypeName(value) {
  const typeMap = {
    "حجز قاعة": ["حجز قاعة", "Room booking"],
    "Room booking": ["حجز قاعة", "Room booking"],
    "طلب نقل": ["طلب نقل", "Transportation"],
    "Transportation": ["طلب نقل", "Transportation"],
    "طلب صيانة": ["طلب صيانة", "Maintenance"],
    "Maintenance": ["طلب صيانة", "Maintenance"],
    "طلب مستلزمات": ["طلب مستلزمات", "Supplies"],
    "Supplies": ["طلب مستلزمات", "Supplies"]
  };
  const labels = typeMap[value];
  return labels ? labels[language === "en" ? 1 : 0] : value;
}

function formatDate(value) {
  if (!value) return "—";
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat(language === "en" ? "en" : "ar-SA", { dateStyle: "medium" }).format(date);
}

function pageLink(route, label, icon = "") {
  const destination = route === "planner" ? "room-planner" : route;
  return `<a href="${destination}.html"${page === route ? ' aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`;
}

function renderShell(content) {
  const nav = NAV_ITEMS.filter(([route]) => {
    if (["dashboard", "requests", "resources", "notifications", "profile"].includes(route)) return true;
    if (route === "planner") return isStudentRole(currentUser.role) || currentUser.role === "facilities_staff";
    if (route === "services") return isStudentRole(currentUser.role);
    if (route === "maintenance") return isStudentRole(currentUser.role) || currentUser.role === "facilities_staff";
    if (route === "transportation") return isStudentRole(currentUser.role) || currentUser.role === "transport_staff";
    return false;
  }).map(([route, icon]) => pageLink(route, PAGE_INFO[route][language === "en" ? 1 : 0], icon)).join("");
  const userRole = roleName(currentUser.role);
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="dashboard.html" aria-label="NavU ${t("نظرة عامة", "Overview")}">
          <span class="brand-mark" aria-hidden="true">N</span>
          <span class="brand-copy"><b>NavU</b><strong>SMART UNIVERSITY LOGISTICS PLATFORM</strong><span>NAJRAN UNIVERSITY</span></span>
        </a>
        <nav class="side-nav" aria-label="${t("التنقل الرئيسي", "Main navigation")}">${nav}</nav>
        <div class="sidebar-bottom">
          <a href="profile.html">${t("إعدادات الحساب", "Account settings")}</a>
          <button type="button" data-action="logout">${t("تسجيل الخروج", "Sign out")}</button>
        </div>
      </aside>
      <div class="app-main">
        <header class="topbar">
          <h1 class="topbar-title">${PAGE_INFO[page][language === "en" ? 1 : 0]}</h1>
          <div class="topbar-actions">
            <button class="lang-button" type="button" data-action="language" aria-label="${t("التبديل إلى الإنجليزية", "Switch to Arabic")}">${language === "ar" ? "EN" : "عربي"}</button>
            <a class="user-chip" href="profile.html"><span class="avatar" aria-hidden="true">${escapeHtml(initials(currentUser.fullName))}</span><span class="user-name">${escapeHtml(currentUser.fullName)}</span><span class="muted">${escapeHtml(userRole)}</span></a>
          </div>
        </header>
        <main class="content">${content}</main>
      </div>
    </div>
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`;
}

function renderAuthShell(content) {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-brand" aria-label="NavU">
        <span class="brand-mark"><img src="NavUwhite.png" alt="NavU logo" width="69" height="48"></span>
        <p>${t("مساحة موحدة للخدمات والموارد الجامعية.", "One connected space for university services and resources.")}</p>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="section-title"><span></span><button class="lang-button" type="button" data-action="language">${language === "ar" ? "EN" : "عربي"}</button></div>
          ${content}
        </div>
      </section>
    </main>
    <div class="toast-region" aria-live="polite" aria-atomic="true"></div>`;
}

function toast(message, error = false) {
  const region = document.querySelector(".toast-region");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.setAttribute("role", error ? "alert" : "status");
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 4800);
}

function iconCard(href, icon, title, subtitle) {
  return `<a class="action-card" href="${href}"><span class="action-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><span>${subtitle}</span></a>`;
}

function statusPill(status) {
  const cls = status === "in-progress" ? "in-progress" : status;
  return `<span class="status ${escapeHtml(cls)}">${escapeHtml(statusName(status))}</span>`;
}

function heading(title, subtitle, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">NavU · ${t("الخدمات اللوجستية الجامعية", "University logistics")}</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function requestDepartment(type) {
  if (type === "طلب نقل") return "transportation";
  if (type === "طلب صيانة" || type === "طلب مستلزمات") return "facilities";
  if (type === "حجز قاعة") return "facilities";
  return "facilities";
}

function requestIsOpen(request) {
  return !["rejected", "cancelled", "completed"].includes(request.status);
}

function overlaps(date, start, end, request) {
  if (!date || !start || !end || request.date !== date || !request.startTime || !request.endTime) return false;
  return start < request.endTime && end > request.startTime;
}

function canSeeDepartmentRequests(role, request) {
  if (role === "facilities_staff") return ["facilities", "maintenance", "laboratory"].includes(request.department);
  if (role === "transport_staff") return request.department === "transportation";
  return false;
}

function visibleRequests(user, requests) {
  if (isStudentRole(user.role)) return requests.filter((request) => request.ownerId === user.id);
  return requests.filter((request) => canSeeDepartmentRequests(user.role, request));
}

function requestRows(requests, staff = false, resources = []) {
  if (!requests.length) {
    return `<tr><td colspan="7"><div class="empty-state">${t("لا توجد طلبات هنا حتى الآن.", "No requests to display yet.")}</div></td></tr>`;
  }
  return requests.sort((a, b) => b.createdAt - a.createdAt).map((request) => {
    let actions = staff ? `
      <div class="stack">
        ${currentUser.role === "facilities_staff" && request.type === "طلب صيانة"
          ? `<input type="text" data-status-note="${escapeHtml(request.id)}" aria-label="${t("ملاحظة تقدم الصيانة", "Maintenance progress note")}" placeholder="${t("ملاحظة التقدم أو العمل المنجز", "Progress or completed work note")}">`
          : ""}
        <div class="inline-form">
        <select aria-label="${t("تحديث حالة الطلب", "Update request status")}" data-status-select="${escapeHtml(request.id)}">
          ${STATUS_FLOW.map((status) => `<option value="${status}"${status === request.status ? " selected" : ""}>${escapeHtml(statusName(status))}</option>`).join("")}
        </select>
        <button class="button small" type="button" data-action="update-status" data-id="${escapeHtml(request.id)}">${t("حفظ", "Save")}</button>
        </div>
      </div>` : request.ownerId === currentUser.id && ["submitted", "review", "awaiting"].includes(request.status)
      ? `<button class="button small danger" type="button" data-action="cancel-request" data-id="${escapeHtml(request.id)}">${t("إلغاء", "Cancel")}</button>` : "—";
    if (staff && currentUser.role === "transport_staff" && request.department === "transportation") {
      const interval = timeRange(request);
      const busy = new Set(requests.filter((other) => other.id !== request.id && requestIsOpen(other) &&
        intervalsOverlap(interval, timeRange(other))).flatMap((other) => other.assignedVehicles || []));
      const unavailable = new Set(resources.filter((resource) => resource.available === false).map((resource) => resource.id));
      const assignment = `<div class="stack"><select multiple size="3" aria-label="${t("إسناد المركبات", "Assign vehicles")}" data-vehicle-select="${escapeHtml(request.id)}">${vehicleResources(resources).map((vehicle) => {
        const unavailableVehicle = unavailable.has(vehicle.id);
        const busyVehicle = busy.has(vehicle.id) && !request.assignedVehicles?.includes(vehicle.id);
        const disabled = (unavailableVehicle || busyVehicle) && !request.assignedVehicles?.includes(vehicle.id);
        const reason = unavailableVehicle ? t("غير متاحة", "Unavailable") : busyVehicle ? t("مسندة", "Assigned") : "";
        return `<option value="${vehicle.id}"${request.assignedVehicles?.includes(vehicle.id) ? " selected" : ""}${disabled ? " disabled" : ""}>${vehicle.id} · ${vehicle.capacity}${reason ? ` · ${reason}` : ""}</option>`;
      }).join("")}</select><button class="button small secondary" type="button" data-action="assign-vehicles" data-id="${escapeHtml(request.id)}">${t("إسناد", "Assign")}</button></div>`;
      actions = `<div class="stack">${actions}${assignment}</div>`;
    }
    const extra = request.resourceId ? ` · ${escapeHtml(request.resourceId)}` : "";
    const history = (request.history || []).map((entry) => `<li>${escapeHtml(statusName(entry.status))} · ${formatDate(entry.at)}${entry.actorName ? ` · ${escapeHtml(entry.actorName)}` : ""}${entry.detail ? ` · ${escapeHtml(entry.detail)}` : ""}</li>`).join("");
    const detailParts = [
      request.description, request.location, request.pickup && `${t("الانطلاق", "From")}: ${request.pickup}`,
      request.destination && `${t("الوجهة", "Destination")}: ${request.destination}`,
      request.passengers && `${t("الركاب", "Passengers")}: ${request.passengers}`,
      request.attendance && `${t("الحضور", "Attendance")}: ${request.attendance}`,
      request.equipment?.length && `${t("التجهيزات", "Equipment")}: ${request.equipment.join("، ")}`,
      request.assignedVehicles?.length && `${t("المركبات المسندة", "Assigned vehicles")}: ${request.assignedVehicles.join(", ")}`
    ].filter(Boolean).map(escapeHtml).join(" · ");
    return `<tr>
      <td><strong>${escapeHtml(request.id)}</strong></td>
      <td>${escapeHtml(requestTypeName(request.type))}<div class="muted small-text">${escapeHtml(request.detail || "")}${extra}</div>
        ${detailParts ? `<div class="muted small-text">${detailParts}</div>` : ""}
        <details class="request-history"><summary>${t("التفاصيل والسجل", "Details & history")}</summary><ul>${history || `<li>${escapeHtml(statusName(request.status))}</li>`}</ul>${request.layout && (isStudentRole(currentUser.role) || currentUser.role === "facilities_staff") ? `<a class="button secondary small" href="room-planner.html?requestId=${encodeURIComponent(request.id)}">${t("فتح المخطط المحفوظ", "Open saved layout")}</a>` : ""}</details>
      </td>
      <td>${formatDate(request.createdAt)}</td>
      <td>${escapeHtml(departmentName(request.department))}</td>
      <td>${statusPill(request.status)}</td>
      <td>${formatDate(request.updatedAt)}</td>
      <td>${actions}</td>
    </tr>`;
  }).join("");
}

function renderRequestTable(requests, staff = false, resources = []) {
  return `<div class="table-wrap"><table><thead><tr>
    <th>${t("رقم الطلب", "Request ID")}</th><th>${t("التفاصيل", "Details")}</th><th>${t("تاريخ التقديم", "Submitted")}</th>
    <th>${t("القسم المسؤول", "Department")}</th><th>${t("الحالة", "Status")}</th><th>${t("آخر تحديث", "Updated")}</th><th>${t("الإجراء", "Action")}</th>
  </tr></thead><tbody>${requestRows(requests, staff, resources)}</tbody></table></div>`;
}

function renderDashboard(requests) {
  const own = visibleRequests(currentUser, requests);
  const counts = {
    all: own.length,
    pending: own.filter((item) => ["submitted", "review", "awaiting"].includes(item.status)).length,
    approved: own.filter((item) => item.status === "approved").length,
    progress: own.filter((item) => item.status === "in-progress").length,
    completed: own.filter((item) => item.status === "completed").length
  };
  const recent = own.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const staffRole = isStaffRole(currentUser.role);
  const quickActions = [
    ...(isStudentRole(currentUser.role) ? [iconCard("services.html", "+", t("تقديم طلب", "New request"), t("اختر خدمة جامعية", "Choose a university service"))] : []),
    ...(currentUser.role !== "transport_staff" ? [iconCard("room-planner.html", "▦", t("مخطط القاعات", "Room planner"), t("صمّم ترتيب المقاعد", "Plan a seating layout"))] : []),
    ...(currentUser.role !== "facilities_staff" ? [iconCard("transportation.html", "↗", t("النقل الجامعي", "University transport"), t("قدّم أو تابع طلب رحلة", "Create or track a trip request"))] : []),
    iconCard("resources.html", "◈", t("دليل الموارد", "Resource directory"), t("ابحث في الموارد المسجلة", "Browse registered resources")),
    iconCard("requests.html", "≡", t("متابعة الطلبات", "Track requests"), t("اعرض الحالات والتحديثات", "See statuses and updates"))
  ].join("");
  const dept = staffRole ? `<section class="card"><div class="section-title"><h2>${t("مساحة القسم", "Department workspace")}</h2><span class="tag">${escapeHtml(roleName(currentUser.role))}</span></div>
      <p>${t("تظهر هنا الطلبات المصرح بها لقسمك فقط.", "Only requests authorized for your department appear here.")}</p>
      ${renderRequestTable(own.slice(0, 6), isStaffRole(currentUser.role))}</section>` : "";
  const submitAction = isStudentRole(currentUser.role) ? `<a class="button" href="services.html">${t("＋ تقديم طلب", "＋ New request")}</a>` : "";
  return `${heading(`${t("مرحباً", "Welcome")}، ${escapeHtml(currentUser.fullName)}`, `${escapeHtml(roleName(currentUser.role))} · ${escapeHtml(profileDepartmentName(currentUser.department))}`, submitAction)}
    <section class="stats">
      ${[
        [t("إجمالي الطلبات", "Total requests"), counts.all, ""],
        [t("قيد الانتظار", "Pending"), counts.pending, "gold"],
        [t("معتمدة", "Approved"), counts.approved, "green"],
        [t("قيد التنفيذ", "In progress"), counts.progress, ""],
        [t("مكتملة", "Completed"), counts.completed, "green"]
      ].map(([label, value, color]) => `<article class="stat-card"><span class="stat-label"><i class="stat-mark ${color}"></i>${label}</span><strong class="stat-value">${value}</strong></article>`).join("")}
    </section>
    <section class="card"><div class="section-title"><h2>${t("الوصول السريع", "Quick access")}</h2></div><div class="quick-actions">${quickActions}</div></section>
    <section class="grid grid-2">
      <article class="card"><div class="section-title"><h2>${t("أحدث الطلبات", "Recent requests")}</h2><a href="requests.html">${t("عرض الكل", "View all")} →</a></div>${renderRequestTable(recent)}</article>
      <article class="card"><div class="section-title"><h2>${t("آخر الإشعارات", "Latest notifications")}</h2><a href="notifications.html">${t("عرض الإشعارات", "View notifications")} →</a></div><div id="dashboard-notifications" class="stack"></div></article>
    </section>
    ${dept}`;
}

function field(label, name, type = "text", required = true, attrs = "") {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label><input id="${name}" name="${name}" type="${type}" ${required ? "required" : ""} ${attrs}></div>`;
}

function selectField(label, name, options, required = true) {
  return `<div class="field"><label for="${name}">${label}${required ? " *" : ""}</label><select id="${name}" name="${name}" ${required ? "required" : ""}>${options}</select></div>`;
}

function roleOptions(selected = "") {
  return Object.entries(ROLE_LABELS).map(([key, labels]) =>
    `<option value="${key}"${key === selected ? " selected" : ""}>${labels[language === "en" ? 1 : 0]}</option>`
  ).join("");
}

function collegeOptions() {
  return `<option value="">${t("اختر الكلية", "Select a college")}</option>` + Object.entries(COLLEGES).map(([group, colleges]) =>
    `<optgroup label="${escapeHtml(language === "en" ? ({
      "الكليات العلمية": "Scientific colleges", "الكليات الصحية": "Health colleges", "الكليات الإنسانية": "Humanities colleges"
    })[group] : group)}">${colleges.map((college) => `<option value="${escapeHtml(college)}">${escapeHtml(language === "en" ? COLLEGE_EN[college] : college)}</option>`).join("")}</optgroup>`
  ).join("");
}

function renderLogin() {
  renderAuthShell(`<h2>${t("تسجيل الدخول", "Sign in")}</h2><p>${t("أدخل بيانات حسابك للمتابعة إلى NavU.", "Sign in to continue to NavU.")}</p>
    <form data-form="login">
      <div class="field-grid">
        ${field(t("اسم المستخدم ", "Username"), "username", "text")}
        ${field(t("كلمة المرور", "Password"), "password", "password")}
      </div>
      <div class="form-actions"><button class="button" type="submit">${t("دخول", "Sign in")}</button></div>
    </form>
    <p class="auth-switch">${t("ليس لديك حساب؟", "New to NavU?")} <a href="register.html">${t("إنشاء حساب", "Create an account")}</a></p>`);
}

function renderRegister() {
  const groupNames = {
    "الكليات العلمية": "Scientific colleges",
    "الكليات الصحية": "Health colleges",
    "الكليات الإنسانية": "Humanities colleges"
  };
  const groups = Object.entries(COLLEGES).map(([group, colleges]) =>
    `<optgroup label="${escapeHtml(language === "en" ? groupNames[group] : group)}">${colleges.map((college) => `<option value="${escapeHtml(college)}">${escapeHtml(language === "en" ? COLLEGE_EN[college] : college)}</option>`).join("")}</optgroup>`
  ).join("");
  const departments = ["الخدمات اللوجستية والمرافق", "النقل والحركة"];
  const departmentOptions = departments.map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(language === "en" ? ({
    "الخدمات اللوجستية والمرافق": "Logistics and facilities", "النقل والحركة": "Transportation"
  })[department] : department)}</option>`).join("");
  renderAuthShell(`<h2>${t("إنشاء حساب NavU", "Create your NavU account")}</h2><p>${t("أكمل بياناتك لإنشاء ملفك الشخصي.", "Enter your details to create your profile.")}</p>
    <form data-form="register">
      <div class="field-grid">
        ${field(t("الاسم الكامل", "Full name"), "fullName")}
        ${field(t("الرقم الجامعي أو الوظيفي", "University or employee ID"), "universityId")}
        ${field(t("رقم الجوال", "Mobile number"), "mobile", "tel")}
        ${field(t("البريد الإلكتروني", "Email address"), "email", "email")}
        ${selectField(t("الكلية أو الإدارة", "College or department"), "department", `<option value="">${t("اختر الكلية أو الإدارة", "Select a college or department")}</option>${groups}<optgroup label="${t("الإدارات", "Departments")}">${departmentOptions}</optgroup>`)}
        ${selectField(t("الدور الوظيفي", "User role"), "role", `<option value="">${t("اختر الدور", "Select a role")}</option>${roleOptions()}`)}
        ${field(t("كلمة المرور (8 أحرف على الأقل)", "Password (at least 8 characters)"), "password", "password", true, "minlength=\"8\" autocomplete=\"new-password\"")}
        ${field(t("تأكيد كلمة المرور", "Confirm password"), "confirmPassword", "password", true, "minlength=\"8\" autocomplete=\"new-password\"")}
      </div>
      <div class="form-actions"><button class="button" type="submit">${t("إنشاء الحساب", "Create account")}</button></div>
    </form>
    <p class="auth-switch">${t("لديك حساب بالفعل؟", "Already registered?")} <a href="login.html">${t("تسجيل الدخول", "Sign in")}</a></p>`);
}

function serviceCards() {
  return `<div class="grid grid-2">
    ${iconCard("services.html?type=room", "▦", t("حجز قاعة أو مرفق", "Room or facility booking"), t("قاعات دراسية، مختبرات، تدريب ومسارح", "Classrooms, labs, training rooms and theaters"))}
    ${iconCard("transportation.html", "↗", t("طلب نقل جامعي", "University transportation"), t("رحلة ومركبات مناسبة لعدد الركاب", "Trips and suitable vehicle capacities"))}
    ${iconCard("maintenance.html", "⚒", t("طلب صيانة", "Maintenance request"), t("أرسل تفاصيل العطل وموقعه", "Report a facility or equipment issue"))}
    ${iconCard("services.html?type=equipment", "◈", t("أجهزة ومستلزمات", "Equipment and supplies"), t("اطلب احتياجاتك الأكاديمية", "Request academic supplies"))}
  </div>`;
}

function renderServices() {
  const type = new URLSearchParams(location.search).get("type");
  if (!isStudentRole(currentUser.role)) {
    return `${heading(t("الخدمات", "Services"), t("ليس لديك صلاحية لإنشاء طلبات أكاديمية.", "Your role cannot submit academic requests."))}<section class="card"><p>${t("يمكنك متابعة طلبات القسم من مساحة العمل.", "Use your department workspace to manage requests.")}</p></section>`;
  }
  const formContent = type === "room" ? roomBookingForm() : type === "equipment" ? equipmentForm() : "";
  return `${heading(t("الخدمات الجامعية", "University services"), t("اختر الخدمة لفتح نموذج الطلب المناسب.", "Choose a service to open its request form."))}
    ${formContent ? `<section class="card">${formContent}</section>` : `<section class="card"><div class="section-title"><h2>${t("تقديم طلب", "Create a request")}</h2></div>${serviceCards()}</section>`}`;
}

function roomBookingForm() {
  const types = Object.entries(RESOURCE_TYPES).filter(([key]) => ["classroom", "training", "theater", "laboratory"].includes(key))
    .map(([key, names]) => `<option value="${key}">${names[language === "en" ? 1 : 0]}</option>`).join("");
  const equipment = [
    ["projector", "جهاز عرض", "Projector"], ["microphone", "ميكروفون", "Microphone"],
    ["display", "شاشة عرض", "Display"], ["whiteboard", "سبورة", "Whiteboard"], ["conference", "مؤتمرات مرئية", "Video conferencing"]
  ];
  return `<div class="section-title"><div><h2>${t("طلب حجز مرفق", "Facility booking request")}</h2><p class="muted small-text">${t("يعرض هذا المتصفح المرافق والطلبات المسجلة فيه فقط، وليس جدول الجامعة المباشر.", "This browser shows only facilities and requests saved here, not the live university schedule.")}</p></div><a class="button secondary small" href="services.html">${t("كل الخدمات", "All services")}</a></div>
    <form data-form="request" data-request-type="room">
      <div class="field-grid">
        ${field(t("اسم المقرر أو الفعالية", "Course or event name"), "eventTitle")}
        ${selectField(t("نوع المرفق", "Facility type"), "facilityType", types)}
        ${selectField(t("الكلية", "College"), "college", collegeOptions())}
        ${field(t("التاريخ", "Date"), "date", "date")}
        ${field(t("وقت البداية", "Start time"), "startTime", "time")}
        ${field(t("وقت النهاية", "End time"), "endTime", "time")}
        ${field(t("الحضور المتوقع", "Expected attendance"), "attendance", "number", true, 'min="1" max="60"')}
        <div class="field"><label for="roomResource">${t("المرفق المقترح", "Requested facility")} *</label><select name="resourceId" id="roomResource" required></select></div>
        <div class="field full"><span class="muted small-text" id="room-availability" aria-live="polite">${t("اختر التاريخ والوقت لعرض التوفر والبدائل.", "Choose a date and time to see availability and alternatives.")}</span></div>
        <div class="field full"><div id="booking-room-viewer" class="room-plan three-viewer" data-label="${t("معاينة القاعة ثلاثية الأبعاد", "3D room preview")}">
          <div class="viewer-canvas"></div><div class="viewer-controls"><span>${t("اسحب للتدوير · مرر للتكبير", "Drag to rotate · scroll to zoom")}</span><button type="button" class="button secondary small" data-viewer-reset>${t("إعادة ضبط الكاميرا", "Reset camera")}</button></div>
        </div></div>
        <div class="field full"><label>${t("التجهيزات المطلوبة", "Required equipment")}</label><div class="equipment-list">${equipment.map(([key, ar, en]) => `<label class="check-row"><input type="checkbox" name="equipment" value="${key}">${t(ar, en)}</label>`).join("")}</div></div>
        <div class="field full">${field(t("ملاحظات", "Notes"), "notes", "text", false)}</div>
      </div>
      <div class="notice">${t("يتم حفظ مخطط المقاعد والتجهيزات المحددة مع الطلب.", "The selected seating plan and equipment are stored with the request.")}</div>
      <div class="form-actions"><button class="button" type="submit">${t("إرسال طلب الحجز", "Submit booking request")}</button><a class="button secondary" href="room-planner.html">${t("فتح مخطط القاعات", "Open room planner")}</a></div>
    </form>`;
}

function equipmentForm() {
  return `<div class="section-title"><div><h2>${t("طلب أجهزة ومستلزمات", "Equipment and supplies request")}</h2><p class="muted small-text">${t("حدد احتياجك الأكاديمي.", "Describe the items you need for academic use.")}</p></div></div>
    <form data-form="request" data-request-type="equipment">
      <div class="field-grid">
        ${field(t("اسم الجهاز أو المستلزم", "Item or equipment name"), "item")}
        ${field(t("الكمية", "Quantity"), "quantity", "number", true, 'min="1" max="500"')}
        ${field(t("التاريخ المطلوب", "Required date"), "date", "date")}
        ${field(t("الموقع", "Location"), "location")}
        ${field(t("المقرر أو الفعالية", "Course or event"), "event", "text", false)}
        <div class="field full"><label for="intendedUse">${t("الغرض من الاستخدام", "Intended use")} *</label><textarea id="intendedUse" name="intendedUse" required></textarea></div>
        <div class="field full"><label for="notes">${t("ملاحظات إضافية", "Additional notes")}</label><textarea id="notes" name="notes"></textarea></div>
      </div><div class="form-actions"><button class="button" type="submit">${t("إرسال طلب المستلزمات", "Submit supplies request")}</button></div>
    </form>`;
}

function maintenanceForm() {
  const categories = ["كهرباء", "تكييف", "أثاث", "أجهزة", "سباكة", "أخرى"].map((value) =>
    `<option value="${value}">${language === "en" ? MAINTENANCE_EN[value] : value}</option>`
  ).join("");
  return `<section class="card"><div class="section-title"><div><h2>${t("بلاغ صيانة جديد", "New maintenance request")}</h2><p class="muted small-text">${t("أدخل الموقع ووصف المشكلة لمساعدة الفريق المختص.", "Add the location and problem details for the maintenance team.")}</p></div></div>
    <form data-form="request" data-request-type="maintenance">
      <div class="field-grid">
        ${field(t("عنوان الطلب", "Request title"), "title")}
        ${field(t("المبنى أو موقع العطل", "Building or issue location"), "location")}
        ${selectField(t("فئة الصيانة", "Maintenance category"), "category", categories)}
        ${selectField(t("الأولوية", "Priority"), "priority", `<option value="normal">${t("عادية", "Normal")}</option><option value="high">${t("مرتفعة", "High")}</option><option value="urgent">${t("عاجلة", "Urgent")}</option>`)}
        <div class="field full"><label for="description">${t("وصف المشكلة", "Problem description")} *</label><textarea id="description" name="description" required></textarea></div>
        <div class="field"><label for="photo">${t("صورة اختيارية", "Optional photo")}</label><input id="photo" name="photo" type="file" accept="image/*"></div>
        <div class="field"><label for="notes">${t("ملاحظات إضافية", "Additional notes")}</label><input id="notes" name="notes" type="text"></div>
      </div><div class="form-actions"><button class="button" type="submit">${t("إرسال بلاغ الصيانة", "Submit maintenance request")}</button></div>
    </form></section>`;
}

function renderMaintenance(requests) {
  const staff = currentUser.role === "facilities_staff";
  const visible = staff ? requests.filter((item) => item.type === "طلب صيانة") : requests.filter((item) => item.ownerId === currentUser.id && item.type === "طلب صيانة");
  return `${heading(t("خدمات الصيانة", "Maintenance services"), staff ? t("راجع بلاغات الصيانة المصرح بها وحدّث حالتها.", "Review authorized maintenance requests and update their status.") : t("أرسل بلاغاً جديداً أو تابع حالة بلاغاتك.", "Submit an issue or track your existing requests."), staff ? "" : `<a class="button" href="#maintenance-form">${t("＋ بلاغ جديد", "＋ New report")}</a>`)}
    ${staff ? `<section class="card"><div class="section-title"><h2>${t("بلاغات القسم", "Department requests")}</h2><span class="tag">${visible.length} ${t("طلب", "requests")}</span></div>${renderRequestTable(visible, true)}</section>` : ""}
    <div id="maintenance-form">${maintenanceForm()}</div>`;
}

function transportationForm() {
  return `<section class="card"><div class="section-title"><div><h2>${t("طلب نقل جامعي", "University transportation request")}</h2><p class="muted small-text">${t("تظهر اقتراحات المركبات المسجلة والمتاحة فقط.", "Only registered, available vehicles are suggested.")}</p></div></div>
    <form data-form="request" data-request-type="transport">
      <div class="field-grid">
        ${field(t("عنوان الطلب أو الغرض", "Request title or purpose"), "title")}
        ${field(t("عدد الركاب", "Passenger count"), "passengers", "number", true, 'min="1" max="150"')}
        ${field(t("موقع الانطلاق", "Pickup location"), "pickup")}
        ${field(t("الوجهة", "Destination"), "destination")}
        ${field(t("موعد الذهاب", "Departure"), "departure", "datetime-local")}
        ${field(t("موعد العودة (اختياري)", "Return (optional)"), "returnAt", "datetime-local", false)}
        <div class="field full"><label for="notes">${t("ملاحظات إضافية", "Additional notes")}</label><textarea id="notes" name="notes"></textarea></div>
      </div>
      <section class="card"><div class="section-title"><h3>${t("اقتراح المركبات", "Vehicle suggestions")}</h3><span id="combined-capacity" class="tag">${t("أدخل العدد لعرض الاقتراح", "Enter passenger count")}</span></div><div id="vehicle-suggestions" class="grid grid-3"></div></section>
      <section class="card"><div class="section-title"><h3>${t("معاينة داخلية ثلاثية الأبعاد", "3D bus interior preview")}</h3><label class="field bus-model-choice"><span>${t("سعة نموذج العرض، وليست مركبة مسندة", "Visualization seat count, not an assigned vehicle")}</span><select id="bus-model-capacity">${busModelCapacities().map((capacity) => `<option value="${capacity}">${capacity} ${t("مقعداً للركاب", "passenger seats")}</option>`).join("")}</select></label></div>
        <p class="tag" id="bus-capacity-summary"></p>
        <div id="bus-viewer" class="room-plan three-viewer bus-viewer" data-label="${t("نموذج حافلة ثلاثي الأبعاد", "3D bus interior")}">
          <div class="viewer-canvas"></div><div class="viewer-controls"><span>${t("اسحب للتدوير · مرر للتكبير", "Drag to rotate · scroll to zoom")}</span><button type="button" class="button secondary small" data-viewer-reset>${t("إعادة ضبط الكاميرا", "Reset camera")}</button></div>
        </div>
      </section>
      <div class="form-actions"><button class="button" type="submit">${t("إرسال طلب النقل", "Submit transportation request")}</button></div>
    </form></section>`;
}

function renderTransportation(requests, resources) {
  const isStaff = currentUser.role === "transport_staff";
  const visible = isStaff ? requests.filter((item) => item.department === "transportation") : requests.filter((item) => item.ownerId === currentUser.id && item.department === "transportation");
  const staffPanel = isStaff ? `<section class="card"><div class="section-title"><h2>${t("طلبات النقل", "Transportation requests")}</h2></div>${renderRequestTable(visible, true, resources)}</section>
    <section class="card"><h2>${t("أسطول المركبات", "Vehicle fleet")}</h2><div class="resource-grid">${vehicleResources(resources).map(resourceCard).join("") || `<div class="empty-state">${t("لا توجد مركبات مسجلة.", "No vehicles are registered.")}</div>`}</div></section>` : "";
  return `${heading(t("النقل والحركة", "Transportation and movement"), isStaff ? t("إدارة طلبات الرحلات ومركبات القسم.", "Manage trip requests and departmental vehicles.") : t("قدّم طلب رحلة جامعية وحدد تفاصيل التنقل.", "Request a university trip and provide travel details."))}
    ${transportationForm()}${staffPanel}`;
}

function resourceTypeOptions() {
  return `<option value="">${t("كل الأنواع", "All types")}</option>` + Object.entries(RESOURCE_TYPES).map(([key, names]) => `<option value="${key}">${names[language === "en" ? 1 : 0]}</option>`).join("");
}

function resourceAvailabilityControl(resource, available) {
  const canManage = currentUser.role === "transport_staff" && resource.type === "vehicle" ||
    currentUser.role === "facilities_staff" && ROOM_TYPES.includes(resource.type);
  const tag = `<span class="status ${available ? "approved" : "rejected"}">${available ? t("متاح في السجل المحلي", "Available in local records") : t("غير متاح في السجل المحلي", "Unavailable in local records")}</span>`;
  return canManage
    ? `<div class="button-row">${tag}<button class="button small secondary" type="button" data-action="resource-toggle" data-id="${escapeHtml(resource.id)}" data-available="${String(available)}">${available ? t("إيقاف الإتاحة", "Set unavailable") : t("إتاحة المورد", "Set available")}</button></div>`
    : tag;
}

function resourceCard(resource) {
  const name = language === "en" && resource.nameEn ? resource.nameEn : resource.name;
  const type = RESOURCE_TYPES[resource.type]?.[language === "en" ? 1 : 0] || resource.type;
  const location = language === "en" ? (resource.locationEn || LOCATION_EN[resource.location] || resource.location) : resource.location;
  const capacity = resource.capacity ? `<span class="tag">${t("السعة", "Capacity")}: ${resource.capacity}</span>` : "";
  const translatedEquipment = (resource.equipment || []).map((item) => language === "en" ? (EQUIPMENT_EN[item] || item) : item);
  const details = resource.equipment ? translatedEquipment.join(" · ") :
    language === "en" ? (EQUIPMENT_EN[resource.specification] || resource.specification) : resource.specification;
  return `<article class="resource-card" data-resource-card data-type="${escapeHtml(resource.type)}" data-location="${escapeHtml(location)}" data-capacity="${resource.capacity || 0}" data-search="${escapeHtml(`${name} ${resource.id} ${location} ${type} ${details || ""}`.toLowerCase())}">
    <div class="section-title"><span class="tag">${escapeHtml(type)}</span>${resourceAvailabilityControl(resource, resource.available !== false)}</div>
    <h3>${escapeHtml(name)}</h3><span class="muted small-text">${escapeHtml(resource.id)} · ${escapeHtml(location)}</span>
    <div class="resource-meta">${capacity}${translatedEquipment.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
    <p class="small-text">${escapeHtml(details || "")}</p>
    <div class="qr-card">${qrSvg(resource.id)}<small>${t("رمز المورد", "Resource QR")}<br>${escapeHtml(resource.id)}</small></div>
  </article>`;
}

function renderResources(savedResources) {
  const assets = savedResources.filter((resource) =>
    currentUser.role === "transport_staff" ? resource.type === "vehicle" :
      currentUser.role === "facilities_staff" ? resource.type !== "vehicle" : true
  );
  const editor = currentUser.role === "facilities_staff" || currentUser.role === "transport_staff" ? resourceEditorForm() : "";
  return `${heading(t("دليل الموارد", "Resource directory"))}
    ${editor}
    <section class="card">
      <div class="filter-bar">
        <input id="resource-search" type="search" placeholder="${t("ابحث بالاسم أو الرمز أو الموقع", "Search name, ID or location")}" aria-label="${t("البحث في الموارد", "Search resources")}">
        <select id="resource-type" aria-label="${t("نوع المورد", "Resource type")}">${resourceTypeOptions()}</select>
        <select id="resource-location" aria-label="${t("الموقع", "Location")}"><option value="">${t("كل المواقع", "All locations")}</option>${[...new Set(assets.map((a) => language === "en" ? (a.locationEn || a.location) : a.location))].map((loc) => `<option>${escapeHtml(loc)}</option>`).join("")}</select>
        <input id="resource-capacity" type="number" min="1" placeholder="${t("السعة الدنيا", "Min capacity")}" aria-label="${t("السعة الدنيا", "Minimum capacity")}">
      </div>
      <div id="resource-grid" class="resource-grid">${assets.map(resourceCard).join("")}</div>
      <p id="resource-empty" class="empty-state"${assets.length ? " hidden" : ""}>${assets.length ? t("لا توجد موارد مطابقة للفلاتر.", "No resources match these filters.") : t("لا توجد موارد مسجلة لهذا العرض.", "No resources are registered for this view.")}</p>
    </section>`;
}

function resourceEditorForm() {
  const isTransport = currentUser.role === "transport_staff";
  const types = isTransport ? ["vehicle"] : [...ROOM_TYPES, "equipment"];
  const typeOptions = types.map((type) => `<option value="${type}">${RESOURCE_TYPES[type][language === "en" ? 1 : 0]}</option>`).join("");
  return `<section class="card"><h2>${t("إضافة مورد من السجل المعتمد", "Add an entry from the authorized inventory")}</h2>
    <form data-form="resource"><div class="field-grid">
      ${field(t("معرّف المورد", "Resource ID"), "resourceId")}
      ${field(t("الاسم", "Name"), "name")}
      ${selectField(t("النوع", "Type"), "type", typeOptions)}
      ${field(t("الموقع", "Location"), "location")}
      ${field(t("السعة (للقاعات والمركبات)", "Capacity (rooms and vehicles)"), "capacity", "number", false, 'min="1" max="60"')}
      ${field(t("المواصفات أو التجهيزات", "Specifications or equipment"), "specification", "text", false)}
    </div><div class="form-actions"><button class="button" type="submit">${t("حفظ المورد", "Save resource")}</button></div></form>
  </section>`;
}

function qrSvg(payload) {
  const bytes = [...new TextEncoder().encode(payload)];
  if (bytes.length > 17) return `<svg viewBox="0 0 21 21" role="img" aria-label="QR"><text x="1" y="12">ID</text></svg>`;
  const data = [];
  const appendBits = (value, count) => { for (let bit = count - 1; bit >= 0; bit -= 1) data.push((value >>> bit) & 1); };
  appendBits(4, 4);
  appendBits(bytes.length, 8);
  bytes.forEach((byte) => appendBits(byte, 8));
  appendBits(0, Math.min(4, 152 - data.length));
  while (data.length % 8) data.push(0);
  const codewords = [];
  for (let i = 0; i < data.length; i += 8) {
    codewords.push(data.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; codewords.length < 19; pad += 1) codewords.push(pad % 2 ? 0x11 : 0xec);
  const multiply = (x, y) => {
    let result = 0;
    for (let i = 7; i >= 0; i -= 1) {
      result = (result << 1) ^ ((result >>> 7) * 0x11d);
      if (((y >>> i) & 1) === 1) result ^= x;
    }
    return result;
  };
  let generator = [1];
  let root = 1;
  for (let i = 0; i < 7; i += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= multiply(coefficient, root);
    });
    generator = next;
    root = multiply(root, 2);
  }
  const remainder = Array(7).fill(0);
  codewords.forEach((byte) => {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    generator.slice(1).forEach((coefficient, index) => { remainder[index] ^= multiply(coefficient, factor); });
  });
  const bits = [...codewords, ...remainder].flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  const size = 21;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const set = (row, col, value) => { if (row >= 0 && row < size && col >= 0 && col < size) matrix[row][col] = value; };
  const finder = (top, left) => {
    for (let row = -1; row <= 7; row += 1) for (let col = -1; col <= 7; col += 1) {
      const outer = row >= 0 && row <= 6 && col >= 0 && col <= 6 &&
        (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4));
      set(top + row, left + col, outer);
    }
  };
  finder(0, 0); finder(0, 14); finder(14, 0);
  for (let i = 8; i < 13; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const formatData = 8;
  let formatRemainder = formatData << 10;
  for (let bit = 14; bit >= 10; bit -= 1) if ((formatRemainder >>> bit) & 1) formatRemainder ^= 0x537 << (bit - 10);
  const format = ((formatData << 10) | formatRemainder) ^ 0x5412;
  for (let i = 0; i <= 5; i += 1) set(i, 8, (format >>> i) & 1);
  set(7, 8, (format >>> 6) & 1); set(8, 8, (format >>> 7) & 1); set(8, 7, (format >>> 8) & 1);
  for (let i = 9; i < 15; i += 1) set(8, 14 - i, (format >>> i) & 1);
  for (let i = 0; i < 8; i += 1) set(8, size - 1 - i, (format >>> i) & 1);
  for (let i = 8; i < 15; i += 1) set(size - 15 + i, 8, (format >>> i) & 1);
  set(13, 8, true);
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (matrix[row][col] !== null) continue;
        const value = bits[bitIndex++] || 0;
        set(row, col, Boolean(value ^ (((row + col) % 2) === 0)));
      }
    }
    upward = !upward;
  }
  const cells = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); }));
  return `<svg viewBox="-4 -4 29 29" role="img" aria-label="${t("رمز QR للمورد", "Resource QR code")}"><rect x="-4" y="-4" width="29" height="29" fill="#fff"/>${cells.join("")}</svg>`;
}

function renderRequests(requests) {
  const staff = isStaffRole(currentUser.role);
  const items = visibleRequests(currentUser, requests);
  const canManage = isStaffRole(currentUser.role);
  const action = staff ? "" : `<a class="button" href="services.html">${t("＋ طلب جديد", "＋ New request")}</a>`;
  return `${heading(t("متابعة الطلبات", "Request tracking"), staff ? t("السجلات المعروضة مقصورة على صلاحيات قسمك.", "Records are limited to your department permissions.") : t("تابع حالات الطلبات وسجل التحديثات.", "Track statuses and request updates."), action)}
    <section class="card"><div class="section-title"><h2>${staff ? t("الطلبات المسندة إلى القسم", "Department requests") : t("سجل الطلبات", "Request history")}</h2><span class="tag">${items.length} ${t("طلب", "requests")}</span></div>${renderRequestTable(items, canManage)}
    <p class="muted small-text">${t("الحالات: مُرسل، قيد المراجعة، بانتظار الموافقة، معتمد، قيد التنفيذ، مكتمل، مرفوض، ملغى.", "Statuses: submitted, under review, awaiting approval, approved, in progress, completed, rejected and cancelled.")}</p></section>`;
}

function renderNotifications(notifications) {
  const visible = notifications.filter((notice) => notice.recipientId === currentUser.id ||
    isStaffRole(currentUser.role) && canSeeDepartmentRequests(currentUser.role, { department: notice.department }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return `${heading(t("مركز الإشعارات", "Notification center"), t("تحديثات الطلبات والتنبيهات المرتبطة بحسابك.", "Request updates and alerts associated with your account."))}
    <section class="card"><div class="section-title"><h2>${t("الإشعارات", "Notifications")}</h2><button class="button secondary small" type="button" data-action="mark-read">${t("تحديد الكل كمقروء", "Mark all as read")}</button></div>
      <div class="stack">${visible.length ? visible.map((notice) => renderNotice(notice, true)).join("") : `<div class="empty-state">${t("لا توجد إشعارات جديدة.", "There are no notifications yet.")}</div>`}</div>
    </section>`;
}

function renderNotice(notice, detailed = false) {
  const titles = {
    "request-created": t("تم استلام الطلب", "Request received"),
    "department-request": t("طلب جديد للقسم", "New department request"),
    "status-updated": t("تم تحديث حالة الطلب", "Request status updated"),
    "vehicles-assigned": t("تم إسناد مركبات للطلب", "Vehicles assigned to your request")
  };
  let message = notice.message;
  if (notice.kind === "request-created" || notice.kind === "department-request") {
    message = `${requestTypeName(notice.requestType)}: ${notice.detail}`;
  } else if (notice.kind === "status-updated") {
    message = `${notice.requestId}: ${statusName(notice.status)}${notice.detail ? ` · ${notice.detail}` : ""}`;
  } else if (notice.kind === "vehicles-assigned") {
    message = `${notice.requestId}: ${notice.detail}`;
  }
  const title = titles[notice.kind] || notice.title;
  return `<article class="resource-card"><div class="section-title"><strong>${escapeHtml(title)}</strong>${detailed ? `<span class="tag">${formatDate(notice.createdAt)}</span>` : ""}</div><p>${escapeHtml(message || "")}</p>${detailed && notice.requestId ? `<a href="requests.html">${t("عرض الطلب", "View request")} ${escapeHtml(notice.requestId)} →</a>` : ""}</article>`;
}

function renderProfile() {
  const departmentLabel = profileDepartmentName(currentUser.department);
  return `${heading(t("الملف الشخصي", "Personal profile"), t("حدّث معلومات الاتصال المسموح بها.", "Update your permitted contact information."))}
    <section class="card"><div class="section-title"><h2>${t("بيانات الحساب", "Account details")}</h2><span class="tag">${escapeHtml(roleName(currentUser.role))}</span></div>
      <div class="user-chip"><span class="avatar" aria-hidden="true">${escapeHtml(initials(currentUser.fullName))}</span><strong>${escapeHtml(currentUser.fullName)}</strong></div>
      <form data-form="profile"><div class="field-grid">
        ${field(t("الاسم الكامل", "Full name"), "fullName", "text", false, `value="${escapeHtml(currentUser.fullName)}" readonly`)}
        ${field(t("الرقم الجامعي أو الوظيفي", "University or employee ID"), "universityId", "text", false, `value="${escapeHtml(currentUser.universityId)}" readonly`)}
        ${field(t("الدور", "Role"), "role", "text", false, `value="${escapeHtml(roleName(currentUser.role))}" readonly`)}
        ${field(t("الكلية أو الإدارة", "College or department"), "department", "text", false, `value="${escapeHtml(departmentLabel)}" readonly`)}
        ${field(t("رقم الجوال", "Mobile number"), "mobile", "tel", true, `value="${escapeHtml(currentUser.mobile)}"`)}
        ${field(t("البريد الإلكتروني", "Email address"), "email", "email", true, `value="${escapeHtml(currentUser.email)}" readonly`)}
        <div class="field full"><label for="title">${t("التخصص الأكاديمي أو المسمى الوظيفي", "Academic specialization or job title")}</label><input id="title" name="title" value="${escapeHtml(currentUser.title || "")}"></div>
      </div><div class="form-actions"><button class="button" type="submit">${t("حفظ التغييرات", "Save changes")}</button></div></form>
    </section>`;
}

function updateLayoutSummary(count, capacity) {
  const expectedInput = document.querySelector("#expected-attendance");
  const expected = Number(expectedInput?.value || 0);
  const extra = Math.max(0, count - expected);
  const warning = expected > capacity || count < expected;
  document.querySelector("#layout-summary").textContent = t(
    `السعة ${capacity} · الحضور المتوقع ${expected} · المقاعد المرتبة ${count} · مقاعد إضافية ${extra}`,
    `Capacity ${capacity} · Expected ${expected} · Arranged ${count} · Extra seats ${extra}`
  );
  document.querySelector("#layout-summary").classList.toggle("summary-warning", warning);
  if (warning) {
    document.querySelector("#plan-warning").textContent = t(
      "عدد المقاعد يجب أن يغطي الحضور وألا يتجاوز سعة القاعة.",
      "Seats must cover attendance without exceeding room capacity."
    );
  }
}

function add3DBox(scene, size, position, color, material = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...material })
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function add3DCylinder(scene, radius, height, position, color, segments = 24) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}

function addChair(scene, x, z, rotation = 0, scale = 1, color = "#1769aa") {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.62 * scale, 0.12 * scale, 0.58 * scale),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );
  seat.position.y = 0.58 * scale;
  chair.add(seat);
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.62 * scale, 0.66 * scale, 0.1 * scale),
    new THREE.MeshStandardMaterial({ color: color === "#bd922d" ? "#8e6e20" : "#102b4e", roughness: 0.8 })
  );
  back.position.set(0, 0.93 * scale, -0.24 * scale);
  chair.add(back);
  for (const dx of [-0.23, 0.23]) {
    for (const dz of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.045 * scale, 0.54 * scale, 0.045 * scale),
        new THREE.MeshStandardMaterial({ color: "#7e8d9c", metalness: 0.2, roughness: 0.55 })
      );
      leg.position.set(dx * scale, 0.3 * scale, dz * scale);
      chair.add(leg);
    }
  }
  chair.position.set(x, 0, z);
  chair.rotation.y = rotation;
  chair.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  scene.add(chair);
}

function addDesk(scene, x, z, rotation = 0, size = [1.1, 0.12, 0.62]) {
  const desk = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color: "#bd922d", roughness: 0.72 })
  );
  top.position.y = 0.83;
  desk.add(top);
  for (const dx of [-size[0] * 0.4, size[0] * 0.4]) {
    for (const dz of [-size[2] * 0.34, size[2] * 0.34]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.8, 0.06),
        new THREE.MeshStandardMaterial({ color: "#778391", metalness: 0.16, roughness: 0.6 })
      );
      leg.position.set(dx, 0.4, dz);
      desk.add(leg);
    }
  }
  desk.position.set(x, 0, z);
  desk.rotation.y = rotation;
  desk.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  scene.add(desk);
}

function clearScene(scene) {
  for (const child of [...scene.children]) {
    scene.remove(child);
    child.traverse((part) => {
      if (!part.isMesh) return;
      part.geometry.dispose();
      if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose());
      else part.material.dispose();
    });
  }
}

function create3DViewer(hostId, buildScene) {
  const host = document.getElementById(hostId);
  if (!host) return null;
  const canvasHost = host.querySelector(".viewer-canvas");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", host.dataset.label || t("نموذج ثلاثي الأبعاد تفاعلي", "Interactive 3D model"));
  canvas.tabIndex = 0;
  canvasHost.replaceChildren(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (error) {
    canvasHost.textContent = t("تعذر تشغيل العرض ثلاثي الأبعاد في هذا المتصفح.", "3D rendering is unavailable in this browser.");
    console.error("Could not initialize the 3D renderer.", error);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor("#edf3f8");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#edf3f8");
  scene.add(new THREE.HemisphereLight("#ffffff", "#a7b7c5", 2.2));
  const sunlight = new THREE.DirectionalLight("#ffffff", 2.1);
  sunlight.position.set(-5, 13, 8);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  scene.add(sunlight);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const target = new THREE.Vector3(0, 0.9, 0);
  let radius = 20;
  let azimuth = 0.72;
  let polar = 0.92;
  const positionCamera = () => {
    const sinPolar = Math.sin(polar);
    camera.position.set(
      target.x + radius * sinPolar * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * sinPolar * Math.cos(azimuth)
    );
    camera.lookAt(target);
  };
  const resize = () => {
    const bounds = canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const update = (builder) => {
    clearScene(scene);
    scene.add(new THREE.HemisphereLight("#ffffff", "#a7b7c5", 2.2), sunlight);
    builder(scene);
    positionCamera();
    renderer.render(scene, camera);
  };
  const reset = () => {
    radius = hostId === "bus-viewer" ? 23 : 20;
    azimuth = 0.72;
    polar = 0.92;
    positionCamera();
    renderer.render(scene, camera);
  };
  let pointer = null;
  canvas.addEventListener("pointerdown", (event) => {
    pointer = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pointer) return;
    azimuth -= (event.clientX - pointer[0]) * 0.008;
    polar = Math.min(1.45, Math.max(0.25, polar + (event.clientY - pointer[1]) * 0.008));
    pointer = [event.clientX, event.clientY];
    positionCamera();
    renderer.render(scene, camera);
  });
  const releasePointer = () => { pointer = null; };
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    radius = Math.min(38, Math.max(9, radius + Math.sign(event.deltaY) * 1.2));
    positionCamera();
    renderer.render(scene, camera);
  }, { passive: false });
  host.querySelector("[data-viewer-reset]")?.addEventListener("click", reset);

  const observer = new ResizeObserver(resize);
  observer.observe(canvasHost);
  const viewer = {
    host,
    update,
    dispose() {
      observer.disconnect();
      renderer.dispose();
      clearScene(scene);
      canvas.remove();
    }
  };
  active3DViewers.push(viewer);
  resize();
  update(buildScene);
  return viewer;
}

function buildRoomScene(scene, options) {
  add3DBox(scene, [12, 0.25, 10], [0, -0.14, 0], "#dce5eb");
  add3DBox(scene, [12, 3.4, 0.22], [0, 1.55, -4.9], "#f7f9fb");
  add3DBox(scene, [0.22, 3.4, 10], [-5.9, 1.55, 0], "#f7f9fb");
  add3DBox(scene, [0.22, 3.4, 3.0], [5.9, 1.55, -3.5], "#f7f9fb");
  add3DBox(scene, [0.22, 3.4, 5.2], [5.9, 1.55, 2.4], "#f7f9fb");
  add3DBox(scene, [4.2, 2.9, 0.1], [0, 1.92, -4.76], "#ffffff", { roughness: 0.45 });
  add3DBox(scene, [2.6, 1.4, 0.08], [0, 2.03, -4.65], "#d8eaf7", { emissive: "#d8eaf7", emissiveIntensity: 0.1 });
  add3DBox(scene, [0.12, 2.25, 1.05], [5.72, 1.1, -0.65], "#bd922d");
  add3DBox(scene, [0.08, 0.9, 2.5], [-5.76, 1.95, -1.4], "#a9d9eb", { transparent: true, opacity: 0.65 });
  add3DBox(scene, [0.08, 0.9, 2.5], [5.76, 1.95, 1.0], "#a9d9eb", { transparent: true, opacity: 0.65 });
  addDesk(scene, 0, -3.7, 0, [2.1, 0.16, 0.9]);
  addChair(scene, 0, -2.85, Math.PI);
  add3DBox(scene, [0.5, 0.18, 0.5], [0, 3.1, -0.7], "#596879");
  const { seats, style, equipment } = options;
  const columns = Math.max(1, Math.min(style === "exam" ? 9 : 8, Math.ceil(Math.sqrt(seats * 1.25))));
  const rows = Math.ceil(seats / columns);
  if (style === "groups" || style === "workshop") {
    const tableCount = Math.min(style === "groups" ? 4 : 6, Math.ceil(seats / (style === "groups" ? 6 : 4)));
    const centers = [[-3.3, -1.1], [0, -1.1], [3.3, -1.1], [-3.3, 2], [0, 2], [3.3, 2]];
    const perTable = Math.ceil(seats / tableCount);
    let placed = 0;
    centers.slice(0, tableCount).forEach(([x, z], tableIndex) => {
      const remaining = seats - placed;
      const around = Math.min(perTable, remaining);
      if (style === "groups") {
        add3DCylinder(scene, 0.78, 0.12, [x, 0.78, z], "#bd922d");
      } else {
        addDesk(scene, x, z, 0, [1.7, 0.14, 1.0]);
      }
      for (let index = 0; index < around; index += 1) {
        const angle = index * Math.PI * 2 / around;
        const distance = style === "groups" ? 1.12 : 1.22;
        addChair(scene, x + Math.cos(angle) * distance, z + Math.sin(angle) * distance, angle + Math.PI / 2, 0.83);
      }
      placed += around;
    });
  } else if (style === "u-shape") {
    for (let index = 0; index < seats; index += 1) {
      const side = index < 5 ? 0 : index < 10 ? 1 : 2;
      const offset = side === 0 ? index : side === 1 ? index - 5 : index - 10;
      const x = side === 0 ? -4.25 : side === 1 ? 4.25 : -3.5 + offset * 1.75;
      const z = side === 2 ? 3.0 : -2.8 + offset * 1.4;
      const rotation = side === 0 ? Math.PI / 2 : side === 1 ? -Math.PI / 2 : 0;
      addDesk(scene, x, z, rotation);
      addChair(scene, x, z + (side === 2 ? 0.56 : 0), rotation, 0.82);
    }
  } else {
    for (let index = 0; index < seats; index += 1) {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = columns === 1 ? 0 : -4.2 + col * 8.4 / (columns - 1);
      const z = -2.3 + row * Math.min(1.4, 5.3 / Math.max(rows - 1, 1));
      addDesk(scene, x, z, 0, style === "exam" ? [0.78, 0.1, 0.55] : [0.92, 0.1, 0.55]);
      addChair(scene, x, z + 0.5, 0, 0.78);
    }
  }
  for (let index = 0; index < equipment.projector; index += 1) {
    add3DBox(scene, [0.34, 0.16, 0.26], [-1.5 + index * 0.5, 3.12, -1.2], "#bd922d");
  }
  for (let index = 0; index < equipment.display; index += 1) {
    add3DBox(scene, [1.1, 0.75, 0.08], [-4.3 + index * 1.2, 1.9, -4.65], "#1769aa");
  }
  for (let index = 0; index < equipment.microphone; index += 1) {
    add3DCylinder(scene, 0.05, 0.4, [-0.45 + index * 0.18, 1.0, -3.5], "#bd922d", 10);
  }
  for (let index = 0; index < equipment.whiteboard; index += 1) {
    add3DBox(scene, [1.4, 0.8, 0.06], [-3.2 + index * 1.65, 1.8, -4.72], "#ffffff");
  }
}

function buildBusScene(scene, capacity) {
  const rows = Math.ceil(capacity / 4);
  const length = Math.max(10, rows * 0.58 + 2);
  add3DBox(scene, [4.3, 0.2, length], [0, -0.15, 0], "#dce5eb");
  add3DBox(scene, [0.1, 0.24, length], [-2.1, 0.06, 0], "#f7f9fb");
  add3DBox(scene, [0.1, 0.24, length], [2.1, 0.06, 0], "#f7f9fb");
  add3DBox(scene, [3.9, 0.1, 0.12], [0, 1.35, -length / 2], "#f7f9fb");
  add3DBox(scene, [3.9, 0.1, 0.12], [0, 1.35, length / 2], "#f7f9fb");
  add3DBox(scene, [0.12, 0.9, 0.75], [-2.02, 1.1, -length / 2 + 1.2], "#a9d9eb", { transparent: true, opacity: 0.65 });
  add3DBox(scene, [0.12, 0.9, 0.75], [2.02, 1.1, -length / 2 + 1.2], "#a9d9eb", { transparent: true, opacity: 0.65 });
  add3DBox(scene, [0.12, 0.9, 0.75], [-2.02, 1.1, length / 2 - 1.2], "#a9d9eb", { transparent: true, opacity: 0.65 });
  add3DBox(scene, [0.12, 0.9, 0.75], [2.02, 1.1, length / 2 - 1.2], "#a9d9eb", { transparent: true, opacity: 0.65 });
  add3DBox(scene, [0.3, 1.1, 0.65], [1.45, 0.55, -length / 2 + 1.05], "#bd922d");
  add3DBox(scene, [0.1, 1.05, 0.85], [2.02, 0.55, -length / 2 + 2.5], "#bd922d");
  add3DBox(scene, [0.1, 1.05, 0.85], [2.02, 0.55, length / 2 - 0.8], "#bd922d");
  addChair(scene, -0.72, -length / 2 + 1.45, Math.PI, 0.9, "#bd922d");
  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.035, 8, 24),
    new THREE.MeshStandardMaterial({ color: "#243348" })
  );
  steeringWheel.position.set(-0.72, 1.05, -length / 2 + 0.58);
  steeringWheel.rotation.x = Math.PI / 2;
  scene.add(steeringWheel);
  for (let index = 0; index < capacity; index += 1) {
    const row = Math.floor(index / 4);
    const place = index % 4;
    const side = place < 2 ? -1 : 1;
    const across = place % 2;
    const x = side * (0.88 + across * 0.55);
    const z = -length / 2 + 2.25 + row * 0.58;
    if (z > length / 2 - 0.55) continue;
    addChair(scene, x, z, Math.PI, 0.72);
  }
}

function update3DViewer(hostId, buildScene) {
  let viewer = active3DViewers.find((item) => item.host.id === hostId);
  if (!viewer) viewer = create3DViewer(hostId, buildScene);
  else viewer.update(buildScene);
}

function drawBusModel() {
  const select = document.querySelector("#bus-model-capacity");
  if (!select) return;
  const capacity = Number(select.value);
  const vehicleId = select.dataset.vehicleId;
  document.querySelector("#bus-capacity-summary").textContent = vehicleId
    ? `${vehicleId} · ${t("السعة المسجلة محلياً", "Locally registered capacity")}: ${capacity}`
    : `${t("مقاعد الركاب في النموذج", "Passenger seats in model")}: ${capacity} · ${t("مقعد السائق منفصل", "Driver seat shown separately")}`;
  update3DViewer("bus-viewer", (scene) => buildBusScene(scene, capacity));
}

function drawRoomPlan() {
  const countInput = document.querySelector("#plan-seat-count");
  const capacityInput = document.querySelector("#plan-capacity");
  if (!countInput || !capacityInput) return;
  const selectedRoom = currentResources.find((resource) => resource.id === document.querySelector("#plan-room").value);
  const capacity = selectedRoom?.capacity || Number(capacityInput.value || 0);
  if (selectedRoom) capacityInput.value = String(selectedRoom.capacity || "");
  const count = Number(countInput.value);
  const style = document.querySelector("#plan-layout").value;
  const limit = capacity ? layoutLimit(style, capacity) : 0;
  countInput.max = String(limit || 60);
  const expected = Number(document.querySelector("#expected-attendance").value || 0);
  const equipment = {};
  ["projector", "microphone", "display", "whiteboard"].forEach((key) => {
    equipment[key] = Number(document.querySelector(`#eq-${key}`)?.value || 0);
  });
  const valid = capacity > 0 && Number.isInteger(count) && count > 0 && count <= limit && count >= expected && expected <= capacity;
  document.querySelector("#plan-warning").textContent = valid ? "" : t(
    "أدخل سعة معروفة، واجعل المقاعد تغطي الحضور ولا تتجاوز سعة القاعة.",
    "Enter a known capacity; seats must cover attendance without exceeding it."
  );
  countInput.setAttribute("aria-invalid", String(!valid));
  updateLayoutSummary(Number.isInteger(count) ? count : 0, capacity);
  update3DViewer("room-viewer", (scene) => buildRoomScene(scene, { seats: valid ? count : 0, style, equipment }));
}

function layoutLimit(style, capacity) {
  const physicalLimit = style === "u-shape" ? 15 : style === "workshop" || style === "groups" ? 24 : style === "exam" ? 32 : 40;
  return Math.min(capacity, physicalLimit);
}

function plannerPage() {
  return `${heading(t("مخطط القاعات الافتراضي", "Virtual room planner"), t("صمّم تخطيطاً أولياً للمقاعد والتجهيزات المطلوبة.", "Create a proposed seating and equipment plan."))}
    <section class="grid grid-2">
      <article class="card"><div class="section-title"><h2>${t("إعداد المخطط", "Plan settings")}</h2></div>
        <div class="planner-toolbar">
          <div class="field"><label for="plan-room">${t("قاعة مسجلة (اختياري)", "Registered room (optional)")}</label><select id="plan-room"><option value="">${t("مخطط عام — أدخل سعة معروفة", "General layout — enter a known capacity")}</option>${roomResources().map((room) => `<option value="${escapeHtml(room.id)}">${escapeHtml(language === "en" ? room.nameEn || room.name : room.name)} · ${room.capacity || "—"}</option>`).join("")}</select></div>
          <div class="field"><label for="plan-capacity">${t("السعة المعروفة", "Known room capacity")}</label><input id="plan-capacity" type="number" min="1" max="60" value="" required></div>
          <div class="field"><label for="plan-seat-count">${t("عدد المقاعد", "Seat count")}</label><input id="plan-seat-count" type="number" min="1" max="60" value="" required></div>
          <div class="field"><label for="plan-layout">${t("ترتيب الجلوس", "Seating layout")}</label><select id="plan-layout">
            <option value="rows">${t("صفوف تقليدية", "Classroom rows")}</option><option value="exam">${t("ترتيب اختبارات", "Examination")}</option>
            <option value="u-shape">${t("شكل حرف U", "U-shaped")}</option><option value="groups">${t("طاولات مجموعات دائرية", "Circular group tables")}</option><option value="workshop">${t("ورشة عمل", "Workshop")}</option>
          </select></div>
          <div class="field"><label for="expected-attendance">${t("الحضور المتوقع", "Expected attendance")}</label><input id="expected-attendance" type="number" min="1" max="60" value="" required></div>
        </div>
        <p id="plan-warning" role="alert" class="muted"></p>
        <p id="layout-summary" class="tag"></p>
        <div class="equipment-list">
          ${[["projector", "أجهزة العرض", "Projectors"], ["microphone", "الميكروفونات", "Microphones"], ["display", "الشاشات", "Displays"], ["whiteboard", "السبورات", "Whiteboards"]].map(([key, ar, en]) => `<div class="equipment-row"><label for="eq-${key}">${t(ar, en)}</label><input id="eq-${key}" type="number" min="0" max="10" value="${key === "projector" ? 1 : 0}"></div>`).join("")}
        </div>
        <button class="button" type="button" data-action="save-layout">${t("حفظ المخطط لطلب الحجز", "Save plan for a booking")}</button>
      </article>
      <article class="card"><div class="section-title"><h2>${t("معاينة القاعة", "Room preview")}</h2><span class="tag">${t("مخطط مقترح", "Proposed plan")}</span></div>
        <div id="room-viewer" class="room-plan three-viewer" data-label="${t("نموذج قاعة ثلاثي الأبعاد", "3D room model")}">
          <div class="viewer-canvas"></div><div class="viewer-controls"><span>${t("اسحب للتدوير · مرر للتكبير", "Drag to rotate · scroll to zoom")}</span><button type="button" class="button secondary small" data-viewer-reset>${t("إعادة ضبط الكاميرا", "Reset camera")}</button></div>
        </div>
      </article>
    </section>`;
}

function roomsAvailable(date, startTime, endTime, requests, resources) {
  const enabled = new Set(resources.filter((resource) => resource.available !== false).map((resource) => resource.id));
  return roomResources(resources).filter((room) => enabled.has(room.id) && !requests.some((request) =>
    request.resourceId === room.id && requestIsOpen(request) && overlaps(date, startTime, endTime, request)
  ));
}

async function updateRoomOptions() {
  const select = document.querySelector("#roomResource");
  if (!select) return;
  const form = select.form;
  const type = form.elements.facilityType.value;
  const date = form.elements.date.value;
  const start = form.elements.startTime.value;
  const end = form.elements.endTime.value;
  const attendance = Number(form.elements.attendance.value || 0);
  const status = document.querySelector("#room-availability");
  if (!date || !start || !end || start >= end) {
    select.innerHTML = `<option value="">${t("اختر التاريخ والوقت أولاً", "Choose a date and time first")}</option>`;
    status.textContent = start && end && start >= end ? t("وقت النهاية يجب أن يكون بعد البداية.", "End time must be after start time.") : t("اختر التاريخ والوقت لعرض التوفر والبدائل.", "Choose a date and time to view availability and alternatives.");
    return;
  }
  const allRequests = await getAll("requests");
  const inventory = await getAll("resources");
  const matchingType = roomResources(inventory).filter((room) => room.type === type && (!attendance || room.capacity >= attendance));
  if (!matchingType.length) {
    select.innerHTML = `<option value="">${t("لا توجد مرافق مسجلة لهذا النوع", "No facilities of this type are registered")}</option>`;
    status.textContent = t("لا توجد قاعات مسجلة. أضف مورداً موثقاً من دليل الموارد أولاً.", "No rooms are registered. Add a verified resource in the resource directory first.");
    return;
  }
  const available = roomsAvailable(date, start, end, allRequests, inventory);
  const options = matchingType.filter((room) => available.includes(room));
  select.innerHTML = `<option value="">${t("اختر مرفقاً متاحاً", "Select an available facility")}</option>` + options.map((room) =>
    `<option value="${room.id}">${escapeHtml(language === "en" ? room.nameEn : room.name)} · ${room.capacity} · ${escapeHtml(language === "en" ? LOCATION_EN[room.location] || room.location : room.location)} · ${escapeHtml(room.equipment.map((item) => language === "en" ? EQUIPMENT_EN[item] || item : item).join(", "))}</option>`
  ).join("");
  if (options.length) {
    status.textContent = `${t("متاحون في الموعد", "Available at this time")}: ${options.map((room) =>
      `${language === "en" ? room.nameEn : room.name} (${room.capacity}) · ${language === "en" ? LOCATION_EN[room.location] || room.location : room.location} · ${room.equipment.map((item) => language === "en" ? EQUIPMENT_EN[item] || item : item).join(", ")}`
    ).join(" · ")}`;
    return;
  }
  const enabledIds = new Set(inventory.filter((resource) => resource.available !== false).map((resource) => resource.id));
  const alternatives = matchingType.filter((room) => enabledIds.has(room.id) && !available.includes(room));
  const searchDate = new Date(`${date}T12:00:00`);
  let nearest = null;
  for (let offset = 1; offset <= 30 && !nearest; offset += 1) {
    searchDate.setDate(searchDate.getDate() + 1);
    const candidateDate = `${searchDate.getFullYear()}-${String(searchDate.getMonth() + 1).padStart(2, "0")}-${String(searchDate.getDate()).padStart(2, "0")}`;
    nearest = matchingType.find((room) => enabledIds.has(room.id) && !allRequests.some((request) =>
      request.resourceId === room.id && requestIsOpen(request) && overlaps(candidateDate, start, end, request)
    ));
    if (nearest) nearest = { room: nearest, date: candidateDate };
  }
  select.innerHTML = `<option value="">${t("لا يوجد مرفق متاح بهذا النوع", "No facility of this type is available")}</option>`;
  status.textContent = nearest
    ? t(`لا يتوفر مرفق مناسب في هذا الموعد. أقرب اقتراح: ${nearest.room.name}، سعة ${nearest.room.capacity}، ${nearest.room.location}، ${nearest.room.equipment.join("، ")} — ${formatDate(nearest.date)} الساعة ${start}.`, `No suitable facility is available at this time. Nearest suggestion: ${nearest.room.nameEn}, capacity ${nearest.room.capacity}, ${LOCATION_EN[nearest.room.location] || nearest.room.location}, ${nearest.room.equipment.map((item) => EQUIPMENT_EN[item] || item).join(", ")} — ${formatDate(nearest.date)} at ${start}.`)
    : t("لا يوجد مرفق مناسب لهذا النوع والسعة في الموعد المحدد.", "No matching facility meets this type and capacity for the selected time.");
}

function timeRange(request) {
  if (request.departure) {
    const start = request.departure.length === 16 ? request.departure : new Date(request.departure).toISOString().slice(0, 16);
    const end = request.returnAt
      ? (request.returnAt.length === 16 ? request.returnAt : new Date(request.returnAt).toISOString().slice(0, 16))
      : addLocalHour(start);
    return { start, end };
  }
  if (request.date && request.startTime && request.endTime) return { start: `${request.date}T${request.startTime}`, end: `${request.date}T${request.endTime}` };
  return null;
}

function addLocalHour(value) {
  const date = new Date(value);
  date.setHours(date.getHours() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function intervalsOverlap(first, second) {
  return Boolean(first && second && first.start < second.end && first.end > second.start);
}

function availableVehicles(start, end, requests, resources) {
  const busy = new Set();
  requests.filter((request) => requestIsOpen(request) && request.assignedVehicles?.length)
    .forEach((request) => {
      if (intervalsOverlap({ start, end }, timeRange(request))) request.assignedVehicles.forEach((id) => busy.add(id));
    });
  const enabled = new Set(resources.filter((resource) => resource.available !== false).map((resource) => resource.id));
  return vehicleResources(resources).filter((vehicle) => enabled.has(vehicle.id) && !busy.has(vehicle.id));
}

function vehicleCombination(passengers, fleet) {
  let best = null;
  for (let mask = 1; mask < (1 << fleet.length); mask += 1) {
    const selected = fleet.filter((_, index) => mask & (1 << index));
    const capacity = selected.reduce((sum, vehicle) => sum + vehicle.capacity, 0);
    if (capacity < passengers) continue;
    if (!best || capacity < best.capacity || capacity === best.capacity && selected.length < best.selected.length) {
      best = { selected, capacity };
    }
  }
  return best;
}

async function updateVehicleSuggestions() {
  const input = document.querySelector("#passengers");
  const container = document.querySelector("#vehicle-suggestions");
  if (!input || !container) return;
  const count = Number(input.value);
  const departure = document.querySelector("#departure").value;
  const returnAt = document.querySelector("#returnAt").value;
  if (!Number.isInteger(count) || count < 1 || !departure) {
    container.innerHTML = `<p class="muted">${t("أدخل عدد الركاب وموعد الانطلاق لاقتراح المركبات.", "Enter passengers and departure time for vehicle suggestions.")}</p>`;
    document.querySelector("#combined-capacity").textContent = t("بانتظار تفاصيل الرحلة", "Awaiting trip details");
    return;
  }
  const startDate = new Date(departure);
  const endDate = returnAt ? new Date(returnAt) : new Date(startDate.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(startDate.getTime()) || endDate <= startDate) {
    container.innerHTML = `<p class="muted">${t("تحقق من موعد العودة؛ يجب أن يكون بعد الانطلاق.", "Check the return time; it must be after departure.")}</p>`;
    return;
  }
  const [requests, resources] = await Promise.all([getAll("requests"), getAll("resources")]);
  const viewerCapacity = Number(document.querySelector("#bus-model-capacity")?.value || BUS_MODEL_CAPACITIES[0]);
  update3DViewer("bus-viewer", (scene) => buildBusScene(scene, viewerCapacity));
  const fleet = availableVehicles(departure, returnAt || addLocalHour(departure), requests, resources);
  const combination = vehicleCombination(count, fleet);
  if (!combination) {
    container.innerHTML = `<p class="empty-state">${t("لا توجد مركبات مسجلة متاحة لهذا الموعد. يمكن إرسال طلب الرحلة دون إسناد مركبة.", "No registered vehicle is available for this time. Submit the trip request without a vehicle assignment.")}</p>`;
    document.querySelector("#combined-capacity").textContent = t("لا يوجد إسناد مؤكد", "No confirmed assignment");
    return;
  }
  document.querySelector("#combined-capacity").textContent = `${t("السعة المجمعة", "Combined capacity")}: ${combination.capacity} · ${t("المطلوب", "Required")}: ${count}`;
  container.innerHTML = combination.selected.map((vehicle) => `<article class="resource-card"><strong>${escapeHtml(vehicle.id)}</strong><span>${vehicle.capacity} ${t("راكباً", "passengers")}</span><span class="tag">${t("متاح حسب الجدول المسجل محلياً", "Available in locally saved schedules")}</span><button class="button secondary small" type="button" data-action="inspect-vehicle" data-id="${escapeHtml(vehicle.id)}">${t("استعراض ثلاثي الأبعاد", "Inspect in 3D")}</button></article>`).join("");
}

function plannerSnapshot() {
  const seatInput = document.querySelector("#plan-seat-count");
  if (!seatInput) {
    try {
      const saved = JSON.parse(sessionGet("navu-room-layout") || "null");
      if (saved && Number.isInteger(saved.seats) && Number.isInteger(saved.capacity)) return saved;
    } catch (error) {
      console.error("Could not read the saved room plan.", error);
    }
    return { roomId: "", capacity: 0, seats: 0, style: "rows", equipment: {} };
  }
  const count = Number(seatInput.value);
  const style = document.querySelector("#plan-layout").value;
  const roomId = document.querySelector("#plan-room").value;
  const equipment = {};
  ["projector", "microphone", "display", "whiteboard"].forEach((key) => {
    equipment[key] = Number(document.querySelector(`#eq-${key}`)?.value || 0);
  });
  return {
    roomId,
    capacity: Number(document.querySelector("#plan-capacity").value),
    seats: count,
    expectedAttendance: Number(document.querySelector("#expected-attendance")?.value || 0),
    style,
    equipment
  };
}

async function setupPlanner() {
  if (!document.querySelector("#room-viewer")) return;
  try {
    const requestId = new URLSearchParams(location.search).get("requestId");
    let saved;
    if (requestId) {
      const request = await getById("requests", requestId);
      if (!request || request.ownerId !== currentUser.id && !canSeeDepartmentRequests(currentUser.role, request)) {
        document.querySelector("#plan-warning").textContent = t("لا يمكن فتح مخطط هذا الطلب.", "You cannot access this request layout.");
        return;
      }
      saved = request.layout;
      if (!saved) {
        document.querySelector("#plan-warning").textContent = t("لا يوجد مخطط محفوظ لهذا الطلب.", "This request has no saved layout.");
        return;
      }
    } else {
      saved = JSON.parse(sessionGet("navu-room-layout") || "null");
    }
    if (saved) {
      document.querySelector("#plan-room").value = saved.roomId;
      document.querySelector("#plan-capacity").value = saved.capacity || "";
      document.querySelector("#plan-seat-count").value = saved.seats;
      document.querySelector("#plan-layout").value = saved.style;
      document.querySelector("#expected-attendance").value = saved.expectedAttendance || "";
      Object.entries(saved.equipment || {}).forEach(([key, value]) => {
        const input = document.querySelector(`#eq-${key}`);
        if (input) input.value = value;
      });
    }
  } catch (error) {
    console.error("Could not restore the saved room plan.", error);
    document.querySelector("#plan-warning").textContent = t("تعذر تحميل المخطط المحفوظ.", "Could not load the saved layout.");
  }
  ["plan-seat-count", "plan-capacity", "plan-layout", "plan-room", "expected-attendance", "eq-projector", "eq-microphone", "eq-display", "eq-whiteboard"]
    .forEach((id) => {
      document.querySelector(`#${id}`).addEventListener("input", drawRoomPlan);
      document.querySelector(`#${id}`).addEventListener("change", drawRoomPlan);
    });
  ["plan-layout", "plan-room"].forEach((id) => document.querySelector(`#${id}`).addEventListener("change", () => {
    const room = currentResources.find((resource) => resource.id === document.querySelector("#plan-room").value);
    if (room) document.querySelector("#plan-capacity").value = room.capacity || "";
    drawRoomPlan();
  }));
  drawRoomPlan();
}

function setupRoomForm() {
  const form = document.querySelector('[data-request-type="room"]');
  if (!form) return;
  const updatePreview = () => {
    const room = currentResources.find((resource) => resource.id === form.elements.resourceId.value);
    const layout = plannerSnapshot();
    const attendance = Number(form.elements.attendance.value || 0);
    const equipment = {
      projector: form.querySelector('[name="equipment"][value="projector"]')?.checked ? 1 : 0,
      microphone: form.querySelector('[name="equipment"][value="microphone"]')?.checked ? 1 : 0,
      display: form.querySelector('[name="equipment"][value="display"]')?.checked ? 1 : 0,
      whiteboard: form.querySelector('[name="equipment"][value="whiteboard"]')?.checked ? 1 : 0
    };
    update3DViewer("booking-room-viewer", (scene) => buildRoomScene(scene, {
      seats: layout.seats || attendance,
      style: layout.style || "rows",
      equipment
    }));
    if (room) document.querySelector("#room-availability").textContent =
      `${language === "en" ? room.nameEn || room.name : room.name} · ${room.capacity} · ${language === "en" ? room.locationEn || room.location : room.location}`;
  };
  ["facilityType", "date", "startTime", "endTime", "attendance", "resourceId"].forEach((name) => {
    form.elements[name].addEventListener("change", () => {
      updateRoomOptions().then(updatePreview).catch((error) => {
        console.error("Could not refresh room booking options.", error);
        toast(t("تعذر تحديث خيارات الحجز.", "Could not refresh booking options."), true);
      });
    });
    form.elements[name].addEventListener("input", () => {
      updateRoomOptions().then(updatePreview).catch((error) => {
        console.error("Could not refresh room booking options.", error);
      });
    });
  });
  form.querySelectorAll('[name="equipment"]').forEach((input) => input.addEventListener("change", updatePreview));
  updatePreview();
  updateRoomOptions().catch((error) => {
    console.error("Could not load room availability.", error);
    document.querySelector("#room-availability").textContent = t("تعذر تحميل التوفر حالياً.", "Could not load availability.");
  });
}

function setupTransportForm() {
  const form = document.querySelector('[data-request-type="transport"]');
  if (!form) return;
  document.querySelector("#bus-model-capacity").addEventListener("change", () => {
    document.querySelector("#bus-model-capacity").dataset.vehicleId = "";
    drawBusModel();
  });
  drawBusModel();
  ["passengers", "departure", "returnAt"].forEach((name) => {
    form.elements[name].addEventListener("input", () => updateVehicleSuggestions().catch((error) => {
      console.error("Could not calculate available vehicles.", error);
      toast(t("تعذر تحميل المركبات المتاحة.", "Could not load available vehicles."), true);
    }));
    form.elements[name].addEventListener("change", () => updateVehicleSuggestions().catch((error) => {
      console.error("Could not calculate available vehicles.", error);
    }));
  });
}

function setupResourceFilters() {
  const grid = document.querySelector("#resource-grid");
  if (!grid) return;
  const filters = ["resource-search", "resource-type", "resource-location", "resource-capacity"].map((id) => document.querySelector(`#${id}`));
  const apply = () => {
    const [search, type, locationFilter, capacity] = filters.map((input) => input.value);
    let shown = 0;
    grid.querySelectorAll("[data-resource-card]").forEach((card) => {
      const matches = card.dataset.search.includes(search.toLowerCase()) &&
        (!type || card.dataset.type === type) &&
        (!locationFilter || card.dataset.location === locationFilter) &&
        (!capacity || Number(card.dataset.capacity) >= Number(capacity));
      card.hidden = !matches;
      if (matches) shown += 1;
    });
    document.querySelector("#resource-empty").hidden = shown !== 0;
  };
  filters.forEach((input) => input.addEventListener("input", apply));
  filters.forEach((input) => input.addEventListener("change", apply));
}

function renderPage(requests, notifications, resources) {
  let content = "";
  if (page === "services" && !isStudentRole(currentUser.role)) {
    content = `${heading(t("الخدمات", "Services"), t("ليس لديك صلاحية لإنشاء طلبات أكاديمية.", "Your role cannot submit academic requests."))}<section class="card"><p>${t("يمكنك متابعة طلبات القسم من مساحة العمل.", "Use your department workspace to manage requests.")}</p></section>`;
  } else if (page === "planner" && !(isStudentRole(currentUser.role) || currentUser.role === "facilities_staff")) {
    content = `${heading(t("مخطط القاعات", "Room planner"), t("هذه المساحة غير متاحة لدورك.", "This workspace is not available for your role."))}<section class="card"><a class="button" href="dashboard.html">${t("العودة إلى النظرة العامة", "Return to overview")}</a></section>`;
  } else if (page === "maintenance" && !(isStudentRole(currentUser.role) || currentUser.role === "facilities_staff")) {
    content = `${heading(t("الصيانة", "Maintenance"), t("هذه المساحة غير متاحة لدورك.", "This workspace is not available for your role."))}<section class="card"><a class="button" href="dashboard.html">${t("العودة إلى النظرة العامة", "Return to overview")}</a></section>`;
  } else if (page === "transportation" && !(isStudentRole(currentUser.role) || currentUser.role === "transport_staff")) {
    content = `${heading(t("النقل الجامعي", "Transportation"), t("هذه المساحة غير متاحة لدورك.", "This workspace is not available for your role."))}<section class="card"><a class="button" href="dashboard.html">${t("العودة إلى النظرة العامة", "Return to overview")}</a></section>`;
  }
  else if (page === "dashboard") content = renderDashboard(requests);
  else if (page === "services") content = renderServices();
  else if (page === "maintenance") content = renderMaintenance(requests);
  else if (page === "transportation") content = renderTransportation(requests, resources);
  else if (page === "requests") content = renderRequests(requests);
  else if (page === "notifications") content = renderNotifications(notifications);
  else if (page === "profile") content = renderProfile();
  else if (page === "resources") content = renderResources(resources);
  else if (page === "planner") content = plannerPage();
  else content = renderDashboard(requests);
  renderShell(content);
  if (page === "dashboard") {
    const list = document.querySelector("#dashboard-notifications");
    const latest = notifications.filter((item) => item.recipientId === currentUser.id ||
      isStaffRole(currentUser.role) && canSeeDepartmentRequests(currentUser.role, { department: item.department }))
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    list.innerHTML = latest.length ? latest.map((notice) => renderNotice(notice)).join("") : `<p class="empty-state">${t("لا توجد إشعارات جديدة.", "There are no recent notifications.")}</p>`;
  }
  setupPlanner();
  setupRoomForm();
  setupTransportForm();
  setupResourceFilters();
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5)}`;
}

async function passwordHash(password, salt) {
  if (!crypto.subtle) throw new Error(t("المتصفح لا يدعم التحقق المطلوب. افتح الموقع عبر localhost.", "This browser cannot verify passwords. Open the site through localhost."));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const digest = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 }, key, 256);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createNotification({ recipientId, department, title, message, requestId, kind, requestType, status, detail }) {
  return { id: newId("NTF"), recipientId, department, title, message, requestId, kind, requestType, status, detail, createdAt: Date.now(), read: false };
}

async function registerUser(form) {
  const data = new FormData(form);
  const fullName = String(data.get("fullName")).trim();
  const email = String(data.get("email")).trim().toLowerCase();
  const universityId = String(data.get("universityId")).trim();
  const password = String(data.get("password"));
  const role = String(data.get("role"));
  const department = String(data.get("department"));
  if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) {
    throw new Error(t("اختر أحد الأدوار الأربعة المحددة.", "Choose one of the four available roles."));
  }
  if (isStudentRole(role) && !Object.values(COLLEGES).flat().includes(department) ||
      role === "facilities_staff" && department !== "الخدمات اللوجستية والمرافق" ||
      role === "transport_staff" && department !== "النقل والحركة") {
    throw new Error(t("القسم لا يتوافق مع الدور المحدد.", "The department does not match the selected role."));
  }
  if (password !== data.get("confirmPassword")) throw new Error(t("كلمتا المرور غير متطابقتين.", "Passwords do not match."));
  const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
  const user = {
    id: newId("USR"),
    fullName,
    universityId,
    mobile: String(data.get("mobile")).trim(),
    email,
    department,
    role,
    passwordHash: await passwordHash(password, passwordSalt),
    passwordSalt: [...passwordSalt],
    title: "",
    createdAt: Date.now()
  };
  const tx = db.transaction("users", "readwrite");
  tx.objectStore("users").add(user);
  try {
    await transactionDone(tx);
  } catch (error) {
    if (error.name === "ConstraintError") throw new Error(t("البريد أو الرقم الجامعي مستخدم بالفعل.", "Email or university ID is already registered."));
    throw error;
  }
  sessionSet("navu-user-id", user.id);
  location.href = "dashboard.html";
}

async function signIn(form) {
  const data = new FormData(form);
  const email = String(data.get("email")).trim().toLowerCase();
  const tx = db.transaction("users", "readonly");
  const user = await dbRequest(tx.objectStore("users").index("email").get(email));
  await transactionDone(tx);
  if (!user || !user.passwordSalt || user.passwordHash !== await passwordHash(String(data.get("password")), new Uint8Array(user.passwordSalt))) {
    throw new Error(t("البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Email or password is incorrect."));
  }
  if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, user.role)) {
    throw new Error(t("لم يتم تعيين دور مخوّل لهذا الحساب.", "This account has no assigned NavU role."));
  }
  sessionSet("navu-user-id", user.id);
  location.href = "dashboard.html";
}

function getRequestFromForm(form) {
  const data = new FormData(form);
  const type = form.dataset.requestType;
  const common = {
    id: newId("NU"),
    ownerId: currentUser.id,
    ownerName: currentUser.fullName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "submitted",
    history: [{ status: "submitted", actorId: currentUser.id, actorName: currentUser.fullName, at: Date.now() }]
  };
  if (type === "room") {
    const startTime = String(data.get("startTime"));
    const endTime = String(data.get("endTime"));
    const attendance = Number(data.get("attendance"));
    const room = currentResources.find((item) => item.id === data.get("resourceId") && ROOM_TYPES.includes(item.type));
    if (!room) throw new Error(t("اختر مرفقاً متاحاً.", "Choose an available facility."));
    if (room.type !== data.get("facilityType")) throw new Error(t("المرفق لا يطابق نوع الحجز.", "The selected facility does not match the booking type."));
    if (startTime >= endTime) throw new Error(t("وقت النهاية يجب أن يكون بعد وقت البداية.", "End time must be after the start time."));
    if (!Number.isInteger(attendance) || attendance > room.capacity) throw new Error(t("عدد الحضور يتجاوز سعة المرفق.", "Attendance exceeds facility capacity."));
    if (new Date(`${data.get("date")}T${startTime}`) < new Date()) throw new Error(t("اختر موعداً مستقبلياً.", "Choose a future date and time."));
    const layout = plannerSnapshot();
    if (layout.roomId && layout.roomId !== room.id) {
      throw new Error(t("قاعة المخطط لا تطابق المرفق المختار.", "The planned room does not match the selected facility."));
    }
    if (!layout.seats) {
      layout.roomId = room.id;
      layout.seats = attendance;
    }
    layout.roomId = room.id;
    layout.capacity = room.capacity;
    layout.expectedAttendance = attendance;
    layout.bookingEquipment = data.getAll("equipment");
    if (layoutLimit(layout.style, room.capacity) < layout.seats) throw new Error(t("ترتيب الجلوس يتجاوز الحد المسموح لهذا المخطط.", "The seating arrangement exceeds this layout's limit."));
    if (layout.seats > room.capacity || layout.seats < attendance) throw new Error(t("تحقق من المقاعد؛ يجب أن تغطي الحضور وألا تتجاوز سعة القاعة.", "The seat plan must cover attendance and stay within room capacity."));
    return {
      ...common, type: t("حجز قاعة", "Room booking"), department: "facilities", detail: String(data.get("eventTitle")).trim(),
      resourceId: room.id, resourceType: room.type, date: String(data.get("date")), startTime, endTime, attendance,
      college: String(data.get("college")), equipment: data.getAll("equipment"), layout,
      notes: String(data.get("notes") || "")
    };
  }
  if (type === "transport") {
    const departure = String(data.get("departure"));
    const returnAt = String(data.get("returnAt") || "");
    if (returnAt && returnAt <= departure) throw new Error(t("موعد العودة يجب أن يكون بعد الانطلاق.", "Return time must be after departure."));
    const passengers = Number(data.get("passengers"));
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 500) {
      throw new Error(t("أدخل عدداً صحيحاً للركاب لا يتجاوز 500.", "Enter a whole passenger count no greater than 500."));
    }
    if (new Date(departure) < new Date()) throw new Error(t("اختر موعد انطلاق مستقبلياً.", "Choose a future departure time."));
    const startDate = departure.slice(0, 10);
    const startTime = departure.slice(11, 16);
    const endTime = returnAt ? returnAt.slice(11, 16) : addLocalHour(departure).slice(11, 16);
    return {
      ...common, type: t("طلب نقل", "Transportation"), department: "transportation",
      detail: String(data.get("title")).trim(), passengers, pickup: String(data.get("pickup")).trim(),
      destination: String(data.get("destination")).trim(), departure,
      returnAt, date: startDate, startTime, endTime, notes: String(data.get("notes") || "")
    };
  }
  if (type === "maintenance") {
    const photo = data.get("photo");
    if (photo?.size > 2 * 1024 * 1024) throw new Error(t("حجم الصورة يجب ألا يتجاوز 2 ميغابايت.", "Photo size must not exceed 2 MB."));
    if (photo?.size && !photo.type.startsWith("image/")) throw new Error(t("يرجى اختيار ملف صورة.", "Choose an image file."));
    return {
      ...common, type: t("طلب صيانة", "Maintenance"), department: "facilities",
      detail: String(data.get("title")).trim(), location: String(data.get("location")).trim(),
      category: String(data.get("category")), priority: String(data.get("priority")),
      description: String(data.get("description")).trim(), notes: String(data.get("notes") || ""),
      photo: photo?.size ? photo : null
    };
  }
  return {
    ...common, type: t("طلب مستلزمات", "Supplies"), department: "facilities",
    detail: String(data.get("item")).trim(), item: String(data.get("item")).trim(),
    quantity: Number(data.get("quantity")), intendedUse: String(data.get("intendedUse")).trim(),
    date: String(data.get("date")), location: String(data.get("location")).trim(),
    event: String(data.get("event") || ""), notes: String(data.get("notes") || "")
  };
}

async function saveRequest(request) {
  const tx = db.transaction(["requests", "notifications", "resources"], "readwrite");
  const requestsStore = tx.objectStore("requests");
  const resourcesStore = tx.objectStore("resources");
  const noticeStore = tx.objectStore("notifications");
  const existing = requestsStore.getAll();
  const resourceCheck = request.resourceId ? resourcesStore.get(request.resourceId) : null;
  let conflict = false;
  let resourceUnavailable = false;
  let ready = 0;
  const commitIfReady = () => {
    ready += 1;
    if (ready < (resourceCheck ? 2 : 1)) return;
    const all = existing.result;
    if (resourceUnavailable) {
      tx.abort();
      return;
    }
    if (request.resourceId && all.some((item) => item.resourceId === request.resourceId && requestIsOpen(item) && overlaps(request.date, request.startTime, request.endTime, item))) {
      conflict = true;
      tx.abort();
      return;
    }
    requestsStore.add(request);
    noticeStore.add(createNotification({
      recipientId: request.ownerId, department: request.department, title: t("تم استلام الطلب", "Request received"),
      message: `${request.type}: ${request.detail}`, requestId: request.id, kind: "request-created",
      requestType: request.type, detail: request.detail
    }));
    noticeStore.add(createNotification({
      recipientId: null, department: request.department, title: t("طلب جديد للقسم", "New department request"),
      message: `${request.type}: ${request.detail}`, requestId: request.id, kind: "department-request",
      requestType: request.type, detail: request.detail
    }));
  };
  existing.onsuccess = commitIfReady;
  if (resourceCheck) {
    resourceCheck.onsuccess = () => {
      resourceUnavailable = !resourceCheck.result || resourceCheck.result.available === false;
      commitIfReady();
    };
  }
  try {
    await transactionDone(tx);
  } catch (error) {
    if (conflict) throw new Error(t("تم حجز هذا المرفق في الفترة نفسها. اختر وقتاً أو مرفقاً آخر.", "This facility was booked for the same time. Choose another time or facility."));
    if (resourceUnavailable) throw new Error(t("المورد غير متاح حالياً. اختر مورداً آخر.", "This resource is currently unavailable. Choose another resource."));
    throw error;
  }
}

async function updateRequestStatus(id, status, note = "") {
  const tx = db.transaction(["requests", "notifications"], "readwrite");
  const store = tx.objectStore("requests");
  const request = await dbRequest(store.get(id));
  if (!request) {
    tx.abort();
    throw new Error(t("لم يتم العثور على الطلب.", "Request not found."));
  }
  const authorized = currentUser.id === request.ownerId && ["submitted", "review", "awaiting"].includes(request.status) && status === "cancelled"
    || currentUser.role === "facilities_staff" && ["facilities", "maintenance", "laboratory"].includes(request.department)
    || currentUser.role === "transport_staff" && request.department === "transportation"
    ;
  if (!authorized) {
    tx.abort();
    throw new Error(t("ليس لديك صلاحية لتحديث هذا الطلب.", "You are not authorized to update this request."));
  }
  if (!STATUS_FLOW.includes(status)) {
    tx.abort();
    throw new Error(t("حالة الطلب غير صالحة.", "Invalid request status."));
  }
  const previous = request.status;
  const transitions = {
    submitted: ["review", "cancelled", "rejected"],
    review: ["awaiting", "approved", "cancelled", "rejected"],
    awaiting: ["approved", "cancelled", "rejected"],
    approved: ["in-progress", "rejected"],
    "in-progress": ["completed", "rejected"],
    completed: [],
    rejected: [],
    cancelled: []
  };
  if (previous !== status && !transitions[previous]?.includes(status)) {
    tx.abort();
    throw new Error(t("لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية.", "This status transition is not allowed."));
  }
  if (currentUser.role === "facilities_staff" && request.type === "طلب صيانة" && status === "completed" && !note.trim()) {
    tx.abort();
    throw new Error(t("أضف وصفاً موجزاً للعمل المنجز قبل إكمال الطلب.", "Add a short completion note before closing this request."));
  }
  request.status = status;
  request.updatedAt = Date.now();
  request.history.push({ status, actorId: currentUser.id, actorName: currentUser.fullName, at: Date.now(), previous, detail: note.trim() });
  store.put(request);
  tx.objectStore("notifications").add(createNotification({
    recipientId: request.ownerId, department: request.department,
    title: t("تم تحديث حالة الطلب", "Request status updated"),
    message: `${request.id}: ${statusName(status)}${note.trim() ? ` · ${note.trim()}` : ""}`, requestId: request.id,
    kind: "status-updated", status, detail: note.trim()
  }));
  await transactionDone(tx);
}

async function updateProfile(form) {
  const data = new FormData(form);
  const tx = db.transaction("users", "readwrite");
  const store = tx.objectStore("users");
  const user = await dbRequest(store.get(currentUser.id));
  if (!user) {
    tx.abort();
    throw new Error(t("تعذر العثور على الحساب.", "Account not found."));
  }
  user.mobile = String(data.get("mobile")).trim();
  user.title = String(data.get("title") || "").trim();
  store.put(user);
  await transactionDone(tx);
  currentUser = user;
}

async function saveResource(form) {
  const data = new FormData(form);
  const id = String(data.get("resourceId")).trim();
  const name = String(data.get("name")).trim();
  const type = String(data.get("type"));
  const location = String(data.get("location")).trim();
  const specification = String(data.get("specification") || "").trim();
  const capacityValue = String(data.get("capacity") || "").trim();
  const capacity = capacityValue ? Number(capacityValue) : null;
  const authorizedType = currentUser.role === "transport_staff"
    ? type === "vehicle"
    : currentUser.role === "facilities_staff" && (ROOM_TYPES.includes(type) || type === "equipment");
  if (!/^[A-Za-z0-9._-]{1,17}$/.test(id) || !name || !location || !authorizedType) {
    throw new Error(t("تحقق من معرّف المورد والاسم والموقع ونوع المورد.", "Check the resource ID, name, location, and authorized resource type."));
  }
  const requiresCapacity = type === "vehicle" || ROOM_TYPES.includes(type);
  if (requiresCapacity && (!Number.isInteger(capacity) || capacity < 1 || capacity > 60)) {
    throw new Error(t("أدخل سعة صحيحة بين 1 و60 للمركبة أو القاعة.", "Enter a whole capacity from 1 to 60 for this vehicle or room."));
  }
  const resource = {
    id,
    name,
    type,
    location,
    specification,
    equipment: specification ? specification.split(",").map((item) => item.trim()).filter(Boolean) : [],
    capacity,
    available: true,
    updatedAt: Date.now()
  };
  const tx = db.transaction("resources", "readwrite");
  tx.objectStore("resources").add(resource);
  try {
    await transactionDone(tx);
  } catch (error) {
    if (error.name === "ConstraintError") throw new Error(t("معرّف المورد مستخدم بالفعل.", "This resource ID is already registered."));
    throw error;
  }
}

async function markNotificationsRead() {
  const tx = db.transaction("notifications", "readwrite");
  const store = tx.objectStore("notifications");
  const notices = await dbRequest(store.getAll());
  notices.filter((item) => item.recipientId === currentUser.id ||
    isStaffRole(currentUser.role) && canSeeDepartmentRequests(currentUser.role, { department: item.department }))
    .forEach((item) => { item.read = true; store.put(item); });
  await transactionDone(tx);
}

async function toggleResourceAvailability(id, currentlyAvailable) {
  const tx = db.transaction(["resources", "requests"], "readwrite");
  const store = tx.objectStore("resources");
  const resource = await dbRequest(store.get(id));
  const permitted = resource && (
    currentUser.role === "transport_staff" && resource.type === "vehicle" ||
    currentUser.role === "facilities_staff" && ROOM_TYPES.includes(resource.type)
  );
  if (!permitted) {
    tx.abort();
    throw new Error(t("ليس لديك صلاحية لتحديث هذا المورد.", "You are not authorized to update this resource."));
  }
  if (currentlyAvailable) {
    const requests = await dbRequest(tx.objectStore("requests").getAll());
    const hasUpcomingAssignment = requests.some((request) => {
      if (!requestIsOpen(request)) return false;
      const assigned = resource.type === "vehicle"
        ? request.assignedVehicles?.includes(id)
        : request.resourceId === id;
      const interval = timeRange(request);
      return assigned && interval && new Date(interval.end) > new Date();
    });
    if (hasUpcomingAssignment) {
      tx.abort();
      throw new Error(t("لا يمكن إيقاف مورد مرتبط بطلب مفتوح أو رحلة قادمة.", "This resource is linked to an open request or upcoming trip."));
    }
  }
  resource.available = !currentlyAvailable;
  resource.updatedAt = Date.now();
  store.put(resource);
  await transactionDone(tx);
}

async function assignVehicles(requestId, vehicleIds) {
  if (currentUser.role !== "transport_staff") throw new Error(t("هذا الإجراء لموظفي النقل المخولين فقط.", "Only transportation staff can assign vehicles."));
  const tx = db.transaction(["requests", "notifications", "resources"], "readwrite");
  const store = tx.objectStore("requests");
  const requests = await dbRequest(store.getAll());
  const resources = await dbRequest(tx.objectStore("resources").getAll());
  const request = requests.find((item) => item.id === requestId);
  if (!request || request.department !== "transportation") {
    tx.abort();
    throw new Error(t("لم يتم العثور على طلب النقل.", "Transportation request not found."));
  }
  if (["completed", "rejected", "cancelled"].includes(request.status)) {
    tx.abort();
    throw new Error(t("لا يمكن إسناد مركبات إلى طلب مغلق.", "Vehicles cannot be assigned to a closed request."));
  }
  const capacity = vehicleIds.reduce((total, id) => total + (vehicleResources(resources).find((vehicle) => vehicle.id === id)?.capacity || 0), 0);
  if (capacity < request.passengers || new Set(vehicleIds).size !== vehicleIds.length) {
    tx.abort();
    throw new Error(t("سعة المركبات المحددة غير كافية أو يوجد تكرار.", "Selected vehicle capacity is insufficient or duplicated."));
  }
  if (vehicleIds.some((id) => !resources.some((resource) => resource.id === id && resource.available !== false))) {
    tx.abort();
    throw new Error(t("إحدى المركبات المحددة غير متاحة.", "One of the selected vehicles is unavailable."));
  }
  const range = timeRange(request);
  const conflict = requests.some((other) => other.id !== request.id && requestIsOpen(other) &&
    other.assignedVehicles?.some((id) => vehicleIds.includes(id)) &&
    intervalsOverlap(range, timeRange(other)));
  if (conflict) {
    tx.abort();
    throw new Error(t("إحدى المركبات مسندة لرحلة متداخلة.", "A selected vehicle is already assigned to an overlapping trip."));
  }
  request.assignedVehicles = vehicleIds;
  request.updatedAt = Date.now();
  request.history.push({ status: request.status, actorId: currentUser.id, actorName: currentUser.fullName, at: Date.now(), detail: vehicleIds.join(", ") });
  store.put(request);
  tx.objectStore("notifications").add(createNotification({
    recipientId: request.ownerId, department: "transportation",
    title: t("تم إسناد مركبات للطلب", "Vehicles assigned to your request"),
    message: vehicleIds.join(", "), requestId: request.id, kind: "vehicles-assigned", detail: vehicleIds.join(", ")
  }));
  await transactionDone(tx);
}

function handleGlobalClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "language") {
    language = language === "ar" ? "en" : "ar";
    try { sessionStorage.setItem("navu-language", language); } catch (error) { console.error("Could not save language preference.", error); }
    render().catch((error) => showFatalError(error));
  }
  if (action === "logout") {
    sessionRemove("navu-user-id");
    location.href = "login.html";
  }
  if (action === "update-status") {
    const id = button.dataset.id;
    const status = document.querySelector(`[data-status-select="${CSS.escape(id)}"]`).value;
    const note = document.querySelector(`[data-status-note="${CSS.escape(id)}"]`)?.value || "";
    updateRequestStatus(id, status, note).then(() => render()).then(() => toast(t("تم تحديث حالة الطلب.", "Request status updated."))).catch((error) => toast(error.message, true));
  }
  if (action === "cancel-request") {
    updateRequestStatus(button.dataset.id, "cancelled").then(() => render()).then(() => toast(t("تم إلغاء الطلب.", "Request cancelled."))).catch((error) => toast(error.message, true));
  }
  if (action === "mark-read") {
    markNotificationsRead().then(() => toast(t("تم تحديد الإشعارات كمقروءة.", "Notifications marked as read."))).catch((error) => toast(error.message, true));
  }
  if (action === "save-layout") {
    try {
      const snapshot = plannerSnapshot();
      const room = snapshot.roomId ? currentResources.find((item) => item.id === snapshot.roomId) : null;
      const capacity = room?.capacity || snapshot.capacity;
      const expected = Number(document.querySelector("#expected-attendance").value);
      if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(snapshot.seats) ||
        snapshot.seats < expected || snapshot.seats > layoutLimit(snapshot.style, capacity) || expected > capacity) {
        toast(t("تحقق من سعة القاعة والحضور وعدد المقاعد.", "Check room capacity, attendance and seat count."), true);
        return;
      }
      sessionSet("navu-room-layout", JSON.stringify(snapshot));
      toast(t("تم حفظ المخطط لهذه الجلسة. افتح طلب حجز لربطه بالطلب.", "Plan saved for this session. Open a booking request to attach it."));
    } catch (error) {
      toast(error.message, true);
    }
  }
  if (action === "assign-vehicles") {
    const select = document.querySelector(`[data-vehicle-select="${CSS.escape(button.dataset.id)}"]`);
    assignVehicles(button.dataset.id, [...select.selectedOptions].map((option) => option.value))
      .then(() => render()).then(() => toast(t("تم إسناد المركبات.", "Vehicles assigned."))).catch((error) => toast(error.message, true));
  }
  if (action === "resource-toggle") {
    toggleResourceAvailability(button.dataset.id, button.dataset.available === "true")
      .then(() => render())
      .then(() => toast(t("تم تحديث حالة المورد.", "Resource availability updated.")))
      .catch((error) => toast(error.message, true));
  }
  if (action === "resource-link") {
    navigator.clipboard?.writeText(button.dataset.url).then(() => toast(t("تم نسخ رابط المورد.", "Resource link copied.")))
      .catch(() => toast(button.dataset.url));
  }
  if (action === "inspect-vehicle") {
    const vehicle = vehicleResources().find((item) => item.id === button.dataset.id);
    const select = document.querySelector("#bus-model-capacity");
    if (!vehicle || !select) return;
    if (![...select.options].some((option) => option.value === String(vehicle.capacity))) {
      select.add(new Option(String(vehicle.capacity), String(vehicle.capacity)));
    }
    select.value = String(vehicle.capacity);
    select.dataset.vehicleId = vehicle.id;
    drawBusModel();
    document.querySelector("#bus-viewer")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function showFatalError(error) {
  console.error("NavU could not start.", error);
  app.innerHTML = `<main class="auth-page"><section class="auth-panel"><div class="auth-card"><h1>NavU</h1><h2>${t("تعذر فتح التطبيق", "Unable to open NavU")}</h2><p>${escapeHtml(error.message || String(error))}</p><a class="button" href="login.html">${t("إعادة المحاولة", "Try again")}</a></div></section></main>`;
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  try {
    if (form.dataset.form === "register") {
      await registerUser(form);
      return;
    }
    if (form.dataset.form === "login") {
      await signIn(form);
      return;
    }
    if (form.dataset.form === "profile") {
      await updateProfile(form);
      await render();
      toast(t("تم حفظ بيانات الملف الشخصي.", "Profile updated."));
      return;
    }
    if (form.dataset.form === "resource") {
      await saveResource(form);
      await render();
      toast(t("تم تسجيل المورد في هذا المتصفح.", "Resource saved in this browser."));
      return;
    }
    if (form.dataset.form === "request") {
      const request = getRequestFromForm(form);
      await saveRequest(request);
      form.reset();
      await render();
      toast(`${t("تم تسجيل الطلب", "Request created")}: ${request.id}`);
    }
  } catch (error) {
    console.error("NavU action failed.", error);
    toast(error.message || t("تعذر إكمال العملية.", "Could not complete the action."), true);
  }
}

async function render() {
  active3DViewers.forEach((viewer) => viewer.dispose());
  active3DViewers = [];
  language = readLanguage();
  document.documentElement.lang = language === "ar" ? "ar" : "en";
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.body.dir = language === "ar" ? "rtl" : "ltr";
  document.title = `NavU | ${PAGE_INFO[page]?.[language === "en" ? 1 : 0] || "NavU"}`;
  if (page === "login" || page === "register") {
    if (page === "login") renderLogin();
    else renderRegister();
    return;
  }
  const userId = sessionGet("navu-user-id");
  if (!userId) {
    location.replace("login.html");
    return;
  }
  currentUser = await getById("users", userId);
  if (!currentUser || !Object.prototype.hasOwnProperty.call(ROLE_LABELS, currentUser.role)) {
    sessionRemove("navu-user-id");
    renderAuthShell(`<h2>${t("لا يوجد دور مخوّل لهذا الحساب", "No authorized role is assigned")}</h2><p>${t("سجّل الدخول بحساب يحمل أحد الأدوار الأربعة المحددة.", "Sign in with an account assigned one of the four defined roles.")}</p><a class="button" href="login.html">${t("تسجيل الدخول", "Sign in")}</a>`);
    return;
  }
  const requests = await getAll("requests");
  const notifications = await getAll("notifications");
  const resources = await getAll("resources");
  currentResources = resources;
  renderPage(requests, notifications, resources);
}

document.addEventListener("click", handleGlobalClick);
document.addEventListener("submit", (event) => { handleSubmit(event).catch((error) => showFatalError(error)); });

openDatabase()
  .then((database) => { db = database; return render(); })
  .catch(showFatalError);
  