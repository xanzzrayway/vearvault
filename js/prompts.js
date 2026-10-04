/* ---------- Data ---------- */
async function load(){
  if(!configured){ render(); return; }
  $("#grid").innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  const { data, error } = await sb.from("prompts").select("id,user_id,title,description,content,category,is_public,created_at").order("created_at",{ascending:false});
  if(error){ toast("Gagal memuat prompt"); rows = []; render(); return; }
  const map = {};
  const ps = await sb.from("profiles").select("id,display_name,avatar_url,role");
  (ps.data || []).forEach(p => { map[p.id] = PROF[p.id] = p; });
  rows = data.map(r => ({ ...r, profiles: map[r.user_id] || null }));
  render();
}

function render(){
  const list = rows.filter(r =>
    (cat==="Semua" || r.category===cat) &&
    (view==="all" ? r.is_public : (user && r.user_id===user.id)) &&
    (!term || (r.title+" "+(r.description||"")+" "+r.content).toLowerCase().includes(term))
  );
  const g = $("#grid");
  if(!list.length){
    $("#more").hidden = true;
    g.innerHTML = view==="mine" && !user
      ? `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Masuk untuk melihat prompt kamu</h3><p>Prompt yang kamu simpan akan muncul di sini.</p></div>`
      : `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada prompt</h3><p>Tambahkan prompt pertama untuk kategori ini.</p></div>`;
    return;
  }
  g.innerHTML = list.slice(0, shown).map(cardHTML).join("");
  $("#more").hidden = list.length <= shown;
}

const onCardClick = async e => {
  const b = e.target.closest("button");
  if(b){
    if(b.dataset.user){ openUser(b.dataset.user); return; }
    const find = id => rows.find(r => String(r.id)===String(id));
    if(b.dataset.copy){ await copyText(find(b.dataset.copy).content); toast("Prompt disalin"); }
    if(b.dataset.dl) downloadPrompt(find(b.dataset.dl));
    if(b.dataset.del) await deletePrompt(b.dataset.del);
    return;
  }
  const card = e.target.closest(".card");
  if(card) openPrompt(card.dataset.id);
};
const onCardKey = e => {
  if(e.key==="Enter" && e.target.classList.contains("card")) openPrompt(e.target.dataset.id);
};
$("#grid").addEventListener("keydown", onCardKey);
$("#profGrid").addEventListener("keydown", onCardKey);
$("#grid").addEventListener("click", onCardClick);
$("#profGrid").addEventListener("click", onCardClick);

/* ---------- Filter ---------- */
function renderChips(){
  $("#chips").innerHTML = [["Semua","#1d4ed8"],...CATS].map(([n,c]) =>
    `<button class="chip ${n===cat?"on":""}" data-c="${esc(n)}">${n==="Semua"?"":`<i style="background:${c}"></i>`}${esc(n)}</button>`).join("");
}
$("#chips").onclick = e => { const b=e.target.closest(".chip"); if(!b) return; cat=b.dataset.c; shown=PAGE; renderChips(); render(); };
$("#seg").onclick = e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.v==="mine" && !user){ login(); return; }
  view = b.dataset.v; shown = PAGE; syncSeg(); render();
};
let qT;
$("#q").oninput = e => { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => { term = v.trim().toLowerCase(); shown = PAGE; render(); }, 150); };
$("#moreBtn").onclick = () => { shown += PAGE; render(); };

/* ---------- Tambah prompt ---------- */
$("#addBtn").onclick = () => {
  if(!user){ login(); return; }
  if(!profile){ openOnb("first"); return; }
  $("#dlg").showModal(); updCnt();
};
$("#closeBtn").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("click", e => { if(e.target===$("#dlg")) $("#dlg").close(); });

$("#form").onsubmit = async e => {
  e.preventDefault();
  if(!profile){ $("#dlg").close(); openOnb("first"); return; }
  const btn = $("#saveBtn"); btn.disabled = true;
  const row = {
    user_id: user.id,
    title: $("#fTitle").value.trim(),
    description: $("#fDesc").value.trim() || null,
    category: $("#fCat").value,
    content: $("#fBody").value.trim(),
    is_public: $("#fPub").checked
  };
  const res = await sb.from("prompts").insert(row).select("id,user_id,title,description,content,category,is_public,created_at").single();
  if(res.error){ btn.disabled = false; return toast("Gagal menyimpan prompt"); }
  const data = { ...res.data, profiles: { display_name: profile.display_name, avatar_url: profile.avatar_url } };
  btn.disabled = false;
  rows.unshift(data); $("#form").reset(); $("#fPub").checked = true; setCat(CATS[0][0]); updCnt(); $("#dlg").close(); render(); refreshProfileList(); toast("Prompt disimpan");
  if(row.is_public && charLen(row.content) > MISSION.chars && !hasRole(MISSION.role)){
    const p = await loadProfile();
    if(p){ profile = p; renderAuth(); syncProfileView(); if(hasRole(MISSION.role)) toast("Role Gear Vault terbuka"); }
  }
};

/* ---------- Deteksi panjang prompt ---------- */
function updCnt(){
  const n = charLen($("#fBody").value);
  $("#cntN").textContent = fmt(n) + " karakter";
  $("#cntOk").hidden = !($("#fPub").checked && n > MISSION.chars && !hasRole(MISSION.role));
}
$("#fBody").addEventListener("input", updCnt);
$("#fPub").addEventListener("change", updCnt);

/* ---------- Kartu prompt (dipakai di beranda dan halaman profil) ---------- */
function cardHTML(r){
    const mine = user && r.user_id===user.id;
    const p = r.profiles || {};
    const name = p.display_name || "Anonim";
    return `<article class="card" data-id="${r.id}" tabindex="0">
      <div class="top"><span class="tag"><i style="background:${color(r.category)}"></i>${esc(r.category)}</span>${r.is_public?"":'<span class="lock">Pribadi</span>'}</div>
      <h3>${esc(r.title)}</h3>
      ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
      <div class="body${r.description ? " s" : ""}">${esc(r.content)}</div>
      <div class="foot">
        <button class="by" type="button" data-user="${esc(r.user_id)}" aria-label="Lihat profil">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">`:`<span class="ph">${esc(initial(name))}</span>`}<em>${esc(name)}</em></button>
        <div class="acts">
          ${(mine || isAdmin())?`<button class="del" data-del="${r.id}" aria-label="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`:""}
          <button class="btn sm line" data-dl="${r.id}" aria-label="Unduh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg></button>
          <button class="btn sm" data-copy="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/></svg>Salin</button>
        </div>
      </div></article>`;
}

/* ---------- Salin, unduh, hapus (dipakai kartu dan popup) ---------- */
async function copyText(text){
  try{ await navigator.clipboard.writeText(text); }
  catch{ const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
}
function downloadPrompt(r){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([r.content], { type:"text/plain;charset=utf-8" }));
  a.download = (r.title.replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase() || "prompt") + ".txt";
  a.click(); URL.revokeObjectURL(a.href);
}
async function deletePrompt(id){
  if(!confirm("Hapus prompt ini?")) return false;
  const { error } = await sb.from("prompts").delete().eq("id", id);
  if(error){ toast("Gagal menghapus"); return false; }
  rows = rows.filter(r => String(r.id)!==String(id));
  render(); refreshProfileList(); toast("Prompt dihapus");
  return true;
}
