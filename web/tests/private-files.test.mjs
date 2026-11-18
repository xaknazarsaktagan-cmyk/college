import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import {createHandler} from '../supabase/functions/document-files/handler.ts';
import {createFirebaseVerifier} from '../supabase/functions/document-files/firebase-jwt.ts';
const {privateKey,publicKey}=await jose.generateKeyPair('RS256');
const projectId='demo-narxoz',origin='http://localhost:8081';
const sign=(uid,project=projectId,expiry='1h')=>new jose.SignJWT({}).setProtectedHeader({alg:'RS256'}).setSubject(uid).setIssuer(`https://securetoken.google.com/${project}`).setAudience(project).setIssuedAt().setExpirationTime(expiry).sign(privateKey);
const tokens=Object.fromEntries(await Promise.all(['alice','bob','commission'].map(async uid=>[uid,await sign(uid)])));
const verifier=createFirebaseVerifier(jose,projectId,async()=>publicKey);
const fields=obj=>({fields:Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,{stringValue:v}]))});
const pdf=new TextEncoder().encode('%PDF-1.4\n%%EOF');
function fixture({storageStatus=200}={}){
 const path='documents/alice/alice__id/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf';
 const docs={alice__id:fields({user_id:'alice',stored_name:path,storage_provider:'supabase',file:'Жеке куәлік.pdf'})},calls=[];
 const handler=createHandler({projectId,supabaseUrl:'https://test.supabase.co',serviceKey:'SERVER_ONLY_TEST_KEY',verifyToken:verifier,allowedOrigins:[origin],fetcher:async(url,options={})=>{
  calls.push({url,options});
  if(url.startsWith('https://firestore.googleapis.com/')){
   assert.ok(Object.values(tokens).includes(options.headers.Authorization.slice(7)));
   const path=new URL(url).pathname.split('/documents/')[1];
   if(path.startsWith('users/'))return Response.json(fields({role:path.endsWith('/commission')?'admin':'applicant'}));
   return docs[path.split('/')[1]]?Response.json(docs[path.split('/')[1]]):new Response(null,{status:404});
  }
  assert.equal(options.headers.apikey,'SERVER_ONLY_TEST_KEY');assert.equal(options.headers.Authorization,'Bearer SERVER_ONLY_TEST_KEY');
  return options.method?Response.json({ok:true},{status:storageStatus}):new Response(pdf,{status:storageStatus});
 }});
 const request=(method,uid='alice',extra={})=>{
  const params=new URLSearchParams({documentId:extra.id||'alice__id'});if(extra.path)params.set('path',extra.path);
  const headers={Origin:extra.origin||origin};if(uid)headers.Authorization='Bearer '+(tokens[uid]||uid);
  let body;if(method==='POST'){body=new FormData();body.append('documentId',extra.id||'alice__id');body.append('file',new File([extra.bytes||pdf],'file.pdf',{type:extra.mime||'application/pdf'}));}
  return handler(new Request('https://test.supabase.co/functions/v1/document-files?'+params,{method,headers,body}));
 };
 return {handler,request,calls,docs,path};
}
test('Firebase JWT rejects tampering, wrong project and expired tokens',async()=>{
 assert.equal(await verifier(tokens.alice),'alice');
 for(const token of [await sign('alice','other-project'),await sign('alice',projectId,'-1h'),'forged-token'])await assert.rejects(verifier(token));
 const parts=tokens.alice.split('.');parts[1]=btoa(JSON.stringify({sub:'commission'}));await assert.rejects(verifier(parts.join('.')));
});
test('missing or forged authentication never reaches storage',async()=>{
 const {request,calls}=fixture();assert.equal((await request('GET',null)).status,401);assert.equal((await request('GET','forged')).status,401);assert.equal(calls.length,0);
});
test('owner uploads to their own immutable namespace',async()=>{
 const {request,calls}=fixture(),response=await request('POST');assert.equal(response.status,200);const result=await response.json();assert.match(result.path,/^documents\/alice\/alice__id\/[a-f0-9-]+\.pdf$/);assert.ok(!JSON.stringify(result).includes('SERVER_ONLY_TEST_KEY'));assert.deepEqual(calls.find(c=>c.options.method==='POST').options.body,pdf);
});
test('other applicant and admin cannot upload on behalf of owner',async()=>{
 for(const uid of ['bob','commission']){const {request,calls}=fixture();assert.equal((await request('POST',uid)).status,403);assert.equal(calls.filter(c=>c.url.includes('/storage/')).length,0);}
});
test('only owner and admin can read bytes, with private no-store headers',async()=>{
 for(const uid of ['alice','commission']){const {request}=fixture(),response=await request('GET',uid);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),pdf);}
 const {request,calls}=fixture();assert.equal((await request('GET','bob')).status,403);assert.equal(calls.filter(c=>c.url.includes('/storage/')).length,0);
});
test('MIME, signature, size, and path traversal are checked on server',async()=>{
 for(const extra of [{mime:'text/html'},{bytes:new TextEncoder().encode('<script>')},{bytes:new Uint8Array(5242881)},{id:'..'},{id:'alice__id/../bob'}]){const {request,calls}=fixture();assert.ok((await request('POST','alice',extra)).status>=400);assert.equal(calls.filter(c=>c.url.includes('/storage/')).length,0);}
});
test('cleanup cannot delete another user or document namespace',async()=>{
 const {request,path,calls}=fixture();assert.equal((await request('DELETE','alice',{path})).status,200);
 for(const uid of ['bob','commission'])assert.equal((await request('DELETE',uid,{path})).status,403);
 for(const path of ['documents/bob/alice__id/a.pdf','documents/alice/other/a.pdf','documents/alice/alice__id/../b.pdf'])assert.equal((await request('DELETE','alice',{path})).status,403);
 assert.equal(calls.filter(c=>c.options.method==='DELETE').length,1);
});
test('bad metadata paths are blocked; unavailable storage fails clearly',async()=>{
 const {request,docs}=fixture();docs.alice__id.fields.stored_name.stringValue='documents/bob/bob__id/a.pdf';assert.equal((await request('GET','commission')).status,404);
 const response=await fixture({storageStatus:503}).request('POST');assert.equal(response.status,503);assert.equal((await response.json()).code,'STORAGE_UNAVAILABLE');
});
test('CORS preflight permits configured sites only',async()=>{
 const {request,handler,calls}=fixture();assert.equal((await request('GET','alice',{origin:'https://other.example'})).status,403);assert.equal(calls.length,0);const response=await handler(new Request('https://test.supabase.co/functions/v1/document-files',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});
