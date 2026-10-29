import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user as authenticated_user
from ..config import settings
from ..database import get_db
from ..models import Application, Document, Notification, Program, Ticket, User
from ..schemas import ApplicationIn, TicketIn
from ..seed import ensure_docs

router = APIRouter(prefix="/api", tags=["cabinet"])
def get_current_user(user: User = Depends(authenticated_user)) -> User:
    if user.role != "applicant":
        raise HTTPException(403, "Тек абитуриентке рұқсат")
    return user


OK_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def app_out(app: Application | None) -> dict:
    if not app:
        return {"submitted": False, "status": "draft", "draft": {}, "number": None}
    prog = app.program
    return {
        "submitted": app.submitted,
        "status": app.status,
        "number": app.number,
        "draft": {
            "program_id": app.program_id,
            "program": prog.name_kk if prog else None,
            "lang": app.lang,
            "ent": app.ent_score,
            "dorm": app.dorm,
        },
    }


def docs_out(docs: list[Document]) -> list[dict]:
    return [
        {
            "id": d.id,
            "type": d.doc_type,
            "name": d.name,
            "hint": d.hint,
            "status": d.status,
            "file": d.original_name,
            "reason": d.reason,
        }
        for d in docs
    ]


@router.get("/cabinet")
def cabinet(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "admin":
        raise HTTPException(403, "Әкімші кабинеті басқа бетте")
    ensure_docs(db, user)
    db.commit()
    app = db.query(Application).options(joinedload(Application.program)).filter_by(user_id=user.id).first()
    docs = db.query(Document).filter_by(user_id=user.id).all()
    notes = db.query(Notification).filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
    tickets = db.query(Ticket).filter_by(user_id=user.id).order_by(Ticket.created_at.desc()).all()
    return {
        "user": {"id": user.id, "name": user.name, "email": user.email, "phone": user.phone,
                 "iin": user.iin[:2] + "••••••••" + user.iin[-2:], "role": user.role},
        "application": app_out(app),
        "documents": docs_out(docs),
        "notes": [{"id": n.id, "t": n.text, "d": n.created_at.isoformat(), "r": n.read} for n in notes],
        "tickets": [
            {"id": t.id, "subject": t.subject, "message": t.message, "reply": t.reply,
             "status": t.status, "created_at": t.created_at.isoformat()}
            for t in tickets
        ],
    }


@router.put("/application")
def save_application(body: ApplicationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.program_id is not None and db.get(Program, body.program_id) is None:
        raise HTTPException(400, "Бағдарлама табылмады")
    app = db.query(Application).filter_by(user_id=user.id).first()
    if not app:
        app = Application(user_id=user.id)
        db.add(app)
    if app.status in ("accepted", "rejected"):
        raise HTTPException(400, "Шешім шыққан өтінішті өзгертуге болмайды")
    app.program_id = body.program_id
    app.lang = body.lang
    app.ent_score = body.ent_score
    app.dorm = body.dorm
    app.updated_at = datetime.utcnow()
    if app.submitted:
        app.status = "review"
    db.commit()
    db.refresh(app)
    return app_out(app)


@router.post("/application/submit")
def submit_application(body: ApplicationIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not body.program_id:
        raise HTTPException(400, "Бағдарлама таңдаңыз")
    if body.ent_score is None or body.ent_score < 0 or body.ent_score > 140:
        raise HTTPException(400, "ҰБТ балы 0–140 аралығында болуы керек")
    if body.program_id is not None and db.get(Program, body.program_id) is None:
        raise HTTPException(400, "Бағдарлама табылмады")
    app = db.query(Application).filter_by(user_id=user.id).first()
    if not app:
        app = Application(user_id=user.id)
        db.add(app)
    if app.status in ("accepted", "rejected"):
        raise HTTPException(400, "Шешім шыққан өтінішті өзгертуге болмайды")
    app.program_id = body.program_id
    app.lang = body.lang
    app.ent_score = body.ent_score
    app.dorm = body.dorm
    app.submitted = True
    app.status = "review"
    if not app.number:
        app.number = f"{datetime.utcnow().year}-{user.id:06d}"
    db.add(Notification(user_id=user.id, text=f"Өтініш № {app.number} жіберілді. Енді құжаттарды жүктеңіз."))
    db.commit()
    db.refresh(app)
    return app_out(app)


@router.post("/application/reopen")
def reopen(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    app = db.query(Application).filter_by(user_id=user.id).first()
    if not app or not app.submitted:
        raise HTTPException(400, "Өтініш жоқ")
    if app.status in ("accepted", "rejected"):
        raise HTTPException(400, "Шешім шыққан соң өзгертуге болмайды")
    app.submitted = False
    app.status = "draft"
    db.commit()
    return app_out(app)


@router.post("/documents/{doc_id}/upload")
async def upload(doc_id: int, file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.user_id != user.id:
        raise HTTPException(404, "Құжат табылмады")
    if file.content_type not in OK_TYPES:
        raise HTTPException(400, "Формат қолдау таппайды. PDF, JPG немесе PNG таңдаңыз.")
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(400, f"Файл {settings.max_upload_mb} МБ-тан аспауы керек")
    if not data:
        raise HTTPException(400, "Файл бос болмауы керек")
    signatures = {
        "application/pdf": data.startswith(b"%PDF-"),
        "image/jpeg": data.startswith(b"\xff\xd8\xff"),
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if not signatures[file.content_type]:
        raise HTTPException(400, "Файл мазмұны таңдалған форматқа сәйкес емес")
    os.makedirs(settings.upload_dir, exist_ok=True)
    ext = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}[file.content_type]
    stored = f"{user.id}_{doc.doc_type}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.upload_dir, stored)
    with open(path, "wb") as f:
        f.write(data)
    if doc.stored_name:
        old = os.path.join(settings.upload_dir, doc.stored_name)
        if os.path.isfile(old):
            os.remove(old)
    doc.stored_name = stored
    doc.original_name = file.filename
    doc.status = "review"
    doc.reason = None
    db.add(Notification(user_id=user.id, text=f"«{doc.name}» жүктелді. Тексеру 1–2 жұмыс күні."))
    db.commit()
    return {"ok": True, "status": doc.status, "file": doc.original_name}


@router.get("/documents/{doc_id}/file")
def get_file(doc_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or not doc.stored_name:
        raise HTTPException(404, "Файл жоқ")
    if user.role != "admin" and doc.user_id != user.id:
        raise HTTPException(403, "Рұқсат жоқ")
    path = os.path.join(settings.upload_dir, doc.stored_name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Файл жоқ")
    return FileResponse(path, filename=doc.original_name or doc.stored_name)


@router.post("/notes/{note_id}/read")
def read_note(note_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, note_id)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Хабар табылмады")
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/notes/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter_by(user_id=user.id, read=False).update({"read": True})
    db.commit()
    return {"ok": True}


@router.post("/tickets")
def create_ticket(body: TicketIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    t = Ticket(user_id=user.id, subject=body.subject.strip(), message=body.message.strip())
    db.add(t)
    db.add(Notification(user_id=user.id, text="Қолдау өтініші жіберілді. Орта есеппен 15 минутта жауап береміз."))
    db.commit()
    db.refresh(t)
    return {"id": t.id, "status": t.status}
