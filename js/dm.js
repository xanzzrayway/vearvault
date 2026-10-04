/* ---------- Chat Privat (DM) dan daftar Pesan ---------- */
const DM_COLS = "id,from_user,to_user,content,is_read,created_at";
let dmCh = null, dmPeer = null, dmIds = new Set(), dmStick = true;   // dmUnread ada di core.js

const dmScroll = () => { const l = $("#dmList"); l.scrollTop = l.scrollHeight; };

/* ---------- Notifikasi realtime (aktif selama login) ---------- */
async function refreshDmUnread(){
  if(!user) return;
  const { count } = await sb.from("dm_messages").select("id", { count:"exact", head:true }).eq("to_user", user.id).eq("is_read", false);
  dmUnread = count || 0; paintBadge();
}
async function syncDM(){
  if(dmCh && sb){ sb.removeChannel(dmCh); dmCh = null; }
  dmUnread = 0; paintBadge();
  if(!configured || !user || !profile) return;
  refreshDmUnread();
  dmCh = sb.channel("dm-" + user.id)
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"dm_messages", filter:"to_user=eq." + user.id }, onDmInsert)
    .subscribe();
}
async function onDmInsert(pl){
  const m = pl.new;
  await ensureProfiles([m.from_user]);
  if($("#dm").open && dmPeer && dmPeer.id === m.from_user){ addDm(m, true); markDmRead(); return; }
  dmUnread++; paintBadge();
  toast("Pesan dari " + ((PROF[m.from_user] || {}).display_name || "seseorang"));
  if($("#pm").open) loadPM();
}

/* ---------- Daftar percakapan ---------- */
async function openPM(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  if(!user) return login();
  if(!profile) return openOnb("first");
  $("#pmList").innerHTML = "";
  $("#pm").showModal();
  loadPM();
}
async function loadPM(){
  const me = user.id;
  const { data, error } = await sb.from("dm_messages").select(DM_COLS).or(`from_user.eq.${me},to_user.eq.${me}`).order("created_at", { ascending:false }).limit(300);
  if(error) return toast("Gagal memuat pesan");
  const conv = new Map();
  (data || []).forEach(m => {
    const peer = m.from_user === me ? m.to_user : m.from_user;
    let c = conv.get(peer);
    if(!c){ c = { peer, last:m, unread:0 }; conv.set(peer, c); }
    if(m.to_user === me && !m.is_read) c.unread++;
  });
  const list = [...conv.values()];
  await ensureProfiles(list.map(c => c.peer));
  const box = $("#pmList");
  if(!list.length){
    box.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada percakapan</h3></div>`;
    return;
  }
  box.innerHTML = list.map(c => {
    const p = PROF[c.peer] || {}, name = p.display_name || "Anonim";
    const mine = c.last.from_user === me;
    return `<button class="bx ${c.unread ? "new" : ""}" data-peer="${esc(c.peer)}" type="button">
      <span class="av">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</span>
      <div class="bx-t"><b>${esc(name)}</b><small>${mine ? "Kamu: " : ""}${esc(c.last.content)}</small></div>
      <span class="pm-meta">${ago(c.last.created_at)}${c.unread ? `<b class="cb">${c.unread > 99 ? "99+" : c.unread}</b>` : ""}</span>
    </button>`;
  }).join("");
}
$("#pmList").onclick = e => {
  const b = e.target.closest(".bx"); if(!b) return;
  const p = PROF[b.dataset.peer] || { id:b.dataset.peer };
  openDM({ id:b.dataset.peer, display_name:p.display_name, avatar_url:p.avatar_url });
};
$("#pmX").onclick = () => $("#pm").close();

/* ---------- Percakapan dengan satu orang ---------- */
function paintDmHead(){
  const p = dmPeer;
  $("#dmPeer").innerHTML = `<span class="av">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(p.display_name))}</span><span>${esc(p.display_name)}</span>`;
}
function paintDmInput(){
  $("#dmIn").innerHTML = `<div class="ch-row">
      <textarea id="dmText" rows="1" maxlength="1000" aria-label="Pesan"></textarea>
      <button class="btn send" id="dmSend" type="button" aria-label="Kirim">${I_SEND}</button>
    </div>`;
  const t = $("#dmText");
  /* Enter = baris baru; kotak melebar ke atas */
  t.addEventListener("input", () => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; });
  $("#dmSend").onclick = sendDm;
}
function addDm(m, live){
  if(dmIds.has(m.id)) return;
  dmIds.add(m.id);
  const own = m.from_user === user.id;
  const t = new Date(m.created_at);
  const el = document.createElement("div");
  el.className = "msg" + (own ? " me" : "");
  el.innerHTML = `<div class="bub"><span class="tx">${esc(m.content)}</span><span class="tm">${t.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })}</span></div>`;
  $("#dmList").appendChild(el);
  if(own) dmStick = true;
  if(live && dmStick) dmScroll();
}
async function markDmRead(){
  if(!dmPeer) return;
  await sb.from("dm_messages").update({ is_read:true }).eq("from_user", dmPeer.id).eq("to_user", user.id).eq("is_read", false);
  refreshDmUnread();
}
async function openDM(v){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  if(!user) return login();
  if(!profile) return openOnb("first");
  if(!v || !v.id || v.id === user.id) return;
  const known = PROF[v.id] || {};
  dmPeer = { id:v.id, display_name: v.display_name || known.display_name || "Akun", avatar_url: v.avatar_url || known.avatar_url || null };
  $("#dmList").innerHTML = ""; dmIds.clear(); dmStick = true;
  paintDmHead(); paintDmInput();
  $("#dm").showModal();
  const me = user.id, peer = dmPeer.id;
  const q = `and(from_user.eq.${me},to_user.eq.${peer}),and(from_user.eq.${peer},to_user.eq.${me})`;
  const { data, error } = await sb.from("dm_messages").select(DM_COLS).or(q).order("created_at", { ascending:false }).limit(100);
  if(error) toast("Gagal memuat pesan");
  (data || []).reverse().forEach(m => addDm(m, false));
  dmScroll();
  markDmRead();
}
async function sendDm(){
  const t = $("#dmText"); if(!t || !dmPeer) return;
  const text = t.value.trim(); if(!text) return;
  const b = $("#dmSend"); b.disabled = true;
  const { data, error } = await sb.from("dm_messages").insert({ from_user:user.id, to_user:dmPeer.id, content:text }).select(DM_COLS).single();
  b.disabled = false;
  if(error) return toast(/terlalu cepat/.test(error.message || "") ? "Terlalu cepat, tunggu sebentar" : "Gagal mengirim");
  t.value = ""; t.style.height = "auto";
  addDm(data, true);
}

$("#dmList").addEventListener("scroll", () => { const l = $("#dmList"); dmStick = l.scrollHeight - l.scrollTop - l.clientHeight < 120; }, { passive:true });
$("#dmPeer").onclick = () => { if(dmPeer) openUser(dmPeer.id); };
$("#dmX").onclick = () => $("#dm").close();
$("#dm").addEventListener("close", () => { dmPeer = null; if($("#pm").open) loadPM(); });
new ResizeObserver(() => {
  $("#dm").style.setProperty("--inh", $("#dmIn").offsetHeight + "px");
  if(dmStick) dmScroll();
}).observe($("#dmIn"));
