const TOKEN_KEY = "narxoz-firebase-session";
let firebaseService;
const service = () => firebaseService || (firebaseService = import('./firebase-service.js?v=private-files-1'));
const api = {
  token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); },
  setToken(t, remember) {
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, 'active');
  },
  async clear() {
    localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY);
    try { await (await service()).logout(); } catch (e) { console.warn('Firebase sign-out:',e.code||e.message); }
  },
  async req(path, opts = {}) {
    try { return await (await service()).request(path, opts); }
    catch (e) {
      const ru = typeof getLang==='function' && getLang()==='ru';
      const messages = {
        'auth/invalid-credential':'Email немесе құпиясөз қате',
        'auth/email-already-in-use':'Бұл email тіркелген',
        'auth/invalid-email':'Email форматы қате',
        'auth/weak-password':'Құпиясөз жеткілікті күрделі емес',
        'auth/network-request-failed':'Firebase байланысын тексеріңіз',
        'auth/too-many-requests':'Сұрау тым көп. Кейінірек қайталаңыз',
        'permission-denied':'Firebase рұқсаттары жеткіліксіз. Ережелер мен рөлді тексеріңіз',
        'storage/unauthorized':ru?'Нет доступа к хранилищу. Комиссии нужно проверить правила Firebase Storage.':'Қоймаға рұқсат жоқ. Комиссия Firebase Storage ережелерін тексеруі керек.',
        'storage/unauthenticated':ru?'Войдите в аккаунт заново и повторите загрузку.':'Аккаунтқа қайта кіріп, файлды қайта жүктеңіз.',
        'storage/bucket-not-found':ru?'Хранилище файлов ещё не подключено. Обратитесь в комиссию.':'Файл қоймасы әлі қосылмаған. Комиссияға хабарласыңыз.',
        'storage/project-not-found':ru?'Хранилище проекта не найдено. Обратитесь в комиссию.':'Жобаның файл қоймасы табылмады. Комиссияға хабарласыңыз.',
        'storage/quota-exceeded':ru?'Лимит хранилища исчерпан. Обратитесь в комиссию.':'Файл қоймасының лимиті таусылған. Комиссияға хабарласыңыз.',
        'storage/retry-limit-exceeded':ru?'Хранилище не ответило за 30 секунд. Проверьте интернет и попробуйте снова. Если ошибка повторяется, сообщите комиссии.':'Қойма 30 секундта жауап бермеді. Интернетті тексеріп, қайталаңыз. Қайталанса, комиссияға хабарласыңыз.',
        'storage/canceled':ru?'Загрузка отменена. Можно выбрать файл снова.':'Жүктеу тоқтатылды. Файлды қайта таңдауға болады.',
        'storage/unknown':ru?'Файл не загружен. Попробуйте снова; если ошибка повторяется, сообщите комиссии.':'Файл жүктелмеді. Қайталап көріңіз; қайталанса, комиссияға хабарласыңыз.'
      };
      if (messages[e.code]) { const err = new Error(messages[e.code]); err.status=e.status; err.code=e.code; throw err; }
      throw e;
    }
  },
  get(p) { return this.req(p); },
  post(p, body) { return this.req(p, {method:'POST',body:JSON.stringify(body)}); },
  put(p, body) { return this.req(p, {method:'PUT',body:JSON.stringify(body)}); }
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(m) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

// тіл мен тақырып i18n.js ішінде басқарылады (getLang / setLang / tr / dyn)
function lang() {
  return getLang();
}

function t(dict) {
  return dict[lang()] || dict.kk || "";
}

let documentViewer;
async function openDoc(id) {
  const ru=typeof getLang==='function'&&getLang()==='ru';
  if(documentViewer?.open)documentViewer.close();
  const dialog=document.createElement('dialog');documentViewer=dialog;
  dialog.className='document-viewer';dialog.setAttribute('aria-label',ru?'Просмотр документа':'Құжатты қарау');
  dialog.innerHTML=`<header><h2>${ru?'Документ':'Құжат'}</h2><button type="button" class="viewer-close" aria-label="${ru?'Закрыть':'Жабу'}">×</button></header><p class="viewer-status" role="status">${ru?'Загружаем документ…':'Құжат жүктелуде…'}</p><div class="viewer-content"></div><footer></footer>`;
  let objectUrl;
  dialog.querySelector('.viewer-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();
  try {
    const blob=await api.get(`/api/documents/${id}/file`);
    if(!dialog.open)return;
    if(!['application/pdf','image/png','image/jpeg'].includes(blob.type))throw new Error(ru?'Неподдерживаемый формат документа':'Құжат форматы қолдау таппайды');
    objectUrl=URL.createObjectURL(blob);
    const title=blob.name||'document';dialog.querySelector('h2').textContent=title;
    const view=document.createElement(blob.type==='application/pdf'?'iframe':'img');
    view.src=objectUrl;
    if(view.tagName==='IMG'){view.alt=title;}else{view.title=title;view.setAttribute('referrerpolicy','no-referrer');}
    dialog.querySelector('.viewer-content').append(view);
    dialog.querySelector('.viewer-status').textContent=ru?'Если просмотр недоступен, скачайте файл.':'Алдын ала қарау ашылмаса, файлды жүктеп алыңыз.';
    const link=document.createElement('a');link.href=objectUrl;link.download=title;link.className='btn';link.textContent=ru?'Скачать документ':'Құжатты жүктеп алу';dialog.querySelector('footer').append(link);
  } catch(error){if(dialog.open)dialog.querySelector('.viewer-status').textContent=error.message;throw error;}
}
