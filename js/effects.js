/* ---------- Efek kaca ---------- */
if(navigator.userAgentData && navigator.userAgentData.brands.some(b=>/Chromium/.test(b.brand))) document.documentElement.classList.add("refract");
$("#grid").addEventListener("pointermove", e => {
  const c = e.target.closest(".card"); if(!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty("--mx",(e.clientX-r.left)+"px");
  c.style.setProperty("--my",(e.clientY-r.top)+"px");
});
