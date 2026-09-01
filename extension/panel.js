const APP_URL = "https://mtoools.lovable.app";
document.getElementById("openApp").href = APP_URL + "/dashboard";

// tabs
const tabs = document.querySelectorAll("#tabs button");
tabs.forEach((b) =>
  b.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ["calc", "pass", "conv", "notes", "pomo", "text", "color", "date", "util", "links"].forEach((id) =>
      document.getElementById(id).classList.toggle("hidden", id !== b.dataset.t),
    );
  }),
);

// quick launcher + search
const TOOL_LABELS = {
  calc: "Калькулятор", pass: "Пароли", conv: "Конвертер", notes: "Заметки",
  pomo: "Помодоро", text: "Текст", color: "Цвет", date: "Даты", util: "Утилиты", links: "Сервисы",
};
const toolSearch = document.getElementById("toolSearch");
const quickButtons = document.querySelectorAll("[data-quick]");
const activateTool = (tool) => {
  const b = document.querySelector(`#tabs button[data-t="${tool}"]`);
  if (b) b.click();
  quickButtons.forEach((x) => x.classList.toggle("active", x.dataset.quick === tool));
};
quickButtons.forEach((b) => b.addEventListener("click", () => {
  activateTool(b.dataset.quick);
  toolSearch?.focus();
  toolSearch?.select();
}));
toolSearch?.addEventListener("input", () => {
  const q = toolSearch.value.trim().toLowerCase();
  tabs.forEach((b) => {
    const match = !q || (TOOL_LABELS[b.dataset.t] || b.textContent).toLowerCase().includes(q);
    b.classList.toggle("quick-match-hidden", !match);
  });
  if (q) {
    const first = [...tabs].find((b) => !b.classList.contains("quick-match-hidden"));
    if (first) activateTool(first.dataset.t);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
    e.preventDefault();
    toolSearch?.focus();
  }
  if (e.key === "Escape" && document.activeElement === toolSearch) {
    toolSearch.value = "";
    toolSearch.dispatchEvent(new Event("input"));
    toolSearch.blur();
  }
});
document.getElementById("openSideInfo")?.addEventListener("click", () => {
  toolSearch?.focus();
});

// Context-menu actions are staged by the background service worker.
async function consumeContextAction() {
  if (!chrome.storage?.local) return;
  chrome.storage.local.get(["mtools_context_action"], (r) => {
    const action = r?.mtools_context_action;
    if (!action || !action.createdAt || Date.now() - action.createdAt > 10 * 60 * 1000) return;
    chrome.storage.local.remove("mtools_context_action");
    if (!action.tool) return;
    activateTool(action.tool);
    const selection = action.selection || "";
    if (action.tool === "calc" && selection) {
      document.getElementById("calcExpr").value = selection.replace(/[^0-9+\-*/%().\s]/g, "");
      document.getElementById("calcRes").textContent = "Готово — нажмите =";
    }
    if (action.tool === "conv") {
      const n = Number(selection.replace(/,/g, ".").trim());
      if (Number.isFinite(n)) document.getElementById("convVal").value = n;
      convert();
    }
    if (action.tool === "text" && selection) {
      const input = document.getElementById("txtIn");
      input.value = selection;
      if (action.action === "upper") input.value = input.value.toUpperCase();
      if (action.action === "lower") input.value = input.value.toLowerCase();
      if (action.action === "trim") input.value = input.value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      input.dispatchEvent(new Event("input"));
    }
    if (action.tool === "color" && selection) {
      const match = selection.match(/#[0-9a-f]{6}\b/i);
      if (match) {
        document.getElementById("colHex").value = match[0].toUpperCase();
        renderColor();
      } else {
        document.getElementById("colOut").textContent = "Выделите HEX-цвет, например #5B4BFF";
      }
    }
  });
}

// calculator
const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C","(",")","%"];
const pad = document.getElementById("calcPad");
const expr = document.getElementById("calcExpr");
const res = document.getElementById("calcRes");
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

// passwords
document.getElementById("passGen").addEventListener("click", () => {
  let set = "abcdefghijkmnopqrstuvwxyz";
  if (document.getElementById("pUp").checked) set += "ABCDEFGHJKLMNPQRSTUVWXYZ";
  if (document.getElementById("pNum").checked) set += "23456789";
  if (document.getElementById("pSym").checked) set += "!@#$%^&*-_=+";
  const len = Math.max(6, Math.min(64, +document.getElementById("passLen").value || 16));
  const arr = crypto.getRandomValues(new Uint32Array(len));
  document.getElementById("passOut").value = Array.from(arr, (n) => set[n % set.length]).join("");
});
document.getElementById("passCopy").addEventListener("click", () => {
  const v = document.getElementById("passOut").value;
  if (v) navigator.clipboard.writeText(v);
});

// converter
const UNITS = {
  len: { м: 1, км: 1000, см: 0.01, миля: 1609.34, фут: 0.3048 },
  mass: { кг: 1, г: 0.001, т: 1000, фунт: 0.453592 },
  temp: { "°C": 1, "°F": 1, K: 1 },
};
const kind = document.getElementById("convKind");
const from = document.getElementById("convFrom");
const to = document.getElementById("convTo");
function fillUnits() {
  const u = Object.keys(UNITS[kind.value]);
  [from, to].forEach((sel, i) => {
    sel.innerHTML = u.map((x) => `<option>${x}</option>`).join("");
    sel.selectedIndex = Math.min(i, u.length - 1);
  });
  convert();
}
function convert() {
  const v = parseFloat(document.getElementById("convVal").value);
  if (isNaN(v)) return (document.getElementById("convRes").textContent = "—");
  let out;
  if (kind.value === "temp") {
    const c = from.value === "°C" ? v : from.value === "°F" ? (v - 32) / 1.8 : v - 273.15;
    out = to.value === "°C" ? c : to.value === "°F" ? c * 1.8 + 32 : c + 273.15;
  } else {
    const t = UNITS[kind.value];
    out = (v * t[from.value]) / t[to.value];
  }
  document.getElementById("convRes").textContent = Math.round(out * 10000) / 10000 + " " + to.value;
}
kind.addEventListener("change", fillUnits);
[from, to, document.getElementById("convVal")].forEach((el) => el.addEventListener("input", convert));
fillUnits();

// notes
const notes = document.getElementById("notesArea");
chrome.storage?.local.get(["mtools_notes"], (r) => { notes.value = r?.mtools_notes ?? ""; });
let t;
notes.addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(() => {
    chrome.storage?.local.set({ mtools_notes: notes.value });
    document.getElementById("notesSaved").textContent = "Сохранено";
    setTimeout(() => (document.getElementById("notesSaved").innerHTML = "&nbsp;"), 1200);
  }, 400);
});

