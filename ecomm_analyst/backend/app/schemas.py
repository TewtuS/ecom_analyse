"""
Pydantic v2 schemas for request / response validation.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


# ── Auth ──────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ── Product ───────────────────────────────────
class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: int
    marketplace: str
    image_url: Optional[str] = ""


class ProductOut(ProductCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Sales ─────────────────────────────────────
class SalesRecordCreate(BaseModel):
    product_id: int
    quantity: int
    revenue: float
    returned: bool = False
    sale_date: Optional[datetime] = None
    marketplace: str
    bundled_with: Optional[str] = ""


class SalesRecordOut(SalesRecordCreate):
    id: int
    sale_date: datetime

    model_config = {"from_attributes": True}


# ── Engagement ────────────────────────────────
class EngagementMetricCreate(BaseModel):
    product_id: int
    date: Optional[datetime] = None
    page_visits: int = 0
    cart_adds: int = 0
    click_through_rate: float = 0.0
    image_views: int = 0
    marketplace: str


class EngagementMetricOut(EngagementMetricCreate):
    id: int
    date: datetime

    model_config = {"from_attributes": True}


# ── Comments ──────────────────────────────────
class CommentCreate(BaseModel):
    product_id: int
    author: str
    text: str
    rating: int
    sentiment: str
    marketplace: str


class CommentOut(CommentCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Competitor Prices ─────────────────────────
class CompetitorPriceCreate(BaseModel):
    product_id: int
    competitor_name: str
    price: float
    marketplace: str


class CompetitorPriceOut(CompetitorPriceCreate):
    id: int
    recorded_at: datetime

    model_config = {"from_attributes": True}


# ── AI Insights ───────────────────────────────
class InsightRequest(BaseModel):
    segments: List[str]   # e.g. ["sales", "engagement"]
    question: str


class InsightResponse(BaseModel):
    segments: List[str]
    question: str
    answer: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard summary ─────────────────────────
class DashboardSummary(BaseModel):
    total_revenue: float
    total_orders: int
    total_returns: int
    avg_ctr: float
    total_page_visits: int
    total_cart_adds: int
    positive_comments: int
    negative_comments: int
    neutral_comments: int
    # Period-over-period trend percentages (positive = growth)
    revenue_trend: Optional[float] = None
    orders_trend: Optional[float] = None
    ctr_trend: Optional[float] = None
