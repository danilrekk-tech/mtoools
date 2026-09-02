const APP_URL = "https://mtoools.lovable.app";
document.getElementById("openApp").href = APP_URL + "/dashboard";

const $ = (id) => document.getElementById(id);
const store = {
  get: (keys) => new Promise((res) => (chrome.storage?.local ? chrome.storage.local.get(keys, res) : res({}))),
  set: (obj) => new Promise((res) => (chrome.storage?.local ? chrome.storage.local.set(obj, res) : res())),
  remove: (k) => new Promise((res) => (chrome.storage?.local ? chrome.storage.local.remove(k, res) : res())),
};

/* ---------- реестр локальных инструментов ---------- */
const LOCAL_TOOLS = [
  { id: "calc", name: "Калькулятор", desc: "Быстрые вычисления", icon: "🧮", color: "#34d399" },
  { id: "conv", name: "Конвертер", desc: "Длина, масса, температура", icon: "⇄", color: "#38bdf8" },
  { id: "pass", name: "Генератор паролей", desc: "Надёжные пароли", icon: "🔒", color: "#a78bfa" },
  { id: "color", name: "Цвета", desc: "HEX, RGB, HSL", icon: "🎨", color: "#f472b6" },
  { id: "text", name: "Анализ текста", desc: "Регистр, Base64, JSON, статистика", icon: "🅣", color: "#f59e0b" },
  { id: "notes", name: "Заметки", desc: "Быстрые записи с автосохранением", icon: "📝", color: "#60a5fa" },
  { id: "pomo", name: "Помодоро", desc: "Таймер фокуса и перерывов", icon: "⏱", color: "#fb7185" },
  { id: "date", name: "Даты", desc: "Разница дат и timestamp", icon: "📅", color: "#22d3ee" },
  { id: "util", name: "Утилиты", desc: "UUID, SHA-256, проценты, рандом", icon: "🧰", color: "#818cf8" },
  { id: "links", name: "Мои ссылки", desc: "Личные быстрые ссылки", icon: "🔗", color: "#4ade80" },
];
const SECTION_IDS = LOCAL_TOOLS.map((t) => t.id);
const localById = (id) => LOCAL_TOOLS.find((t) => t.id === id);

let remoteTools = [];      // инструменты из сервиса
let quickIds = [];         // id быстрых кнопок
let recent = [];           // [{id,name,at}]
let token = "";
let prefs = {};
let links = [];

const DEFAULT_QUICK = ["calc", "conv", "pass", "color"];

/* ---------- вспомогательное ---------- */
function remoteId(t) { return "remote:" + t.slug; }
function allTools() {
  return [
    ...LOCAL_TOOLS,
    ...remoteTools.map((t) => ({
      id: remoteId(t),
      name: t.name,
      desc: t.description || (t.kind === "external" ? "Внешний сервис" : "Инструмент MTools"),
      icon: t.kind === "external" ? "↗" : "◈",
      color: t.color || "#5b6bff",
      remote: t,
    })),
  ];
}
const toolById = (id) => allTools().find((t) => t.id === id);
function iconEl(tool) {
  const d = document.createElement("span");
  d.className = "tile-icon";
  d.textContent = tool.icon;
  d.style.background = tool.color + "22";
  d.style.color = tool.color;
  return d;
}
function openUrl(url) { chrome.tabs ? chrome.tabs.create({ url }) : window.open(url, "_blank"); }
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return Math.floor(s / 60) + " мин назад";
  if (s < 86400) return Math.floor(s / 3600) + " ч назад";
  if (s < 172800) return "вчера";
  return Math.floor(s / 86400) + " дн назад";
}

