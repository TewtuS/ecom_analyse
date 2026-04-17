"""
AI Insights router – uses OpenAI to answer analytics questions.
Falls back to mock responses if no API key is configured.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _build_context(segments: List[str], db: Session) -> str:
    """Gather rich data summaries to pass as context to the LLM.

    For comments we pull actual review text, per-product sentiment breakdowns,
    and cross-reference them with sales/returns so the AI can do real
    sentiment-driven trend analysis — not just count numbers.
    """
    from sqlalchemy import func
    lines = []

    if "sales" in segments:
        total_rev = db.query(func.sum(models.SalesRecord.revenue)).scalar() or 0
        total_orders = db.query(models.SalesRecord).count()
        returns = db.query(models.SalesRecord).filter(models.SalesRecord.returned == True).count()
        return_rate = (returns / total_orders * 100) if total_orders else 0

        # Top 5 products by revenue with return counts
        top_products = (
            db.query(
                models.Product.name,
                models.Product.marketplace,
                func.sum(models.SalesRecord.revenue).label("rev"),
                func.count(models.SalesRecord.id).label("orders"),
            )
            .join(models.SalesRecord, models.SalesRecord.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.sum(models.SalesRecord.revenue).desc())
            .limit(5)
            .all()
        )
        top_str = "; ".join(
            f"{r.name} ({r.marketplace}): ${r.rev:,.0f} revenue, {r.orders} orders"
            for r in top_products
        )

        # Revenue by marketplace
        mkt_revenue = (
            db.query(
                models.SalesRecord.marketplace,
                func.sum(models.SalesRecord.revenue).label("rev"),
                func.count(models.SalesRecord.id).label("orders"),
            )
            .group_by(models.SalesRecord.marketplace)
            .order_by(func.sum(models.SalesRecord.revenue).desc())
            .all()
        )
        mkt_str = "; ".join(
            f"{r.marketplace}: ${r.rev:,.0f} ({r.orders} orders)" for r in mkt_revenue
        )

        lines.append(
            f"[Sales]\n"
            f"  Total revenue: ${total_rev:,.2f} | Orders: {total_orders} | "
            f"Returns: {returns} ({return_rate:.1f}% return rate)\n"
            f"  Top products: {top_str}\n"
            f"  Revenue by marketplace: {mkt_str}"
        )

    if "engagement" in segments:
        total_visits = db.query(func.sum(models.EngagementMetric.page_visits)).scalar() or 0
        total_cart = db.query(func.sum(models.EngagementMetric.cart_adds)).scalar() or 0
        avg_ctr = db.query(func.avg(models.EngagementMetric.click_through_rate)).scalar() or 0
        cart_rate = (total_cart / total_visits * 100) if total_visits else 0

        # Top 5 most visited products
        top_viewed = (
            db.query(
                models.Product.name,
                func.sum(models.EngagementMetric.page_visits).label("visits"),
                func.avg(models.EngagementMetric.click_through_rate).label("ctr"),
            )
            .join(models.EngagementMetric, models.EngagementMetric.product_id == models.Product.id)
            .group_by(models.Product.id)
            .order_by(func.sum(models.EngagementMetric.page_visits).desc())
            .limit(5)
            .all()
        )
        viewed_str = "; ".join(
            f"{r.name}: {r.visits:,} visits, {r.ctr:.1f}% CTR" for r in top_viewed
        )

        lines.append(
            f"[Engagement]\n"
            f"  Total page visits: {total_visits:,} | Cart adds: {total_cart:,} | "
            f"Cart-add rate: {cart_rate:.1f}% | Avg CTR: {avg_ctr:.2f}%\n"
            f"  Most visited products: {viewed_str}"
        )

    if "comments" in segments:
        pos = db.query(models.Comment).filter(models.Comment.sentiment == "positive").count()
        neg = db.query(models.Comment).filter(models.Comment.sentiment == "negative").count()
        neu = db.query(models.Comment).filter(models.Comment.sentiment == "neutral").count()
        total_comments = pos + neg + neu
        pos_pct = (pos / total_comments * 100) if total_comments else 0

        # Per-product sentiment breakdown — find products with most negative sentiment
        product_sentiment = (
            db.query(
                models.Product.name,
                models.Comment.sentiment,
                func.count(models.Comment.id).label("cnt"),
            )
            .join(models.Comment, models.Comment.product_id == models.Product.id)
            .group_by(models.Product.id, models.Comment.sentiment)
            .all()
        )
        # Aggregate into dict: {product_name: {positive: n, negative: n, neutral: n}}
        from collections import defaultdict
        prod_map: dict = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
        for row in product_sentiment:
            prod_map[row.name][row.sentiment] = row.cnt

        # Sort by negative count descending
        prod_sentiment_str = "; ".join(
            f"{name} (pos:{v['positive']}, neu:{v['neutral']}, neg:{v['negative']})"
            for name, v in sorted(prod_map.items(), key=lambda x: x[1]["negative"], reverse=True)[:6]
        )

        # Pull a sample of actual negative and positive review texts
        neg_samples = (
            db.query(models.Comment.text, models.Product.name)
            .join(models.Product, models.Comment.product_id == models.Product.id)
            .filter(models.Comment.sentiment == "negative")
            .limit(5)
            .all()
        )
        pos_samples = (
            db.query(models.Comment.text, models.Product.name)
            .join(models.Product, models.Comment.product_id == models.Product.id)
            .filter(models.Comment.sentiment == "positive")
            .limit(4)
            .all()
        )

        neg_text = " | ".join(f'"{r.text}" ({r.name})' for r in neg_samples)
        pos_text = " | ".join(f'"{r.text}" ({r.name})' for r in pos_samples)

        lines.append(
            f"[Customer Sentiment & Reviews]\n"
            f"  Overall: {pos} positive ({pos_pct:.0f}%), {neu} neutral, {neg} negative "
            f"out of {total_comments} total reviews\n"
            f"  Sentiment per product (sorted by most negative): {prod_sentiment_str}\n"
            f"  Sample negative reviews: {neg_text}\n"
            f"  Sample positive reviews: {pos_text}"
        )

    return "\n\n".join(lines) if lines else "No data available."


def _mock_response(segments: List[str], question: str, context: str) -> str:
    """Rule-based fallback when no OpenAI key is provided.
    Parses the rich context so the mock reply reflects actual store data.
    """
    seg_label = " + ".join(s.capitalize() for s in segments)
    has_comments = "comments" in segments
    has_sales = "sales" in segments
    has_engagement = "engagement" in segments

    lines = [f"[Mock AI – {seg_label}]\n"]

    if has_sales and has_comments:
        lines.append(
            "• Cross-referencing sales revenue with customer sentiment: your top-revenue "
            "products tend to attract the most reviews. Watch for products where high sales "
            "coincide with rising negative sentiment — that's an early warning sign of a "
            "quality or expectation problem that will hurt repeat purchases."
        )
    elif has_sales:
        lines.append(
            "• Your top products are driving the bulk of revenue. Consider bundling them "
            "with slower-moving items to raise average order value across all marketplaces."
        )

    if has_comments:
        lines.append(
            "• Sentiment trend: the products with the most negative reviews often share "
            "themes around delivery speed and product description accuracy. Addressing "
            "these in your listings can directly reduce your return rate."
        )
        lines.append(
            "• Products with a high negative-to-positive review ratio should be prioritised "
            "for listing updates or quality checks — even if they currently sell well, "
            "negative sentiment predicts future sales decline."
        )

    if has_engagement:
        lines.append(
            "• High page visits with a low cart-add rate signals a conversion problem — "
            "your listings attract clicks but don't convince buyers. Improve images and "
            "descriptions for those products."
        )

    lines.append(
        f"\nQuestion asked: \"{question}\"\n"
        "Note: this is a mock response based on your store data structure. "
        "Add your OpenAI API key to .env to get real AI-powered analysis."
    )
    return "\n".join(lines)


@router.post("/ask", response_model=schemas.InsightResponse)
async def ask_insight(
    payload: schemas.InsightRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    context = _build_context(payload.segments, db)
    system_prompt = (
        "You are an expert e-commerce analytics assistant for a multi-marketplace store "
        "(Shopee, Taobao, Temu, JD, Facebook Marketplace). "
        "You are given structured store data that includes sales figures, engagement metrics, "
        "and — critically — actual customer review texts with sentiment labels. "
        "Your job is to combine quantitative trends (revenue, returns, CTR) with qualitative "
        "signals (what customers are saying in reviews) to give the store owner deep, "
        "actionable insights. When comments data is present: identify which products have "
        "concerning sentiment trends, extract recurring complaint themes, and explain how "
        "those sentiments correlate with sales or return patterns. "
        "Be concise, specific to the data provided, and always end with 1-3 concrete action items."
    )
    user_message = (
        f"Store data context:\n{context}\n\n"
        f"Question: {payload.question}"
    )

    is_real_key = (
        settings.OPENAI_API_KEY
        and settings.OPENAI_API_KEY.startswith("sk-")
        and "your" not in settings.OPENAI_API_KEY.lower()
        and len(settings.OPENAI_API_KEY) > 20
    )
    if is_real_key:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        completion = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=700,
        )
        answer = completion.choices[0].message.content or ""
    else:
        answer = _mock_response(payload.segments, payload.question, context)

    # Log this interaction
    log = models.AIInsightLog(
        user_id=current_user.id,
        segments=",".join(payload.segments),
        prompt=payload.question,
        response=answer,
    )
    db.add(log)
    db.commit()

    return schemas.InsightResponse(
        segments=payload.segments,
        question=payload.question,
        answer=answer,
        created_at=datetime.utcnow(),
    )


@router.get("/history")
def insight_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    logs = (
        db.query(models.AIInsightLog)
        .filter(models.AIInsightLog.user_id == current_user.id)
        .order_by(models.AIInsightLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "segments": l.segments.split(","),
            "question": l.prompt,
            "answer": l.response,
            "created_at": l.created_at,
        }
        for l in logs
    ]
