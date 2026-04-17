"""
Comments / Reviews router – CRUD + sentiment analytics.
"""
from collections import Counter
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/comments", tags=["comments"])

# Common stop-words to exclude from word-frequency analysis
STOP_WORDS = {
    "the", "a", "an", "is", "it", "i", "my", "this", "was", "and", "to",
    "of", "in", "for", "on", "that", "with", "but", "very", "so", "are",
    "be", "have", "had", "not", "from", "at", "by", "or",
}


@router.get("/", response_model=List[schemas.CommentOut])
def list_comments(
    product_id: Optional[int] = Query(None),
    sentiment: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(models.Comment)
    if product_id:
        q = q.filter(models.Comment.product_id == product_id)
    if sentiment:
        q = q.filter(models.Comment.sentiment == sentiment)
    if marketplace:
        q = q.filter(models.Comment.marketplace == marketplace)
    return q.order_by(models.Comment.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.CommentOut, status_code=201)
def create_comment(
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    comment = models.Comment(**payload.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


# ── Analytics ─────────────────────────────────
@router.get("/analytics/top-positive")
def top_positive(
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(models.Comment)
        .filter(models.Comment.sentiment == "positive")
        .order_by(models.Comment.rating.desc())
        .limit(limit)
        .all()
    )


@router.get("/analytics/top-negative")
def top_negative(
    limit: int = 5,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(models.Comment)
        .filter(models.Comment.sentiment == "negative")
        .order_by(models.Comment.rating.asc())
        .limit(limit)
        .all()
    )


@router.get("/analytics/sentiment-summary")
def sentiment_summary(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Count of positive / neutral / negative reviews and average rating."""
    rows = (
        db.query(
            models.Comment.sentiment,
            func.count(models.Comment.id).label("count"),
            func.avg(models.Comment.rating).label("avg_rating"),
        )
        .group_by(models.Comment.sentiment)
        .all()
    )
    return [
        {"sentiment": r.sentiment, "count": r.count, "avg_rating": round(r.avg_rating or 0, 2)}
        for r in rows
    ]


@router.get("/analytics/word-frequency")
def word_frequency(
    sentiment: Optional[str] = Query(None),
    limit: int = 20,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Most frequent words in comments, optionally filtered by sentiment."""
    q = db.query(models.Comment.text)
    if sentiment:
        q = q.filter(models.Comment.sentiment == sentiment)
    texts = [row[0] for row in q.all()]
    words: Counter = Counter()
    for text in texts:
        for word in text.lower().split():
            clean = "".join(c for c in word if c.isalpha())
            if clean and clean not in STOP_WORDS and len(clean) > 2:
                words[clean] += 1
    return [{"word": w, "count": c} for w, c in words.most_common(limit)]


@router.get("/analytics/themes")
def comment_themes(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return top praise and complaint themes based on keyword matching."""
    praise_keywords = ["fast", "quality", "love", "great", "excellent", "recommend", "perfect", "amazing"]
    complaint_keywords = ["broken", "slow", "damaged", "wrong", "refund", "return", "poor", "bad", "defective"]

    all_comments = db.query(models.Comment).all()
    praise: Counter = Counter()
    complaints: Counter = Counter()
    for c in all_comments:
        text_lower = c.text.lower()
        for kw in praise_keywords:
            if kw in text_lower:
                praise[kw] += 1
        for kw in complaint_keywords:
            if kw in text_lower:
                complaints[kw] += 1

    return {
        "praise_themes": [{"theme": k, "count": v} for k, v in praise.most_common(5)],
        "complaint_themes": [{"theme": k, "count": v} for k, v in complaints.most_common(5)],
    }
