# Affiliate Replica with Auth (Demo)

This demo contains a React + TypeScript frontend and a Node/Express backend with SQLite for admin credentials
and session-based authentication. Use this for local development only.

Quick start:
1. cd backend && npm install
2. cd ../frontend && npm install
3. Start backend: cd backend && npm run dev
4. Start frontend: cd frontend && npm run dev
5. Open http://localhost:5173

Default initial admin credentials (only for first run, created from .env or defaults):
- email: admin@example.com
- password: password123

Note: For security in production, replace SQLite with a proper DB and secure cookies, HTTPS, and environment secrets.
