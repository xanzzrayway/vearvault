/* ---------- Ganti Role & Misi Role ---------- */
const fmt = n => Number(n).toLocaleString("id-ID");

function paintRoleList(){
  const cur = profile.role || "newbie";
  $("#rolList").innerHTML = ROLES.map(r => hasRole(r.id)
    ? `<button type="button" class="role ${r.id===cur?"on":""}" data-r="${r.id}"><span>${r.name}</span>${r.id===cur?TICK:""}</button>`
    : `<button type="button" class="role locked" data-r="${r.id}" aria-disabled="true"><span>${r.name}</span>${LOCK}</button>`
  ).join("");
}
function openRole(){ paintRoleList(); $("#rol").showModal(); }
$("#rolList").onclick = async e => {
  const b = e.target.closest(".role"); if(!b) return;
  const id = b.dataset.r;
  if(!hasRole(id)) return toast(id===MISSION.role ? "Selesaikan Misi Role dulu" : "Role terkunci");
  if(id === (profile.role || "newbie")) return;
  const { error } = await sb.rpc("set_role", { new_role: id });
  if(error) return toast("Gagal ganti role");
  const p = await loadProfile(); if(p) profile = p;
  renderAuth(); paintRoleList(); toast("Role diganti");
};

/* Hanya prompt publik dengan isi lebih dari MISSION.chars karakter yang dihitung */
function countMission(){
  return rows.filter(r => user && r.user_id===user.id && r.is_public && charLen(r.content) > MISSION.chars).length;
}
function paintMission(n){
  const done = hasRole(MISSION.role);
  const shownN = Math.min(n, MISSION.count);
  const pct = Math.round(shownN / MISSION.count * 100);
  $("#misBody").innerHTML = `<div class="mcard">
    <div class="mtop"><b>Gear Vault</b><span class="pill">${done?"Selesai":"Aktif"}</span></div>
    <p>Upload ${fmt(MISSION.count)} prompt dengan isi lebih dari ${fmt(MISSION.chars)} karakter dan dapatkan role Gear Vault.</p>
    <div class="bar2"><i style="width:${pct}%"></i></div>
    <div class="mnum"><b>${fmt(shownN)}</b> / ${fmt(MISSION.count)}</div>
    <div class="note">Hanya prompt publik yang dihitung.</div>
  </div>${done ? "" : '<button class="btn" id="misAdd" type="button">Tambah prompt</button>'}`;
  const a = $("#misAdd");
  if(a) a.onclick = () => { $("#mis").close(); $("#addBtn").click(); };
}
async function openMission(){
  paintMission(countMission());
  $("#mis").showModal();
  const r = await sb.rpc("mission_progress");
  if(!r.error && typeof r.data === "number") paintMission(r.data);
}