/* ---------- навигация ---------- */
function showView(name) {
  $("viewHome").classList.toggle("hidden", name !== "home");
  $("viewSearch").classList.toggle("hidden", name !== "search");
  $("viewTool").classList.toggle("hidden", name !== "tool");
}
function openTool(id) {
  const tool = toolById(id);
  if (!tool) return;
  if (tool.remote) {
    pushRecent(tool);
    if (tool.remote.kind === "external" && tool.remote.url) return openUrl(tool.remote.url);
    return openUrl(APP_URL + "/tools?tool=" + encodeURIComponent(tool.remote.slug));
  }
  SECTION_IDS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
  $("toolTitle").textContent = tool.name;
  $("favBtn").textContent = quickIds.includes(id) ? "★" : "☆";
  $("favBtn").dataset.tool = id;
  showView("tool");
  pushRecent(tool);
  pushSync({ tab: id });
}
$("backBtn").addEventListener("click", () => { showView("home"); $("toolSearch").value = ""; $("searchClear").classList.add("hidden"); });
$("favBtn").addEventListener("click", async () => {
  const id = $("favBtn").dataset.tool;
  if (!id) return;
  quickIds = quickIds.includes(id) ? quickIds.filter((x) => x !== id) : [...quickIds, id].slice(0, 8);
  await store.set({ mtools_quick: quickIds });
  pushSync({ quick: quickIds });
  $("favBtn").textContent = quickIds.includes(id) ? "★" : "☆";
  renderQuick();
});

/* ---------- быстрый доступ ---------- */
function renderQuick() {
  const grid = $("quickGrid");
  grid.innerHTML = "";
  const items = quickIds.map(toolById).filter(Boolean);
  if (!items.length) {
    grid.innerHTML = '<div class="muted quick-empty">Не выбрано ни одного инструмента — нажмите «Настроить».</div>';
    return;
  }
  items.forEach((t) => {
    const b = document.createElement("button");
    b.className = "quick-tile";
    b.title = t.desc;
    b.append(iconEl(t));
    const n = document.createElement("span");
    n.className = "tile-name";
    n.textContent = t.name;
    b.append(n);
    b.addEventListener("click", () => openTool(t.id));
    grid.appendChild(b);
  });
}

/* ---------- недавние ---------- */
async function pushRecent(tool) {
  recent = [{ id: tool.id, name: tool.name, at: Date.now() }, ...recent.filter((r) => r.id !== tool.id)].slice(0, 6);
  await store.set({ mtools_recent: recent });
  renderRecent();
}
function renderRecent() {
  const list = $("recentList");
  list.innerHTML = "";
  $("clearRecent").classList.toggle("hidden", !recent.length);
  if (!recent.length) {
    list.innerHTML = '<div class="muted">Здесь появятся инструменты, которыми вы пользовались.</div>';
    return;
  }
  recent.forEach((r) => {
    const t = toolById(r.id) || { id: r.id, name: r.name, desc: "", icon: "◈", color: "#5b6bff" };
    const b = document.createElement("button");
    b.className = "row-item";
    b.append(iconEl(t));
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = "<b></b><span></span>";
    meta.querySelector("b").textContent = t.name;
    meta.querySelector("span").textContent = t.desc || "";
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = ago(r.at);
    b.append(meta, when);
    b.addEventListener("click", () => openTool(t.id));
    list.appendChild(b);
  });
}
$("clearRecent").addEventListener("click", async () => { recent = []; await store.set({ mtools_recent: [] }); renderRecent(); });

/* ---------- поиск ---------- */
const search = $("toolSearch");
let activeIdx = 0;
function renderResults(q) {
  const list = $("resultList");
  const items = allTools().filter((t) => (t.name + " " + (t.desc || "")).toLowerCase().includes(q));
  list.innerHTML = "";
  activeIdx = 0;
  if (!items.length) { list.innerHTML = '<div class="muted">Ничего не найдено.</div>'; return; }
  items.forEach((t, i) => {
    const b = document.createElement("button");
    b.className = "row-item" + (i === 0 ? " active" : "");
    b.append(iconEl(t));
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = "<b></b><span></span>";
    meta.querySelector("b").textContent = t.name;
    meta.querySelector("span").textContent = t.desc || "";
    b.append(meta);
    b.addEventListener("click", () => openTool(t.id));
    list.appendChild(b);
  });
}
function moveActive(delta) {
  const rows = [...$("resultList").querySelectorAll(".row-item")];
  if (!rows.length) return;
  rows[activeIdx]?.classList.remove("active");
  activeIdx = (activeIdx + delta + rows.length) % rows.length;
  rows[activeIdx].classList.add("active");
  rows[activeIdx].scrollIntoView({ block: "nearest" });
}
search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  $("searchClear").classList.toggle("hidden", !q);
  if (!q) return showView("home");
  renderResults(q);
  showView("search");
});
$("searchClear").addEventListener("click", () => { search.value = ""; $("searchClear").classList.add("hidden"); showView("home"); });
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); search.focus(); search.select(); return; }
  if (e.key === "/" && !typing) { e.preventDefault(); search.focus(); return; }
  if (!$("viewSearch").classList.contains("hidden")) {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    if (e.key === "Enter") { e.preventDefault(); $("resultList").querySelectorAll(".row-item")[activeIdx]?.click(); }
  }
  if (e.key === "Escape") {
    if (!$("settingsModal").classList.contains("hidden")) return closeSettings();
    search.value = ""; $("searchClear").classList.add("hidden"); showView("home"); search.blur();
  }
});

