/* ---------- Tinjau Prompt (khusus admin): prompt publik disetujui dulu sebelum tampil ---------- */
var revCount = 0;
let revRows = [], revMore = false, revTarget = null, revBusy = false, revT = null;
const REV_PAGE = 20;

function paintReviewBadge(){
  const b = $("#revBadge");
  b.textContent = revCount > 99 ? "99+" : revCount;
  b.hidden = revCount === 0;
  if(typeof paintBadge === "function") paintBadge();
}
async function refreshReviewCount(){
  if(!configured || !isAdmin()){ revCount = 0; paintReviewBadge(); return; }
  const { count } = await sb.from("prompts").select("id", { count:"exact", head:true }).eq("status","pending").eq("is_public", true);
  revCount = count || 0;
  paintReviewBadge();
  if($("#rev").open) $("#rvCount").textContent = revCount ? fmt(revCount) + " menunggu" : "";
}
/* Dipanggil setiap login/logout */
function syncReview(){
  clearInterval(revT); revT = null;
  const admin = !!(configured && user && profile && isAdmin());
  $("#drReview").hidden = !admin;
  revCount = 0; revRows = []; paintReviewBadge();
  if($("#rev").open && !admin) $("#rev").close();
  if(!admin) return;
  refreshReviewCount();
  revT = setInterval(refreshReviewCount, 60000);
}

async function loadReview(){
  const l = $("#rvList");
  l.innerHTML = '<div class="skel"></div><div class="skel"></div>';
  const { data, error } = await sb.from("prompts")
    .select("id,user_id,title,description,content,category,is_public,status,created_at")
    .eq("status","pending").eq("is_public", true)
    .order("created_at", { ascending:true }).limit(REV_PAGE);
  if(error){ l.innerHTML = ""; return toast("Gagal memuat antrian tinjauan"); }
  revRows = data || [];
  revMore = revRows.length === REV_PAGE;
  const ids = [...new Set(revRows.map(r => r.user_id))].filter(id => !PROF[id]);
  if(ids.length){
    const ps = await sb.from("profiles").select("id,display_name,avatar_url,role").in("id", ids);
    (ps.data || []).forEach(p => PROF[p.id] = p);
  }
  paintReview();
}

function paintReview(){
  const l = $("#rvList");
  if(!revRows.length){
    l.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Tidak ada yang menunggu</h3><p>Semua prompt sudah ditinjau.</p></div>`;
    return;
  }
  l.innerHTML = revRows.map(r => {
    const p = PROF[r.user_id] || {};
    const name = p.display_name || "Anonim";
    const when = new Date(r.created_at).toLocaleString("id-ID", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
    const prev = r.content.length > 420 ? r.content.slice(0, 420) + "…" : r.content;
    return `<article class="rv" data-id="${r.id}">
      <div class="top"><span class="tag"><i style="background:${color(r.category)}"></i>${esc(r.category)}</span><span class="rv-n">${fmt(charLen(r.content))} karakter</span></div>
      <h3>${esc(r.title)}</h3>
      ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
      <button class="by rv-by" type="button" data-a="user" aria-label="Lihat profil">${avatarTag(p.avatar_url, name, "avatar xs")}<em>${esc(name)}</em><small>${esc(when)}</small></button>
      <div class="body s">${esc(prev)}</div>
      <div class="rv-acts">
        <button class="btn sm line" type="button" data-a="view">Lihat penuh</button>
        <button class="btn sm danger" type="button" data-a="no">Tolak</button>
        <button class="btn sm" type="button" data-a="ok">Setujui</button>
      </div></article>`;
  }).join("");
}

function openReview(){
  if(!isAdmin()) return toast("Khusus admin");
  $("#rvCount").textContent = revCount ? fmt(revCount) + " menunggu" : "";
  $("#rev").showModal();
  loadReview();
  refreshReviewCount();
}

/* Dipakai setelah setuju/tolak: ubah salinan di beranda supaya langsung sinkron */
function applyReviewLocal(id, status, note){
  const r = rows.find(x => String(x.id) === String(id));
  if(r){ r.status = status; r.review_note = note || null; }
  render(); refreshProfileList();
}
function dropReviewRow(id){
  revRows = revRows.filter(r => String(r.id) !== String(id));
  revCount = Math.max(0, revCount - 1);
  paintReviewBadge();
  $("#rvCount").textContent = revCount ? fmt(revCount) + " menunggu" : "";
  if(!revRows.length && revMore) loadReview(); else paintReview();
}
async function reviewAct(id, approve, note){
  if(revBusy) return false;
  revBusy = true;
  const { error } = await sb.rpc("review_prompt", { pid: Number(id), approve, note: note || null });
  revBusy = false;
  if(error){
    toast(/menunggu tinjauan/.test(error.message || "") ? "Prompt ini sudah ditinjau" : "Gagal menyimpan keputusan");
    if(/menunggu tinjauan/.test(error.message || "")) dropReviewRow(id);
    return false;
  }
  applyReviewLocal(id, approve ? "approved" : "rejected", note);
  dropReviewRow(id);
  toast(approve ? "Prompt disetujui dan tampil di beranda" : "Prompt ditolak");
  return true;
}

$("#rvList").onclick = async e => {
  const b = e.target.closest("button"); if(!b) return;
  const card = b.closest(".rv"); if(!card) return;
  const r = revRows.find(x => String(x.id) === card.dataset.id); if(!r) return;
  if(b.dataset.a === "user"){ openUser(r.user_id); return; }
  if(b.dataset.a === "view"){ showPromptView({ ...r, profiles: PROF[r.user_id] || null }, null); return; }
  if(b.dataset.a === "ok"){ b.disabled = true; await reviewAct(r.id, true); b.disabled = false; return; }
  if(b.dataset.a === "no"){
    revTarget = r;
    $("#rjT").textContent = r.title;
    $("#rjText").value = "";
    $("#rj").showModal();
    setTimeout(() => $("#rjText").focus(), 60);
  }
};
$("#rjX").onclick = () => $("#rj").close();
$("#rj").addEventListener("click", e => { if(e.target === $("#rj")) $("#rj").close(); });
$("#rjForm").onsubmit = async e => {
  e.preventDefault();
  const r = revTarget; if(!r) return;
  const btn = $("#rjSend"); btn.disabled = true;
  const ok = await reviewAct(r.id, false, $("#rjText").value.trim());
  btn.disabled = false;
  if(ok) $("#rj").close();
};
$("#rvX").onclick = () => $("#rev").close();
