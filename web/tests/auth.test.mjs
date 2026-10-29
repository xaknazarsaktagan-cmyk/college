import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,EmailAuthProvider,reauthenticateWithCredential,updatePassword} from 'firebase/auth';
test('real Firebase Auth emulator: register, logout, login, reauthenticate, change password',async()=>{
 const app=initializeApp({apiKey:'demo-key',projectId:'demo-narxoz'});
 try {
  const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  const email=`auth-${Date.now()}@example.com`;
  const created=await createUserWithEmailAndPassword(auth,email,'Testing1234');
  assert.ok(created.user.uid);await signOut(auth);assert.equal(auth.currentUser,null);
  await assert.rejects(signInWithEmailAndPassword(auth,email,'Wrong1234'));
  await signInWithEmailAndPassword(auth,email,'Testing1234');
  await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(email,'Testing1234'));
  await updatePassword(auth.currentUser,'Changed1234');await signOut(auth);
  await signInWithEmailAndPassword(auth,email,'Changed1234');assert.equal(auth.currentUser.email,email);
 }finally {await deleteApp(app);}
});
