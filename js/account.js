/* ---------- Pengaturan akun: nama → profil → info & role ---------- */
function readAvatar(file){
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
        const m = Math.min(im.width, im.height);
        c.getContext("2d").drawImage(im, (im.width-m)/2, (im.height-m)/2, m, m, 0, 0, S, S);
        res(c.toDataURL("image/jpeg", .82));
      };
      im.onerror = rej; im.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function paintAvatar(){
  $("#pick").innerHTML = draft.avatar
    ? `<img src="${esc(draft.avatar)}" alt="" referrerpolicy="no-referrer">`
    : esc(initial(draft.name));
  const n = $("#oNext2");
  n.textContent = picked ? "Lanjut" : "Lewati";
  n.classList.toggle("line", !picked);
}
function paintInfo(){
  $("#info").innerHTML = `${avatarTag(draft.avatar, draft.name, "avatar lg")}<div><b>${esc(draft.name)}</b><small>${esc(user.email||"")}</small></div>`;
  const cur = (profile && profile.role) || "newbie";
  $("#roles").innerHTML = ROLES.filter(r => !r.hidden).map(r => r.open
    ? `<button type="button" class="role ${r.id===cur?"on":""}" data-r="${r.id}"><span>${r.name}</span>${r.id===cur?TICK:""}</button>`
    : `<button type="button" class="role locked" data-r="${r.id}" aria-disabled="true"><span>${r.name}</span>${LOCK}</button>`
  ).join("");
}
function goStep(n){
  step = n;
  document.querySelectorAll("#onb .pane").forEach(p => p.classList.toggle("on", +p.dataset.s===n));
  document.querySelectorAll("#onb .steps i").forEach((d,i) => d.classList.toggle("on", i<n));
  if(n===2) paintAvatar();
  if(n===3) paintInfo();
  if(n===1) setTimeout(() => $("#oName").focus(), 60);
}
function openOnb(mode){
  onbMode = mode; picked = false;
  const m = user.user_metadata || {};
  draft = {
    name: (profile && profile.display_name) || m.full_name || m.name || (user.email||"").split("@")[0] || "",
    avatar: (profile && profile.avatar_url) || googleAvatar()
  };
  $("#oName").value = draft.name;
  $("#onbX").style.display = mode==="first" ? "none" : "";
  goStep(1);
  if(!$("#onb").open) $("#onb").showModal();
}
$("#oNext1").onclick = () => {
  const n = $("#oName").value.trim();
  if(n.length<2 || n.length>30) return toast("Nama 2–30 karakter");
  draft.name = n; goStep(2);
};
$("#oName").addEventListener("keydown", e => { if(e.key==="Enter"){ e.preventDefault(); $("#oNext1").click(); } });
$("#pickWrap").onclick = () => $("#oFile").click();
$("#pickWrap").addEventListener("keydown", e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("#oFile").click(); } });
$("#oFile").onchange = async e => {
  const f = e.target.files[0]; if(!f) return;
  try{ draft.avatar = await readAvatar(f); picked = true; paintAvatar(); }
  catch{ toast("Foto tidak bisa dibaca"); }
  e.target.value = "";
};
$("#oNext2").onclick = () => goStep(3);
document.querySelectorAll("[data-back]").forEach(b => b.onclick = () => goStep(step-1));
$("#roles").onclick = e => { const b = e.target.closest(".role"); if(b && b.classList.contains("locked")) toast("Role terkunci"); };
$("#onbX").onclick = () => $("#onb").close();
$("#onb").addEventListener("cancel", e => { if(onbMode==="first") e.preventDefault(); });
$("#onb").addEventListener("click", e => { if(e.target===$("#onb") && onbMode==="edit") $("#onb").close(); });

$("#finish").onclick = async () => {
  const btn = $("#finish"); btn.disabled = true;
  const row = { display_name: draft.name, avatar_url: draft.avatar };
  try{
      const q = profile
        ? sb.from("profiles").update(row).eq("id", user.id)
        : sb.from("profiles").insert({ id: user.id, ...row });
      const { error } = await q;
      if(error) throw error;
      const res = await sb.from("profiles").select("*").eq("id", user.id).single();
      if(res.error) throw res.error;
      profile = res.data;
  }catch(err){
    btn.disabled = false; return toast("Gagal menyimpan akun");
  }
  btn.disabled = false;
  const first = onbMode==="first";
  $("#onb").close(); renderAuth(); syncInbox(); syncModeration(); load();
  toast(first ? "Akun siap" : "Akun disimpan");
};
