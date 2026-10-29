# Абитуриент кабинеті

Толық жұмыс істейтін қабылдау жүйесі: абитуриент кабинеті, комиссия панелі, PostgreSQL және Docker.

## Іске қосу

```bash
docker compose up --build
```

Браузер: [http://localhost:8081](http://localhost:8081)

## Демо аккаунттар

| Рөл | Логин | Құпиясөз |
|---|---|---|
| Абитуриент | demo@abit.kz | Demo1234 |
| Комиссия | admin@abit.kz | Admin1234 |

## Не бар

- Тіркелу / кіру (JWT, құпиясөз bcrypt)
- Өтініш, ҰБТ балы, бағдарлама каталогы
- Құжат жүктеу (файл серверде сақталады)
- Хабарлар, FAQ, қолдау чаты
- Админ: құжатты қабылдау/қайтару, мәртебе, хабар
- Интерфейс: қазақша / орысша; оқу тілі: қазақша / орысша / ағылшынша
- PostgreSQL + Nginx + FastAPI

## Стек

`frontend` — HTML/CSS/JS · `backend` — FastAPI · `db` — PostgreSQL 16

## Docker-сыз жергілікті іске қосу

Python 3.12 қажет. Жоба түбірінен:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend
../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8081
```

Бұл режим SQLite қолданады, frontend пен API бір серверде ашылады.

## Тесттер

```bash
.venv/bin/pip install -r backend/requirements-dev.txt
cd backend
../.venv/bin/python -m pytest -q
```

Тесттер уақытша SQLite базасын қолданады; жұмыс базасын өзгертпейді.
