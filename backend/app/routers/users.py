from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import require_admin, hash_password
from .. import models, schemas

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("", response_model=schemas.UserOut)
def create_user(data: schemas.UserCreate,
                db: Session = Depends(get_db),
                _: models.User = Depends(require_admin)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(400, "Username already exists")
    u = models.User(
        username=data.username,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.post("/{uid}/password")
def change_password(uid: int, data: schemas.PasswordChange,
                    db: Session = Depends(get_db),
                    _: models.User = Depends(require_admin)):
    u = db.query(models.User).filter(models.User.id == uid).first()
    if not u:
        raise HTTPException(404, "Not found")
    u.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/{uid}")
def delete_user(uid: int,
                db: Session = Depends(get_db),
                current: models.User = Depends(require_admin)):
    u = db.query(models.User).filter(models.User.id == uid).first()
    if not u:
        raise HTTPException(404, "Not found")
    if u.id == current.id:
        raise HTTPException(400, "Cannot delete self")
    if db.query(models.User).count() == 1:
        raise HTTPException(400, "At least one user required")
    db.delete(u)
    db.commit()
    return {"ok": True}