/* ---------- закрепление панели ---------- */
$("pinBtn").addEventListener("click", async () => {
  const { mtools_pinned } = await store.get(["mtools_pinned"]);
  const next = !mtools_pinned;
  await store.set({ mtools_pinned: next });
  $("pinBtn").classList.toggle("on", next);
  if (next && chrome.sidePanel && chrome.windows) {
    chrome.windows.getCurrent().then((w) => chrome.sidePanel.open({ windowId: w.id }).catch(() => {}));
  }
});

/* ---------- настройки ---------- */
function renderQuickConfig() {
  const box = $("quickConfig");
  box.innerHTML = "";
  allTools().forEach((t) => {
    const row = document.createElement("label");
    row.className = "check-row";
    row.append(iconEl(t));
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = t.name;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = quickIds.includes(t.id);
    cb.dataset.id = t.id;
    row.append(nm, cb);
    box.appendChild(row);
  });
}
function openSettings() { renderQuickConfig(); $("settingsModal").classList.remove("hidden"); }
function closeSettings() { $("settingsModal").classList.add("hidden"); }
$("settingsBtn").addEventListener("click", openSettings);
$("configQuick").addEventListener("click", openSettings);
$("closeSettings").addEventListener("click", closeSettings);
$("settingsModal").addEventListener("click", (e) => { if (e.target === $("settingsModal")) closeSettings(); });
$("resetQuick").addEventListener("click", () => { quickIds = [...DEFAULT_QUICK]; renderQuickConfig(); });
$("saveQuick").addEventListener("click", async () => {
  quickIds = [...$("quickConfig").querySelectorAll("input:checked")].map((c) => c.dataset.id).slice(0, 8);
  await store.set({ mtools_quick: quickIds });
  pushSync({ quick: quickIds });
  renderQuick();
  closeSettings();
});

/* ---------- синхронизация с сервисом ---------- */
const API = APP_URL + "/api/public/extension/sync";
const syncState = $("syncState");
async function pullSync() {
  if (!token) return;
  syncState.textContent = "Синхронизация…";
  try {
    const r = await fetch(API + "?token=" + encodeURIComponent(token));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    prefs = j.prefs || {};
    remoteTools = j.tools || [];
    if (Array.isArray(prefs.links)) { links = prefs.links; renderLinks(); }
    if (Array.isArray(prefs.quick) && prefs.quick.length) { quickIds = prefs.quick; await store.set({ mtools_quick: quickIds }); }
    if (typeof prefs.notes === "string" && !$("notesArea").value) $("notesArea").value = prefs.notes;
    renderQuick(); renderRecent(); renderQuickConfig();
    syncState.textContent = "Синхронизировано · " + remoteTools.length + " инструментов" + (j.user?.name ? " · " + j.user.name : "");
  } catch (e) {
    syncState.textContent = "Ошибка синхронизации: " + e.message;
  }
}
async function pushSync(patch) {
  if (!token) return;
  prefs = { ...prefs, ...patch };
  try {
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, prefs: patch }) });
  } catch {}
}
$("syncGo").addEventListener("click", async () => {
  token = $("syncToken").value.trim();
  await store.set({ mtools_token: token });
  pullSync();
});

