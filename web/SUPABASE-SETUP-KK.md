# Тегін лимиті бар жеке құжат қоймасы

Жаңа файлдар Supabase-та сақталады. Firebase Authentication, өтініштер, чат және админ рөлі бұрынғы Firebase жобасында қалады. Абитуриенттерге жаңа аккаунт қажет емес. Supabase Free жоспарының сақтау/трафик/функция лимиттері бар; бұл шексіз сақтау емес. Лимит бітсе, тарифті автоматты ауыстырмаймыз.

## 1. Тегін жоба ашу

1. https://supabase.com → Start your project → GitHub арқылы кіру.
2. Қажет болса, Free ұйымын ашыңыз, содан соң New project.
3. Атауы: college. Database password үшін өзіңізге бөлек құпиясөз қойыңыз. Оны кодқа, GitHub-қа немесе чатқа жазбаңыз.
4. Create new project басып, жоба дайын болғанын күтіңіз.

## 2. Жеке bucket құру

Supabase жобасында SQL Editor → New query ашыңыз. Осы репозиторийдегі `supabase/setup.sql` файлының толық мазмұнын қойып, Run басыңыз.

Storage бөлімінде `college-documents` пайда болады. Оның Public күйі **өшік** болуы керек. Құжаттарды Public қылмаңыз. Клиентке тікелей рұқсат беретін Storage policies қажет емес: қолжетімділікті серверлік функция тексереді.

## 3. Функцияны браузерден жариялау (терминалсыз)

1. Supabase → Edge Functions → Deploy a new function → Via Editor ашыңыз.
2. Функция атауы: **document-files**.
3. Редактордағы бастапқы кодты толық өшіріңіз.
4. Осы репозиторийдегі **supabase/document-files-dashboard.ts** файлының толық мазмұнын көшіріп қойыңыз. Ол — бір файлға біріктірілген дайын код; басқа файлдарды қосу қажет емес.
5. Deploy басыңыз.
6. Функцияның Details/Settings бөлімінде **Verify JWT / Enforce JWT verification** параметрін **өшіріңіз**, өзгерісті сақтаңыз. Бұл Supabase Auth токенін тексеруді ғана өшіреді. Функция Firebase JWT-інің қолтаңбасын, жобасын және мерзімін өзі тексереді; токенсіз құжаттарға рұқсат берілмейді.

Осы жоба үшін Firebase Project ID әдепкіде **xako-cours**. Басқа Firebase жоба қолданылса, Edge Function Secrets ішінде **FIREBASE_PROJECT_ID** мәнін нақты ID-ға өзгертіңіз.

Supabase функцияға **SUPABASE_URL** және **SUPABASE_SERVICE_ROLE_KEY** серверлік параметрлерін өзі береді. Бұларды сайт кодына көшірмеңіз және чатқа жібермеңіз. Firebase custom claims немесе Supabase Third-party Auth integration қажет емес.

### Балама: терминалдан жариялау

Жобаның **web** қалтасында, Node.js 20+ орнатылған компьютерде:

```powershell
npx supabase@2 login
npx supabase@2 secrets set FIREBASE_PROJECT_ID=xako-cours --project-ref iicuckvxjdaivnfmhzje
npx supabase@2 functions deploy document-files --project-ref iicuckvxjdaivnfmhzje --no-verify-jwt --use-api
```

`--use-api` Docker-сыз жариялайды. Login өз Supabase аккаунтыңызға кіруді сұрайды. Құпия токенді кодқа сақтамаңыз.

## 4. Сайтқа тек ашық функция адресін қою

`frontend/js/document-storage-config.js` файлы:

```js
window.DOCUMENT_STORAGE = {
  provider: 'supabase',
  endpoint: 'https://iicuckvxjdaivnfmhzje.supabase.co/functions/v1/document-files'
};
```

Бұл — құпия кілт емес, функция адресі. Осы репозиторийде жоба адресі енгізілген. Vercel жаңартуды жариялаған соң Ctrl+Shift+R басыңыз. Басқа жоба қолдансаңыз, оның Project Ref мәнін қойып, GitHub-қа сақтаңыз. Локал Docker қолдансаңыз, `docker compose up -d --force-recreate web` орындаңыз.

Функция әдепкіде мына сайттардан сұрау қабылдайды:

- https://college-frontend-kohl.vercel.app
- http://localhost:8081
- http://127.0.0.1:8081

Өзге домен болса, барлық қажетті origin-дерді үтірмен тізіп орнатыңыз:

```powershell
npx supabase@2 secrets set "ALLOWED_ORIGINS=https://your-site.example,http://localhost:8081" --project-ref YOUR_PROJECT_REF
```

Жоба preview-адрестерін автоматты рұқсат етпейміз.

## 5. Firebase ережесін жаңарту

Firebase Console → Firestore Database → Rules ішіне **жаңартылған** `firebase/firestore.rules` мазмұнын қойып, Publish басыңыз. `storage_provider` өрісін сақтау үшін бұл өзгеріс қажет. Firebase Storage/Blaze қосу жаңа жүктеулер үшін қажет емес.

## 6. Тексеру

1. Абитуриент болып кіріңіз. Өтініш беріп, Құжаттар бөлімінде PDF/JPG/PNG таңдаңыз (5 МБ дейін).
2. Пайыз көрсетіліп, файл күйі «Тексерілуде» болуы керек.
3. Админ болып кіріңіз: Өтініштер → Ашу → файл атауы.
4. Фото немесе PDF админ панелінің үстіндегі терезеде ашылады; жүктеп алу батырмасы да бар. Құжатты қабылдауға немесе қайтаруға болады.
5. Өзге абитуриенттің аккаунты бұл файлды аша алмауы керек.

Файлдар анонимді URL-мен ашылмайды; әр сұрау Firebase сессиясымен тексеріледі. Браузердегі алдын ала қарауға уақытша blob URL қолданылады, терезе жабылғанда ол жойылады.

Бұрын Firebase Storage-қа сақталған файлдар автоматты көшірілмейді; олар үшін бұрынғы оқу жолы сақталған. Жаңа жүктеулер Supabase-қа түседі.

## Ортада тексерілгені

- `npm run test:files`: 9 тест, JWT қолтаңбасы/мерзімі/жобасы, иесі/админ/бөтен аккаунт, MIME/сигнатура/көлем, жолды алмастыру, жеке жауаптар және CORS.
- `tests/supabase_browser.py`: жүктеу қатесі/қайталау, PNG байттарының сақталуы, иесі мен админнің терезеде қарауы және құжатты қабылдау; бұлт қызметтері тестте алмастырылған.
- Deno арқылы Edge Function типтері тексерілді.
- Нақты Supabase-қа жариялау мен нақты файл жүктеу үшін жоғарыдағы баптаулар аяқталуы қажет; олар осы кодты GitHub-қа салумен автоматты орындалмайды.
