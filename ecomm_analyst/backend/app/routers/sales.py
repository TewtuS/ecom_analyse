"""
Sales analytics router – CRUD + aggregated analytics endpoints.
"""
from collections import Counter
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/sales", tags=["sales"])


# ── CRUD ──────────────────────────────────────
@router.get("/", response_model=List[schemas.SalesRecordOut])
def list_sales(
    marketplace: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.SalesRecord)
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    return q.order_by(models.SalesRecord.sale_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.SalesRecordOut, status_code=201)
def create_sale(
    payload: schemas.SalesRecordCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    record = models.SalesRecord(**payload.model_dump())
    if record.sale_date is None:
        record.sale_date = datetime.utcnow()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ── Analytics ─────────────────────────────────
@router.get("/analytics/top-products")
def top_products(
    marketplace: Optional[str] = Query(None),
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Products ranked by total revenue."""
    q = (
        db.query(
            models.Product.id,
            models.Product.name,
            func.sum(models.SalesRecord.revenue).label("total_revenue"),
            func.sum(models.SalesRecord.quantity).label("total_units"),
        )
        .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
    )
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    rows = (
        q.group_by(models.Product.id)
        .order_by(func.sum(models.SalesRecord.revenue).desc())
        .limit(limit)
        .all()
    )
    return [
        {"id": r.id, "name": r.name, "total_revenue": round(r.total_revenue, 2), "total_units": r.total_units}
        for r in rows
    ]


@router.get("/analytics/most-returned")
def most_returned(
    marketplace: Optional[str] = Query(None),
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Products with most returns."""
    q = (
        db.query(
            models.Product.id,
            models.Product.name,
            func.count(models.SalesRecord.id).label("return_count"),
        )
        .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
        .filter(models.SalesRecord.returned == True)
    )
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    rows = (
        q.group_by(models.Product.id)
        .order_by(func.count(models.SalesRecord.id).desc())
        .limit(limit)
        .all()
    )
    return [{"id": r.id, "name": r.name, "return_count": r.return_count} for r in rows]


@router.get("/analytics/trends")
def sales_trends(
    marketplace: Optional[str] = Query(None),
    days: int = 30,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Daily revenue for last N days."""
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        db.query(
            func.date(models.SalesRecord.sale_date).label("day"),
            func.sum(models.SalesRecord.revenue).label("revenue"),
            func.count(models.SalesRecord.id).label("orders"),
        )
        .filter(models.SalesRecord.sale_date >= since)
    )
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    rows = (
        q.group_by(func.date(models.SalesRecord.sale_date))
        .order_by(func.date(models.SalesRecord.sale_date))
        .all()
    )
    return [{"day": str(r.day), "revenue": round(r.revenue, 2), "orders": r.orders} for r in rows]


@router.get("/analytics/bundled-items")
def bundled_items(
    marketplace: Optional[str] = Query(None),
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Most frequently bundled product pairs."""
    q = db.query(models.SalesRecord).filter(models.SalesRecord.bundled_with != "")
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    records = q.all()
    pair_counter: Counter = Counter()
    for r in records:
        for bid in r.bundled_with.split(","):
            bid = bid.strip()
            if bid:
                pair = tuple(sorted([str(r.product_id), bid]))
                pair_counter[pair] += 1

    # Resolve product names
    result = []
    for (a, b), count in pair_counter.most_common(limit):
        pa = db.get(models.Product, int(a))
        pb = db.get(models.Product, int(b))
        result.append({
            "product_a": pa.name if pa else a,
            "product_b": pb.name if pb else b,
            "count": count,
        })
    return result


@router.get("/analytics/bundle-analytics")
def bundle_analytics(
    marketplace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Full bundle analytics:
    - summary KPIs
    - all bundle pairs with count + combined revenue
    - top pairs for chart
    """
    from collections import defaultdict

    q = db.query(models.SalesRecord).filter(models.SalesRecord.bundled_with != "")
    if marketplace and marketplace != "all":
        q = q.filter(models.SalesRecord.marketplace == marketplace)
    records = q.all()

    # Pair → {count, revenue, qty}
    pair_data: dict = defaultdict(lambda: {"count": 0, "revenue": 0.0, "qty": 0})

    for r in records:
        for bid in r.bundled_with.split(","):
            bid = bid.strip()
            if not bid:
                continue
            pair = tuple(sorted([str(r.product_id), bid]))
            pair_data[pair]["count"] += 1
            pair_data[pair]["revenue"] += r.revenue
            pair_data[pair]["qty"] += r.quantity

    # Resolve names
    pairs = []
    for (a, b), d in pair_data.items():
        pa = db.get(models.Product, int(a))
        pb = db.get(models.Product, int(b))
        pairs.append({
            "product_a": pa.name if pa else a,
            "product_b": pb.name if pb else b,
            "product_a_id": int(a),
            "product_b_id": int(b),
            "count": d["count"],
            "revenue": round(d["revenue"], 2),
            "avg_order_qty": round(d["qty"] / d["count"], 1) if d["count"] else 0,
        })

    pairs.sort(key=lambda x: x["count"], reverse=True)

    total_bundles = sum(p["count"] for p in pairs)
    total_bundle_revenue = round(sum(p["revenue"] for p in pairs), 2)
    most_common = pairs[0] if pairs else None
    avg_bundle_size = round(
        sum(p["avg_order_qty"] for p in pairs) / len(pairs), 1
    ) if pairs else 0

    return {
        "summary": {
            "total_bundle_sales": total_bundles,
            "total_bundle_revenue": total_bundle_revenue,
            "unique_pairs": len(pairs),
            "avg_bundle_qty": avg_bundle_size,
            "most_common_pair": (
                f"{most_common['product_a']} + {most_common['product_b']}" if most_common else "—"
            ),
            "most_common_count": most_common["count"] if most_common else 0,
        },
        "pairs": pairs,
        "chart_data": [
            {
                "name": f"{p['product_a'][:18]}… + {p['product_b'][:18]}…"
                        if len(p["product_a"]) + len(p["product_b"]) > 36
                        else f"{p['product_a']} + {p['product_b']}",
                "count": p["count"],
                "revenue": p["revenue"],
            }
            for p in pairs[:10]
        ],
    }


@router.get("/analytics/competitor-pricing")
def competitor_pricing(
    marketplace: Optional[str] = Query(None),
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Competitor prices vs our price per product."""
    q = db.query(models.CompetitorPrice).join(models.Product)
    if marketplace and marketplace != "all":
        q = q.filter(models.CompetitorPrice.marketplace == marketplace)
    if product_id:
        q = q.filter(models.CompetitorPrice.product_id == product_id)
    rows = q.all()
    result = []
    for r in rows:
        result.append({
            "product_id": r.product_id,
            "product_name": r.product.name,
            "our_price": r.product.price,
            "competitor": r.competitor_name,
            "competitor_price": r.price,
            "diff": round(r.product.price - r.price, 2),
            "marketplace": r.marketplace,
        })
    return result


@router.get("/analytics/price-trends")
def price_trends(
    marketplace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Daily average: our price vs average competitor price.
    Groups CompetitorPrice rows by recorded_at date.
    """
    q = db.query(models.CompetitorPrice).join(models.Product)
    if marketplace and marketplace != "all":
        q = q.filter(models.CompetitorPrice.marketplace == marketplace)
    rows = q.order_by(models.CompetitorPrice.recorded_at).all()

    # Bucket by date string
    from collections import defaultdict
    by_date: dict = defaultdict(lambda: {"our_prices": [], "comp_prices": []})
    for r in rows:
        day = str(r.recorded_at.date()) if hasattr(r.recorded_at, "date") else str(r.recorded_at)[:10]
        by_date[day]["our_prices"].append(r.product.price)
        by_date[day]["comp_prices"].append(r.price)

    result = []
    for day in sorted(by_date.keys()):
        d = by_date[day]
        our_avg = round(sum(d["our_prices"]) / len(d["our_prices"]), 2) if d["our_prices"] else 0
        comp_avg = round(sum(d["comp_prices"]) / len(d["comp_prices"]), 2) if d["comp_prices"] else 0
        result.append({"date": day, "our_price": our_avg, "competitor_price": comp_avg})
    return result


@router.get("/analytics/product-pricing/{product_id}")
def product_pricing_detail(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Per-product pricing detail:
    - price_index: our_price / avg_market_price * 100
    - price_diff_pct: % we are above/below market average
    - price_rank: cheapest / median / most expensive label
    - pct_above / pct_below: % of competitor records where we are above/below
    - competitors: list of competitor cards {name, image_url, price, diff, diff_pct}
    """
    product = db.get(models.Product, product_id)
    if not product:
        from fastapi import HTTPException
        raise HTTPException(404, "Product not found")

    rows = (
        db.query(models.CompetitorPrice)
        .filter(models.CompetitorPrice.product_id == product_id)
        .join(models.Product)
        .all()
    )

    comp_prices = [r.price for r in rows]
    our_price = product.price

    if not comp_prices:
        return {
            "product_id": product_id,
            "product_name": product.name,
            "our_price": our_price,
            "price_index": None,
            "price_diff_pct": None,
            "price_rank": "N/A",
            "pct_above": 0,
            "pct_below": 0,
            "competitors": [],
        }

    avg_market = sum(comp_prices) / len(comp_prices)
    price_index = round(our_price / avg_market * 100, 1) if avg_market else None
    price_diff_pct = round((our_price - avg_market) / avg_market * 100, 1) if avg_market else None

    all_prices = sorted(comp_prices + [our_price])
    rank_pos = all_prices.index(our_price)
    n = len(all_prices)
    if rank_pos == 0:
        price_rank = "Cheapest in market"
    elif rank_pos == n - 1:
        price_rank = "Most expensive in market"
    else:
        pct_rank = rank_pos / (n - 1) * 100
        if pct_rank <= 33:
            price_rank = "Among the cheapest"
        elif pct_rank <= 66:
            price_rank = "Median priced"
        else:
            price_rank = "Among the most expensive"

    above = sum(1 for p in comp_prices if our_price > p)
    below = sum(1 for p in comp_prices if our_price < p)
    total = len(comp_prices)
    pct_above = round(above / total * 100, 1) if total else 0
    pct_below = round(below / total * 100, 1) if total else 0

    competitors = []
    for r in rows:
        diff = round(our_price - r.price, 2)
        diff_pct = round((our_price - r.price) / r.price * 100, 1) if r.price else 0
        competitors.append({
            "name": r.competitor_name,
            "price": r.price,
            "diff": diff,
            "diff_pct": diff_pct,
            "marketplace": r.marketplace,
        })
    competitors.sort(key=lambda x: x["price"])

    return {
        "product_id": product_id,
        "product_name": product.name,
        "product_image": product.image_url,
        "our_price": our_price,
        "avg_market_price": round(avg_market, 2),
        "price_index": price_index,
        "price_diff_pct": price_diff_pct,
        "price_rank": price_rank,
        "pct_above": pct_above,
        "pct_below": pct_below,
        "competitors": competitors,
    }


@router.get("/analytics/competitor-breakdown")
def competitor_breakdown(
    marketplace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Per-competitor summary: avg price, number of products tracked,
    how many products they undercut us on.
    """
    q = db.query(models.CompetitorPrice).join(models.Product)
    if marketplace and marketplace != "all":
        q = q.filter(models.CompetitorPrice.marketplace == marketplace)
    rows = q.all()

    from collections import defaultdict
    buckets: dict = defaultdict(lambda: {"prices": [], "our_prices": [], "products": set()})
    for r in rows:
        b = buckets[r.competitor_name]
        b["prices"].append(r.price)
        b["our_prices"].append(r.product.price)
        b["products"].add(r.product_id)

    result = []
    for name, b in sorted(buckets.items()):
        avg_comp = round(sum(b["prices"]) / len(b["prices"]), 2)
        avg_our = round(sum(b["our_prices"]) / len(b["our_prices"]), 2)
        cheaper_count = sum(1 for cp, op in zip(b["prices"], b["our_prices"]) if cp < op)
        result.append({
            "competitor": name,
            "avg_price": avg_comp,
            "avg_our_price": avg_our,
            "products_tracked": len(b["products"]),
            "undercuts_us": cheaper_count,
            "avg_diff": round(avg_our - avg_comp, 2),
        })
    result.sort(key=lambda x: x["avg_diff"], reverse=True)
    return result
