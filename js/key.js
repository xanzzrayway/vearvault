/* ---------- Aktivasi Key (VearTools): buat dan lihat key milik sendiri ---------- */
let akBusy = false;

async function openKey(){
  if(!configured) return toast("Belum terhubung ke server");
  if(!user){ needGoogle("Masuk dengan Google untuk membuat key"); return; }
  $("#akBody").innerHTML = '<div class="skel"></div>';
  $("#ak").showModal();
  const { data, error } = await sb.rpc("get_tools_key");
  if(error){ $("#akBody").innerHTML = '<p class="wn-msg">Gagal memuat key. Coba lagi nanti.</p>'; return; }
  paintKey(data || {});
}
function paintKey(d){
  const b = $("#akBody");
  if(!d.key){
    b.innerHTML = `<p class="wn-msg">Key dipakai untuk membuka VearTools. Satu akun hanya bisa punya satu key.</p>
      <button class="btn" type="button" id="akGen">Generate Key</button>`;
    $("#akGen").onclick = genKey;
    return;
  }
  b.innerHTML = `<div class="ak-key" id="akKey">${esc(d.key)}</div>
    <p class="ak-st ${d.activated ? "on" : ""}">${d.activated ? "Sudah diaktifkan di VearTools" : "Belum diaktifkan. Masukkan key ini di VearTools."}</p>
    <button class="btn line" type="button" id="akCopy">Salin key</button>
    <a class="btn" href="/tools/" id="akGo">Buka VearTools</a>`;
  $("#akCopy").onclick = async () => {
    try{ await navigator.clipboard.writeText(d.key); toast("Key tersalin"); }catch{ toast("Gagal menyalin, salin manual"); }
  };
}
async function genKey(){
  if(akBusy) return;
  akBusy = true; $("#akGen").disabled = true;
  const { data, error } = await sb.rpc("generate_tools_key");
  akBusy = false;
  if(error){ const g = $("#akGen"); if(g) g.disabled = false; return toast(/terlalu|tidak diizinkan/.test(error.message || "") ? "Tidak bisa membuat key untuk akun ini" : "Gagal membuat key"); }
  paintKey({ key: data, activated: false });
  toast("Key dibuat");
}
$("#akX").onclick = () => $("#ak").close();
$("#ak").addEventListener("click", e => { if(e.target === $("#ak")) $("#ak").close(); });
