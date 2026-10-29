import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..auth import create_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import Notification, User
from ..schemas import LoginIn, PasswordIn, ProfileIn, RegisterIn, TokenOut
from ..seed import ensure_docs

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_out(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "iin": u.iin[:2] + "••••••••" + u.iin[-2:] if len(u.iin) == 12 else u.iin,
        "role": u.role,
    }


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not re.fullmatch(r"\d{12}", body.iin):
        raise HTTPException(400, "ЖСН 12 цифрдан тұруы керек")
    if not re.search(r"[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]", body.password) or not re.search(r"\d", body.password):
        raise HTTPException(400, "Құпиясөзде әріп және сан болуы керек")
    if len(body.name.strip().split()) < 2:
        raise HTTPException(400, "Аты мен тегін толық жазыңыз")
    email = body.email.lower()
    if db.query(User).filter((User.email == email) | (User.iin == body.iin)).first():
        raise HTTPException(400, "Бұл email немесе ЖСН тіркелген")
    user = User(
        name=body.name.strip(),
        iin=body.iin,
        phone=body.phone.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role="applicant",
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Бұл email немесе ЖСН тіркелген")
    ensure_docs(db, user)
    db.add(Notification(user_id=user.id, text="Кабинетке қош келдіңіз! Өтінішті толтырудан бастаңыз."))
    db.commit()
    db.refresh(user)
    return TokenOut(token=create_token(user), role=user.role, name=user.name)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    key = body.login.strip().lower()
    user = db.query(User).filter((User.email == key) | (User.iin == body.login.strip())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(400, "Логин немесе құпиясөз қате")
    return TokenOut(token=create_token(user), role=user.role, name=user.name)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.put("/profile")
def update_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.name:
        if len(body.name.strip().split()) < 2:
            raise HTTPException(400, "Аты мен тегін толық жазыңыз")
        user.name = body.name.strip()
    if body.phone:
        user.phone = body.phone.strip()
    db.commit()
    return user_out(user)


@router.post("/password")
def change_password(body: PasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(body.current, user.password_hash):
        raise HTTPException(400, "Қазіргі құпиясөз қате")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
