/* ---------- Init ---------- */
(async function init(){
  renderChips(); renderAuth();
  if(configured){
    const { data } = await sb.auth.getSession();
    await setUser(data.session?.user || null);
    sb.auth.onAuthStateChange((_ev, s) => {
      const next = s?.user || null;
      if((next?.id||null) !== (user?.id||null)) setTimeout(() => setUser(next), 0);
    });
  } else { load(); }
})();
