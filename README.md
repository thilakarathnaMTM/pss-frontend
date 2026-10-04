# Energy Optimizer Web App (React + Vite)

React TypeScript frontend for the Apex Energy portal.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
cd energy_optimizer_webapp

npm install
```

## Environment

Create `.env` in the frontend root:

```env
VITE_API_URL=http://localhost:8000
```

Without `VITE_API_URL`, the app runs in local dummy/demo mode and does not call the FastAPI backend.

## Run

```bash
npm run dev
```

App: http://localhost:5173

Other scripts:

```bash
npm run build
npm run preview
npm run typecheck
npm run lint
```

## Backend must be running

1. Start FastAPI on port 8000 (see backend README).
2. Set `VITE_API_URL=http://localhost:8000`.
3. Restart Vite after changing `.env`.
4. Login with seeded user:
   - Email: `manager@abcgarments.lk`
   - Password: `energy@2024`

## Project layout

```text
energy_optimizer_webapp/
├── public/
├── src/
│   ├── auth/
│   ├── components/
│   ├── data/api.ts
│   ├── features/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── README.md
```

## Notes

- Auth uses JWT Bearer tokens stored in `localStorage`.
- Machine/facility/tariff fields from the API are mapped in `src/data/api.ts` to frontend shapes.
- Vite proxy (`/api-proxy`) exists in `vite.config.ts` but the app uses `VITE_API_URL` directly.
```

---

### Quick start (both)

**Terminal 1 — backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
cd energy_optimizer_webapp
echo "VITE_API_URL=http://localhost:8000" > .env
npm install
npm run dev
```

Then open http://localhost:5173 and sign in with `manager@abcgarments.lk` / `energy@2024`.