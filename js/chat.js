/* ---------- Chat Global (realtime) ---------- */
let chatCh = null, chatReady = false, chatQ = [], chatIds = new Set(), chatLast = null;
const I_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>`;

const chNear = () => { const l = $("#chList"); return l.scrollHeight - l.scrollTop - l.clientHeight < 120; };
const chScroll = () => { const l = $("#chList"); l.scrollTop = l.scrollHeight; };

function addChat(m, live){
  if(chatIds.has(m.id)) return;
  chatIds.add(m.id);
  const own = user && m.user_id===user.id;
  const p = PROF[m.user_id] || {};
  const name = p.display_name || "Anonim";
  const t = new Date(m.created_at);
  const grouped = chatLast && chatLast.u===m.user_id && (t - chatLast.t) < 300000;
  chatLast = { u: m.user_id, t };
  const near = chNear();
  const head = (!own && !grouped) ? `<button class="nm" data-user="${esc(m.user_id)}" type="button">${esc(name)}</button>` : "";
  const av = own ? "" : grouped ? '<span class="av sp"></span>'
    : `<button class="av" data-user="${esc(m.user_id)}" type="button" aria-label="Lihat profil">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</button>`;
  const el = document.createElement("div");
  el.className = "msg" + (own ? " me" : "");
  el.innerHTML = `${av}<div class="bub">${head}<span class="tx">${esc(m.content)}</span><span class="tm">${t.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span></div>`;
  const list = $("#chList");
  list.appendChild(el);
  while(list.children.length > 200) list.removeChild(list.firstChild);
  if(live && (own || near)) chScroll();
}

function paintChatInput(){
  const box = $("#chIn");
  if(!user){
    box.innerHTML = '<button class="btn" id="chLogin" type="button">Masuk untuk chat</button>';
    $("#chLogin").onclick = login;
    return;
  }
  box.innerHTML = `<textarea id="chText" rows="1" maxlength="500" aria-label="Pesan"></textarea><button class="btn send" id="chSend" type="button" aria-label="Kirim">${I_SEND}</button>`;
  const t = $("#chText");
  t.addEventListener("input", () => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; });
  t.addEventListener("keydown", e => { if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); sendChat(); } });
  $("#chSend").onclick = sendChat;
}

async function sendChat(){
  const t = $("#chText"); if(!t) return;
  const text = t.value.trim(); if(!text) return;
  if(!profile){ openOnb("first"); return; }
  t.value = ""; t.style.height = "auto";
  const { data, error } = await sb.from("chat_messages").insert({ user_id: user.id, content: text }).select("id,user_id,content,created_at").single();
  if(error){
    t.value = text;
    return toast(/terlalu cepat/.test(error.message || "") ? "Terlalu cepat, tunggu sebentar" : "Gagal mengirim");
  }
  addChat(data, true);
}

async function openChat(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  $("#chList").innerHTML = ""; chatIds.clear(); chatLast = null; chatReady = false; chatQ = [];
  paintChatInput();
  $("#chat").showModal();
  if(chatCh) sb.removeChannel(chatCh);
  chatCh = sb.channel("chat-global")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, async pl => {
      const m = pl.new;
      if(!chatReady){ chatQ.push(m); return; }
      await ensureProfiles([m.user_id]);
      addChat(m, true);
    })
    .subscribe();
  const { data, error } = await sb.from("chat_messages").select("id,user_id,content,created_at").order("created_at",{ ascending:false }).limit(80);
  if(error) toast("Gagal memuat chat");
  const list = (data || []).reverse();
  await ensureProfiles([...list, ...chatQ].map(m => m.user_id));
  list.forEach(m => addChat(m, false));
  chatReady = true;
  chatQ.forEach(m => addChat(m, false)); chatQ = [];
  chScroll();
}

$("#chList").addEventListener("click", e => {
  const b = e.target.closest("[data-user]"); if(b) openUser(b.dataset.user);
});
$("#chX").onclick = () => $("#chat").close();
$("#chat").addEventListener("close", () => {
  if(chatCh){ sb.removeChannel(chatCh); chatCh = null; }
  chatReady = false;
});
