"""
SQLAlchemy ORM models – one table per business entity.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ──────────────────────────────────────────────
# Users / Auth
# ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    insight_logs: Mapped[list["AIInsightLog"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# ──────────────────────────────────────────────
# Products
# ──────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Float)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    marketplace: Mapped[str] = mapped_column(String(100))  # Shopee, Taobao, etc.
    image_url: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sales: Mapped[list["SalesRecord"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    engagement: Mapped[list["EngagementMetric"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    competitor_prices: Mapped[list["CompetitorPrice"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


# ──────────────────────────────────────────────
# Sales
# ──────────────────────────────────────────────
class SalesRecord(Base):
    __tablename__ = "sales_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    revenue: Mapped[float] = mapped_column(Float)
    returned: Mapped[bool] = mapped_column(Boolean, default=False)
    sale_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    marketplace: Mapped[str] = mapped_column(String(100))
    # Comma-separated product IDs bundled with this sale (e.g. "3,7")
    bundled_with: Mapped[str] = mapped_column(String(255), default="")

    product: Mapped["Product"] = relationship(back_populates="sales")


# ──────────────────────────────────────────────
# Engagement
# ──────────────────────────────────────────────
class EngagementMetric(Base):
    __tablename__ = "engagement_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    page_visits: Mapped[int] = mapped_column(Integer, default=0)
    cart_adds: Mapped[int] = mapped_column(Integer, default=0)
    click_through_rate: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100 %
    image_views: Mapped[int] = mapped_column(Integer, default=0)
    marketplace: Mapped[str] = mapped_column(String(100))

    product: Mapped["Product"] = relationship(back_populates="engagement")


# ──────────────────────────────────────────────
# Comments / Reviews
# ──────────────────────────────────────────────
class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    author: Mapped[str] = mapped_column(String(100))
    text: Mapped[str] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(Integer)          # 1-5
    sentiment: Mapped[str] = mapped_column(String(20))    # positive / neutral / negative
    marketplace: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="comments")


# ──────────────────────────────────────────────
# Competitor Pricing
# ──────────────────────────────────────────────
class CompetitorPrice(Base):
    __tablename__ = "competitor_prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    competitor_name: Mapped[str] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Float)
    marketplace: Mapped[str] = mapped_column(String(100))
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["Product"] = relationship(back_populates="competitor_prices")


# ──────────────────────────────────────────────
# AI Insight Logs
# ──────────────────────────────────────────────
class AIInsightLog(Base):
    __tablename__ = "ai_insight_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    segments: Mapped[str] = mapped_column(String(255))   # e.g. "sales,engagement"
    prompt: Mapped[str] = mapped_column(Text)
    response: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="insight_logs")
