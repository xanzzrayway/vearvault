/* ---------- Auth ---------- */
let guest = null;   // akun tamu (anonim): { id, profile }. Aplikasi tetap menganggap "belum login" (user = null), hanya Chat Global yang memakainya.
function renderAuth(){
  const a = $("#auth");
  if(!user){
    a.innerHTML = `<button class="gbtn" id="loginBtn"><span class="gico">${GLOGO}<b>+</b></span><span class="t">Masuk</span></button>`;
    $("#loginBtn").onclick = login;
    return;
  }
  const name = (profile && profile.display_name) || "";
  const img = (profile && profile.avatar_url) || googleAvatar();
  a.innerHTML = `<button class="user" id="avBtn" aria-label="Profil">${avatarTag(img, name||user.email, "avatar")}</button>`;
  $("#avBtn").onclick = openProfile;
}

async function login(){
  if(!configured){ toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu"); return; }
  const { error } = await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: location.origin + location.pathname } });
  if(error) toast("Gagal masuk dengan Google");
}
async function logout(){ await sb.auth.signOut(); }
async function loadProfile(){
  if(!configured) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data || null;
}
async function setUser(raw){
  const anon = !!(raw && raw.is_anonymous);
  const u = anon ? null : raw;
  guest = anon ? { id: raw.id, profile: null } : null;
  user = u; profile = null;
  if(u) profile = await loadProfile();
  if(anon) await loadGuest();
  if(!u && view==="mine"){ view="all"; syncSeg(); }
  renderAuth();
  if(typeof syncInbox === "function") syncInbox();
  if(typeof syncModeration === "function") syncModeration();
  if(typeof syncReview === "function") syncReview();
  if(typeof syncPanel === "function") syncPanel();
  if(typeof syncMissions === "function") syncMissions();
  if(typeof syncDM === "function") syncDM();
  if(typeof syncCall === "function") syncCall();
  if(typeof syncPresence === "function") syncPresence();
  if(u && !profile) openOnb("first");
  load();
}
