"""
Customer Engagement router – CRUD + aggregated analytics.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/engagement", tags=["engagement"])


@router.get("/", response_model=List[schemas.EngagementMetricOut])
def list_metrics(
    marketplace: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.EngagementMetric)
    if marketplace:
        q = q.filter(models.EngagementMetric.marketplace == marketplace)
    return q.offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.EngagementMetricOut, status_code=201)
def create_metric(
    payload: schemas.EngagementMetricCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    metric = models.EngagementMetric(**payload.model_dump())
    if metric.date is None:
        metric.date = datetime.utcnow()
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


# ── Analytics ─────────────────────────────────
@router.get("/analytics/top-viewed")
def top_viewed(
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Products ranked by total page visits."""
    rows = (
        db.query(
            models.Product.id,
            models.Product.name,
            func.sum(models.EngagementMetric.page_visits).label("visits"),
            func.sum(models.EngagementMetric.cart_adds).label("cart_adds"),
            func.avg(models.EngagementMetric.click_through_rate).label("avg_ctr"),
        )
        .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
        .group_by(models.Product.id)
        .order_by(func.sum(models.EngagementMetric.page_visits).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "visits": r.visits,
            "cart_adds": r.cart_adds,
            "avg_ctr": round(r.avg_ctr or 0, 2),
        }
        for r in rows
    ]


@router.get("/analytics/trends")
def engagement_trends(
    days: int = 30,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Daily engagement totals for the last N days."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            func.date(models.EngagementMetric.date).label("day"),
            func.sum(models.EngagementMetric.page_visits).label("visits"),
            func.sum(models.EngagementMetric.cart_adds).label("cart_adds"),
            func.avg(models.EngagementMetric.click_through_rate).label("avg_ctr"),
        )
        .filter(models.EngagementMetric.date >= since)
        .group_by(func.date(models.EngagementMetric.date))
        .order_by(func.date(models.EngagementMetric.date))
        .all()
    )
    return [
        {
            "day": str(r.day),
            "visits": r.visits,
            "cart_adds": r.cart_adds,
            "avg_ctr": round(r.avg_ctr or 0, 2),
        }
        for r in rows
    ]


@router.get("/analytics/image-views")
def image_views(
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Most-viewed product images."""
    rows = (
        db.query(
            models.Product.id,
            models.Product.name,
            models.Product.image_url,
            func.sum(models.EngagementMetric.image_views).label("total_image_views"),
        )
        .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
        .group_by(models.Product.id)
        .order_by(func.sum(models.EngagementMetric.image_views).desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "name": r.name, "image_url": r.image_url, "total_image_views": r.total_image_views}
        for r in rows
    ]
