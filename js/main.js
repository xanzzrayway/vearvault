/* ---------- Init ---------- */
(async function init(){
  renderChips(); renderAuth();
  if(configured){
    const { data } = await sb.auth.getSession();
    await setUser(data.session?.user || null);
    startNotice();
    sb.auth.onAuthStateChange((_ev, s) => {
      const next = s?.user || null;
      if((next?.id||null) !== ((user && user.id) || (guest && guest.id) || null)) setTimeout(() => setUser(next), 0);
    });
  } else { load(); }
})();
