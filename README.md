# Energy Optimizer Web App (React + Vite)

React TypeScript frontend for the Apex Energy portal.

## Requirements

- Node.js 18+
- npm

## Setup

```bash

cd pss-frontend

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process # Do this always

npm install # DO this if node_modules folder doesn't exists
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

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process


# Backend

   - Email: `tharuka@nookclothes.lk`
   - Password: `energy@2024`


## Notes

- Auth uses JWT Bearer tokens stored in `localStorage`.
- Machine/facility/tariff fields from the API are mapped in `src/data/api.ts` to frontend shapes.
- Vite proxy (`/api-proxy`) exists in `vite.config.ts` but the app uses `VITE_API_URL` directly.

### Quick start (both)

**Terminal 1 — backend**

```bash
cd pss-backend # Do this
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process # Do this always
python -m venv venv # Only if venv not exists in the backend
venv\Scripts\activate # Do this
pip install -r requirements.txt # Only if venv is created newly
uvicorn app.main:app --reload --port 8000 # Run the backend.
```

**Terminal 2 — frontend**

```bash
cd pss-frontend
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process # Do this always
npm install
npm run dev
```

Then open http://localhost:5173 and sign in with `tharuka@nookclothes.lk` / `energy@2024`.