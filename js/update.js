/* Cek versi: kalau ada update baru, halaman dimuat ulang otomatis */
(async () => {
  try {
    const cur = document.documentElement.dataset.build;
    if(!cur) return;
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    if(!r.ok) return;
    const { v } = await r.json();
    if(v && v !== cur && sessionStorage.getItem("vv_reload") !== v){
      sessionStorage.setItem("vv_reload", v);
      location.reload();
    }
  } catch {}
})();
