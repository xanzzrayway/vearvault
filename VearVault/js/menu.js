/* ---------- Menu samping (tombol garis 3) ---------- */
function paintDrawerUser(){
  const d = $("#drUser");
  if(!user){
    d.innerHTML = `<button class="dr-login" id="drLogin" type="button"><span class="gico">${GLOGO}<b>+</b></span><span>Masuk dengan Google</span></button>`;
    $("#drLogin").onclick = () => { $("#drawer").close(); login(); };
    return;
  }
  const name = (profile && profile.display_name) || "Akun baru";
  const img = (profile && profile.avatar_url) || googleAvatar();
  d.innerHTML = `<button class="dr-card" id="drCard" type="button">${avatarTag(img, name, "avatar sm")}<div><b>${esc(name)}</b><span class="pill">${esc(roleName(profile && profile.role))}</span></div></button>`;
  $("#drCard").onclick = () => { $("#drawer").close(); openProfile(); };
}
$("#menuBtn").onclick = () => { paintDrawerUser(); $("#drawer").showModal(); };
$("#drX").onclick = () => $("#drawer").close();
$("#drawer").addEventListener("click", e => { if(e.target === $("#drawer")) $("#drawer").close(); });

const GO = {
  home: () => window.scrollTo({ top: 0, behavior: "smooth" }),
  chat: () => openChat(),
  pm: () => openPM(),
  box: () => openBox(),
  find: () => openFind(),
  store: () => openStore(),
  set: () => openSettings()
};
$("#drawer").querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
  $("#drawer").close();
  GO[b.dataset.go]();
});
