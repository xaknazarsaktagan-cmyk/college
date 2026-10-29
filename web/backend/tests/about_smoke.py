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
  page.wait_for_timeout(6200)
  assert page.locator('.about-slide').nth(i).get_attribute('aria-hidden')=='false'
  assert abs(page.evaluate('scrollY')-y)<2
  assert abs(page.locator('#about').bounding_box()['height']-height)<2
 for width in (390,1440):
  page.set_viewport_size({'width':width,'height':950})
  for mode in ('paper','night'):
   page.evaluate('(m)=>setTheme(m)',mode)
   for i in range(3):
    page.locator(f'[data-slide="{i}"]').click();page.wait_for_timeout(600)
    assert page.locator('.about-slide').nth(i).get_attribute('aria-hidden')=='false'
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.evaluate("setLang('ru')")
 assert page.locator('#about-heading').inner_text()=='О колледже'
 page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(150)
 assert page.locator('.about-pause').inner_text()=='Продолжить'
 assert not errors,errors
 print('PASS: 6-second cycling, wraparound, stable page position/height, manual controls, light/dark, mobile, translation, reduced motion')
 b.close()
