from playwright.sync_api import sync_playwright
import time
import os
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 base_url = os.environ.get('BASE_URL', 'http://127.0.0.1:8081')
 page.goto(base_url)
 page.locator('#progList article').first.wait_for()
 assert page.locator('#progList article').count()==6
 page.locator('[data-i18n="register"]').click()
 page.locator('#r-name').fill('Тест Пайдаланушы')
 page.locator('#r-iin').fill(str(int(time.time()*1000))[-12:])
 page.locator('#r-phone').fill('+77001234567')
 page.locator('#r-mail').fill(f'test{int(time.time())}@example.com')
 page.locator('#r-pass').fill('Testing1234')
 page.locator('#r-agree').check()
 page.locator('#regForm button[type=submit]').click()
 page.wait_for_url('**/cabinet.html')
 page.locator('#who').wait_for()
 page.locator('[data-nav=application]').first.click()
 page.locator('#a-prog').select_option(index=1)
 page.locator('#a-ent').fill('100')
 page.locator('#appForm button[type=submit]').click()
 page.wait_for_url('**/cabinet.html#docs')
 page.locator('#docList input[type=file]').first.set_input_files({'name':'test.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n%%EOF'})
 page.locator('[data-openfile]').first.wait_for()
 page.locator('[data-nav=profile]').first.click()
 page.locator('#logout').click()
 page.wait_for_url('**/login.html')
 page.locator('#login').fill('admin@abit.kz')
 page.locator('#pass').fill('Admin1234')
 page.locator('#loginBtn').click()
 page.wait_for_url('**/admin.html')
 page.locator('[data-open]').first.wait_for()
 for width in (390,1280):
  page.set_viewport_size({'width':width,'height':850})
  print('admin width',width,'overflow',page.evaluate('document.documentElement.scrollWidth > innerWidth'))
 assert not errors,errors
 print('PASS: landing, registration, application, upload, logout, admin; no JS errors')
 browser.close()
