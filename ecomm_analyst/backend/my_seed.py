"""
my_seed.py — Seeds the database from the real data_200/ CSV files.

Run from the backend/ directory:
    python my_seed.py

WARNING: This WIPES all existing data and replaces it with the CSV data.
"""
import csv
import os
import re
import sys
from datetime import datetime

sys.path.insert(0, ".")

from app.database import Base, SessionLocal, engine
from app.models import Comment, CompetitorPrice, EngagementMetric, Product, SalesRecord, User
from app.security import hash_password

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data_200")
IMAGE_DIR = os.path.join(DATA_DIR, "image")


# ── Helpers ── image filename slug ─────────────────────────────────────────────
def name_to_image_url(product_name: str) -> str:
    """
    Convert a product name to its image URL served via /images/<slug>.jpg
    e.g. "A'PIEU Madecassoside Toner" → "/images/apieu_madecassoside_toner.jpg"
    """
    slug = product_name.lower()
    slug = slug.replace("'", "").replace("'", "").replace("é", "e").replace("ô", "o").replace("ü", "u")
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    slug = slug.strip("_")
    filepath = os.path.join(IMAGE_DIR, f"{slug}.jpg")
    if os.path.isfile(filepath):
        return f"/images/{slug}.jpg"
    return ""

# ── Helpers ────────────────────────────────────────────────────────────────────

def read_csv(filename: str) -> list[dict]:
    path = os.path.join(DATA_DIR, filename)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def parse_date(s: str) -> datetime:
    """Accept YYYY-MM-DD or YYYY-MM-DD HH:MM:SS."""
    s = s.strip()
    if not s:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def parse_bool(s: str) -> bool:
    return s.strip().lower() in ("true", "1", "yes")


# ── Setup ──────────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("Clearing existing data...")
db.query(CompetitorPrice).delete()
db.query(Comment).delete()
db.query(EngagementMetric).delete()
db.query(SalesRecord).delete()
db.query(Product).delete()
db.query(User).delete()
db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — DEMO USER
# ══════════════════════════════════════════════════════════════════════════════
demo = User(
    email="demo@example.com",
    username="demo_store",
    hashed_password=hash_password("demo1234"),
    is_active=True,
)
db.add(demo)
db.commit()
db.refresh(demo)
print(f"Created user: {demo.email}")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — PRODUCTS  (200 rows from products.csv)
# ══════════════════════════════════════════════════════════════════════════════
product_rows = read_csv("products.csv")

# product_id_map: CSV row index (1-based) → actual DB id
product_id_map: dict[int, int] = {}

products_to_add = []
for row in product_rows:
    name = row["name"].strip()
    # Use CSV image_url if provided, otherwise derive from product name
    csv_img = row["image_url"].strip() if row["image_url"].strip() else ""
    image_url = csv_img if csv_img else name_to_image_url(name)
    products_to_add.append(Product(
        name=name,
        category=row["category"].strip(),
        price=float(row["price"]),
        stock=int(row["stock"]),
        image_url=image_url,
        marketplace=row["marketplace"].strip(),
    ))

db.add_all(products_to_add)
db.commit()
for idx, prod in enumerate(products_to_add, start=1):
    db.refresh(prod)
    product_id_map[idx] = prod.id

print(f"Created {len(products_to_add)} products")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — SALES RECORDS  (~1644 rows from sales.csv)
# ══════════════════════════════════════════════════════════════════════════════
sales_rows = read_csv("sales.csv")

sales_to_add = []
skipped_sales = 0
for row in sales_rows:
    csv_pid = int(row["product_id"])
    db_pid = product_id_map.get(csv_pid)
    if db_pid is None:
        skipped_sales += 1
        continue
    sales_to_add.append(SalesRecord(
        product_id=db_pid,
        quantity=int(row["quantity"]),
        revenue=float(row["revenue"]),
        returned=parse_bool(row["returned"]),
        sale_date=parse_date(row["sale_date"]),
        marketplace=row["marketplace"].strip(),
        bundled_with=row["bundled_with"].strip() if row["bundled_with"].strip() else "",
    ))

db.add_all(sales_to_add)
db.commit()
print(f"Created {len(sales_to_add)} sales records" + (f" ({skipped_sales} skipped)" if skipped_sales else ""))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — ENGAGEMENT METRICS  (~1571 rows from engagement.csv)
# ══════════════════════════════════════════════════════════════════════════════
engagement_rows = read_csv("engagement.csv")

engagement_to_add = []
skipped_eng = 0
for row in engagement_rows:
    csv_pid = int(row["product_id"])
    db_pid = product_id_map.get(csv_pid)
    if db_pid is None:
        skipped_eng += 1
        continue
    engagement_to_add.append(EngagementMetric(
        product_id=db_pid,
        date=parse_date(row["date"]),
        page_visits=int(row["page_visits"]),
        cart_adds=int(row["cart_adds"]),
        click_through_rate=float(row["click_through_rate"]),
        image_views=int(row["image_views"]),
        marketplace=row["marketplace"].strip(),
    ))

db.add_all(engagement_to_add)
db.commit()
print(f"Created {len(engagement_to_add)} engagement metric rows" + (f" ({skipped_eng} skipped)" if skipped_eng else ""))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — COMMENTS / REVIEWS  (~1018 rows from comments.csv)
# ══════════════════════════════════════════════════════════════════════════════
comment_rows = read_csv("comments.csv")

comments_to_add = []
skipped_comments = 0
for row in comment_rows:
    csv_pid = int(row["product_id"])
    db_pid = product_id_map.get(csv_pid)
    if db_pid is None:
        skipped_comments += 1
        continue
    comments_to_add.append(Comment(
        product_id=db_pid,
        author=row["author"].strip(),
        text=row["text"].strip(),
        rating=int(row["rating"]),
        sentiment=row["sentiment"].strip().lower(),
        marketplace=row["marketplace"].strip(),
        created_at=parse_date(row["created_at"]),
    ))

db.add_all(comments_to_add)
db.commit()
print(f"Created {len(comments_to_add)} comments" + (f" ({skipped_comments} skipped)" if skipped_comments else ""))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — COMPETITOR PRICES  (~597 rows from competitor.csv)
# ══════════════════════════════════════════════════════════════════════════════
competitor_rows = read_csv("competitor.csv")

competitor_to_add = []
skipped_comp = 0
for row in competitor_rows:
    csv_pid = int(row["product_id"])
    db_pid = product_id_map.get(csv_pid)
    if db_pid is None:
        skipped_comp += 1
        continue
    competitor_to_add.append(CompetitorPrice(
        product_id=db_pid,
        competitor_name=row["competitor_name"].strip(),
        price=float(row["price"]),
        marketplace=row["marketplace"].strip(),
        recorded_at=parse_date(row["recorded_at"]),
    ))

db.add_all(competitor_to_add)
db.commit()
print(f"Created {len(competitor_to_add)} competitor price entries" + (f" ({skipped_comp} skipped)" if skipped_comp else ""))


# ── Done ───────────────────────────────────────────────────────────────────────
db.close()
print("\nSeeding complete!")
print("Login: demo@example.com / demo1234")