// pomodoro
let left = 25 * 60, running = false, focus = true, iv;
const disp = document.getElementById("pomoTime");
const render = () => {
  disp.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  document.getElementById("pomoMode").textContent = focus ? "Фокус" : "Перерыв";
};
document.getElementById("pomoStart").addEventListener("click", (e) => {
  running = !running;
  e.target.textContent = running ? "Пауза" : "Старт";
  clearInterval(iv);
  if (running) iv = setInterval(() => {
    left--;
    if (left <= 0) { focus = !focus; left = focus ? 25 * 60 : 5 * 60; }
    render();
  }, 1000);
});
document.getElementById("pomoReset").addEventListener("click", () => {
  running = false; clearInterval(iv); focus = true; left = 25 * 60;
  document.getElementById("pomoStart").textContent = "Старт";
  render();
});
render();


// ---------- text tools ----------
const txt = document.getElementById("txtIn");
const txtStat = document.getElementById("txtStat");
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

// ---------- color ----------
const colHex = document.getElementById("colHex");
const colPick = document.getElementById("colPick");
const colOut = document.getElementById("colOut");
const colSwatch = document.getElementById("colSwatch");
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
  const l = (max + min) / 2;
  const d = max - min;
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
document.getElementById("colRand").addEventListener("click", () => {
  colHex.value = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
  renderColor();
});
document.getElementById("colCopy").addEventListener("click", () => navigator.clipboard.writeText(colOut.textContent));
renderColor();

// ---------- dates ----------
const dA = document.getElementById("dA"), dB = document.getElementById("dB");
const today = new Date().toISOString().slice(0, 10);
dA.value = today; dB.value = today;
const diff = () => {
  const a = new Date(dA.value), b = new Date(dB.value);
  if (isNaN(+a) || isNaN(+b)) return;
  const days = Math.round((b - a) / 86400000);
  document.getElementById("dDiff").textContent = `${days} дн.`;
};
[dA, dB].forEach((el) => el.addEventListener("change", diff));
diff();
document.getElementById("tsGo").addEventListener("click", () => {
  const raw = document.getElementById("tsIn").value.trim();
  const n = Number(raw);
  const out = document.getElementById("tsOut");
  if (!raw) return (out.textContent = "Сейчас: " + Math.floor(Date.now() / 1000));
  if (isNaN(n)) return (out.textContent = "Не число");
  out.textContent = new Date(n < 1e12 ? n * 1000 : n).toLocaleString("ru-RU");
});

// ---------- account sync ----------
const API = APP_URL + "/api/public/extension/sync";
let token = "";
let prefs = {};
const syncState = document.getElementById("syncState");
const remoteList = document.getElementById("remoteList");

function iconUrl(t) {
  if (t.kind === "external" && t.url) {
    try { return "https://www.google.com/s2/favicons?domain=" + new URL(t.url).hostname + "&sz=64"; } catch { return null; }
  }
  return null;
}
function openUrl(url) { chrome.tabs ? chrome.tabs.create({ url }) : window.open(url, "_blank"); }

