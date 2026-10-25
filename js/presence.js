/* ---------- Status Online / Offline (kehadiran lewat Supabase Realtime Presence) ---------- */
/* Online = akun sedang login dan website terbuka. Tidak login atau website tertutup = Offline. */
let presCh = null, presOnline = new Set(), presReady = false;

const isOnline = id => presReady && presOnline.has(id);
function presBadge(id){
  const on = isOnline(id);
  return `<span class="pres ${presReady ? (on ? "on" : "off") : "wait"}" data-pres="${esc(id)}"><i></i><b>${on ? "Online" : "Offline"}</b></span>`;
}
function paintPresence(){
  document.querySelectorAll("[data-pres]").forEach(el => {
    const on = isOnline(el.dataset.pres);
    el.classList.toggle("wait", !presReady);
    el.classList.toggle("on", presReady && on);
    el.classList.toggle("off", presReady && !on);
    const b = el.querySelector("b"); if(b) b.textContent = on ? "Online" : "Offline";
  });
}
function presSync(){
  if(!presCh) return;
  presOnline = new Set(Object.keys(presCh.presenceState() || {}));
  presReady = true;
  paintPresence();
}
/* Dipanggil setiap login/logout. Pengunjung yang belum login hanya membaca, tidak ikut tercatat online. */
function syncPresence(){
  if(presCh && sb){ sb.removeChannel(presCh); presCh = null; }
  presOnline = new Set(); presReady = false;
  paintPresence();
  if(!configured) return;
  const ch = presCh = sb.channel("presence-global", { config: { presence: { key: user ? user.id : "tamu" } } });
  ch.on("presence", { event: "sync" }, presSync)
    .on("presence", { event: "join" }, presSync)
    .on("presence", { event: "leave" }, presSync)
    .subscribe(async status => {
      if(status === "SUBSCRIBED" && user && presCh === ch) await ch.track({ since: Date.now() });
    });
}
