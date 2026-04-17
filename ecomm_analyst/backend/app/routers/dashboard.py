"""
Dashboard summary router – single call that returns all KPIs.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, Integer, cast
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _pct_change(current: float, previous: float) -> float | None:
    """Return percentage change rounded to 1 dp, or None if no prior data."""
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


@router.get("/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    from datetime import datetime, timedelta

    # Determine the latest sale date in the DB and build 30-day windows
    latest: datetime | None = db.query(func.max(models.SalesRecord.sale_date)).scalar()
    if latest is None:
        latest = datetime.utcnow()

    period_end = latest
    period_start = latest - timedelta(days=30)
    prev_start = period_start - timedelta(days=30)

    # ── All-time totals ────────────────────────────────────────────────────
    total_revenue = db.query(func.sum(models.SalesRecord.revenue)).scalar() or 0
    total_orders = db.query(models.SalesRecord).count()
    total_returns = (
        db.query(models.SalesRecord).filter(models.SalesRecord.returned == True).count()
    )
    avg_ctr = db.query(func.avg(models.EngagementMetric.click_through_rate)).scalar() or 0
    total_visits = db.query(func.sum(models.EngagementMetric.page_visits)).scalar() or 0
    total_cart = db.query(func.sum(models.EngagementMetric.cart_adds)).scalar() or 0
    pos = db.query(models.Comment).filter(models.Comment.sentiment == "positive").count()
    neg = db.query(models.Comment).filter(models.Comment.sentiment == "negative").count()
    neu = db.query(models.Comment).filter(models.Comment.sentiment == "neutral").count()

    # ── Current 30-day window ──────────────────────────────────────────────
    cur_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= period_start, models.SalesRecord.sale_date <= period_end)
        .scalar() or 0
    )
    cur_orders = (
        db.query(func.count(models.SalesRecord.id))
        .filter(models.SalesRecord.sale_date >= period_start, models.SalesRecord.sale_date <= period_end)
        .scalar() or 0
    )
    cur_ctr = (
        db.query(func.avg(models.EngagementMetric.click_through_rate))
        .filter(models.EngagementMetric.date >= period_start, models.EngagementMetric.date <= period_end)
        .scalar() or 0
    )

    # ── Previous 30-day window ─────────────────────────────────────────────
    prev_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= prev_start, models.SalesRecord.sale_date < period_start)
        .scalar() or 0
    )
    prev_orders = (
        db.query(func.count(models.SalesRecord.id))
        .filter(models.SalesRecord.sale_date >= prev_start, models.SalesRecord.sale_date < period_start)
        .scalar() or 0
    )
    prev_ctr = (
        db.query(func.avg(models.EngagementMetric.click_through_rate))
        .filter(models.EngagementMetric.date >= prev_start, models.EngagementMetric.date < period_start)
        .scalar() or 0
    )

    return schemas.DashboardSummary(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        total_returns=total_returns,
        avg_ctr=round(avg_ctr, 2),
        total_page_visits=total_visits or 0,
        total_cart_adds=total_cart or 0,
        positive_comments=pos,
        negative_comments=neg,
        neutral_comments=neu,
        revenue_trend=_pct_change(cur_rev, prev_rev),
        orders_trend=_pct_change(cur_orders, prev_orders),
        ctr_trend=_pct_change(cur_ctr, prev_ctr),
    )


@router.get("/kpi-detail/{kpi_type}")
def kpi_detail(
    kpi_type: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Returns drill-down data for each KPI card.
    kpi_type: revenue | orders | returns | ctr | visits | cart | positive | negative
    """
    if kpi_type == "revenue":
        # Revenue by marketplace
        rows = (
            db.query(
                models.SalesRecord.marketplace,
                func.sum(models.SalesRecord.revenue).label("revenue"),
                func.count(models.SalesRecord.id).label("orders"),
            )
            .group_by(models.SalesRecord.marketplace)
            .order_by(func.sum(models.SalesRecord.revenue).desc())
            .all()
        )
        # Top products by revenue
        top_products = (
            db.query(
                models.Product.name,
                func.sum(models.SalesRecord.revenue).label("revenue"),
            )
            .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.sum(models.SalesRecord.revenue).desc())
            .limit(5)
            .all()
        )
        return {
            "kpi": "revenue",
            "by_marketplace": [
                {"name": r.marketplace, "value": round(r.revenue, 2), "orders": r.orders}
                for r in rows
            ],
            "top_products": [
                {"name": p.name, "value": round(p.revenue, 2)} for p in top_products
            ],
        }

    elif kpi_type == "orders":
        # Orders by marketplace
        rows = (
            db.query(
                models.SalesRecord.marketplace,
                func.count(models.SalesRecord.id).label("orders"),
                func.sum(models.SalesRecord.quantity).label("units"),
            )
            .group_by(models.SalesRecord.marketplace)
            .order_by(func.count(models.SalesRecord.id).desc())
            .all()
        )
        # Orders by category
        by_category = (
            db.query(
                models.Product.category,
                func.count(models.SalesRecord.id).label("orders"),
            )
            .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
            .group_by(models.Product.category)
            .order_by(func.count(models.SalesRecord.id).desc())
            .all()
        )
        return {
            "kpi": "orders",
            "by_marketplace": [
                {"name": r.marketplace, "value": r.orders, "units": r.units}
                for r in rows
            ],
            "by_category": [
                {"name": c.category, "value": c.orders} for c in by_category
            ],
        }

    elif kpi_type == "returns":
        total = db.query(models.SalesRecord).count()
        returned = db.query(models.SalesRecord).filter(models.SalesRecord.returned == True).count()
        # Returns by marketplace
        rows = (
            db.query(
                models.SalesRecord.marketplace,
                func.count(models.SalesRecord.id).label("total"),
                func.sum(cast(models.SalesRecord.returned, Integer)).label("returned"),
            )
            .group_by(models.SalesRecord.marketplace)
            .all()
        )
        # Most returned products
        top_returned = (
            db.query(
                models.Product.name,
                func.count(models.SalesRecord.id).label("returns"),
            )
            .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
            .filter(models.SalesRecord.returned == True)
            .group_by(models.Product.id)
            .order_by(func.count(models.SalesRecord.id).desc())
            .limit(5)
            .all()
        )
        return {
            "kpi": "returns",
            "return_rate": round(returned / total * 100, 1) if total else 0,
            "total_orders": total,
            "total_returns": returned,
            "by_marketplace": [
                {
                    "name": r.marketplace,
                    "returns": int(r.returned or 0),
                    "total": r.total,
                    "rate": round(int(r.returned or 0) / r.total * 100, 1) if r.total else 0,
                }
                for r in rows
            ],
            "top_returned_products": [
                {"name": p.name, "value": p.returns} for p in top_returned
            ],
        }

    elif kpi_type == "ctr":
        # CTR by marketplace
        rows = (
            db.query(
                models.EngagementMetric.marketplace,
                func.avg(models.EngagementMetric.click_through_rate).label("avg_ctr"),
                func.sum(models.EngagementMetric.page_visits).label("visits"),
            )
            .group_by(models.EngagementMetric.marketplace)
            .order_by(func.avg(models.EngagementMetric.click_through_rate).desc())
            .all()
        )
        # Top products by CTR
        top_ctr = (
            db.query(
                models.Product.name,
                func.avg(models.EngagementMetric.click_through_rate).label("avg_ctr"),
            )
            .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.avg(models.EngagementMetric.click_through_rate).desc())
            .limit(5)
            .all()
        )
        return {
            "kpi": "ctr",
            "by_marketplace": [
                {"name": r.marketplace, "value": round(r.avg_ctr, 2), "visits": r.visits}
                for r in rows
            ],
            "top_products": [
                {"name": p.name, "value": round(p.avg_ctr, 2)} for p in top_ctr
            ],
        }

    elif kpi_type == "visits":
        # Page visits by marketplace
        rows = (
            db.query(
                models.EngagementMetric.marketplace,
                func.sum(models.EngagementMetric.page_visits).label("visits"),
            )
            .group_by(models.EngagementMetric.marketplace)
            .order_by(func.sum(models.EngagementMetric.page_visits).desc())
            .all()
        )
        # Top visited products
        top_visited = (
            db.query(
                models.Product.name,
                func.sum(models.EngagementMetric.page_visits).label("visits"),
            )
            .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.sum(models.EngagementMetric.page_visits).desc())
            .limit(5)
            .all()
        )
        return {
            "kpi": "visits",
            "by_marketplace": [
                {"name": r.marketplace, "value": r.visits} for r in rows
            ],
            "top_products": [
                {"name": p.name, "value": p.visits} for p in top_visited
            ],
        }

    elif kpi_type == "cart":
        # Cart adds by marketplace
        rows = (
            db.query(
                models.EngagementMetric.marketplace,
                func.sum(models.EngagementMetric.cart_adds).label("cart_adds"),
            )
            .group_by(models.EngagementMetric.marketplace)
            .order_by(func.sum(models.EngagementMetric.cart_adds).desc())
            .all()
        )
        # Top products by cart adds
        top_cart = (
            db.query(
                models.Product.name,
                func.sum(models.EngagementMetric.cart_adds).label("cart_adds"),
            )
            .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.sum(models.EngagementMetric.cart_adds).desc())
            .limit(5)
            .all()
        )
        return {
            "kpi": "cart",
            "by_marketplace": [
                {"name": r.marketplace, "value": r.cart_adds} for r in rows
            ],
            "top_products": [
                {"name": p.name, "value": p.cart_adds} for p in top_cart
            ],
        }

    elif kpi_type in ("positive", "negative", "neutral"):
        sentiment_label = kpi_type
        # Reviews by marketplace
        rows = (
            db.query(
                models.Comment.marketplace,
                func.count(models.Comment.id).label("count"),
            )
            .filter(models.Comment.sentiment == sentiment_label)
            .group_by(models.Comment.marketplace)
            .order_by(func.count(models.Comment.id).desc())
            .all()
        )
        # Top products for this sentiment
        top_products = (
            db.query(
                models.Product.name,
                func.count(models.Comment.id).label("count"),
            )
            .join(models.Comment, models.Comment.product_id == models.Product.id)
            .filter(models.Comment.sentiment == sentiment_label)
            .group_by(models.Product.id)
            .order_by(func.count(models.Comment.id).desc())
            .limit(5)
            .all()
        )
        # Sample comments
        samples = (
            db.query(models.Comment.text, models.Comment.rating, models.Product.name)
            .join(models.Product, models.Comment.product_id == models.Product.id)
            .filter(models.Comment.sentiment == sentiment_label)
            .order_by(models.Comment.rating.desc() if sentiment_label == "positive" else models.Comment.rating.asc())
            .limit(5)
            .all()
        )
        return {
            "kpi": sentiment_label,
            "by_marketplace": [
                {"name": r.marketplace, "value": r.count} for r in rows
            ],
            "top_products": [
                {"name": p.name, "value": p.count} for p in top_products
            ],
            "sample_comments": [
                {"text": s.text, "rating": s.rating, "product": s.name} for s in samples
            ],
        }

    raise HTTPException(status_code=404, detail=f"Unknown KPI type: {kpi_type}")


