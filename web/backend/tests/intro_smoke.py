from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (390,1440):
  page=b.new_page(viewport={'width':width,'height':950})
  errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  page.goto('http://127.0.0.1:8081/');page.add_style_tag(content='html{scroll-behavior:auto!important}')
  for i,progress in enumerate((0,.5,.95)):
   page.evaluate('''p => {const s=document.querySelector('.intro-story'),st=s.querySelector('.intro-stage');scrollTo(0,s.offsetTop-parseFloat(getComputedStyle(st).top)+(s.offsetHeight-st.offsetHeight)*p)}''',progress)
   page.wait_for_timeout(150)
   assert page.locator('.intro-scene').nth(i).get_attribute('aria-hidden')=='false'
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')

  page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100)
  assert page.locator('.story-ready').count()==0
  for scene in page.locator('.intro-scene').all():assert scene.get_attribute('aria-hidden') is None
  assert not errors,errors
  page.close()
 print('PASS: 3 story phases at 390/1440px, reduced motion, no overflow or JS errors')
 b.close()
