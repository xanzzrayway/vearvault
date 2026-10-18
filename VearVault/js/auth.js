/* ---------- Auth ---------- */
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
async function setUser(u){
  user = u; profile = null;
  if(u) profile = await loadProfile();
  if(!u && view==="mine"){ view="all"; syncSeg(); }
  renderAuth();
  if(typeof syncInbox === "function") syncInbox();
  if(typeof syncModeration === "function") syncModeration();
  if(typeof syncDM === "function") syncDM();
  if(u && !profile) openOnb("first");
  load();
}
