(() => {
  const ru = () => typeof getLang === 'function' && getLang() === 'ru';
  const label = (kk, r) => ru() ? r : kk;
  let uid, timer, generation=0, busy=false;
  const dialog=document.createElement('dialog');
  dialog.className='chat-dialog';
  dialog.innerHTML=`<div class="chat-heading"><h2 id="chat-title"></h2><button type="button" class="btn ghost" id="chat-close" aria-label="Close">×</button></div><p id="chat-error" role="status"></p><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form"><label for="chat-text" id="chat-label"></label><textarea id="chat-text" maxlength="4000" required rows="3"></textarea><button class="btn" id="chat-send" type="submit"></button></form>`;
  document.body.append(dialog);
  const $=s=>dialog.querySelector(s);
  function labels(){
    $('#chat-title').textContent=label('Қабылдау комиссиясымен чат','Чат с приёмной комиссией');
    $('#chat-label').textContent=label('Хабарлама','Сообщение');
    $('#chat-send').textContent=label('Жіберу','Отправить');
  }
  function stop(){clearTimeout(timer);generation++;uid=null;}
  dialog.addEventListener('close',stop);
  $('#chat-close').onclick=()=>dialog.close();
  async function refresh(token){
    try {
      const messages=await api.get('/api/chat/'+encodeURIComponent(uid));
      if(token!==generation || !dialog.open)return;
      const log=$('#chat-log'), nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;
      const signature=JSON.stringify(messages);
      if(log.dataset.signature!==signature){
        log.dataset.signature=signature;
        log.innerHTML=messages.length ? messages.map(m=>`<article class="chat-message ${m.sender_role==='admin'?'commission':'student'}"><b>${esc(m.sender_role==='admin'?label('Комиссия','Комиссия'):label('Абитуриент','Абитуриент'))}</b><p>${esc(m.text)}</p><small>${esc(new Date(m.created_at).toLocaleString(ru()?'ru-RU':'kk-KZ'))}</small></article>`).join('') : `<p>${label('Әзірге хабарлама жоқ. Бірінші болып жазыңыз.','Сообщений пока нет. Напишите первым.')}</p>`;
        if(nearBottom)log.scrollTop=log.scrollHeight;
      }
      $('#chat-error').textContent='';
    } catch(e){if(token===generation)$('#chat-error').textContent=e.message;}
    finally{if(token===generation && dialog.open){clearTimeout(timer);timer=setTimeout(()=>refresh(token),3000);}}
  }
  window.openApplicantChat=async target=>{
    try {
      const me=await api.get('/api/auth/me');
      stop();uid=me.role==='admin'?target:me.id;
      if(!uid)throw new Error(label('Абитуриентті таңдаңыз','Выберите абитуриента'));
      labels();$('#chat-log').innerHTML='…';delete $('#chat-log').dataset.signature;$('#chat-text').value='';
      dialog.showModal();refresh(generation);$('#chat-text').focus();
    } catch(e){toast(e.message);}
  };
  $('#chat-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const text=$('#chat-text').value.trim();if(!text)return;
    const token=generation,target=uid;busy=true;$('#chat-send').disabled=true;
    try{await api.post('/api/chat/'+encodeURIComponent(target),{text});if(token===generation){$('#chat-text').value='';clearTimeout(timer);await refresh(token);}}
    catch(e){if(token===generation)$('#chat-error').textContent=e.message;}
    finally{busy=false;$('#chat-send').disabled=false;}
  };
  addEventListener('abit-lang',labels);
  if(document.querySelector('#appTable')){
    document.addEventListener('click',e=>{const b=e.target.closest('[data-chat]');if(b)openApplicantChat(b.dataset.chat);});
  }else{
    const button=document.createElement('button');button.className='btn chat-launch';button.type='button';button.textContent=label('Комиссиямен чат','Чат с комиссией');button.onclick=()=>openApplicantChat();document.body.append(button);
    addEventListener('abit-lang',()=>button.textContent=label('Комиссиямен чат','Чат с комиссией'));
  }
})();
