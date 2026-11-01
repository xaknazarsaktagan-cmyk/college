// Run only on your trusted computer. Never copy service-account keys into frontend.
import {initializeApp, applicationDefault} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
async function secret() {
  if(!stdin.isTTY)throw new Error('Interactive terminal required; do not pass passwords as arguments.');
  stdout.write('Admin password (hidden, at least 16 characters): ');
  stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let value='';
    const done=()=>{stdin.off('data',receive);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};
    function receive(chunk){for(const c of chunk){
      if(c==='\u0003'){done();reject(new Error('Cancelled'));return;}
      if(c==='\r'||c==='\n'){done();resolve(value);return;}
      if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;
    }}
    stdin.on('data',receive);
  });
}
try {
  const rl=createInterface({input:stdin,output:stdout});
  const projectId=(await rl.question('Firebase project ID: ')).trim();
  const email=(await rl.question('Admin email [admin@gmail.com]: ')).trim()||'admin@gmail.com';
  rl.close();
  if(!projectId || !email.includes('@'))throw new Error('Project ID and valid email required.');
  const password=await secret();
  if(password.length<16)throw new Error('Password must have at least 16 characters.');
  initializeApp({credential:applicationDefault(),projectId});
  // Check Firestore access before creating an Auth account.
  const db=getFirestore();await db.collection('users').limit(1).get();
  const auth=getAuth();
  const user=await auth.createUser({email,password,displayName:'Қабылдау комиссиясы'});
  try {
    await db.collection('users').doc(user.uid).set({name:'Қабылдау комиссиясы',email,role:'admin',phone:'',iin:'',created_at:new Date().toISOString()});
  } catch(e){await auth.deleteUser(user.uid);throw e;}
  console.log('Admin created:',email,'UID:',user.uid); // Password is never logged.
} catch(e){console.error('Admin creation failed:',e.code||e.message);process.exitCode=1;}
