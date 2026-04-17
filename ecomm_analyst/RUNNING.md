# MarketLens — Running Instructions

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **npm** 9+

---

## 1. Backend Setup

Run each line one at a time in Terminal 1:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python seed.py
uvicorn app.main:app --reload --port 8000
```

> After `copy .env.example .env` you can optionally open `.env` and add your `OPENAI_API_KEY` before continuing.

- **API base URL**: http://localhost:8000
- **Interactive API docs (Swagger)**: http://localhost:8000/docs

---

## 2. Frontend Setup

Run each line one at a time in Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

- **App URL**: http://localhost:3000

---

## 3. Login

Use the pre-seeded demo account:

```
Email:    demo@example.com
Password: demo1234
```

---

## 4. Service Summary

| Service | URL | Command |
|---|---|---|
| FastAPI backend | http://localhost:8000 | `uvicorn app.main:app --reload --port 8000` |
| Swagger API docs | http://localhost:8000/docs | (auto-starts with backend) |
| Next.js frontend | http://localhost:3000 | `npm run dev` |

---

## 5. Production Notes

- **Switch to PostgreSQL**: Uncomment `psycopg2-binary==2.9.9` in `requirements.txt` and update `DATABASE_URL` in `.env`
- **SECRET_KEY**: Replace with a long random string (e.g. `openssl rand -hex 32`)
- **OPENAI_API_KEY**: Add a real key to enable live GPT-4o-mini responses
- **Database migrations**: Alembic is installed — use it instead of `Base.metadata.create_all` for schema management in production
