# Transport Billing System

A professional, responsive app for managing taxi transport services, built with React (frontend), Node.js (backend), and PostgreSQL (database).

## Features
- User authentication (register, login, forgot password)
- Dashboard with trip stats (per day, month, year)
- Trip capture (with shift, driver, direction, date, etc.)
- Invoice generation (PDF download)
- Modern, responsive UI (Material UI)
- Ready for Heroku deployment

## Deployment
1. Set up PostgreSQL and apply schema from `database/schema.sql`.
2. Configure environment variables in `server/.env` (DB connection, JWT secret, etc).
3. Build frontend: `npm run build --prefix client`.
4. Deploy to Heroku. Heroku will use the `Procfile` to start the backend.

## Heroku Notes
- Backend runs via `web: npm run start --prefix server`.
- Frontend static files should be served by backend or via Heroku static hosting.

## PDF Invoice
- Click 'Generate Invoice' in dashboard to download PDF (via backend API).

---

For any issues, please check logs or contact support.