"""UI integration with an in-memory Firebase SDK double, not a live Firebase test.
Run a static HTTP server in frontend on port 8086, then run with Python Playwright.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page()
    page.goto('http://127.0.0.1:8086/login.html')
    page.locator('#login').fill('missing@example.com');page.locator('#pass').fill('Testing1234');page.locator('#loginBtn').click()
    page.wait_for_function("document.querySelector('#e-form').textContent.includes('firebase-config.js')")
    context=browser.new_context()
    context.route('**/js/firebase-config.js*',lambda route:route.fulfill(content_type='text/javascript',body='window.FIREBASE_CONFIG={apiKey:"demo",projectId:"demo",appId:"demo",storageBucket:"demo"};'))
    context.route('**/js/vendor/firebase.js*',lambda route:route.fulfill(content_type='text/javascript',body=(root/'tests/firebase-mock.js').read_text()))
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.goto('http://127.0.0.1:8086/login.html#register')
    for name,value in {'r-name':'Тест Студент','r-iin':'050101123456','r-phone':'+77001234567','r-mail':'student@example.com','r-pass':'Testing1234'}.items():page.locator('#'+name).fill(value)
    page.locator('#r-agree').check();page.locator('#regForm button[type=submit]').click();page.wait_for_url('**/cabinet.html')
    page.wait_for_function("document.querySelector('#who').textContent.length>0")
    uid=page.evaluate("async()=> (await api.get('/api/auth/me')).id")
    page.locator('[data-nav=application]').first.click();page.locator('#a-prog').select_option(index=1);page.locator('#a-ent').fill('100');page.locator('#appForm button[type=submit]').click();page.wait_for_url('**/cabinet.html#docs')
    page.locator('#docList input[type=file]').first.set_input_files({'name':'test.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n%%EOF'})
    page.locator('[data-openfile]').first.wait_for()
    page.evaluate("api.post('/api/tickets',{subject:'Сұрақ',message:'Өтініш туралы сұрақ'})")
    page.locator('.chat-launch').click()
    page.locator('#chat-text').fill('Менің құжаттарымды тексеріңіз <script>alert(1)</script>')
    page.locator('#chat-send').click()
    page.locator('#chat-log').get_by_text('Менің құжаттарымды тексеріңіз <script>alert(1)</script>',exact=True).wait_for()
    page.locator('#chat-close').click()

    page.locator('[data-nav=profile]').first.click();page.locator('#logout').click();page.wait_for_url('**/login.html')
    page.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('firebase-test-state'));s.accounts.commission={email:'commission@example.com',password:'TestOnly1234'};s.docs['users/commission']={name:'Commission Admin',email:'commission@example.com',role:'admin',iin:'',phone:''};localStorage.setItem('firebase-test-state',JSON.stringify(s));}""")
    page.locator('#login').fill('commission@example.com');page.locator('#pass').fill('TestOnly1234');page.locator('#remember').check();page.locator('#loginBtn').click();page.wait_for_url('**/admin.html')
    page.locator('[data-open]').first.wait_for()
    page.evaluate("async()=>{const a=(await api.get('/api/admin/applications'))[0];await api.post('/api/admin/applications/'+a.id+'/status',{status:'accepted'});const t=(await api.get('/api/admin/tickets'))[0];await api.post('/api/admin/tickets/'+t.id+'/reply',{reply:'Жауап',status:'answered'});await api.post('/api/admin/notify',{user_id:a.user.id,text:'Хабар'});}")
    page.locator('[data-open]').first.click()
    page.locator('[data-chat]').first.click()
    page.locator('#chat-log').get_by_text('Менің құжаттарымды тексеріңіз <script>alert(1)</script>',exact=True).wait_for()
    page.locator('#chat-text').fill('Құжаттар қабылданды')
    page.locator('#chat-send').click()
    page.locator('#chat-log').get_by_text('Құжаттар қабылданды',exact=True).wait_for()
    page.locator('#chat-close').click()
    page.locator('#logout').click();page.wait_for_url('**/login.html')
    page.locator('#login').fill('student@example.com');page.locator('#pass').fill('Testing1234');page.locator('#loginBtn').click();page.wait_for_url('**/cabinet.html')
    page.locator('.chat-launch').click()
    page.locator('#chat-log').get_by_text('Құжаттар қабылданды',exact=True).wait_for()
    page.set_viewport_size({'width':390,'height':844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not errors,errors
    assert not any('/api/' in r for r in requests),requests
    assert uid.isalnum()
    print('PASS: missing config guidance; registration/login/logout, string UID, cabinet, application, PDF upload, tickets, admin decisions/replies/notifications, private two-way chat history, HTML escaping, mobile layout; no HTTP API calls. Firebase SDK double only.')
    browser.close()
