from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Deadline, Document, Faq, Notification, Program, User

DOC_TYPES = [
    ("id", "Жеке куәлік", "Екі беті, PDF немесе JPG"),
    ("cert", "Аттестат / диплом", "Қосымшасымен бірге"),
    ("med", "Медициналық анықтама 086-У", "Мөрі мен қолы көрінуі керек"),
    ("photo", "Фото 3×4", "Ашық фонда, JPG/PNG"),
    ("ent", "ҰБТ сертификаты", "Сертификат нөмірі көрінуі керек"),
    ("pay", "Төлем түбіртегі", "Тіркеу жарнасы"),
]

PROGRAMS = [
    ("B057", "Ақпараттық жүйелер", "Информационные системы", "Information Systems", "IT факультеті",
     "Ақпараттық жүйелерді жобалау, дерекқор және корпоративтік қосымшалар.", 25, 40, 70),
    ("B058", "Информатика", "Информатика", "Computer Science", "IT факультеті",
     "Алгоритмдер, бағдарламалау және жасанды интеллект негіздері.", 20, 35, 75),
    ("B059", "Есептеу техникасы", "Вычислительная техника", "Computer Engineering", "IT факультеті",
     "Компьютерлік желілер, аппараттық құралдар және ендірілген жүйелер.", 15, 30, 65),
    ("B044", "Экономика", "Экономика", "Economics", "Экономика факультеті",
     "Микро/макроэкономика, қаржы және аналитика.", 18, 50, 50),
    ("B049", "Құқықтану", "Юриспруденция", "Law", "Заң факультеті",
     "ҚР құқығы, азаматтық және қылмыстық іс жүргізу.", 12, 28, 75),
    ("B084", "Медицина", "Медицина", "Medicine", "Медицина факультеті",
     "Жалпы медицина. Клиникалық практика 3-курстан басталады.", 10, 15, 85),
]

DEADLINES = [
    ("15 қаз", "15 окт", "15 Oct", "Құжат қабылдаудың соңғы күні", "Последний день приёма документов", "Document deadline", 1),
    ("20 қаз", "20 окт", "20 Oct", "Емтихан", "Экзамен", "Exam", 2),
    ("01 жел", "01 дек", "01 Dec", "Нәтиже жариялау", "Публикация результатов", "Results published", 3),
]

FAQS = [
    ("Құжаттар қандай форматта жүктеледі?", "PDF, JPG немесе PNG. Бір файл 5 МБ-тан аспауы керек.",
     "Какой формат документов?", "PDF, JPG или PNG. Не более 5 МБ.",
     "What file formats are accepted?", "PDF, JPG or PNG. Max 5 MB."),
    ("Өтінішті қалай өзгертемін?", "Комиссия тексергенге дейін кабинетте «Өтінішті өзгерту» түймесі бар.",
     "Как изменить заявление?", "До проверки комиссии можно изменить заявление в кабинете.",
     "How do I edit my application?", "You can edit it in the cabinet until the commission reviews it."),
    ("Жатақхана қалай беріледі?", "Өтініште белгі қойыңыз. Орындар конкурс негізінде бөлінеді.",
     "Как получить общежитие?", "Отметьте в заявлении. Места распределяются по конкурсу.",
     "How is dorm assigned?", "Tick the box in the application. Places are competitive."),
    ("Комиссия қанша күн қарайды?", "Әдетте 3–5 жұмыс күні. Хабар кабинетке келеді.",
     "Сколько дней рассматривает комиссия?", "Обычно 3–5 рабочих дней.",
     "How long does review take?", "Usually 3–5 business days."),
]


def ensure_docs(db: Session, user: User):
    existing = {d.doc_type for d in user.documents}
    for dtype, name, hint in DOC_TYPES:
        if dtype not in existing:
            db.add(Document(user_id=user.id, doc_type=dtype, name=name, hint=hint, status="empty"))


def seed(db: Session):
    if db.query(Program).count() == 0:
        for row in PROGRAMS:
            db.add(Program(
                code=row[0], name_kk=row[1], name_ru=row[2], name_en=row[3],
                faculty=row[4], description=row[5], grants=row[6], paid=row[7], min_ent=row[8],
            ))
    if db.query(Deadline).count() == 0:
        for i, row in enumerate(DEADLINES):
            db.add(Deadline(day=row[0], title_kk=row[3], title_ru=row[4], title_en=row[5], sort=row[6]))
    if db.query(Faq).count() == 0:
        for i, row in enumerate(FAQS):
            db.add(Faq(q_kk=row[0], a_kk=row[1], q_ru=row[2], a_ru=row[3], q_en=row[4], a_en=row[5], sort=i))

    demo = db.query(User).filter_by(email="demo@abit.kz").first()
    if not demo:
        demo = User(
            name="Айдос Сейітов", iin="040101500123", phone="+77001234567",
            email="demo@abit.kz", password_hash=hash_password("Demo1234"), role="applicant",
        )
        db.add(demo)
        db.flush()
        db.add(Notification(user_id=demo.id, text="Кабинетке қош келдіңіз! Өтінішті толтырудан бастаңыз."))
        ensure_docs(db, demo)

    admin = db.query(User).filter_by(email="admin@abit.kz").first()
    if not admin:
        db.add(User(
            name="Қабылдау комиссиясы", iin="000000000000", phone="+77000000000",
            email="admin@abit.kz", password_hash=hash_password("Admin1234"), role="admin",
        ))
    db.commit()
