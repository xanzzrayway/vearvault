/* ---------- Panel admin ---------- */
function syncPanel(){
  const admin = !!(configured && user && profile && isAdmin());
  $("#drPanel").hidden = !admin;
  if(!admin){ if($("#pnl").open) $("#pnl").close(); if($("#anf").open) $("#anf").close(); }
}
function openPanel(){
  if(!isAdmin()) return toast("Khusus admin");
  $("#pnl").showModal();
}
$("#pnX").onclick = () => $("#pnl").close();
$("#pnList").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.a === "info") openInfoForm();
};

/* ---------- Kirim Informasi Pop up ---------- */
function updInfoCnt(){ $("#anfN").textContent = $("#anfB").value.length + " / 600"; }
async function paintCurNotice(){
  const box = $("#anfCur");
  const row = await fetchActiveNotice();
  if(!row){ box.hidden = true; return; }
  box.hidden = false;
  const when = new Date(row.created_at).toLocaleString("id-ID", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  $("#anfCurT").textContent = row.title;
  $("#anfCurM").textContent = "Aktif sejak " + when;
}
function openInfoForm(){
  $("#anfT").value = ""; $("#anfB").value = ""; updInfoCnt();
  $("#anf").showModal();
  paintCurNotice();
}
$("#anfB").addEventListener("input", updInfoCnt);
$("#anfX").onclick = () => $("#anf").close();
$("#anf").addEventListener("click", e => { if(e.target === $("#anf")) $("#anf").close(); });
$("#anfForm").onsubmit = async e => {
  e.preventDefault();
  const judul = $("#anfT").value.trim(), isi = $("#anfB").value.trim();
  if(!judul || !isi) return;
  if(!confirm("Kirim informasi ini ke semua pengguna?")) return;
  const btn = $("#anfSend"); btn.disabled = true;
  const { data, error } = await sb.rpc("admin_send_announcement", { judul, isi });
  btn.disabled = false;
  if(error) return toast("Gagal mengirim informasi");
  markNotice(data);
  $("#anfT").value = ""; $("#anfB").value = ""; updInfoCnt();
  toast("Informasi terkirim, tampil ke pengguna saat masuk");
  paintCurNotice();
};
$("#anfEnd").onclick = async () => {
  if(!confirm("Matikan informasi yang sedang aktif?")) return;
  const { error } = await sb.rpc("admin_end_announcement");
  if(error) return toast("Gagal mematikan informasi");
  toast("Informasi dimatikan");
  paintCurNotice();
};
