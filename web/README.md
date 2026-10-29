# Narxoz College — Firebase edition

Бэкенд и база: **Firebase Authentication + Cloud Firestore + Cloud Storage**.
Python API, SQL и локальная база в этой версии не используются. Docker остаётся:
Nginx обслуживает сайт на `http://localhost:8081`, браузер подключается к Firebase.

## 1. Подключение своего Firebase

1. Создайте проект в Firebase Console и добавьте Web app.
2. В **Authentication → Sign-in method** включите **Email/Password**.
3. В Authentication → Settings → Authorized domains добавьте `localhost` и домен будущего сайта.
4. Создайте **Cloud Firestore** (база `(default)`) и **Storage bucket**.
   Cloud Storage может требовать подключённый billing/Blaze; актуальные условия
   проверьте в своей консоли. Одного API key для работы всего проекта недостаточно.
5. Скопируйте весь объект `firebaseConfig` в `frontend/js/firebase-config.js`:
   `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   Это публичная конфигурация Web app. Приватные ключи service account сюда не вставляются.
6. Опубликуйте содержимое `firebase/firestore.rules` в Firestore → Rules,
   а `firebase/storage.rules` — в Storage → Rules.
   При запросе Firebase Console разрешите Storage rules обращаться к Firestore
   (это нужно для проверки роли комиссии). Не включайте открытый test mode.
7. Для просмотра загруженных файлов из браузера настройте CORS bucket:

   ```bash
   gcloud storage buckets update gs://YOUR_STORAGE_BUCKET --cors-file=firebase/storage.cors.json
   ```

   При публикации сайта добавьте его HTTPS origin в `storage.cors.json` и примените файл снова.
   Значение `YOUR_STORAGE_BUCKET` берётся из `firebaseConfig.storageBucket`.

Правила также можно опубликовать через Firebase CLI:

```bash
npm ci
npx firebase login
npx firebase deploy --only firestore:rules,storage --project YOUR_PROJECT_ID
```

## 2. Запуск через Docker

В папке `web`, где лежит `docker-compose.yml`:

```bash
docker compose up -d
```

Откройте **http://localhost:8081**. Не открывайте `index.html` через `file://`:
ES-модули, Firebase Auth и Storage требуют HTTP/HTTPS.
Проверка контейнера: `http://localhost:8081/healthz` (проверяет Nginx, а не связь с Firebase).

Если ранее запускалась версия проекта с отдельными контейнерами API/БД:
`docker compose up -d --remove-orphans`. Это остановит старые контейнеры этого
Compose-проекта, но не удалит тома. **Не используйте `down -v`**, если нужны старые данные.
Данные старой базы не переносятся в Firebase автоматически.

## 3. Аккаунт комиссии

1. Зарегистрируйтесь на сайте как обычный пользователь.
2. В Firebase Console → Firestore → `users` найдите документ с UID этого пользователя.
3. Измените поле `role` с `applicant` на `admin` **в консоли**.
4. Выйдите и снова войдите на сайте: откроется панель комиссии.

Пользователь не может повысить себе роль через сайт или прямой Firestore запрос:
это запрещено правилами. Готовых демо-аккаунтов и общих паролей нет.

Вход выполняется по email. ЖСН хранится в профиле и показывается владельцу
в маскированном виде. Уникальность аккаунтов обеспечивает Firebase по email;
отдельного поиска/уникального индекса аккаунтов по ЖСН в этой версии нет.

## 4. Что работает после подключения

- Регистрация, вход, сохранение сессии, выход, смена пароля — Firebase Auth.
- Профиль, черновик/отправка заявления, статусы — Firestore.
- Загрузка PDF/JPG/PNG до 5 МБ — Storage; описание и статус файла — Firestore.
- Комиссия: список заявлений, документы, принятие/возврат, решения, сообщения.
- Поддержка: обращение студента, ответ комиссии, уведомления и отметка прочтения.
- Публичный каталог программ/FAQ/дат включён в `frontend/js/catalog.js`:
  это статические справочные данные, не отдельная база; их можно редактировать без ключа.

Security Rules защищают владельцев документов, роли и окончательные решения.
Storage rules проверяют размер и MIME; проверка сигнатуры содержимого выполняется
клиентом. Для серверного антивируса/модерации потребуется отдельная Firebase Function.
Админская статистика читает коллекции; для большого числа студентов нужны пагинация
и агрегаты. Не храните реальные персональные данные до настройки своих правил и проекта.

## 5. SDK, обновление и проверки

Официальный Firebase SDK уже собран в `frontend/js/vendor/firebase.js`.
Node.js не нужен для обычного Docker-запуска. Для пересборки:

```bash
npm ci
npm run build:sdk
```

`firebase/sdk.js` — исходная точка сборки, версии и lockfile сохранены.
Для локальных проверок без реальных ключей доступны Firebase Emulators (Java 21+, Node 20+):

```bash
npm ci
npm run test:rules
```

`FIREBASE_EMULATORS` должен оставаться `false` для настоящего проекта.
Пустая конфигурация разрешает просматривать публичную страницу, но не авторизацию:
при попытке входа сайт явно показывает, что Firebase ещё не настроен.

## Результаты проверки этой сборки

- Docker Compose: единственный Nginx-контейнер запущен; `/healthz`, HTML и JS доступны.
- Firebase Auth Emulator: регистрация, выход, вход и смена пароля прошли.
- `tests/browser_smoke.py`: браузерные сценарии с тестовым SDK прошли, включая
  регистрацию, заявление, PDF, обращения и действия комиссии. Для этого теста
  нужен Python Playwright, Chromium `/usr/bin/chromium` и статический сервер
  `python3 -m http.server 8086 --directory frontend` из `web`. SDK-double используется
  только в тесте; рабочий сайт использует официальный Firebase SDK.
- Правила Firestore/Storage: тесты подготовлены, но не выполнены в текущей среде:
  скачивание официального Java-эмулятора заблокировано сетевой политикой (403).
  После доступа к загрузке запустите `npm run test:rules`.
- Реальное облако Firebase: не проверено, конфигурация пользователя ещё не предоставлена.

Отдельный проверенный тест Auth: `npm run test:auth`.

## Если регистрация показывает HTML «404 Nginx»

Это ответ старого HTTP API, которого в Firebase-версии больше нет. Сохраните
свой `frontend/js/firebase-config.js`, обновите файлы проекта и восстановите
конфигурацию. В папке `web` выполните `docker compose up -d --force-recreate`,
затем откройте `http://localhost:8081/login.html` в режиме инкогнито.
Проверьте `http://localhost:8081/js/api.js`: первая строка должна содержать
`narxoz-firebase-session`. Если там `abit-token`, сервер обслуживает старую папку.
В этой сборке скрипты имеют версии в URL, а Nginx запрещает их кеширование.
