/* ---------- Mode tampilan: Klasik, Normal, Baru (liquid glass) ---------- */
const UI_KEY = "vv_ui";
const UI_MODES = [
  ["klasik", "Klasik", "Polos tanpa efek kaca"],
  ["normal", "Normal", "Kaca lembut seperti biasa"],
  ["baru",   "Baru",   "Liquid glass penuh"]
];
const uiGet = () => { try{ const v = localStorage.getItem(UI_KEY); return UI_MODES.some(m => m[0] === v) ? v : "normal"; }catch{ return "normal"; } };

function uiApply(m){
  const h = document.documentElement;
  h.dataset.ui = m;
  /* Pembiasan tepi (SVG displacement) hanya jalan di browser berbasis Chromium */
  try{ h.dataset.rfx = (window.CSS && CSS.supports && CSS.supports("backdrop-filter", "url(#lg-r)")) ? "1" : "0"; }catch{ h.dataset.rfx = "0"; }
}
function uiSet(m){
  try{ localStorage.setItem(UI_KEY, m); }catch{}
  uiApply(m);
  paintUiPick();
  toast("Tampilan " + (UI_MODES.find(x => x[0] === m) || [])[1]);
}
function paintUiPick(){
  const box = $("#uiPick"); if(!box) return;
  if($("#fixBar")) $("#fixBar").checked = fixGet();
  const cur = uiGet();
  box.innerHTML = UI_MODES.map(([id, name, sub]) =>
    `<button class="ui-opt ${id === cur ? "on" : ""}" type="button" data-m="${id}" aria-pressed="${id === cur}">
       <span class="ui-prev up-${id}"><i></i><b></b></span>
       <span class="ui-name">${name}</span><small>${sub}</small>
     </button>`).join("");
}
/* Bar browser tetap terlihat (halaman bergulir di dalam #app) */
const FIX_KEY = "vv_fixbar";
const fixGet = () => { try{ return localStorage.getItem(FIX_KEY) !== "0"; }catch{ return true; } };
function fixSet(on){
  const h = document.documentElement, app = $("#app");
  const y = h.classList.contains("fixbar") ? app.scrollTop : window.scrollY;
  try{ localStorage.setItem(FIX_KEY, on ? "1" : "0"); }catch{}
  h.classList.toggle("fixbar", on);
  if(on){ app.scrollTop = y; } else if(h.classList.contains("lock")){ window.__lockY = y; } else { window.scrollTo({ top: y, behavior: "instant" }); }
}
$("#fixBar").addEventListener("change", e => { fixSet(e.target.checked); toast(e.target.checked ? "Bar browser tetap terlihat" : "Bar browser boleh menghilang saat scroll"); });

$("#uiPick").addEventListener("click", e => { const b = e.target.closest(".ui-opt"); if(b && b.dataset.m !== uiGet()) uiSet(b.dataset.m); });

/* Kilau kaca mengikuti jari/kursor (hanya mode Baru) */
const LG_HOT = ".btn,.chip,.gbtn,.card,.seg,.bar,.pf-bar,.bx,.fr,.dr-item,.dr-card,.mcard,.st-card,.rv,.ai,.pickbtn,.role,.ch-in,.menu,.cmd,.menubtn,.mu-item,.ms-step,.mf-row,.ch-btn";
let lgRaf = 0, lgEv = null;
function lgMove(){
  lgRaf = 0; const e = lgEv; if(!e) return;
  const el = e.target.closest && e.target.closest(LG_HOT); if(!el) return;
  const r = el.getBoundingClientRect(); if(!r.width || !r.height) return;
  el.style.setProperty("--lx", Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)).toFixed(1) + "%");
  el.style.setProperty("--ly", Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)).toFixed(1) + "%");
}
["pointermove", "pointerdown"].forEach(t => document.addEventListener(t, e => {
  if(document.documentElement.dataset.ui !== "baru") return;
  lgEv = e; if(!lgRaf) lgRaf = requestAnimationFrame(lgMove);
}, { passive: true }));
