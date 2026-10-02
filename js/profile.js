/* ---------- Profil: ganti nama, ganti PP ---------- */
let edPhoto = null, edPicked = false;

async function updateProfile(part){
  const { error } = await sb.from("profiles").update(part).eq("id", user.id);
  if(error) throw error;
  const r = await sb.from("profiles").select("*").eq("id", user.id).single();
  if(r.error) throw r.error;
  profile = r.data;
}
function openProfile(){
  if(!profile){ openOnb("first"); return; }
  const name = profile.display_name;
  const img = profile.avatar_url || googleAvatar();
  $("#profInfo").innerHTML = `${avatarTag(img, name, "avatar xl")}<div><b>${esc(name)}</b><small>${esc(user.email||"")}</small><span class="pill">${esc(roleName(profile.role))}</span></div>`;
  $("#prof").showModal();
}
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
  $("#ed").close(); renderAuth(); load(); toast(msg);
}

$("#pName").onclick = () => { $("#prof").close(); $("#edNameIn").value = profile.display_name; showEd("name"); setTimeout(() => $("#edNameIn").focus(), 60); };
$("#pPhoto").onclick = () => { $("#prof").close(); edPhoto = profile.avatar_url || googleAvatar(); edPicked = false; paintEdPick(); showEd("photo"); };
$("#pRole").onclick = () => { $("#prof").close(); openRole(); };
$("#pMission").onclick = () => { $("#prof").close(); openMission(); };
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

[["prof","profX"],["ed","edX"],["rol","rolX"],["mis","misX"]].forEach(([d,x]) => {
  $("#"+d).addEventListener("click", e => { if(e.target===$("#"+d)) $("#"+d).close(); });
  $("#"+x).onclick = () => $("#"+d).close();
});
