"""Private-storage browser integration using mock Firebase and an intercepted function.
Run frontend on port 8086. No real user files or cloud services are used.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from email import message_from_bytes
from email.policy import default
from urllib.parse import urlparse,parse_qs
import base64,json,uuid
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1280,'height':900})
 context.route('**/js/firebase-config.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.FIREBASE_CONFIG={apiKey:"demo",projectId:"demo",appId:"demo",storageBucket:"demo"};'))
 context.route('**/js/document-storage-config.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.DOCUMENT_STORAGE={provider:"supabase",endpoint:"https://test.supabase.co/functions/v1/document-files"};'))
 context.route('**/js/vendor/firebase.js*',lambda r:r.fulfill(content_type='text/javascript',body=(root/'tests/firebase-mock.js').read_text()))
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 files={};calls=[];fail_next=[True]
 def function(route):
  req=route.request
  cors={'Access-Control-Allow-Origin':'http://127.0.0.1:8086','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'}
  if req.method=='OPTIONS':route.fulfill(status=204,headers=cors);return
  calls.append(req.method)
  uid=req.headers.get('authorization','').removeprefix('Bearer mock-token-')
  state=page.evaluate("JSON.parse(localStorage.getItem('firebase-test-state'))")
  doc_id=parse_qs(urlparse(req.url).query)['documentId'][0]
  doc=state['docs']['documents/'+doc_id];role=state['docs']['users/'+uid]['role']
  if doc['user_id']!=uid and role!='admin':route.fulfill(status=403,json={'code':'ACCESS_DENIED'},headers=cors);return
  if req.method=='POST':
   assert role=='applicant'
   if fail_next[0]:fail_next[0]=False;route.fulfill(status=503,json={'code':'STORAGE_UNAVAILABLE'},headers=cors);return
   raw=b'Content-Type: '+req.headers['content-type'].encode()+b'\r\n\r\n'+req.post_data_buffer
   form=message_from_bytes(raw,policy=default)
   file=next(part for part in form.iter_parts() if part.get_param('name',header='content-disposition')=='file')
   ext={'image/png':'png','application/pdf':'pdf','image/jpeg':'jpg'}[file.get_content_type()]
   path=f'documents/{uid}/{doc_id}/{uuid.uuid4()}.{ext}';files[path]=(file.get_payload(decode=True),file.get_content_type())
   route.fulfill(json={'path':path},headers=cors)
  elif req.method=='DELETE':
   path=parse_qs(urlparse(req.url).query)['path'][0];assert path.startswith(f'documents/{uid}/{doc_id}/');files.pop(path,None);route.fulfill(json={'ok':True},headers=cors)
  else:
   data,mime=files[doc['stored_name']];route.fulfill(body=data,content_type=mime,headers=cors)
 context.route('https://test.supabase.co/functions/v1/document-files*',function)
 page.goto('http://127.0.0.1:8086/login.html#register')
 for name,value in {'r-name':'Test Student','r-iin':'050101123456','r-phone':'+77001234567','r-mail':'student@example.com','r-pass':'Testing1234'}.items():page.locator('#'+name).fill(value)
 page.locator('#r-agree').check();page.locator('#regForm button[type=submit]').click();page.wait_for_url('**/cabinet.html')
 page.locator('#who').filter(has_text='Test Student').wait_for()
 uid=page.evaluate("async()=> (await api.get('/api/auth/me')).id")
 page.locator('[data-nav=application]').first.click();page.locator('#a-prog').select_option(index=1);page.locator('#a-ent').fill('100');page.locator('#appForm button[type=submit]').click();page.wait_for_url('**/cabinet.html#docs')
 png=base64.b64decode(page.evaluate("()=>{const c=document.createElement('canvas');c.width=c.height=2;return c.toDataURL('image/png').split(',')[1];}"))
 image={'name':'photo.png','mimeType':'image/png','buffer':png}
 page.locator('#docList input[type=file]').first.set_input_files(image)
 page.locator('.upload-feedback.failed .upload-message').filter(has_text='STORAGE_UNAVAILABLE').wait_for()
 page.locator('#docList input[type=file]').first.set_input_files(image)
 page.locator('[data-openfile]').first.wait_for()
 record=page.evaluate("async()=> (await api.get('/api/cabinet')).documents.find(d=>d.file==='photo.png')")
 assert record['storage_provider']=='supabase'
 assert files[record['stored_name']][0]==png
 page.locator('[data-openfile]').first.click();page.locator('.document-viewer img').wait_for()
 page.locator('.document-viewer img').evaluate('img=>img.decode()')
 assert page.locator('.document-viewer img').evaluate('img=>img.naturalWidth')==2
 assert page.locator('.document-viewer a[download]').get_attribute('href').startswith('blob:')
 page.locator('.viewer-close').click()
 page.locator('[data-nav=profile]').first.click();page.locator('#logout').click();page.wait_for_url('**/login.html')
 page.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('firebase-test-state'));s.accounts.commission={email:'commission@example.com',password:'TestOnly1234'};s.docs['users/commission']={name:'Commission Admin',email:'commission@example.com',role:'admin',iin:'',phone:''};localStorage.setItem('firebase-test-state',JSON.stringify(s));}""")
 page.locator('#login').fill('commission@example.com');page.locator('#pass').fill('TestOnly1234');page.locator('#loginBtn').click();page.wait_for_url('**/admin.html')
 page.locator('[data-open]').first.click();page.locator('[data-file]').first.click()
 page.locator('.document-viewer img').wait_for();page.locator('.document-viewer img').evaluate('img=>img.decode()')
 assert page.locator('.document-viewer h2').inner_text()=='photo.png'
 page.locator('.viewer-close').click();page.locator('[data-ok]').first.click()
 page.wait_for_function("JSON.parse(localStorage.getItem('firebase-test-state')).docs["+json.dumps('documents/'+record['id'])+"].status==='ok'")
 assert not errors,errors
 assert 'GET' in calls and 'POST' in calls
 print('PASS: private Supabase adapter, upload error/retry, exact PNG bytes, owner preview, admin in-panel preview/download and document approval; mocked cloud services')
 browser.close()
