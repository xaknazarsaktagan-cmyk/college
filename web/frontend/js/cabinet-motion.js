(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelector('[data-open-chat]')?.addEventListener('click',()=>window.openApplicantChat?.());
  let active=null,frame=0;
  const reset=()=>{if(active){active.style.removeProperty('--tilt-x');active.style.removeProperty('--tilt-y');active=null;}cancelAnimationFrame(frame);};
  document.addEventListener('pointermove',event=>{
    if(reduced.matches||!fine.matches)return;
    const card=event.target.closest('.specialty-card');
    if(!card){reset();return;}
    if(active!==card){reset();active=card;}
    const rect=card.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      if(active!==card)return;
      card.style.setProperty('--tilt-x',`${(0.5-y/rect.height)*4}deg`);
      card.style.setProperty('--tilt-y',`${(x/rect.width-0.5)*4}deg`);
    });
  },{passive:true});
  document.addEventListener('pointerleave',reset);addEventListener('blur',reset);
  reduced.addEventListener('change',reset);fine.addEventListener('change',reset);
})();
