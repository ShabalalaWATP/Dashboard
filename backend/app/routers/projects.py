from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import require_admin
from .. import models, schemas, crud

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    items = db.query(models.Project).order_by(models.Project.start_date.desc()).all()
    return [crud.project_to_dict(p) for p in items]


@router.get("/{pid}", response_model=schemas.ProjectOut)
def get_project(pid: int, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    return crud.project_to_dict(p)


@router.post("", response_model=schemas.ProjectOut)
def create_project(data: schemas.ProjectCreate,
                   db: Session = Depends(get_db),
                   _: models.User = Depends(require_admin)):
    if db.query(models.Project).filter(models.Project.name == data.name).first():
        raise HTTPException(400, "Name already in use")
    p = crud.create_project(db, data)
    return crud.project_to_dict(p)


@router.patch("/{pid}", response_model=schemas.ProjectOut)
def update_project(pid: int, data: schemas.ProjectUpdate,
                   db: Session = Depends(get_db),
                   _: models.User = Depends(require_admin)):
    p = db.query(models.Project).filter(models.Project.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    p = crud.update_project(db, p, data)
    return crud.project_to_dict(p)


@router.post("/{pid}/close", response_model=schemas.ProjectOut)
def close_project(pid: int, data: schemas.ProjectClose,
                  db: Session = Depends(get_db),
                  _: models.User = Depends(require_admin)):
    p = db.query(models.Project).filter(models.Project.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    p = crud.close_project(db, p, data)
    return crud.project_to_dict(p)


@router.delete("/{pid}")
def delete_project(pid: int,
                   db: Session = Depends(get_db),
                   _: models.User = Depends(require_admin)):
    p = db.query(models.Project).filter(models.Project.id == pid).first()
    if not p:
        raise HTTPException(404, "Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