/* ---------- контекстное меню ---------- */
async function consumeContextAction() {
  const r = await store.get(["mtools_context_action"]);
  const action = r?.mtools_context_action;
  if (!action || !action.createdAt || Date.now() - action.createdAt > 10 * 60 * 1000) return;
  await store.remove("mtools_context_action");
  if (!action.tool) return;
  openTool(action.tool);
  const selection = action.selection || "";
  if (action.tool === "calc" && selection) {
    $("calcExpr").value = selection.replace(/[^0-9+\-*/%().\s]/g, "");
    $("calcRes").textContent = "Готово — нажмите =";
  }
  if (action.tool === "conv") {
    const n = Number(selection.replace(/,/g, ".").trim());
    if (Number.isFinite(n)) $("convVal").value = n;
    convert();
  }
  if (action.tool === "text" && selection) {
    const input = $("txtIn");
    input.value = selection;
    if (action.action === "upper") input.value = input.value.toUpperCase();
    if (action.action === "lower") input.value = input.value.toLowerCase();
    if (action.action === "trim") input.value = input.value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    input.dispatchEvent(new Event("input"));
  }
  if (action.tool === "color" && selection) {
    const match = selection.match(/#[0-9a-f]{6}\b/i);
    if (match) { $("colHex").value = match[0].toUpperCase(); renderColor(); }
    else $("colOut").textContent = "Выделите HEX-цвет, например #5B4BFF";
  }
  if (action.tool === "pass") $("passGen").click();
}

/* ---------- калькулятор ---------- */
const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C","(",")","%"];
const pad = $("calcPad"), expr = $("calcExpr"), res = $("calcRes");
keys.forEach((k) => {
  const btn = document.createElement("button");
  btn.textContent = k;
  btn.addEventListener("click", () => {
    if (k === "C") { expr.value = ""; res.textContent = "0"; return; }
    if (k === "=") {
      try {
        if (!/^[-+*/%().\d\s]+$/.test(expr.value)) throw new Error();
        res.textContent = String(Function(`"use strict";return (${expr.value})`)());
      } catch { res.textContent = "Ошибка"; }
      return;
    }
    expr.value += k;
  });
  pad.appendChild(btn);
});

/* ---------- пароли ---------- */
$("passGen").addEventListener("click", () => {
  let set = "abcdefghijkmnopqrstuvwxyz";
  if ($("pUp").checked) set += "ABCDEFGHJKLMNPQRSTUVWXYZ";
  if ($("pNum").checked) set += "23456789";
  if ($("pSym").checked) set += "!@#$%^&*-_=+";
  const len = Math.max(6, Math.min(64, +$("passLen").value || 16));
  const arr = crypto.getRandomValues(new Uint32Array(len));
  $("passOut").value = Array.from(arr, (n) => set[n % set.length]).join("");
});
$("passCopy").addEventListener("click", () => {
  const v = $("passOut").value;
  if (v) navigator.clipboard.writeText(v);
});

/* ---------- конвертер ---------- */
const UNITS = {
  len: { м: 1, км: 1000, см: 0.01, миля: 1609.34, фут: 0.3048 },
  mass: { кг: 1, г: 0.001, т: 1000, фунт: 0.453592 },
  temp: { "°C": 1, "°F": 1, K: 1 },
};
const kind = $("convKind"), from = $("convFrom"), to = $("convTo");
function fillUnits() {
  const u = Object.keys(UNITS[kind.value]);
  [from, to].forEach((sel, i) => {
    sel.innerHTML = u.map((x) => `<option>${x}</option>`).join("");
    sel.selectedIndex = Math.min(i, u.length - 1);
  });
  convert();
}
function convert() {
  const v = parseFloat($("convVal").value);
  if (isNaN(v)) return ($("convRes").textContent = "—");
  let out;
  if (kind.value === "temp") {
    const c = from.value === "°C" ? v : from.value === "°F" ? (v - 32) / 1.8 : v - 273.15;
    out = to.value === "°C" ? c : to.value === "°F" ? c * 1.8 + 32 : c + 273.15;
  } else {
    const t = UNITS[kind.value];
    out = (v * t[from.value]) / t[to.value];
  }
  $("convRes").textContent = Math.round(out * 10000) / 10000 + " " + to.value;
}
kind.addEventListener("change", fillUnits);
[from, to, $("convVal")].forEach((el) => el.addEventListener("input", convert));
fillUnits();

/* ---------- заметки ---------- */
const notes = $("notesArea");
let nt;
notes.addEventListener("input", () => {
  clearTimeout(nt);
  nt = setTimeout(() => {
    store.set({ mtools_notes: notes.value });
    pushSync({ notes: notes.value });
    $("notesSaved").textContent = "Сохранено";
    setTimeout(() => ($("notesSaved").innerHTML = "&nbsp;"), 1200);
  }, 400);
});

/* ---------- помодоро ---------- */
let left = 25 * 60, running = false, focus = true, iv;
const disp = $("pomoTime");
const render = () => {
  disp.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  $("pomoMode").textContent = focus ? "Фокус" : "Перерыв";
};
$("pomoStart").addEventListener("click", (e) => {
  running = !running;
  e.target.textContent = running ? "Пауза" : "Старт";
  clearInterval(iv);
  if (running) iv = setInterval(() => {
    left--;
    if (left <= 0) { focus = !focus; left = focus ? 25 * 60 : 5 * 60; }
    render();
  }, 1000);
});
$("pomoReset").addEventListener("click", () => {
  running = false; clearInterval(iv); focus = true; left = 25 * 60;
  $("pomoStart").textContent = "Старт";
  render();
});
render();

/* ---------- текст ---------- */
const txt = $("txtIn"), txtStat = $("txtStat");
const statTxt = () => {
  const v = txt.value;
  txtStat.textContent = `${v.length} символов · ${v.trim() ? v.trim().split(/\s+/).length : 0} слов · ${v.split("\n").length} строк`;
};
txt.addEventListener("input", statTxt);
document.querySelectorAll("[data-tx]").forEach((b) =>
  b.addEventListener("click", () => {
    const v = txt.value;
    try {
      switch (b.dataset.tx) {
        case "upper": txt.value = v.toUpperCase(); break;
        case "lower": txt.value = v.toLowerCase(); break;
        case "title": txt.value = v.replace(/\p{L}[\p{L}']*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()); break;
        case "b64e": txt.value = btoa(unescape(encodeURIComponent(v))); break;
        case "b64d": txt.value = decodeURIComponent(escape(atob(v.trim()))); break;
        case "json": txt.value = JSON.stringify(JSON.parse(v), null, 2); break;
        case "trim": txt.value = v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); break;
        case "copy": navigator.clipboard.writeText(v); break;
        case "clear": txt.value = ""; break;
      }
    } catch { txt.value = "Ошибка обработки"; }
    statTxt();
  }),
);
statTxt();

/* ---------- цвет ---------- */
const colHex = $("colHex"), colPick = $("colPick"), colOut = $("colOut"), colSwatch = $("colSwatch");
function hexToRgb(h) {
  const m = /^#?([\da-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function renderColor() {
  const rgb = hexToRgb(colHex.value);
  if (!rgb) return (colOut.textContent = "Некорректный HEX");
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hdeg = 0;
  if (d) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    hdeg = max === rr ? 60 * (((gg - bb) / d) % 6) : max === gg ? 60 * ((bb - rr) / d + 2) : 60 * ((rr - gg) / d + 4);
    if (hdeg < 0) hdeg += 360;
  }
  colSwatch.style.background = `rgb(${r},${g},${b})`;
  colPick.value = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  colOut.textContent = `rgb(${r}, ${g}, ${b}) · hsl(${Math.round(hdeg)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
colHex.addEventListener("input", renderColor);
colPick.addEventListener("input", () => { colHex.value = colPick.value.toUpperCase(); renderColor(); });
$("colRand").addEventListener("click", () => {
  colHex.value = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  renderColor();
});
$("colCopy").addEventListener("click", () => navigator.clipboard.writeText(colHex.value + " · " + colOut.textContent));
renderColor();

/* ---------- даты ---------- */
const dA = $("dA"), dB = $("dB");
const today = new Date().toISOString().slice(0, 10);
dA.value = today; dB.value = today;
const diff = () => {
  const a = new Date(dA.value), b = new Date(dB.value);
  if (isNaN(+a) || isNaN(+b)) return;
  $("dDiff").textContent = `${Math.round((b - a) / 86400000)} дн.`;
};
[dA, dB].forEach((el) => el.addEventListener("change", diff));
diff();
$("tsGo").addEventListener("click", () => {
  const raw = $("tsIn").value.trim();
  const n = Number(raw), out = $("tsOut");
  if (!raw) return (out.textContent = "Сейчас: " + Math.floor(Date.now() / 1000));
  if (isNaN(n)) return (out.textContent = "Не число");
  out.textContent = new Date(n < 1e12 ? n * 1000 : n).toLocaleString("ru-RU");
});

/* ---------- утилиты ---------- */
$("uuidGen").addEventListener("click", () => {
  const v = crypto.randomUUID ? crypto.randomUUID() : "";
  $("uuidOut").value = v;
  if (v) navigator.clipboard.writeText(v).catch(() => {});
});
$("hashGo").addEventListener("click", async () => {
  const val = $("hashIn").value;
  if (!val) return;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
  $("hashOut").textContent = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
});
$("pctGo").addEventListener("click", () => {
  const a = parseFloat($("pctA").value), b = parseFloat($("pctB").value);
  $("pctOut").textContent = isFinite(a) && isFinite(b) && b !== 0 ? ((a / b) * 100).toFixed(2) + " %" : "—";
});
$("rndGo").addEventListener("click", () => {
  const a = Math.ceil(+$("rndA").value || 0), b = Math.floor(+$("rndB").value || 0);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  $("rndOut").textContent = String(lo + Math.floor(Math.random() * (hi - lo + 1)));
});

/* ---------- личные ссылки ---------- */
const DEFAULT_LINKS = [
  { name: "Рабочее пространство MTools", url: APP_URL + "/dashboard" },
  { name: "Мои задачи", url: APP_URL + "/tasks" },
  { name: "Календарь смен", url: APP_URL + "/calendar" },
];
const linkList = $("linkList");
function renderLinks() {
  linkList.innerHTML = "";
  links.forEach((l, i) => {
    const row = document.createElement("div");
    row.className = "row";
    const a = document.createElement("button");
    a.className = "btn";
    a.style.flex = "1";
    a.style.textAlign = "left";
    a.textContent = l.name;
    a.title = l.url;
    a.addEventListener("click", () => openUrl(l.url));
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "✕";
    del.addEventListener("click", () => { links.splice(i, 1); saveLinks(); });
    row.append(a, del);
    linkList.appendChild(row);
  });
  if (!links.length) linkList.innerHTML = '<div class="muted">Пока нет ссылок — добавьте ниже.</div>';
}
function saveLinks() {
  store.set({ mtools_links: links });
  pushSync({ links });
  renderLinks();
}
$("lAdd").addEventListener("click", () => {
  const name = $("lName").value.trim();
  let url = $("lUrl").value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  links.push({ name, url });
  $("lName").value = ""; $("lUrl").value = "";
  saveLinks();
});

/* ---------- старт ---------- */
(async function init() {
  const r = await store.get(["mtools_quick", "mtools_recent", "mtools_token", "mtools_notes", "mtools_links", "mtools_pinned"]);
  quickIds = Array.isArray(r.mtools_quick) ? r.mtools_quick : [...DEFAULT_QUICK];
  recent = Array.isArray(r.mtools_recent) ? r.mtools_recent : [];
  links = Array.isArray(r.mtools_links) ? r.mtools_links : DEFAULT_LINKS;
  notes.value = r.mtools_notes ?? "";
  $("pinBtn").classList.toggle("on", !!r.mtools_pinned);
  renderQuick(); renderRecent(); renderLinks();
  if (r.mtools_token) {
    token = r.mtools_token;
    $("syncToken").value = token;
    pullSync();
  }
  consumeContextAction();
})();
