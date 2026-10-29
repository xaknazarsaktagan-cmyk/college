from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import require_admin
from ..database import get_db
from ..models import Application, Document, Notification, Ticket, User
from ..schemas import NotifyIn, ReviewIn, TicketReplyIn

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def stats(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    applicants = db.query(User).filter_by(role="applicant").count()
    submitted = db.query(Application).filter_by(submitted=True).count()
    pending_docs = db.query(Document).filter_by(status="review").count()
    open_tickets = db.query(Ticket).filter(Ticket.status != "closed").count()
    return {
        "applicants": applicants,
        "submitted": submitted,
        "pending_docs": pending_docs,
        "open_tickets": open_tickets,
    }


@router.get("/applications")
def applications(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(Application)
        .options(joinedload(Application.user), joinedload(Application.program))
        .order_by(Application.updated_at.desc())
        .all()
    )
    out = []
    for a in rows:
        docs = db.query(Document).filter_by(user_id=a.user_id).all()
        ok = sum(1 for d in docs if d.status == "ok")
        out.append({
            "id": a.id,
            "number": a.number,
            "status": a.status,
            "submitted": a.submitted,
            "ent": a.ent_score,
            "lang": a.lang,
            "dorm": a.dorm,
            "program": a.program.name_kk if a.program else None,
            "user": {"id" : a.user.id, "name": a.user.name, "email": a.user.email, "phone": a.user.phone, "iin": a.user.iin},
            "docs_ok": ok,
            "docs_total": len(docs),
            "docs": [
                {"id": d.id, "name": d.name, "status": d.status, "file": d.original_name, "reason": d.reason}
                for d in docs
            ],
        })
    return out


@router.post("/applications/{app_id}/status")
def set_status(app_id: int, body: ReviewIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if body.status not in ("review", "accepted", "rejected", "exam"):
        raise HTTPException(400, "Мәртебе қате")
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Өтініш жоқ")
    if not app.submitted:
        raise HTTPException(400, "Өтініш әлі жіберілмеген")
    app.status = body.status
    labels = {"review": "тексерілуде", "accepted": "қабылданды", "rejected": "қабылданбады", "exam": "емтиханға шақырылды"}
    db.add(Notification(user_id=app.user_id, text=f"Өтініш № {app.number}: {labels[body.status]}." + (f" {body.reason}" if body.reason else "")))
    db.commit()
    return {"ok": True}


@router.post("/documents/{doc_id}/review")
def review_doc(doc_id: int, body: ReviewIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if body.status not in ("ok", "bad"):
        raise HTTPException(400, "Мәртебе ok немесе bad болуы керек")
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Құжат жоқ")
    if not doc.stored_name:
        raise HTTPException(400, "Файл жүктелмеген")
    doc.status = body.status
    doc.reason = body.reason if body.status == "bad" else None
    text = f"«{doc.name}» қабылданды." if body.status == "ok" else f"«{doc.name}» қайта жүктеу керек. {body.reason or ''}"
    db.add(Notification(user_id=doc.user_id, text=text.strip()))
    db.commit()
    return {"ok": True}


@router.post("/notify")
def notify(body: NotifyIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, body.user_id)
    if not user:
        raise HTTPException(404, "Пайдаланушы жоқ")
    db.add(Notification(user_id=user.id, text=body.text.strip()))
    db.commit()
    return {"ok": True}


@router.get("/tickets")
def tickets(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(Ticket).options(joinedload(Ticket.user)).order_by(Ticket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "subject": t.subject,
            "message": t.message,
            "reply": t.reply,
            "status": t.status,
            "created_at": t.created_at.isoformat(),
            "user": {"id": t.user.id, "name": t.user.name, "email": t.user.email},
        }
        for t in rows
    ]


@router.post("/tickets/{ticket_id}/reply")
def reply_ticket(ticket_id: int, body: TicketReplyIn, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(404, "Өтініш жоқ")
    t.reply = body.reply
    t.status = body.status
    db.add(Notification(user_id=t.user_id, text=f"Қолдау жауабы: {body.reply[:180]}"))
    db.commit()
    return {"ok": True}


@router.get("/by-program")
def by_program(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    from ..models import Program
    rows = (
        db.query(Program.name_kk, func.count(Application.id))
        .outerjoin(Application, Application.program_id == Program.id)
        .group_by(Program.id)
        .all()
    )
    return [{"program": r[0], "count": r[1]} for r in rows]