function renderRemote(tools) {
  remoteList.innerHTML = "";
  if (!tools || !tools.length) { remoteList.innerHTML = '<div class="muted">Нет доступных инструментов.</div>'; return; }
  tools.forEach((t) => {
    const b = document.createElement("button");
    b.className = "btn tool";
    b.title = t.description || t.name;
    const color = t.color || "#1E4FD9";
    b.style.borderColor = color + "55";
    b.style.background = "linear-gradient(135deg," + color + "26," + color + "0a)";
    const img = iconUrl(t);
    b.innerHTML = (img ? '<img src="' + img + '" width="16" height="16" />' : '<span class="dot" style="background:' + color + '"></span>') +
      "<span>" + t.name + "</span>" + (t.kind === "external" ? '<span class="muted">↗</span>' : "");
    b.addEventListener("click", () => {
      if (t.kind === "external" && t.url) return openUrl(t.url);
      openUrl(APP_URL + "/tools?tool=" + encodeURIComponent(t.slug));
    });
    remoteList.appendChild(b);
  });
}

async function pullSync() {
  if (!token) return;
  syncState.textContent = "Синхронизация…";
  try {
    const r = await fetch(API + "?token=" + encodeURIComponent(token));
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    prefs = j.prefs || {};
    renderRemote(j.tools);
    if (Array.isArray(prefs.links)) { links = prefs.links; renderLinks(); }
    if (typeof prefs.notes === "string" && !document.getElementById("notesArea").value) {
      document.getElementById("notesArea").value = prefs.notes;
    }
    if (prefs.tab) { const b = document.querySelector('#tabs button[data-t="' + prefs.tab + '"]'); if (b) b.click(); }
    syncState.textContent = "Синхронизировано" + (j.user?.name ? " · " + j.user.name : "");
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
const tokenInput = document.getElementById("syncToken");
document.getElementById("syncGo").addEventListener("click", () => {
  token = tokenInput.value.trim();
  chrome.storage?.local.set({ mtools_token: token });
  pullSync();
});
chrome.storage?.local.get(["mtools_token"], (r) => {
  if (r?.mtools_token) { token = r.mtools_token; tokenInput.value = token; pullSync(); }
});
tabs.forEach((b) => b.addEventListener("click", () => pushSync({ tab: b.dataset.t })));

// ---------- external services ----------
const DEFAULT_LINKS = [
  { name: "Рабочее пространство MTools", url: APP_URL + "/dashboard" },
  { name: "Мои задачи", url: APP_URL + "/tasks" },
  { name: "Календарь смен", url: APP_URL + "/calendar" },
];
const linkList = document.getElementById("linkList");
let links = [];
function renderLinks() {
  linkList.innerHTML = "";
  links.forEach((l, i) => {
    const row = document.createElement("div");
    row.className = "row";
    row.style.marginTop = "6px";
    const a = document.createElement("button");
    a.className = "btn";
    a.style.flex = "1";
    a.style.textAlign = "left";
    a.textContent = l.name;
    a.title = l.url;
    a.addEventListener("click", () => chrome.tabs ? chrome.tabs.create({ url: l.url }) : window.open(l.url, "_blank"));
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "✕";
    del.addEventListener("click", () => { links.splice(i, 1); saveLinks(); });
    row.append(a, del);
    linkList.appendChild(row);
  });
  if (!links.length) linkList.innerHTML = '<div class="muted">Пока нет сервисов — добавьте ниже.</div>';
}
function saveLinks() {
  chrome.storage?.local.set({ mtools_links: links });
  pushSync({ links });
  renderLinks();
}
chrome.storage?.local.get(["mtools_links"], (r) => {
  links = r?.mtools_links ?? DEFAULT_LINKS;
  renderLinks();
});
document.getElementById("lAdd").addEventListener("click", () => {
  const name = document.getElementById("lName").value.trim();
  let url = document.getElementById("lUrl").value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  links.push({ name, url });
  document.getElementById("lName").value = "";
  document.getElementById("lUrl").value = "";
  saveLinks();
});


// ---- утилиты ----
const genUuid = () => (crypto.randomUUID ? crypto.randomUUID() : "");
document.getElementById("uuidGen").addEventListener("click", () => {
  const v = genUuid();
  document.getElementById("uuidOut").value = v;
  if (v) navigator.clipboard.writeText(v).catch(() => {});
});
document.getElementById("hashGo").addEventListener("click", async () => {
  const val = document.getElementById("hashIn").value;
  if (!val) return;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(val));
  document.getElementById("hashOut").textContent = [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
});
document.getElementById("pctGo").addEventListener("click", () => {
  const a = parseFloat(document.getElementById("pctA").value);
  const b = parseFloat(document.getElementById("pctB").value);
  document.getElementById("pctOut").textContent =
    isFinite(a) && isFinite(b) && b !== 0 ? ((a / b) * 100).toFixed(2) + " %" : "—";
});
document.getElementById("rndGo").addEventListener("click", () => {
  const a = Math.ceil(+document.getElementById("rndA").value || 0);
  const b = Math.floor(+document.getElementById("rndB").value || 0);
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  document.getElementById("rndOut").textContent = String(lo + Math.floor(Math.random() * (hi - lo + 1)));
});


consumeContextAction();
