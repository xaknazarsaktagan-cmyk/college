from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Deadline, Faq, Program

router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/programs")
def programs(db: Session = Depends(get_db)):
    rows = db.query(Program).order_by(Program.code).all()
    return [
        {
            "id": p.id,
            "code": p.code,
            "name_kk": p.name_kk,
            "name_ru": p.name_ru,
            "name_en": p.name_en,
            "faculty": p.faculty,
            "description": p.description,
            "grants": p.grants,
            "paid": p.paid,
            "min_ent": p.min_ent,
        }
        for p in rows
    ]


@router.get("/deadlines")
def deadlines(db: Session = Depends(get_db)):
    rows = db.query(Deadline).order_by(Deadline.sort).all()
    return [{"id": d.id, "day": d.day, "title_kk": d.title_kk, "title_ru": d.title_ru, "title_en": d.title_en} for d in rows]


@router.get("/faq")
def faq(db: Session = Depends(get_db)):
    rows = db.query(Faq).order_by(Faq.sort).all()
    return [
        {"id": f.id, "q_kk" : f.q_kk, "a_kk": f.a_kk, "q_ru": f.q_ru, "a_ru": f.a_ru, "q_en": f.q_en, "a_en": f.a_en}
        for f in rows
    ]
