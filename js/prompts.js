/* ---------- Data ---------- */
async function load(){
  if(!configured){ render(); return; }
  $("#grid").innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  const { data, error } = await sb.from("prompts").select("id,user_id,title,content,category,is_public,created_at").order("created_at",{ascending:false});
  if(error){ toast("Gagal memuat prompt"); rows = []; render(); return; }
  const map = {};
  const ps = await sb.from("profiles").select("id,display_name,avatar_url");
  (ps.data || []).forEach(p => map[p.id] = p);
  rows = data.map(r => ({ ...r, profiles: map[r.user_id] || null }));
  render();
}

function render(){
  const list = rows.filter(r =>
    (cat==="Semua" || r.category===cat) &&
    (view==="all" ? r.is_public : (user && r.user_id===user.id)) &&
    (!term || (r.title+" "+r.content).toLowerCase().includes(term))
  );
  const g = $("#grid");
  if(!list.length){
    $("#more").hidden = true;
    g.innerHTML = view==="mine" && !user
      ? `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Masuk untuk melihat prompt kamu</h3><p>Prompt yang kamu simpan akan muncul di sini.</p></div>`
      : `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada prompt</h3><p>Tambahkan prompt pertama untuk kategori ini.</p></div>`;
    return;
  }
  g.innerHTML = list.slice(0, shown).map(r => {
    const mine = user && r.user_id===user.id;
    const p = r.profiles || {};
    const name = p.display_name || "Anonim";
    return `<article class="card">
      <div class="top"><span class="tag"><i style="background:${color(r.category)}"></i>${esc(r.category)}</span>${r.is_public?"":'<span class="lock">Pribadi</span>'}</div>
      <h3>${esc(r.title)}</h3>
      <div class="body">${esc(r.content)}</div>
      <div class="foot">
        <div class="by">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">`:`<span class="ph">${esc(initial(name))}</span>`}<em>${esc(name)}</em></div>
        <div class="acts">
          ${mine?`<button class="del" data-del="${r.id}" aria-label="Hapus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>`:""}
          <button class="btn sm line" data-dl="${r.id}" aria-label="Unduh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg></button>
          <button class="btn sm" data-copy="${r.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/></svg>Salin</button>
        </div>
      </div></article>`;
  }).join("");
  $("#more").hidden = list.length <= shown;
}

$("#grid").addEventListener("click", async e => {
  const b = e.target.closest("button"); if(!b) return;
  const find = id => rows.find(r => String(r.id)===String(id));
  if(b.dataset.copy){
    const r = find(b.dataset.copy);
    try{ await navigator.clipboard.writeText(r.content); }
    catch{ const t=document.createElement("textarea");t.value=r.content;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove(); }
    toast("Prompt disalin");
  }
  if(b.dataset.dl){
    const r = find(b.dataset.dl);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.content],{type:"text/plain;charset=utf-8"}));
    a.download = r.title.replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").toLowerCase() + ".txt";
    a.click(); URL.revokeObjectURL(a.href);
  }
  if(b.dataset.del){
    if(!confirm("Hapus prompt ini?")) return;
    const { error } = await sb.from("prompts").delete().eq("id", b.dataset.del);
    if(error) return toast("Gagal menghapus");
    rows = rows.filter(r => String(r.id)!==String(b.dataset.del)); render(); toast("Prompt dihapus");
  }
});

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
$("#fCat").innerHTML = CATS.map(([n]) => `<option>${esc(n)}</option>`).join("");
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
    category: $("#fCat").value,
    content: $("#fBody").value.trim(),
    is_public: $("#fPub").checked
  };
  const res = await sb.from("prompts").insert(row).select("id,user_id,title,content,category,is_public,created_at").single();
  if(res.error){ btn.disabled = false; return toast("Gagal menyimpan prompt"); }
  const data = { ...res.data, profiles: { display_name: profile.display_name, avatar_url: profile.avatar_url } };
  btn.disabled = false;
  rows.unshift(data); $("#form").reset(); $("#fPub").checked = true; updCnt(); $("#dlg").close(); render(); toast("Prompt disimpan");
  if(row.is_public && charLen(row.content) > MISSION.chars && !hasRole(MISSION.role)){
    const p = await loadProfile();
    if(p){ profile = p; renderAuth(); if(hasRole(MISSION.role)) toast("Role Gear Vault terbuka"); }
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
