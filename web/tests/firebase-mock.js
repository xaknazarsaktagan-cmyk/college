// Browser integration double ONLY. Never imported by the production app.
let state=JSON.parse(localStorage.getItem('firebase-test-state')||'{"accounts":{},"docs":{},"files":{},"uid":null}');
const save=()=>localStorage.setItem('firebase-test-state',JSON.stringify(state));
const auth={get currentUser(){return state.uid?{uid:state.uid,email:state.accounts[state.uid].email}:null;}};
export const initializeApp=()=>({});export const getAuth=()=>auth;export const getFirestore=()=>({});export const getStorage=()=>({});
export const browserLocalPersistence='local',browserSessionPersistence='session';
export const setPersistence=async()=>{};
export const onAuthStateChanged=(a,fn)=>{queueMicrotask(fn);return ()=>{};};
export async function createUserWithEmailAndPassword(a,email,password){if(Object.values(state.accounts).some(u=>u.email===email))throw {code:'auth/email-already-in-use'};const uid=crypto.randomUUID().replaceAll('-','');state.accounts[uid]={email,password};state.uid=uid;save();return {user:auth.currentUser};}
export async function signInWithEmailAndPassword(a,email,password){const found=Object.entries(state.accounts).find(([id,u])=>u.email===email&&u.password===password);if(!found)throw {code:'auth/invalid-credential'};state.uid=found[0];save();return {user:auth.currentUser};}
export const signOut=async()=>{state.uid=null;save();};
export const deleteUser=async user=>{delete state.accounts[user.uid];state.uid=null;save();};
export const EmailAuthProvider={credential:(email,password)=>({email,password})};
export async function reauthenticateWithCredential(user,c){if(state.accounts[user.uid].password!==c.password)throw {code:'auth/invalid-credential'};}
export async function updatePassword(user,p){state.accounts[user.uid].password=p;save();}
export const doc=(db,c,id)=>({c,id});export const collection=(db,c)=>({c});export const where=(key,op,v)=>({key,v});export const query=(ref,filter)=>({...ref,filter});
const snap=(ref)=>({id:ref.id,exists:()=>!!state.docs[ref.c+'/'+ref.id],data:()=>structuredClone(state.docs[ref.c+'/'+ref.id])});
export const getDoc=async ref=>snap(ref);
export const setDoc=async(ref,v)=>{state.docs[ref.c+'/'+ref.id]=structuredClone(v);save();};
export const updateDoc=async(ref,v)=>{if(!state.docs[ref.c+'/'+ref.id])throw Error('Missing document');Object.assign(state.docs[ref.c+'/'+ref.id],structuredClone(v));save();};
export const getDocs=async ref=>({docs:Object.entries(state.docs).filter(([k,v])=>k.split('/')[0]===ref.c&&(!ref.filter||v[ref.filter.key]===ref.filter.v)).map(([k])=>snap({c:ref.c,id:k.split('/')[1]}))});
export const addDoc=async(ref,v)=>{const id=crypto.randomUUID();await setDoc({...ref,id},v);return {id};};
export function writeBatch(){let ops=[];return {set:(r,v)=>ops.push(()=>setDoc(r,v)),update:(r,v)=>ops.push(()=>updateDoc(r,v)),commit:async()=>{for(const op of ops)await op();}};}
export const runTransaction=async(db,fn)=>{const batch=writeBatch();const value=await fn({...batch,get:getDoc});await batch.commit();return value;};
export const ref=(s,path)=>({path});export const uploadBytes=async(r,file,meta)=>{state.files[r.path]={bytes:[...new Uint8Array(await file.arrayBuffer())],type:meta.contentType};save();};
export const getBlob=async r=>{const file=state.files[r.path];if(!file)throw Error('Missing file');return new Blob([new Uint8Array(file.bytes)],{type:file.type});};
export const deleteObject=async r=>{delete state.files[r.path];save();};
export const connectAuthEmulator=()=>{};export const connectFirestoreEmulator=()=>{};export const connectStorageEmulator=()=>{};
window.__firebaseMock={promote(uid){state.docs['users/'+uid].role='admin';save();}};
