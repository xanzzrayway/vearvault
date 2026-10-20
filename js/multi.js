/* ---------- Upload Multi Prompt (admin): nama file .txt jadi judul, kategori diatur per file ---------- */
const MU_MAX_FILES = 50, MU_MAX_BYTES = 500000;
const MU_COLS = "id,user_id,title,description,content,category,is_public,status,review_note,created_at";
let muItems = [], muId = 0, muBusy = false;

function muTodo(){ return muItems.filter(i => i.state === "ready" || i.state === "fail"); }

function openMulti(){
  if(!isAdmin()) return toast("Khusus admin");
  if(!muBusy){ muItems = []; $("#muPub").checked = true; muPaint(); }
  $("#mu").showModal();
}

function muPaint(){
  const l = $("#muList");
  if(!muItems.length){
    l.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada file</h3><p>Ketuk "Pilih file .txt" untuk mulai.</p></div>`;
  } else {
    l.innerHTML = muItems.map((it, i) => {
      let mid;
      if(it.state === "bad") mid = `<small class="mu-e">${esc(it.msg)}</small>`;
      else if(it.state === "done") mid = `<small class="mu-ok">Terunggah · ${esc(it.cat)}</small>`;
      else mid = `<button class="pickbtn" type="button" data-a="cat" ${muBusy ? "disabled" : ""}>${
        it.cat ? `<i class="dot" style="background:${color(it.cat)}"></i><span>${esc(it.cat)}</span>` : `<span class="ph">Pilih kategori</span>`
      }${CHEV}</button>${it.state === "fail" ? `<small class="mu-e">${esc(it.msg)}</small>` : it.state === "up" ? "<small>Mengunggah…</small>" : ""}`;
      const del = (it.state === "done" || it.state === "up") ? "" : `<button class="mu-x" type="button" data-a="del" aria-label="Hapus">&times;</button>`;
      return `<div class="mu-item ${it.state}" data-id="${it.id}"><div class="mu-n">${i + 1}</div><div class="mu-b"><b>${esc(it.title || it.name)}</b>${
        it.content ? `<small>${fmt(charLen(it.content))} karakter</small>` : ""}${mid}</div>${del}</div>`;
    }).join("");
  }
  const todo = muTodo(), withCat = todo.filter(i => i.cat).length;
  $("#muBulk").hidden = !todo.length;
  $("#muBulk").disabled = muBusy;
  $("#muStat").textContent = todo.length ? `${withCat} / ${todo.length} kategori dipilih` : "";
  const go = $("#muGo");
  go.disabled = muBusy || !todo.length || withCat !== todo.length;
  go.textContent = muBusy ? "Mengunggah…" : (todo.some(i => i.state === "fail") ? "Coba lagi" : "Unggah");
}

$("#muFile").onchange = async e => {
  const files = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));
  e.target.value = "";
  let skipped = 0;
  for(const f of files){
    if(muItems.some(x => x.name === f.name && x.size === f.size)) continue;
    if(muItems.length >= MU_MAX_FILES){ skipped++; continue; }
    const it = { id: ++muId, name: f.name, size: f.size, title: f.name.replace(/\.txt$/i, "").trim(), content: "", cat: "", state: "ready", msg: "" };
    const bad = m => { it.state = "bad"; it.msg = m; };
    if(!/\.txt$/i.test(f.name)) bad("Bukan file .txt");
    else if(f.size > MU_MAX_BYTES) bad("File terlalu besar (maks. 500 KB)");
    else {
      try{ it.content = (await f.text()).replace(/^\uFEFF/, "").trim(); }catch{ bad("File tidak bisa dibaca"); }
      if(it.state === "ready"){
        if(!it.content) bad("File kosong");
        else if(!it.title) bad("Nama file kosong");
        else if(it.title.length > 80) bad("Nama file terlalu panjang (maks. 80 karakter)");
      }
    }
    muItems.push(it);
  }
  if(skipped) toast("Maksimal " + MU_MAX_FILES + " file sekali unggah");
  muPaint();
};

$("#muList").onclick = e => {
  if(muBusy) return;
  const b = e.target.closest("button"); if(!b) return;
  const el = b.closest(".mu-item"); if(!el) return;
  const it = muItems.find(x => String(x.id) === el.dataset.id); if(!it) return;
  if(b.dataset.a === "del"){ muItems = muItems.filter(x => x !== it); muPaint(); return; }
  if(b.dataset.a === "cat") pickCat(it.cat, name => { it.cat = name; muPaint(); });
};
$("#muBulk").onclick = () => {
  if(muBusy) return;
  pickCat("", name => { muTodo().forEach(i => { i.cat = name; }); muPaint(); });
};

$("#muGo").onclick = async () => {
  if(muBusy) return;
  const todo = muTodo();
  if(!todo.length || todo.some(i => !i.cat)) return;
  if(!confirm(`Unggah ${todo.length} prompt?`)) return;
  muBusy = true; muPaint();
  const pub = $("#muPub").checked;
  let ok = 0, fail = 0;
  for(const it of todo){
    it.state = "up"; muPaint();
    const row = { user_id: user.id, title: it.title, description: null, category: it.cat, content: it.content, is_public: pub };
    const res = await sb.from("prompts").insert(row).select(MU_COLS).single();
    if(res.error){
      it.state = "fail"; fail++;
      it.msg = /duplikat/.test(res.error.message || "") ? "Prompt yang sama sudah ada" : "Gagal mengunggah, coba lagi";
    } else {
      it.state = "done"; ok++;
      rows.unshift({ ...res.data, profiles: { display_name: profile.display_name, avatar_url: profile.avatar_url } });
    }
    muPaint();
  }
  muBusy = false; muPaint();
  render(); refreshProfileList();
  toast(fail ? `${ok} prompt terunggah, ${fail} gagal` : `${ok} prompt terunggah`);
};

$("#muX").onclick = () => { if(muBusy) return toast("Tunggu unggahan selesai"); $("#mu").close(); };
$("#mu").addEventListener("cancel", e => { if(muBusy) e.preventDefault(); });
