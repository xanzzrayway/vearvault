/* ---------- Tema: warna tombol dan warna latar (disimpan di perangkat) ---------- */
const THEME_KEY = "vv_theme";
const THEME_VARS = ["--b1","--b2","--acc1-rgb","--acc2-rgb","--acc-rgb","--accd-rgb","--sh-rgb","--blue-h","--o1","--o2","--o3","--o4","--bg0","--bg1"];

function hex2rgb(h){
  h = String(h).replace("#", "");
  if(h.length === 3) h = h.split("").map(x => x + x).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgb2hsl([r, g, b]){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if(mx !== mn){
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l){
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if(h < 60) [r, g, b] = [c, x, 0]; else if(h < 120) [r, g, b] = [x, c, 0];
  else if(h < 180) [r, g, b] = [0, c, x]; else if(h < 240) [r, g, b] = [0, x, c];
  else if(h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const rgbStr = a => a.join(",");
const toHex = a => "#" + a.map(v => v.toString(16).padStart(2, "0")).join("");

function themeLoad(){
  try{ return JSON.parse(localStorage.getItem(THEME_KEY) || "null") || {}; }catch{ return {}; }
}
function themeSave(t){
  try{
    if(!t || (!t.btn && !t.bg)) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, JSON.stringify(t));
  }catch{}
}
function themeApply(t){
  const st = document.documentElement.style;
  THEME_VARS.forEach(k => st.removeProperty(k));
  t = t || {};
  if(t.btn){
    let [h, s, l] = rgb2hsl(hex2rgb(t.btn));
    l = Math.min(l, .52);                    // cukup gelap supaya tulisan putih tetap terbaca
    if(s > .08) s = Math.max(s, .35);
    const b2 = hsl2rgb(h, s, l);
    const b1 = hsl2rgb(h, Math.min(1, s + .1), Math.min(.72, l + .17));
    st.setProperty("--b1", toHex(b1));
    st.setProperty("--b2", toHex(b2));
    st.setProperty("--acc1-rgb", rgbStr(b1));
    st.setProperty("--acc2-rgb", rgbStr(b2));
    st.setProperty("--acc-rgb", rgbStr(hsl2rgb(h, s, Math.min(.55, l + .04))));
    st.setProperty("--accd-rgb", rgbStr(hsl2rgb(h, s, Math.max(.12, l - .3))));
    st.setProperty("--sh-rgb", rgbStr(hsl2rgb(h, Math.min(s, .5), .28)));
    st.setProperty("--blue-h", toHex(hsl2rgb(h, s, Math.max(.2, l - .08))));
  }
  if(t.bg){
    const [h, s0] = rgb2hsl(hex2rgb(t.bg));
    const s = s0 < .1 ? s0 : Math.max(s0, .45);   // abu-abu tetap abu-abu
    const o = [hsl2rgb(h, s, .62), hsl2rgb(h + 35, s, .7), hsl2rgb(h - 35, s, .76), hsl2rgb(h + 70, s, .86)];
    o.forEach((v, i) => st.setProperty("--o" + (i + 1), rgbStr(v)));
    st.setProperty("--bg0", toHex(hsl2rgb(h, Math.min(.9, s), .965)));
    st.setProperty("--bg1", toHex(hsl2rgb(h, Math.min(.9, s), .975)));
  }
}
themeApply(themeLoad());
