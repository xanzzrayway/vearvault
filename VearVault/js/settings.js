/* ---------- Pengaturan: warna tombol dan warna latar ---------- */
const BTN_COLORS = [["Biru", null], ["Ungu", "#7c3aed"], ["Pink", "#db2777"], ["Merah", "#dc2626"], ["Oranye", "#ea580c"], ["Hijau", "#16a34a"], ["Teal", "#0d9488"], ["Hitam", "#1f2937"]];
const BG_COLORS = [["Bawaan", null], ["Mint", "#34d399"], ["Lavender", "#a78bfa"], ["Peach", "#fb923c"], ["Rose", "#fb7185"], ["Langit", "#38bdf8"], ["Abu", "#94a3b8"], ["Kuning", "#facc15"]];
const BTN_DEF = "#1d4ed8", BG_DEF = "#60a5fa";

function paintSwatches(box, list, cur, def, key){
  const isPreset = list.some(([, v]) => v === cur);
  box.innerHTML = list.map(([n, v]) =>
    `<button class="sw-c ${v === cur ? "on" : ""} ${v ? "" : "def-" + key}" style="--c:${v || def}" data-c="${v || ""}" type="button" aria-label="${n}"></button>`
  ).join("") +
  `<label class="sw-c cu ${cur && !isPreset ? "on" : ""}" aria-label="Warna sendiri"><input type="color" value="${cur || def}" data-key="${key}"></label>`;
}
function paintSettings(){
  const t = themeLoad();
  paintSwatches($("#swBtn"), BTN_COLORS, t.btn || null, BTN_DEF, "btn");
  paintSwatches($("#swBg"), BG_COLORS, t.bg || null, BG_DEF, "bg");
}
function setTheme(key, val, save){
  const t = themeLoad();
  if(val) t[key] = val; else delete t[key];
  themeApply(t);
  if(save){ themeSave(t); paintSettings(); }
}
function openSettings(){ paintSettings(); $("#stBot").hidden = !isAdmin(); $("#set").showModal(); }

[["#swBtn", "btn"], ["#swBg", "bg"]].forEach(([sel, key]) => {
  const box = $(sel);
  box.addEventListener("click", e => {
    const b = e.target.closest("button.sw-c"); if(!b) return;
    setTheme(key, b.dataset.c || null, true);
  });
  box.addEventListener("input", e => { if(e.target.type === "color") setTheme(key, e.target.value, false); });   // pratinjau langsung
  box.addEventListener("change", e => { if(e.target.type === "color") setTheme(key, e.target.value, true); });
});
$("#setReset").onclick = () => { themeSave(null); themeApply(null); paintSettings(); toast("Warna diatur ulang"); };
$("#setX").onclick = () => $("#set").close();
