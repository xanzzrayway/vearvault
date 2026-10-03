/* ---------- Box (prompt privat masuk) dan Kirim Prompt ---------- */
let unread = 0, inboxCh = null, boxRows = [], sdTarget = null;

function paintBadge(){
  const b = $("#boxBadge");
  b.textContent = unread > 99 ? "99+" : unread;
  b.hidden = unread === 0;
  $("#menuDot").hidden = unread === 0;
}
async function refreshUnread(){
  const { count } = await sb.from("inbox").select("id", { count:"exact", head:true }).eq("is_read", false);
  unread = count || 0; paintBadge();
}
/* Dipanggil setiap login/logout: atur notifikasi realtime Box */
async function syncInbox(){
  if(inboxCh && sb){ sb.removeChannel(inboxCh); inboxCh = null; }
  unread = 0; boxRows = []; paintBadge();
  if(!configured || !user || !profile) return;
  refreshUnread();
  inboxCh = sb.channel("inbox-" + user.id)
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"inbox", filter:"to_user=eq." + user.id }, onInboxInsert)
    .subscribe();
}
async function onInboxInsert(pl){
  const m = pl.new;
  unread++; paintBadge();
  await ensureProfiles([m.from_user]);
  const name = (PROF[m.from_user] || {}).display_name || "Seseorang";
  toast("Prompt baru dari " + name);
  if($("#box").open){
    boxRows.unshift({ id:m.id, from_user:m.from_user, title:m.title, category:m.category, is_read:m.is_read, created_at:m.created_at });
    paintBox();
  }
}

function paintBox(){
  const l = $("#bxList");
  if(!boxRows.length){
    l.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Box kosong</h3></div>`;
    return;
  }
  l.innerHTML = boxRows.map(r => {
    const p = PROF[r.from_user] || {};
    const name = p.display_name || "Anonim";
    return `<button class="bx ${r.is_read ? "" : "new"}" data-id="${r.id}" type="button">
      <span class="av">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</span>
      <div class="bx-t"><b>${esc(r.title)}</b><small>${esc(name)} · ${ago(r.created_at)}</small></div>
      <span class="tag"><i style="background:${color(r.category)}"></i>${esc(r.category)}</span>
      ${r.is_read ? "" : '<i class="nd2"></i>'}
    </button>`;
  }).join("");
}

async function openBox(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  if(!user) return login();
  if(!profile) return openOnb("first");
  $("#bxList").innerHTML = "";
  $("#box").showModal();
  const { data, error } = await sb.from("inbox").select("id,from_user,title,category,is_read,created_at").order("created_at",{ ascending:false }).limit(100);
  if(error) toast("Gagal memuat Box");
  boxRows = data || [];
  await ensureProfiles(boxRows.map(r => r.from_user));
  paintBox();
  refreshUnread();
}

$("#bxList").onclick = async e => {
  const b = e.target.closest(".bx"); if(!b) return;
  const id = b.dataset.id;
  const { data, error } = await sb.from("inbox").select("id,from_user,title,description,content,category,is_read,created_at").eq("id", id).single();
  if(error) return toast("Gagal membuka prompt");
  const r = { id:data.id, user_id:data.from_user, title:data.title, description:data.description, content:data.content, category:data.category, is_public:false, profiles:PROF[data.from_user] || null };
  showPromptView(r, async () => {
    if(!confirm("Hapus prompt ini?")) return false;
    const del = await sb.from("inbox").delete().eq("id", id);
    if(del.error){ toast("Gagal menghapus"); return false; }
    boxRows = boxRows.filter(x => String(x.id)!==String(id));
    paintBox(); refreshUnread(); toast("Prompt dihapus");
    return true;
  });
  if(!data.is_read){
    await sb.from("inbox").update({ is_read:true }).eq("id", id);
    const row = boxRows.find(x => String(x.id)===String(id)); if(row) row.is_read = true;
    unread = Math.max(0, unread - 1); paintBadge(); paintBox();
  }
};
$("#bxX").onclick = () => $("#box").close();

/* ---------- Kirim Prompt ke akun lain ---------- */
function openSend(v){
  if(!user){ login(); return; }
  if(!profile){ openOnb("first"); return; }
  if(!v || v.id===user.id) return;
  sdTarget = v.id;
  $("#sdTo").innerHTML = `${avatarTag(v.avatar_url, v.display_name, "avatar sm")}<div><small>Kepada</small><b>${esc(v.display_name)}</b></div>`;
  $("#sdForm").reset();
  setCat(CATS[0][0], "send");
  $("#sd").showModal();
}
$("#sdX").onclick = () => $("#sd").close();
$("#sd").addEventListener("click", e => { if(e.target===$("#sd")) $("#sd").close(); });
$("#sdForm").onsubmit = async e => {
  e.preventDefault();
  const btn = $("#sdSend"); btn.disabled = true;
  const { error } = await sb.from("inbox").insert({
    from_user: user.id,
    to_user: sdTarget,
    title: $("#sTitle").value.trim(),
    description: $("#sDesc").value.trim() || null,
    category: $("#sCat").value,
    content: $("#sBody").value.trim()
  });
  btn.disabled = false;
  if(error) return toast(/terlalu banyak/.test(error.message || "") ? "Terlalu banyak kiriman, tunggu sebentar" : "Gagal mengirim prompt");
  $("#sd").close(); toast("Prompt terkirim");
};
