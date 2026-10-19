/* ---------- Informasi pop up dari admin (tampil sekali saat masuk) ---------- */
const NOTICE_KEY = "vv_notice_seen";
let noticeRow = null;

const noticeSeen = id => { try{ return localStorage.getItem(NOTICE_KEY) === String(id); }catch{ return false; } };
const markNotice = id => { try{ localStorage.setItem(NOTICE_KEY, String(id)); }catch{} };

async function fetchActiveNotice(){
  const { data } = await sb.from("announcements").select("id,title,body,created_at")
    .eq("active", true).order("created_at", { ascending:false }).limit(1).maybeSingle();
  return data || null;
}
async function startNotice(){
  if(!configured) return;
  const row = await fetchActiveNotice();
  if(!row || noticeSeen(row.id)) return;
  noticeRow = row;
  waitShowNotice(0);
}
/* Tunggu sampai tidak ada jendela lain yang terbuka (login, ban, peringatan, dll.) */
function waitShowNotice(n){
  if(!noticeRow) return;
  if(document.querySelector("dialog[open]")){ if(n < 20) setTimeout(() => waitShowNotice(n + 1), 1500); return; }
  $("#anT").textContent = noticeRow.title;
  $("#anB").textContent = noticeRow.body;
  $("#an").showModal();
}
function closeNotice(){ if($("#an").open) $("#an").close(); }
$("#an").addEventListener("close", () => { if(noticeRow){ markNotice(noticeRow.id); noticeRow = null; } });
$("#an").addEventListener("click", e => { if(e.target === $("#an")) closeNotice(); });
$("#anX").onclick = closeNotice;
$("#anOk").onclick = closeNotice;
