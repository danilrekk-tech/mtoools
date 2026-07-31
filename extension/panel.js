const APP_URL = "https://mtoools.lovable.app";
document.getElementById("openApp").href = APP_URL + "/dashboard";

// tabs
const tabs = document.querySelectorAll("#tabs button");
tabs.forEach((b) =>
  b.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ["calc", "pass", "conv", "notes", "pomo", "text", "color", "date", "links"].forEach((id) =>
      document.getElementById(id).classList.toggle("hidden", id !== b.dataset.t),
    );
  }),
);

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
