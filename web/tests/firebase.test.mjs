import {before,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,query,where} from 'firebase/firestore';
import {ref,uploadBytes,getBytes} from 'firebase/storage';
let env;
const user=(uid,role='applicant')=>({name:'Test Student',email:uid+'@example.com',iin:'050101123456',phone:'+77001234567',role,created_at:'2026-10-29'});
const document=(uid)=>({user_id:uid,type:'id',name:'Жеке куәлік',hint:'PDF',status:'empty',file:null,stored_name:null,reason:null});
const app=uid=>({user_id:uid,submitted:true,status:'review',number:'2026-'+uid,draft:{program_id:1,lang:'kk',ent:100,dorm:false},updated_at:'2026-10-29'});
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-narxoz',firestore:{host:'127.0.0.1',port:8082,rules:readFileSync('firebase/firestore.rules','utf8')},storage:{host:'127.0.0.1',port:9199,rules:readFileSync('firebase/storage.rules','utf8')}});
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{for(const uid of ['alice','bob','commission'])await setDoc(doc(ctx.firestore(),'users',uid),user(uid,uid==='commission'?'admin':'applicant'));});
});
after(async()=>{await env?.cleanup();});
test('registration can only create own applicant role',async()=>{
 const db=env.authenticatedContext('new',{email:'new@example.com'}).firestore();
 await assertFails(setDoc(doc(db,'users','new'),user('new','admin')));
 await assertSucceeds(setDoc(doc(db,'users','new'),user('new')));
 await assertFails(updateDoc(doc(db,'users','new'),{role:'admin'}));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users','new')));
});
test('profile isolation and admin access',async()=>{
 const db=env.authenticatedContext('alice').firestore();
 await assertSucceeds(getDoc(doc(db,'users','alice')));
 await assertFails(getDoc(doc(db,'users','bob')));
 await assertFails(getDocs(collection(db,'users')));
 await assertSucceeds(getDocs(collection(env.authenticatedContext('commission').firestore(),'users')));
});
test('applications: invalid program/score, final decisions immutable for applicant',async()=>{
 const db=env.authenticatedContext('alice').firestore(),ref=doc(db,'applications','alice');
 await assertFails(setDoc(ref,{...app('alice'),draft:{...app('alice').draft,program_id:999}}));
 await assertFails(setDoc(ref,{...app('alice'),draft:{...app('alice').draft,ent:141}}));
 await assertSucceeds(setDoc(ref,app('alice')));
 await assertFails(updateDoc(ref,{status:'accepted'}));
 await assertSucceeds(updateDoc(doc(env.authenticatedContext('commission').firestore(),'applications','alice'),{status:'accepted'}));
 await assertFails(updateDoc(ref,{status:'review'}));
 await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(),'applications','alice')));
});
test('documents: only own uploads and admin review',async()=>{
 const db=env.authenticatedContext('alice').firestore(),ref=doc(db,'documents','alice__id');
 await assertSucceeds(setDoc(ref,document('alice')));
 await assertFails(updateDoc(ref,{status:'ok'}));
 await assertSucceeds(updateDoc(ref,{stored_name:'documents/alice/alice__id/test.pdf',file:'test.pdf',status:'review'}));
 await assertFails(updateDoc(doc(env.authenticatedContext('bob').firestore(),'documents','alice__id'),{status:'bad'}));
 await assertSucceeds(updateDoc(doc(env.authenticatedContext('commission').firestore(),'documents','alice__id'),{status:'ok'}));
 await assertSucceeds(getDocs(query(collection(db,'documents'),where('user_id','==','alice'))));
 await assertFails(getDocs(collection(db,'documents')));
});
test('tickets and notifications are protected',async()=>{
 const db=env.authenticatedContext('alice').firestore(),ref=doc(db,'tickets','question');
 await assertSucceeds(setDoc(ref,{user_id:'alice',subject:'Question',message:'Help please',reply:null,status:'open',created_at:'2026'}));
 await assertFails(updateDoc(ref,{reply:'fake',status:'answered'}));
 await assertSucceeds(updateDoc(doc(env.authenticatedContext('commission').firestore(),'tickets','question'),{reply:'Answer',status:'answered'}));
 const note={user_id:'alice',text:'Answer',read:false,created_at:'2026'};
 await assertFails(setDoc(doc(db,'notes','answer'),note));
 await assertSucceeds(setDoc(doc(env.authenticatedContext('commission').firestore(),'notes','answer'),note));
 await assertSucceeds(updateDoc(doc(db,'notes','answer'),{read:true}));
 await assertFails(updateDoc(doc(db,'notes','answer'),{text:'changed'}));
});
test('Storage: file ownership, MIME and size limits',async()=>{
 const storage=env.authenticatedContext('alice').storage(),path='documents/alice/alice__id/storage.pdf';
 await assertSucceeds(uploadBytes(ref(storage,path),new TextEncoder().encode('%PDF-1.4'),{contentType:'application/pdf'}));
 await assertFails(uploadBytes(ref(storage,'documents/bob/bob__id/x.pdf'),new Uint8Array([1]),{contentType:'application/pdf'}));
 await assertFails(uploadBytes(ref(storage,'documents/alice/alice__id/x.html'),new Uint8Array([1]),{contentType:'text/html'}));
 await assertFails(uploadBytes(ref(storage,'documents/alice/alice__id/large.pdf'),new Uint8Array(5*1024*1024+1),{contentType:'application/pdf'}));
 await assertFails(getBytes(ref(env.authenticatedContext('bob').storage(),path)));
 await assertSucceeds(getBytes(ref(env.authenticatedContext('commission').storage(),path)));
});
