import * as f from './vendor/firebase.js?v=firebase-2';
import catalog from './catalog.js?v=firebase-2';
let auth, db, storage, ready;
const now = () => new Date().toISOString();
const fail = (message, status=400) => { const e = new Error(message); e.status=status; throw e; };
const masked = u => ({...u, iin: u.iin ? u.iin.slice(0,2)+'••••••••'+u.iin.slice(-2) : ''});
const defaults = () => ({submitted:false,status:'draft',draft:{},number:null});
function init() {
  if (ready) return ready;
  const config = window.FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.projectId || !config.appId || !config.storageBucket) {
    fail('Firebase бапталмаған. js/firebase-config.js файлын толтырып, Authentication, Firestore және Storage ережелерін қосыңыз.',503);
  }
  const app=f.initializeApp(config);
  auth=f.getAuth(app); db=f.getFirestore(app); storage=f.getStorage(app);
  if (window.FIREBASE_EMULATORS) {
    f.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    f.connectFirestoreEmulator(db,'127.0.0.1',8082);
    f.connectStorageEmulator(storage,'127.0.0.1',9199);
  }
  ready=new Promise(resolve=>{ const stop=f.onAuthStateChanged(auth,()=>{stop();resolve();}); });
  return ready;
}
const d = (c,id) => f.doc(db,c,id);
const read = async (c,id) => { const s=await f.getDoc(d(c,id));return s.exists()?{...s.data(),id:s.id}:null; };
const list = async (c,uid) => (await f.getDocs(uid ? f.query(f.collection(db,c),f.where('user_id','==',uid)) : f.collection(db,c))).docs.map(s=>({...s.data(),id:s.id}));
const note = async (uid,text) => f.addDoc(f.collection(db,'notes'),{user_id:uid,text,read:false,created_at:now()});
async function me() {
  if (!auth.currentUser) fail('Кіру қажет',401);
  const profile=await read('users',auth.currentUser.uid);
  if (!profile) fail('Профиль табылмады. Тіркелу аяқталмаған; қайта тіркеліп көріңіз.',409);
  return profile;
}
async function admin() { const u=await me();if(u.role!=='admin')fail('Тек комиссияға рұқсат',403);return u; }
async function applicant() { const u=await me();if(u.role!=='applicant')fail('Тек абитуриентке рұқсат',403);return u; }
function checkApplication(body,submit) {
  if (body.program_id!==null && !catalog.programs.some(p=>p.id===body.program_id)) fail('Бағдарлама табылмады');
  if (!['kk','ru','en'].includes(body.lang)) fail('Оқу тілі қате');
  if (body.ent_score!==null && (!Number.isInteger(body.ent_score)||body.ent_score<0||body.ent_score>140)) fail('ҰБТ балы 0–140 аралығында болуы керек');
  if (submit && (!body.program_id || body.ent_score===null)) fail('Бағдарлама мен ҰБТ балын толтырыңыз');
}
async function saveApplication(body,submit) {
  const u=await applicant();checkApplication(body,submit);
  return f.runTransaction(db,async tx=>{
    const ref=d('applications',u.id), snap=await tx.get(ref), old=snap.exists()?snap.data():null;
    if (old && ['accepted','rejected'].includes(old.status)) fail('Шешім шыққан өтінішті өзгертуге болмайды');
    const submitted=submit || !!old?.submitted;
    const value={user_id:u.id,submitted,status:submitted?'review':'draft',number:submitted?(old?.number||`${new Date().getFullYear()}-${u.id.slice(0,8)}`):null,draft:{program_id:body.program_id,lang:body.lang,ent:body.ent_score,dorm:!!body.dorm},updated_at:now()};
    tx.set(ref,value);return value;
  });
}
async function upload(id,file) {
  const u=await applicant(), doc=await read('documents',id);
  if(!doc || doc.user_id!==u.id) fail('Құжат табылмады',404);
  if(!file || !['application/pdf','image/jpeg','image/png'].includes(file.type))fail('PDF, JPG немесе PNG таңдаңыз');
  if(!file.size || file.size>5*1024*1024)fail('Файл бос болмауы және 5 МБ-тан аспауы керек');
  const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
  const signatures={'application/pdf':[37,80,68,70,45],'image/jpeg':[255,216,255],'image/png':[137,80,78,71,13,10,26,10]};
  if(!signatures[file.type].every((b,i)=>bytes[i]===b))fail('Файл мазмұны форматқа сәйкес емес');
  const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[file.type];
  const path=`documents/${u.id}/${id}/${crypto.randomUUID()}.${ext}`;
  await f.uploadBytes(f.ref(storage,path),file,{contentType:file.type});
  try { await f.updateDoc(d('documents',id),{stored_name:path,file:file.name,status:'review',reason:null}); }
  catch(e) { await f.deleteObject(f.ref(storage,path)).catch(()=>{});throw e; }
  if(doc.stored_name) await f.deleteObject(f.ref(storage,doc.stored_name)).catch(()=>{});
  return {ok:true};
}
export async function request(path, opts={}) {
  if(path==='/api/programs')return catalog.programs;
  if(path==='/api/deadlines')return catalog.deadlines;
  if(path==='/api/faq')return catalog.faq;
  await init();
  const body=opts.body instanceof FormData?opts.body:JSON.parse(opts.body||'{}');
  if(path==='/api/auth/login') {
    if(!body.login.includes('@'))fail('Email арқылы кіріңіз');
    await f.setPersistence(auth,document.querySelector('#remember')?.checked?f.browserLocalPersistence:f.browserSessionPersistence);
    await f.signInWithEmailAndPassword(auth,body.login.trim(),body.password);
    const u=await me();return {token:'firebase-session',role:u.role,name:u.name};
  }
  if(path==='/api/auth/register') {
    if(body.name.trim().split(/\s+/).length<2 || !/^\d{12}$/.test(body.iin))fail('Аты-жөніңізді және 12 таңбалы ЖСН толтырыңыз');
    if(!/^\+?\d[\d ()-]{9,31}$/.test(body.phone))fail('Телефон нөмірі қате');
    if(body.password.length<8 || !/\p{L}/u.test(body.password)||!/\d/.test(body.password))fail('Құпиясөзде кемінде 8 таңба, әріп және сан болуы керек');
    await f.setPersistence(auth,f.browserLocalPersistence);
    const {user}=await f.createUserWithEmailAndPassword(auth,body.email.trim(),body.password);
    try {
      const batch=f.writeBatch(db);
      batch.set(d('users',user.uid),{name:body.name.trim(),email:user.email,phone:body.phone.trim(),iin:body.iin,role:'applicant',created_at:now()});
      catalog.documents.forEach(v=>batch.set(d('documents',user.uid+'__'+v.type),{user_id:user.uid,...v,status:'empty',file:null,stored_name:null,reason:null}));
      await batch.commit();
    } catch(e) { await f.deleteUser(user).catch(()=>{});throw e; }
    return {token:'firebase-session',role:'applicant',name:body.name};
  }
  if(path==='/api/auth/me')return masked(await me());
  if(path==='/api/auth/profile') {
    const u=await me();if(body.name?.trim().split(/\s+/).length<2)fail('Аты мен тегін толық жазыңыз');
    if(!/^\+?\d[\d ()-]{9,31}$/.test(body.phone||''))fail('Телефон нөмірі қате');
    await f.updateDoc(d('users',u.id),{name:body.name.trim(),phone:body.phone.trim()});return masked(await me());
  }
  if(path==='/api/auth/password') {
    await me();if(body.new_password.length<8)fail('Кемінде 8 таңба енгізіңіз');
    await f.reauthenticateWithCredential(auth.currentUser,f.EmailAuthProvider.credential(auth.currentUser.email,body.current));
    await f.updatePassword(auth.currentUser,body.new_password);return {ok:true};
  }
  if(path==='/api/cabinet') {
    const u=await applicant();const [application,documents,notes,tickets]=await Promise.all([read('applications',u.id),list('documents',u.id),list('notes',u.id),list('tickets',u.id)]);
    return {user:masked(u),application:application||defaults(),documents,notes:notes.sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(n=>({id:n.id,t:n.text,d:n.created_at,r:n.read})),tickets:tickets.sort((a,b)=>b.created_at.localeCompare(a.created_at))};
  }
  if(path==='/api/application')return saveApplication(body,false);
  if(path==='/api/application/submit')return saveApplication(body,true);
  if(path==='/api/application/reopen') {
    const u=await applicant();await f.runTransaction(db,async tx=>{const ref=d('applications',u.id),s=await tx.get(ref);if(!s.exists()||!s.data().submitted||['accepted','rejected'].includes(s.data().status))fail('Өтінішті өзгертуге болмайды');tx.update(ref,{submitted:false,status:'draft',updated_at:now()});});return {ok:true};
  }
  let match;
  if((match=path.match(/^\/api\/documents\/([^/]+)\/upload$/)))return upload(match[1],body.get('file'));
  if((match=path.match(/^\/api\/documents\/([^/]+)\/file$/))) {
    const u=await me(),value=await read('documents',match[1]);if(!value || (!value.stored_name))fail('Файл жоқ',404);
    if(u.role!=='admin'&&value.user_id!==u.id)fail('Рұқсат жоқ',403);
    return f.getBlob(f.ref(storage,value.stored_name));
  }
  if(path==='/api/notes/read-all') {
    const u=await me();const notes=await list('notes',u.id);for(let i=0;i<notes.length;i+=400){const batch=f.writeBatch(db);notes.slice(i,i+400).forEach(n=>batch.update(d('notes',n.id),{read:true}));await batch.commit();}return {ok:true};
  }
  if((match=path.match(/^\/api\/notes\/([^/]+)\/read$/))) {await me();await f.updateDoc(d('notes',match[1]),{read:true});return {ok:true};}
  if(path==='/api/tickets') {
    const u=await applicant();if((body.subject||'').trim().length<3||(body.message||'').trim().length<5)fail('Тақырып пен хабарды толық жазыңыз');
    const ref=await f.addDoc(f.collection(db,'tickets'),{user_id:u.id,subject:body.subject.trim(),message:body.message.trim(),reply:null,status:'open',created_at:now()});return {id:ref.id,status:'open'};
  }
  if(path.startsWith('/api/admin/')) {
    await admin();
    if(path==='/api/admin/applications') {
      const [apps,users,documents]=await Promise.all([list('applications'),list('users'),list('documents')]);
      return apps.map(a=>{const docs=documents.filter(d=>d.user_id===a.user_id);return {...a,user:users.find(u=>u.id===a.user_id),program:catalog.programs.find(p=>p.id===a.draft.program_id)?.name_kk,ent:a.draft.ent,lang:a.draft.lang,dorm:a.draft.dorm,docs,docs_ok:docs.filter(d=>d.status==='ok').length,docs_total:docs.length};});
    }
    if(path==='/api/admin/tickets') {
      const [tickets,users]=await Promise.all([list('tickets'),list('users')]);return tickets.map(t=>({...t,user:users.find(u=>u.id===t.user_id)}));
    }
    if(path==='/api/admin/stats') {
      const [users,apps,docs,tickets]=await Promise.all(['users','applications','documents','tickets'].map(c=>list(c)));return {applicants:users.filter(u=>u.role==='applicant').length,submitted:apps.filter(a=>a.submitted).length,pending_docs:docs.filter(d=>d.status==='review').length,open_tickets:tickets.filter(t=>t.status!=='closed').length};
    }
    if((match=path.match(/^\/api\/admin\/applications\/([^/]+)\/status$/))) {
      const a=await read('applications',match[1]);if(!a?.submitted||!['review','exam','accepted','rejected'].includes(body.status))fail('Өтініш немесе мәртебе қате');
      await f.updateDoc(d('applications',a.id),{status:body.status,updated_at:now()});await note(a.user_id,`Өтініш № ${a.number}: ${body.status}`);return {ok:true};
    }
    if((match=path.match(/^\/api\/admin\/documents\/([^/]+)\/review$/))) {
      const value=await read('documents',match[1]);if(!value?.stored_name||!['ok','bad'].includes(body.status))fail('Құжат немесе мәртебе қате');
      await f.updateDoc(d('documents',value.id),{status:body.status,reason:body.status==='bad'?(body.reason||'Сапасы жеткіліксіз'):null});await note(value.user_id,`«${value.name}»: ${body.status==='ok'?'қабылданды':'қайта жүктеу керек'}`);return {ok:true};
    }
    if(path==='/api/admin/notify') {if(!body.text?.trim())fail('Хабар бос');await note(body.user_id,body.text.trim());return {ok:true};}
    if((match=path.match(/^\/api\/admin\/tickets\/([^/]+)\/reply$/))) {
      const ticket=await read('tickets',match[1]);if(!ticket||!body.reply?.trim()||!['answered','closed'].includes(body.status))fail('Жауап қате');
      await f.updateDoc(d('tickets',ticket.id),{reply:body.reply.trim(),status:body.status});await note(ticket.user_id,`Қолдау жауабы: ${body.reply}`);return {ok:true};
    }
  }
  fail('Әрекет табылмады',404);
}
export async function logout() {await init();await f.signOut(auth);}
