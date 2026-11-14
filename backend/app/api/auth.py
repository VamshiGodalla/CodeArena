from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas.user import Token, UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

DUPLICATE = "Username or email already registered"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    email = data.email.lower()

    # 1. Is the username or email already taken?
    existing = db.scalar(
        select(User).where(or_(User.username == data.username, User.email == email))
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE)

    # 2. Create the user with a SCRAMBLED password
    user = User(
        username=data.username,
        email=email,
        password_hash=hash_password(data.password),
    )

    # 3. Save to the database
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # rare case: two people signed up with the same name at the same moment
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE)
    db.refresh(user)  # reload so we get created_at, which the database filled in
    return user


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Find the user by username OR email
    user = db.scalar(
        select(User).where(
            or_(User.username == form.username, User.email == form.username.lower())
        )
    )

    # 2. Wrong user or wrong password → same error for both
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Correct! Give them a key card
    return Token(access_token=create_access_token(user.id))