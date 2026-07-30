const APP_URL = "https://mtoools.lovable.app";
document.getElementById("openApp").href = APP_URL + "/dashboard";

// tabs
const tabs = document.querySelectorAll("#tabs button");
tabs.forEach((b) =>
  b.addEventListener("click", () => {
    tabs.forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ["calc", "pass", "conv", "notes", "pomo"].forEach((id) =>
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
