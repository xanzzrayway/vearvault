/* ---------- Pilih AI (tampilan sendiri, bukan select bawaan) ---------- */
const CHEV = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const PICKERS = {
  main: { input: "#fCat", btn: "#catBtn" },   // form tambah prompt
  send: { input: "#sCat", btn: "#sCatBtn" },  // form kirim prompt
  store: { input: "#tCat", btn: "#tCatBtn" }  // form jual prompt
};
let pickKey = "main";

function setCat(name, key = "main"){
  const p = PICKERS[key];
  $(p.input).value = name;
  $(p.btn).innerHTML = `<i class="dot" style="background:${color(name)}"></i><span>${esc(name)}</span>${CHEV}`;
}
function paintCP(){
  const cur = $(PICKERS[pickKey].input).value;
  $("#cpList").innerHTML = CATS.map(([n,c]) =>
    `<button type="button" class="ai ${n===cur?"on":""}" data-c="${esc(n)}"><i style="background:${c}"></i><span>${esc(n)}</span>${n===cur?TICK:""}</button>`
  ).join("");
}
function openPicker(key){
  pickKey = key; paintCP();
  $("#cp").showModal();
  setTimeout(() => { const on = $("#cpList .on"); if(on) on.scrollIntoView({ block:"nearest" }); }, 0);
}
$("#catBtn").onclick = () => openPicker("main");
$("#sCatBtn").onclick = () => openPicker("send");
$("#tCatBtn").onclick = () => openPicker("store");
$("#cpList").onclick = e => {
  const b = e.target.closest(".ai"); if(!b) return;
  setCat(b.dataset.c, pickKey); $("#cp").close();
};
$("#cpX").onclick = () => $("#cp").close();
$("#cp").addEventListener("click", e => { if(e.target===$("#cp")) $("#cp").close(); });
setCat(CATS[0][0], "main");
setCat(CATS[0][0], "send");
setCat(CATS[0][0], "store");
