from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """Data the user sends when registering."""
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    """Data the API sends back about a user. No password_hash here!"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    is_admin: bool
    created_at: datetime


class Token(BaseModel):
    """What the login endpoint returns."""
    access_token: str
    token_type: str = "bearer"