@router.get("/sales-by-country")
def sales_by_country(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Returns sales aggregated by country.
    Since the dataset uses marketplaces (not countries), we map each marketplace
    to its primary country and aggregate orders + revenue.
    """
    # Marketplace → ISO country code + display name
    MP_COUNTRY = {
        "Taobao": ("CHN", "China"),
        "JD": ("CHN", "China"),
        "Shopee": ("SGP", "Singapore"),
        "Temu": ("USA", "United States"),
        "Facebook Marketplace": ("USA", "United States"),
        "eBay": ("USA", "United States"),
        "Amazon": ("USA", "United States"),
        "Pinduoduo": ("CHN", "China"),
    }

    rows = (
        db.query(
            models.SalesRecord.marketplace,
            func.count(models.SalesRecord.id).label("orders"),
            func.sum(models.SalesRecord.revenue).label("revenue"),
        )
        .group_by(models.SalesRecord.marketplace)
        .all()
    )

    # Aggregate by country
    country_map: dict = {}
    for r in rows:
        iso, name = MP_COUNTRY.get(r.marketplace, ("OTH", r.marketplace))
        if iso not in country_map:
            country_map[iso] = {"iso": iso, "name": name, "orders": 0, "revenue": 0.0}
        country_map[iso]["orders"] += r.orders
        country_map[iso]["revenue"] += r.revenue or 0

    result = sorted(country_map.values(), key=lambda x: x["revenue"], reverse=True)
    for c in result:
        c["revenue"] = round(c["revenue"], 2)
    return result


@router.get("/charts/overview")
def charts_overview(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Returns data for all new dashboard chart sections:
    - total_revenue_trend: daily revenue (last 60 days) for line chart
    - revenue_growth: WoW and MoM comparison
    - aov_trend: daily average order value
    - revenue_by_marketplace: per-marketplace revenue for doughnut/bar
    - top_products: top 6 products by revenue for horizontal bar
    """
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    since_60 = now - timedelta(days=60)
    since_30 = now - timedelta(days=30)
    since_7 = now - timedelta(days=7)
    prev_week_start = since_7 - timedelta(days=7)
    prev_month_start = since_30 - timedelta(days=30)

    # ── Revenue + AOV trend (last 60 days) ────────────────────────────────
    trend_rows = (
        db.query(
            func.date(models.SalesRecord.sale_date).label("day"),
            func.sum(models.SalesRecord.revenue).label("revenue"),
            func.count(models.SalesRecord.id).label("orders"),
        )
        .filter(models.SalesRecord.sale_date >= since_60)
        .group_by(func.date(models.SalesRecord.sale_date))
        .order_by(func.date(models.SalesRecord.sale_date))
        .all()
    )
    revenue_trend = [
        {
            "day": str(r.day),
            "revenue": round(r.revenue, 2),
            "aov": round(r.revenue / r.orders, 2) if r.orders else 0,
        }
        for r in trend_rows
    ]

    # ── Revenue Growth WoW ─────────────────────────────────────────────────
    cur_week_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= since_7)
        .scalar() or 0
    )
    prev_week_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= prev_week_start, models.SalesRecord.sale_date < since_7)
        .scalar() or 0
    )
    cur_month_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= since_30)
        .scalar() or 0
    )
    prev_month_rev = (
        db.query(func.sum(models.SalesRecord.revenue))
        .filter(models.SalesRecord.sale_date >= prev_month_start, models.SalesRecord.sale_date < since_30)
        .scalar() or 0
    )

    # ── Revenue by Marketplace ─────────────────────────────────────────────
    mp_rows = (
        db.query(
            models.SalesRecord.marketplace,
            func.sum(models.SalesRecord.revenue).label("revenue"),
            func.count(models.SalesRecord.id).label("orders"),
        )
        .group_by(models.SalesRecord.marketplace)
        .order_by(func.sum(models.SalesRecord.revenue).desc())
        .all()
    )

    # ── Top Products ───────────────────────────────────────────────────────
    top_products = (
        db.query(
            models.Product.name,
            func.sum(models.SalesRecord.revenue).label("revenue"),
        )
        .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
        .group_by(models.Product.id)
        .order_by(func.sum(models.SalesRecord.revenue).desc())
        .limit(6)
        .all()
    )

    return {
        "revenue_trend": revenue_trend,
        "revenue_growth": {
            "wow_current": round(cur_week_rev, 2),
            "wow_previous": round(prev_week_rev, 2),
            "wow_pct": _pct_change(cur_week_rev, prev_week_rev),
            "mom_current": round(cur_month_rev, 2),
            "mom_previous": round(prev_month_rev, 2),
            "mom_pct": _pct_change(cur_month_rev, prev_month_rev),
        },
        "revenue_by_marketplace": [
            {"name": r.marketplace, "revenue": round(r.revenue, 2), "orders": r.orders}
            for r in mp_rows
        ],
        "top_products": [
            {"name": p.name, "revenue": round(p.revenue, 2)}
            for p in top_products
        ],
    }
