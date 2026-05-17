# reeracify

# ==============================
# FRONTEND SETUP
# ==============================

# 1. Go to the same repository folder
cd reeracify

# 2. Go into frontend folder
cd frontend

# 3. Check what files exist
ls

# If you see package.json, run:
npm install
npm run dev

# Frontend will usually run at:
# http://localhost:5173
# or:
# http://localhost:3000

# Terminal 1: backend
cd reeracify
source .venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2: frontend
cd reeracify/frontend
npm run dev

# Backend URL:
http://127.0.0.1:8000

# FastAPI docs:
http://127.0.0.1:8000/docs

# Frontend URL:
# Check terminal output after npm run dev.
# Usually one of:
http://localhost:5173
http://localhost:3000

# Make sure frontend API base URL points to:
http://127.0.0.1:8000
