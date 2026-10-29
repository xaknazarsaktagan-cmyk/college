from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class InputModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value, info):
        if isinstance(value, str) and info.field_name not in {"password", "current", "new_password"}:
            return value.strip()
        return value


class RegisterIn(InputModel):
    name: str = Field(min_length=3, max_length=160)
    iin: str = Field(min_length=12, max_length=12)
    phone: str = Field(min_length=10, max_length=32, pattern=r"^\+?\d[\d ()-]{9,31}$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(InputModel):
    login: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=72)


class TokenOut(InputModel):
    token: str
    role: str
    name: str


class ProfileIn(InputModel):
    name: str | None = Field(default=None, min_length=3, max_length=160)
    phone: str | None = Field(default=None, min_length=10, max_length=32, pattern=r"^\+?\d[\d ()-]{9,31}$")


class PasswordIn(InputModel):
    current: str
    new_password: str = Field(min_length=8, max_length=72)


class ApplicationIn(InputModel):
    program_id: int | None = Field(default=None, gt=0)
    lang: Literal["kk", "ru", "en"] = "kk"
    ent_score: float | None = Field(default=None, ge=0, le=140, allow_inf_nan=False)
    dorm: bool = False


class TicketIn(InputModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=5, max_length=4000)


class ReviewIn(InputModel):
    status: str
    reason: str | None = None


class NotifyIn(InputModel):
    user_id: int
    text: str = Field(min_length=1, max_length=4000)


class TicketReplyIn(InputModel):
    reply: str = Field(min_length=1, max_length=4000)
    status: Literal["answered", "closed"] = "answered"
