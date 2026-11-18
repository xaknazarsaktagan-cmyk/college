const ru=()=>typeof getLang==='function'&&getLang()==='ru';
const text=(kk,r)=>ru()?r:kk;
const messages={
  LOGIN_REQUIRED:['Аккаунтқа қайта кіріңіз.','Войдите в аккаунт заново.'],
  INVALID_SESSION:['Сессия аяқталды. Қайта кіріңіз.','Сессия истекла. Войдите заново.'],
  ACCESS_DENIED:['Бұл құжатқа рұқсат жоқ.','Нет доступа к этому документу.'],
  FILE_REQUIRED:['Файлды таңдаңыз.','Выберите файл.'],
  FILE_TOO_LARGE:['Файл 5 МБ-тан аспауы керек.','Файл должен быть не больше 5 МБ.'],
  INVALID_FILE:['PDF, JPG немесе PNG файлын таңдаңыз.','Выберите корректный PDF, JPG или PNG.'],
  FILE_NOT_FOUND:['Құжат файлы табылмады.','Файл документа не найден.'],
  ORIGIN_NOT_ALLOWED:['Сайт мекенжайы қоймада рұқсат етілмеген. Комиссияға хабарласыңыз.','Адрес сайта не разрешён в хранилище. Сообщите комиссии.'],
  STORAGE_NOT_CONFIGURED:['Құжат қоймасы әлі бапталмаған. Комиссияға хабарласыңыз.','Хранилище документов ещё не настроено. Сообщите комиссии.'],
  STORAGE_UNAVAILABLE:['Қойма жауап бермеді немесе тегін лимит таусылған. Қайталап көріңіз.','Хранилище недоступно или исчерпан бесплатный лимит. Попробуйте позже.']
};
function error(code,status=503){const pair=messages[code]||messages.STORAGE_UNAVAILABLE;const e=new Error(text(...pair));e.code=code;e.status=status;return e;}
function endpoint(){
  const url=window.DOCUMENT_STORAGE?.endpoint||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/document-files\/?$/.test(url))throw error('STORAGE_NOT_CONFIGURED');
  return url.replace(/\/$/,'');
}
export function isSupabase(){return (window.DOCUMENT_STORAGE?.provider||'supabase')==='supabase';}
export async function privateFileRequest(user,{method='GET',id,file,path,opts={}}){
  const base=endpoint(),token=await user.getIdToken();
  const query=new URLSearchParams({documentId:id});if(path)query.set('path',path);
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open(method,base+'?'+query);xhr.timeout=60000;
    xhr.setRequestHeader('Authorization','Bearer '+token);
    xhr.responseType=method==='GET'?'blob':'json';
    xhr.upload.onprogress=e=>{if(e.lengthComputable)opts.onProgress?.(Math.min(99,Math.round(e.loaded/e.total*100)));};
    xhr.onload=async()=>{
      if(xhr.status>=200&&xhr.status<300){opts.onProgress?.(100);resolve(xhr.response);return;}
      let code;
      if(xhr.response instanceof Blob){try{code=JSON.parse(await xhr.response.text()).code;}catch{}}
      else code=xhr.response?.code;
      reject(error(code||'STORAGE_UNAVAILABLE',xhr.status));
    };
    xhr.onerror=()=>reject(error('STORAGE_UNAVAILABLE'));
    xhr.ontimeout=()=>reject(error('STORAGE_UNAVAILABLE'));
    xhr.onabort=()=>{const e=new Error(text('Жүктеу тоқтатылды. Файлды қайта таңдауға болады.','Загрузка отменена. Можно выбрать файл снова.'));e.code='storage/canceled';reject(e);};
    opts.onCancelReady?.(()=>{xhr.abort();return true;});
    if(file){const form=new FormData();form.append('documentId',id);form.append('file',new File([file],file.name,{type:opts.mime}));xhr.send(form);}else xhr.send();
  });
}
