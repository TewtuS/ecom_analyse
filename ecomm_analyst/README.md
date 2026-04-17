# MarketLens – E-Commerce Analytics Platform

A full-stack analytics dashboard for marketplace sellers (Shopee, Taobao, Temu, Facebook Marketplace, JD, etc.).

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + React + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Python FastAPI |
| ORM | SQLAlchemy |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Auth | JWT (python-jose + bcrypt) |
| AI | OpenAI GPT-4o-mini (with mock fallback) |

---

## Project Structure
```
ecommerce-analytics/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── config.py        # Settings from .env
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models.py        # ORM models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── security.py      # JWT + bcrypt helpers
│   │   ├── dependencies.py  # FastAPI dependencies
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── dashboard.py
│   │       ├── products.py
│   │       ├── sales.py
│   │       ├── engagement.py
│   │       ├── comments.py
│   │       └── insights.py
│   ├── seed.py              # Demo data seed script
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx            # Redirects → /dashboard
    │   │   ├── login/page.tsx
    │   │   └── dashboard/
    │   │       ├── layout.tsx      # Auth guard + sidebar
    │   │       ├── page.tsx        # Main dashboard
    │   │       ├── sales/page.tsx
    │   │       ├── engagement/page.tsx
    │   │       ├── comments/page.tsx
    │   │       ├── insights/page.tsx
    │   │       └── settings/page.tsx
    │   ├── components/
    │   │   ├── Sidebar.tsx
    │   │   ├── KpiCard.tsx
    │   │   └── PageHeader.tsx
    │   ├── context/
    │   │   └── AuthContext.tsx
    │   └── lib/
    │       └── api.ts              # Axios + typed API helpers
    ├── package.json
    ├── tailwind.config.ts
    └── .env.local
```

---

## Quick Start

### 1. Backend Setup

```bash
cd ecommerce-analytics/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY (optional – mock mode works without it)

# Seed demo data
con

# Start API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd ecommerce-analytics/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

App runs at: http://localhost:3000

### 3. Login
```
Email:    demo@example.com
Password: demo1234
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login → JWT token |
| GET | /api/dashboard/summary | KPI summary |
| GET | /api/products/ | List products |
| GET | /api/sales/analytics/trends | Revenue trend |
| GET | /api/sales/analytics/top-products | Top products by revenue |
| GET | /api/sales/analytics/most-returned | Most returned products |
| GET | /api/sales/analytics/bundled-items | Frequently bundled pairs |
| GET | /api/sales/analytics/competitor-pricing | Competitor price comparison |
| GET | /api/engagement/analytics/trends | Engagement over time |
| GET | /api/engagement/analytics/top-viewed | Most visited products |
| GET | /api/engagement/analytics/image-views | Most viewed images |
| GET | /api/comments/analytics/top-positive | Top 5 positive reviews |
| GET | /api/comments/analytics/top-negative | Top 5 negative reviews |
| GET | /api/comments/analytics/sentiment-summary | Sentiment counts |
| GET | /api/comments/analytics/word-frequency | Most frequent words |
| GET | /api/comments/analytics/themes | Praise & complaint themes |
| POST | /api/insights/ask | Ask AI analytics question |
| GET | /api/insights/history | View past AI interactions |

---

## Switching to PostgreSQL (Production)

1. Uncomment `psycopg2-binary` in `requirements.txt`
2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce_analytics
   ```
3. Run `python seed.py` to re-seed

---

## AI Insights

- **With OpenAI key**: Uses `gpt-4o-mini` with real store data as context
- **Without key**: Falls back to smart rule-based mock responses (still useful for demos)

To enable real AI: add `OPENAI_API_KEY=sk-...` to `backend/.env`

---

## Demo Credentials
- **Email**: demo@example.com
- **Password**: demo1234
