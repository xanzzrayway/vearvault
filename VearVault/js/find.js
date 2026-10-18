/* ---------- Cari Akun ---------- */
let fnT = null, fnSeq = 0;

function openFind(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  $("#fnQ").value = "";
  $("#find").showModal();
  runFind();
  setTimeout(() => $("#fnQ").focus(), 80);
}
async function runFind(){
  const my = ++fnSeq;
  const q = $("#fnQ").value.trim();
  let req = sb.from("profiles").select("id,display_name,avatar_url,role,created_at");
  req = q
    ? req.ilike("display_name", "%" + q.replace(/[\\%_]/g, m => "\\" + m) + "%").order("display_name")
    : req.order("created_at", { ascending:false });
  const { data, error } = await req.limit(30);
  if(my !== fnSeq) return;
  const l = $("#fnList");
  if(error){ l.innerHTML = ""; return toast("Gagal mencari akun"); }
  if(!data.length){
    l.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Akun tidak ditemukan</h3></div>`;
    return;
  }
  data.forEach(p => PROF[p.id] = p);
  l.innerHTML = data.map(p => `<button class="fr" data-id="${esc(p.id)}" type="button">
    ${avatarTag(p.avatar_url, p.display_name, "avatar sm")}
    <div class="fr-t"><b>${esc(p.display_name)}</b><span class="pill">${esc(roleName(p.role))}</span></div>
    ${CHEV}
  </button>`).join("");
}
$("#fnQ").addEventListener("input", () => { clearTimeout(fnT); fnT = setTimeout(runFind, 250); });
$("#fnList").onclick = e => { const b = e.target.closest(".fr"); if(b) openUser(b.dataset.id); };
$("#fnX").onclick = () => $("#find").close();
