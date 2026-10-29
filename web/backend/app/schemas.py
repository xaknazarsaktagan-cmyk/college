from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    iin: str = Field(min_length=12, max_length=12)
    phone: str = Field(min_length=10, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    login: str
    password: str


class TokenOut(BaseModel):
    token: str
    role: str
    name: str


class ProfileIn(BaseModel):
    name: str | None = None
    phone: str | None = None


class PasswordIn(BaseModel):
    current: str
    new_password: str = Field(min_length=8, max_length=72)


class ApplicationIn(BaseModel):
    program_id: int | None = Field(default=None, gt=0)
    lang: Literal["kk", "ru", "en"] = "kk"
    ent_score: float | None = Field(default=None, ge=0, le=140, allow_inf_nan=False)
    dorm: bool = False


class TicketIn(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)


class ReviewIn(BaseModel):
    status: str
    reason: str | None = None


class NotifyIn(BaseModel):
    user_id: int
    text: str


class TicketReplyIn(BaseModel):
    reply: str
    status: str = "answered"
