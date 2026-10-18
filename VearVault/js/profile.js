/* ---------- Profil (layar penuh): milik sendiri dan orang lain ---------- */
let edPhoto = null, edPicked = false, viewing = null, pfShown = PAGE;

async function updateProfile(part){
  const { error } = await sb.from("profiles").update(part).eq("id", user.id);
  if(error) throw error;
  const r = await sb.from("profiles").select("*").eq("id", user.id).single();
  if(r.error) throw r.error;
  profile = r.data;
}

const isOwn = v => !!(user && v && v.id === user.id);

function paintProfile(){
  const v = viewing; if(!v) return;
  const own = isOwn(v);
  const img = v.avatar_url || (own ? googleAvatar() : null);
  $("#pfHero").innerHTML = `${avatarTag(img, v.display_name, "avatar xxl")}
    <div class="pf-id"><h2>${esc(v.display_name)}</h2><span class="pill">${esc(roleName(v.role))}</span>${own ? `<small>${esc(user.email||"")}</small>` : ""}</div>`;
  const list = rows.filter(r => r.user_id===v.id && (r.is_public || own));
  const joined = v.created_at ? new Date(v.created_at).toLocaleDateString("id-ID", { month:"long", year:"numeric" }) : "-";
  $("#pfStats").innerHTML = `<div><b>${fmt(list.length)}</b><span>Prompt</span></div><div><b>${esc(joined)}</b><span>Bergabung</span></div>`;
  $("#profActs").hidden = !own;
  $("#profSend").hidden = own;
  $("#profGrid").innerHTML = list.length
    ? list.slice(0, pfShown).map(cardHTML).join("")
    : `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada prompt</h3></div>`;
  $("#pfMore").hidden = list.length <= pfShown;
}
const refreshProfileList = () => { if($("#prof").open) paintProfile(); };
function syncProfileView(){
  if(viewing && user && viewing.id===user.id) viewing = profile;
  refreshProfileList();
}
function showProfile(v){
  viewing = v; pfShown = PAGE; paintProfile(); paintAdminInfo();
  if(!$("#prof").open) $("#prof").showModal();
  $("#prof").scrollTop = 0;
}
function openProfile(){
  if(!profile){ openOnb("first"); return; }
  showProfile(profile);
}
async function openUser(uid){
  if(user && uid===user.id){ openProfile(); return; }
  const { data, error } = await sb.from("profiles").select("id,display_name,avatar_url,role,created_at,banned").eq("id", uid).maybeSingle();
  if(error || !data) return toast("Profil tidak ditemukan");
  showProfile(data);
}

/* ---------- Ganti nama / ganti PP ---------- */
function showEd(which){
  $("#edName").classList.toggle("on", which==="name");
  $("#edPhoto").classList.toggle("on", which==="photo");
  $("#ed").showModal();
}
function paintEdPick(){
  $("#edPick").innerHTML = edPhoto
    ? `<img src="${esc(edPhoto)}" alt="" referrerpolicy="no-referrer">`
    : esc(initial(profile.display_name));
  $("#edPhotoSave").disabled = !edPicked;
}
async function saveEdit(part, msg, btn){
  btn.disabled = true;
  try{ await updateProfile(part); }
  catch(err){ btn.disabled = false; return toast("Gagal menyimpan"); }
  btn.disabled = false;
  $("#ed").close(); renderAuth(); syncProfileView(); load().then(refreshProfileList); toast(msg);
}

$("#profX").onclick = () => $("#prof").close();
$("#prof").addEventListener("close", () => { viewing = null; });
$("#pfMoreBtn").onclick = () => { pfShown += PAGE; paintProfile(); };

$("#pName").onclick = () => { $("#edNameIn").value = profile.display_name; showEd("name"); setTimeout(() => $("#edNameIn").focus(), 60); };
$("#pPhoto").onclick = () => { edPhoto = profile.avatar_url || googleAvatar(); edPicked = false; paintEdPick(); showEd("photo"); };
$("#pRole").onclick = () => openRole();
$("#pMission").onclick = () => openMission();
$("#pOut").onclick = () => { $("#prof").close(); logout(); };

$("#edNameSave").onclick = () => {
  const n = $("#edNameIn").value.trim();
  if(n.length<2 || n.length>30) return toast("Nama 2–30 karakter");
  saveEdit({ display_name: n }, "Nama diganti", $("#edNameSave"));
};
$("#edNameIn").addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); $("#edNameSave").click(); } });
$("#edPickWrap").onclick = () => $("#edFile").click();
$("#edPickWrap").addEventListener("keydown", e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("#edFile").click(); } });
$("#edFile").onchange = async e => {
  const f = e.target.files[0]; if(!f) return;
  try{ edPhoto = await readAvatar(f); edPicked = true; paintEdPick(); }
  catch{ toast("Foto tidak bisa dibaca"); }
  e.target.value = "";
};
$("#edPhotoSave").onclick = () => saveEdit({ avatar_url: edPhoto }, "PP diganti", $("#edPhotoSave"));

[["ed","edX"],["rol","rolX"],["mis","misX"]].forEach(([d,x]) => {
  $("#"+d).addEventListener("click", e => { if(e.target===$("#"+d)) $("#"+d).close(); });
  $("#"+x).onclick = () => $("#"+d).close();
});

$("#pSend").onclick = () => openSend(viewing);
$("#pChat").onclick = () => openDM(viewing);
