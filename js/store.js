/* ---------- Toko Prompt Premium (gulir ala TikTok) ---------- */
const SP_COLS = "id,user_id,title,description,category,price,link,image_url,created_at";
let spRows = [], sfFile = null, sfBusy = false;

const rp = n => Number(n) === 0 ? "Gratis" : "Rp " + fmt(n);
const hostOf = u => { try{ return new URL(u).hostname.replace(/^www\./, ""); }catch{ return ""; } };
const okUrl = u => /^https:\/\/\S+$/i.test(u || "");
const bucketPath = (url, bucket) => {
  const k = "/" + bucket + "/", i = (url || "").indexOf(k);
  return i < 0 ? null : decodeURIComponent(url.slice(i + k.length).split("?")[0]);
};
const sv = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I_BAG = sv('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/>');
const I_CHAT = sv('<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>');
const I_TRASH = sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>');
const I_PLUS = sv('<path d="M12 5v14M5 12h14"/>');

function spHTML(r){
  const p = PROF[r.user_id] || {}, name = p.display_name || "Anonim";
  const mine = user && r.user_id === user.id;
  const c = color(r.category);
  const bg = okUrl(r.image_url)
    ? `<img class="sp-img" src="${esc(r.image_url)}" alt="" loading="lazy" decoding="async">`
    : `<div class="sp-img sp-ph" style="--c:${c}"></div>`;
  return `<section class="sp" data-id="${r.id}">
    ${bg}<div class="sp-shade"></div>
    <div class="sp-side">
      <button class="sp-av" data-user="${esc(r.user_id)}" type="button" aria-label="Lihat profil penjual">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</button>
      <button class="sp-act buy" data-buy="${r.id}" type="button">${I_BAG}<span>Beli</span></button>
      ${mine ? "" : `<button class="sp-act" data-chat="${esc(r.user_id)}" type="button">${I_CHAT}<span>Chat</span></button>`}
      ${mine || isAdmin() ? `<button class="sp-act" data-del="${r.id}" type="button">${I_TRASH}<span>Hapus</span></button>` : ""}
    </div>
    <div class="sp-info">
      <button class="by" data-user="${esc(r.user_id)}" type="button">${esc(name)}</button>
      <h3>${esc(r.title)}</h3>
      ${r.description ? `<p>${esc(r.description)}</p>` : ""}
      <div class="sp-meta"><span class="sp-price">${rp(r.price)}</span><span class="tag"><i style="background:${c}"></i>${esc(r.category)}</span></div>
    </div>
  </section>`;
}
function paintStore(){
  const f = $("#spFeed");
  if(!spRows.length){
    f.innerHTML = `<div class="sp-empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada prompt premium</h3><button class="btn" id="spEmptySell" type="button">${I_PLUS}Jual prompt</button></div>`;
    $("#spEmptySell").onclick = openSell;
    return;
  }
  f.innerHTML = spRows.map(spHTML).join("");
}
async function openStore(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  $("#spFeed").innerHTML = "";
  $("#store").showModal();
  const { data, error } = await sb.from("store_items").select(SP_COLS).order("created_at", { ascending:false }).limit(60);
  if(error) toast("Gagal memuat toko");
  spRows = data || [];
  await ensureProfiles(spRows.map(r => r.user_id));
  paintStore();
}

$("#spFeed").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.user) return openUser(b.dataset.user);
  if(b.dataset.buy) return openBuy(b.dataset.buy);
  if(b.dataset.chat){ const p = PROF[b.dataset.chat] || {}; return openDM({ id:b.dataset.chat, display_name:p.display_name, avatar_url:p.avatar_url }); }
  if(b.dataset.del) return deleteItem(b.dataset.del);
});
$("#stX").onclick = () => $("#store").close();
$("#stSell").onclick = () => openSell();

async function deleteItem(id){
  const r = spRows.find(x => String(x.id) === String(id)); if(!r) return;
  if(!confirm("Hapus prompt ini dari toko?")) return;
  const { error } = await sb.from("store_items").delete().eq("id", id);
  if(error) return toast("Gagal menghapus");
  const path = bucketPath(r.image_url, "store-media");
  if(path) sb.storage.from("store-media").remove([path]);
  spRows = spRows.filter(x => String(x.id) !== String(id));
  paintStore(); toast("Prompt dihapus");
}

