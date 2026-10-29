from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':950})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8081/')
 page.add_style_tag(content='html{scroll-behavior:auto!important}')
 assert page.locator('#faq,#dates,#dateList,#faqBox').count()==0
 page.locator('#about').scroll_into_view_if_needed();page.wait_for_timeout(250)
 y=page.evaluate('scrollY');height=page.locator('#about').bounding_box()['height']
 for i in (1,2,0):
  page.wait_for_timeout(4700)
  assert page.locator('.about-slide').nth(i).get_attribute('aria-hidden')=='false'
  assert abs(page.evaluate('scrollY')-y)<2
  gap = page.locator('.about-slide.is-active').bounding_box()['y'] - page.locator('.about-heading').bounding_box()['y'] - page.locator('.about-heading').bounding_box()['height']
  assert 0 <= gap <= 20, gap
  assert abs(page.locator('#about').bounding_box()['height']-height)<2
 assert page.locator('.about-controls, .about-tabs, .about-pause').count()==0
 page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(150)
 page.locator('#about').scroll_into_view_if_needed();page.wait_for_timeout(200)
 before = page.locator('.about-slide').evaluate_all("ss=>ss.findIndex(s=>s.classList.contains('is-active'))")
 page.wait_for_timeout(4700)
 assert page.locator('.about-slide').nth((before+1)%3).get_attribute('aria-hidden')=='false'
 for width in (390,1440):
  page.set_viewport_size({'width':width,'height':950})
  for mode in ('paper','night'):
   page.evaluate('(m)=>setTheme(m)',mode)
   assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.evaluate("setLang('ru')")
 assert page.locator('#about-heading').inner_text()=='О колледже'
 assert not errors,errors
 print('PASS: automatic 4.5-second cycling without controls, wraparound, stable page, reduced motion, mobile and themes')
 b.close()
