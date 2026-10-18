/* ---------- Kunci scroll halaman utama saat ada menu/popup terbuka ---------- */
(() => {
  const html = document.documentElement;
  let savedY = 0;
  const sync = () => {
    const anyOpen = !!document.querySelector("dialog[open]");
    const locked = html.classList.contains("lock");
    if(anyOpen && !locked){
      savedY = window.scrollY;
      document.body.style.top = -savedY + "px";
      html.classList.add("lock");
    } else if(!anyOpen && locked){
      html.classList.remove("lock");
      document.body.style.top = "";
      window.scrollTo({ top: savedY, behavior: "instant" });
    }
  };
  const orig = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function(){ orig.call(this); sync(); };
  document.addEventListener("close", sync, true);
})();