/* ---------- Popup Beli ---------- */
function openBuy(id){
  const r = spRows.find(x => String(x.id) === String(id)); if(!r) return;
  const p = PROF[r.user_id] || {}, name = p.display_name || "Anonim";
  const mine = user && r.user_id === user.id;
  const link = okUrl(r.link) ? r.link : "";
  $("#bpBody").innerHTML = `
    ${okUrl(r.image_url) ? `<img class="bp-img" src="${esc(r.image_url)}" alt="">` : ""}
    <h3 class="bp-t">${esc(r.title)}</h3>
    <div class="bp-price">${rp(r.price)}</div>
    <button class="by" data-user="${esc(r.user_id)}" type="button">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="ph">${esc(initial(name))}</span>`}<em>${esc(name)}</em></button>
    <div class="bp-acts">
      ${link ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Buka link<small>${esc(hostOf(link))}</small></a>` : ""}
      ${mine ? "" : `<button class="btn line" id="bpChat" type="button">Chat penjual</button>`}
    </div>
    <p class="bp-note">${mine ? "Ini prompt milikmu." : link ? "Pembayaran dilakukan langsung dengan penjual di link tersebut." : "Penjual belum menambahkan link. Hubungi penjual lewat chat."}</p>`;
  const by = $("#bpBody .by");
  by.onclick = () => { $("#bp").close(); openUser(r.user_id); };
  const ch = $("#bpChat");
  if(ch) ch.onclick = () => { $("#bp").close(); openDM({ id:r.user_id, display_name:name, avatar_url:p.avatar_url }); };
  $("#bp").showModal();
}
$("#bpX").onclick = () => $("#bp").close();
$("#bp").addEventListener("click", e => { if(e.target === $("#bp")) $("#bp").close(); });

/* ---------- Form Jual (gambar, harga, link) ---------- */
function paintSfImg(){
  const b = $("#sfImg");
  b.style.backgroundImage = sfFile ? `url("${sfFile.url}")` : "";
  b.classList.toggle("has", !!sfFile);
  $("#sfRm").hidden = !sfFile;
}
function sfClear(){
  if(sfFile) URL.revokeObjectURL(sfFile.url);
  sfFile = null; paintSfImg();
}
function openSell(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  if(!user) return login();
  if(!profile) return openOnb("first");
  $("#sfForm").reset(); sfClear(); setCat(CATS[0][0], "store");
  $("#sf").showModal();
}
$("#sfImg").onclick = () => $("#sfFile").click();
$("#sfRm").onclick = sfClear;
$("#sfFile").onchange = e => {
  const f = e.target.files[0]; e.target.value = "";
  if(!f) return;
  if(!f.type.startsWith("image/") || f.type === "image/gif") return toast("Pakai gambar JPG, PNG, atau WebP");
  if(sfFile) URL.revokeObjectURL(sfFile.url);
  sfFile = { file:f, url:URL.createObjectURL(f) };
  paintSfImg();
};
$("#tPrice").addEventListener("input", e => {
  const d = e.target.value.replace(/\D/g, "").slice(0, 9);
  e.target.value = d ? fmt(Number(d)) : "";
});
$("#sfX").onclick = () => $("#sf").close();
$("#sf").addEventListener("click", e => { if(e.target === $("#sf")) $("#sf").close(); });

$("#sfForm").onsubmit = async e => {
  e.preventDefault();
  if(sfBusy) return;
  const title = $("#tTitle").value.trim();
  const digits = $("#tPrice").value.replace(/\D/g, "");
  const link = $("#tLink").value.trim();
  if(!title) return;
  if(digits === "") return toast("Isi harga (0 untuk gratis)");
  if(link && !okUrl(link)) return toast("Link harus diawali https://");
  sfBusy = true; $("#sfSend").disabled = true;
  let path = null;
  try{
    let image_url = null;
    if(sfFile){
      const blob = await prepImage(sfFile.file);
      path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb.storage.from("store-media").upload(path, blob, { contentType:"image/jpeg", cacheControl:"31536000" });
      if(up.error) throw up.error;
      image_url = sb.storage.from("store-media").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await sb.from("store_items").insert({
      user_id: user.id, title,
      description: $("#tDesc").value.trim() || null,
      category: $("#tCat").value,
      price: Math.min(Number(digits), 100000000),
      link: link || null, image_url
    }).select(SP_COLS).single();
    if(error) throw error;
    spRows.unshift(data);
    paintStore(); $("#spFeed").scrollTop = 0;
    $("#sf").close(); toast("Prompt dipasang di toko");
  }catch(err){
    if(path) sb.storage.from("store-media").remove([path]);
    toast(/terlalu banyak/.test((err && err.message) || "") ? "Terlalu banyak, coba lagi nanti" : "Gagal memasang prompt");
  }finally{
    sfBusy = false; $("#sfSend").disabled = false;
  }
};
