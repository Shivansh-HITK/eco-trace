# E-Waste Backend

## Setup

1. cd backend
2. Copy .env (already present). Update JWT_SECRET in production.
3. Install deps: `npm i`
4. Generate Prisma client: `npx prisma generate`
5. Create DB/migration: `npx prisma migrate dev --name init`
6. Start dev server: `npm run dev` (http://localhost:4000)

## API

- POST /api/auth/register { email, password, name?, role: INDIVIDUAL|NGO|DRIVER, orgName? }
- POST /api/auth/login { email, password }
- POST /api/auth/otp/request { email }
- POST /api/auth/otp/verify { email, code }

- POST /api/items (auth: any)
  - body: { type, brand?, model?, weightKg?, condition?, photoUrl?, geolocation? }
- GET /api/items (auth: role scoped)
- GET /api/items/:publicId (auth)
- POST /api/items/:publicId/status (auth: NGO|DRIVER|ADMIN)
  - body: { status, note?, geo? }
- GET /api/items/:publicId/qr (auth) -> { dataUrl, payload }

- POST /api/assignments (auth: NGO|ADMIN)
  - body: { driverUserId, itemPublicIds[] }
- GET /api/assignments/my (auth: DRIVER)
- POST /api/assignments/batch/status (auth: NGO|DRIVER|ADMIN)
  - body: { publicIds[], status, note?, geo? }

- GET /api/admin/stats (auth: ADMIN)

## Roles

- INDIVIDUAL: create own items, list own items
- NGO: manage assignments, update statuses, list NGO items
- DRIVER: view assignments, update statuses of assigned items
- ADMIN: full access, analytics

## Security

- JWT Bearer Authorization header required for protected routes
- QR payload is HMAC-signed and time-bound capable
- Passwords stored as bcrypt hashes