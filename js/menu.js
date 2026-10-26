/* ---------- Menu samping (tombol garis 3) ---------- */
/* Belum login Google (termasuk tamu): hanya Chat Global yang terbuka, menu lain agak transparan dan mengarah ke login */
const DR_OPEN = new Set(["chat"]);
function paintDrawerLocks(){
  document.querySelectorAll("#drawer [data-go]").forEach(b => b.classList.toggle("locked", !user && !DR_OPEN.has(b.dataset.go)));
}
function paintDrawerUser(){
  const d = $("#drUser");
  paintDrawerLocks();
  if(!user){
    const gn = guest && guest.profile ? `<small class="dr-guest">Masuk sebagai tamu: <b>${esc(guest.profile.display_name)}</b></small>` : "";
    d.innerHTML = `<button class="dr-login" id="drLogin" type="button"><span class="gico">${GLOGO}<b>+</b></span><span>Masuk dengan Google</span></button>${gn}`;
    $("#drLogin").onclick = () => { $("#drawer").close(); login(); };
    return;
  }
  const name = (profile && profile.display_name) || "Akun baru";
  const img = (profile && profile.avatar_url) || googleAvatar();
  d.innerHTML = `<button class="dr-card" id="drCard" type="button">${avatarTag(img, name, "avatar sm")}<div><b>${esc(name)}</b><span class="pill">${esc(roleName(profile && profile.role))}</span></div></button>`;
  $("#drCard").onclick = () => { $("#drawer").close(); openProfile(); };
}
$("#menuBtn").onclick = () => { paintDrawerUser(); $("#drawer").showModal(); if(typeof refreshReviewCount === "function") refreshReviewCount(); };
$("#drX").onclick = () => $("#drawer").close();
$("#drawer").addEventListener("click", e => { if(e.target === $("#drawer")) $("#drawer").close(); });

const GO = {
  home: () => (document.documentElement.classList.contains("fixbar") ? $("#app") : window).scrollTo({ top: 0, behavior: "smooth" }),
  chat: () => openChat(),
  pm: () => openPM(),
  box: () => openBox(),
  find: () => openFind(),
  store: () => openStore(),
  review: () => openReview(),
  panel: () => openPanel(),
  mission: () => openMissions(),
  set: () => openSettings()
};
$("#drawer").querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
  $("#drawer").close();
  if(!user && !DR_OPEN.has(b.dataset.go)){ needGoogle("Masuk dengan Google untuk membuka menu ini"); return; }
  GO[b.dataset.go]();
});
