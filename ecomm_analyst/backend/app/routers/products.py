"""
Products CRUD router.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/", response_model=List[schemas.ProductOut])
def list_products(
    marketplace: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Product)
    if marketplace:
        q = q.filter(models.Product.marketplace == marketplace)
    if category:
        q = q.filter(models.Product.category == category)
    return q.offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.post("/", response_model=schemas.ProductOut, status_code=201)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    for k, v in payload.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    p = db.get(models.Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    db.delete(p)
    db.commit()
