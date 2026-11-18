from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1)
 context.route('**/js/firebase-config.js*',lambda r:r.fulfill(content_type='text/javascript',body='window.FIREBASE_CONFIG={apiKey:"demo",projectId:"demo",appId:"demo",storageBucket:"demo"};'))
 context.route('**/js/vendor/firebase.js*',lambda r:r.fulfill(content_type='text/javascript',body=(root/'tests/firebase-mock.js').read_text()))
 state={'accounts':{'student':{'email':'student@example.com','password':'TestOnly1234'}},'docs':{'users/student':{'name':'Тест Студент','email':'student@example.com','phone':'+77001111111','iin':'050101123456','role':'applicant'}},'files':{},'uid':'student'}
 for t in ['id','cert','med','photo','ent','pay']:
  state['docs']['documents/student__'+t]={'user_id':'student','type':t,'name':t,'hint':'PDF','status':'empty','file':None,'stored_name':None,'reason':None}
 context.add_init_script('localStorage.setItem("firebase-test-state",'+json.dumps(json.dumps(state))+');localStorage.setItem("narxoz-firebase-session","active");')
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8086/cabinet.html');page.locator('#homeProgCards .specialty-card').first.wait_for();page.evaluate("setTheme('paper')")

 for image in page.locator('#homeProgCards img').all():
  image.scroll_into_view_if_needed()
  image.evaluate("image=>image.decode()")
  assert image.evaluate('image=>image.naturalWidth>0')
 card=page.locator('#homeProgCards .specialty-card').first
 card.scroll_into_view_if_needed();card.hover(position={'x':40,'y':40});page.wait_for_timeout(100)
 assert card.evaluate("el=>el.style.getPropertyValue('--tilt-x')")
 page.emulate_media(reduced_motion='reduce')
 assert card.evaluate("el=>el.style.getPropertyValue('--tilt-x')")==''
 page.evaluate("location.hash='home';scrollTo(0,0)");page.wait_for_timeout(100)
 before=page.locator('#scene').get_attribute('style');page.wait_for_timeout(300)
 assert before==page.locator('#scene').get_attribute('style')
 assert page.locator('.floating-label').first.evaluate("el=>getComputedStyle(el).animationName")=='none'
 page.locator('.cabinet-shortcuts a[href="#docs"]').click()
 page.wait_for_url('**/cabinet.html#docs')
 assert page.locator('#docList').is_visible()
 assert not errors,errors
 print('PASS: six local illustrations decode, pointer tilt, reduced-motion static scene and quick document shortcut')
 browser.close()
