# Event Portal — Backend

Node.js + Express + TypeScript + TypeORM + MySQL backend for the Event Management Portal practical task.

## Features implemented

- **Login API** (username + password, JWT access + refresh tokens)
- **Single session at a time**: logging in from a new browser/device immediately invalidates
  the previous session, and a **Socket.io** event force-logs-out the old browser in real time
  (the User A / Safari vs Chrome scenario).
- **Login rate limiter** (5 attempts / 10 minutes per IP)
- **Add event** with title, description, category, multiple photos, publish date/time + timezone.
  Events are invisible in the public list until `publishAt` (stored in UTC) has passed.
- **Delete event** — soft delete (trash/restore-able) or permanent delete.
- **List events** — converts each event's publish time into the requester's timezone
  (sent via `X-Timezone` header or `?timezone=` query param).
- **Admin dashboard API**: all events with user info + media, filterable by
  `published` / `not_published` (computed from `publishAt` vs current time, not a static flag).
- **Nested categories**: self-referencing tree, admin can nest a category inside any category.
- **Validation** via `express-validator` on all write endpoints.
- **ESLint** configured (`npm run lint`).

## Tech stack

Node.js, TypeScript, Express, TypeORM, MySQL, JWT, Socket.io, Multer, Luxon (timezone conversion), bcryptjs.

## Setup

### 1. Prerequisites
- Node.js 18+
- MySQL 8+ running locally (or update `.env` to point elsewhere)

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env` with your MySQL credentials. Create the database first:
```sql
CREATE DATABASE event_portal;
```

### 4. Run (dev mode — auto-creates tables via TypeORM `synchronize`)
```bash
npm run dev
```
Server starts on `http://localhost:4000` (or your configured `PORT`).

### 5. Seed sample data
```bash
npm run seed
```
This creates:
- Admin user → `username: admin` / `password: Admin@123`
- Editor user → `username: priya.patel` / `password: Editor@123`
- Nested categories matching the provided mock data
- A handful of sample events (mix of already-published and future-scheduled)

### 6. Build for production
```bash
npm run build
npm start
```

### 7. Lint
```bash
npm run lint
```

## API Reference

All authenticated routes require: `Authorization: Bearer <accessToken>`

### Auth
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | Rate-limited. Invalidates any previous session + force-logs-out old browser via socket. |
| POST | `/api/auth/refresh` | `{ refreshToken }` | Issues new access token if session still active. |
| POST | `/api/auth/logout` | — | Requires auth. Marks current session inactive. |
| GET | `/api/auth/me` | — | Requires auth. Returns current user. |
| POST | `/api/auth/register` | `{ name, username, email, password, timezone? }` | Creates a user (viewer role by default). |

### Events
| Method | Route | Notes |
|---|---|---|
| GET | `/api/events?page=&limit=&categoryId=` | Public. Only published, non-deleted events. Honors `X-Timezone` header. |
| GET | `/api/events/:id` | Public. |
| POST | `/api/events` | Requires auth. `multipart/form-data`: `title, description, categoryId?, publishDate (YYYY-MM-DD), publishTime (HH:mm), timezone (IANA), photos[]` (up to 10 images). |
| DELETE | `/api/events/:id` | Requires auth. `{ permanent?: boolean }` in body, or `?permanent=true`. |

### Categories (nested)
| Method | Route | Notes |
|---|---|---|
| GET | `/api/categories` | Public. Returns nested tree. |
| POST | `/api/categories` | Admin only. `{ name, parentId? }` — pass any existing category's id as `parentId` to nest. |
| DELETE | `/api/categories/:id` | Admin only. Cascades to subcategories. |

### Admin
| Method | Route | Notes |
|---|---|---|
| GET | `/api/admin/events?filter=published\|not_published&includeDeleted=true&page=&limit=` | Admin only. Full event list with creator info + media, filterable. |

## Real-time single-session flow (how to test)

1. Log in as `admin` in Browser A (e.g. Chrome) — note the `accessToken` and connect a socket
   with `auth: { token: accessToken }` to `http://localhost:4000`.
2. Log in again as `admin` in Browser B (e.g. Safari / Firefox / incognito).
3. Browser A's socket receives a `force-logout` event immediately, and any further API call
   using Browser A's old access token gets `401 Session has been logged out`.

## Timezone handling

- Every `publishAt` is stored as UTC (`timestamp` column, MySQL session timezone doesn't matter).
- When creating an event, you send local `publishDate` + `publishTime` + IANA `timezone`
  (e.g. `Asia/Kolkata`); the server converts to UTC before saving.
- When listing/reading events, send `X-Timezone: <IANA zone>` and the server converts the
  stored UTC time back to that zone in the response.
- "Published" is always evaluated as `publishAt <= NOW()` in UTC on the server — never compared
  in any local timezone — so it's consistent regardless of who's asking or from where.

## Project structure

```
src/
  entities/        TypeORM entities (User, Session, Category, Event, EventMedia)
  controllers/      Route handlers
  routes/           Express routers
  middleware/       auth guard, rate limiter, validation, error handler
  socket/           Socket.io gateway (force-logout)
  utils/            timezone conversion, JWT, password hashing, slugify
  config/           multer upload config
  seed/             DB seed script
  data-source.ts    TypeORM connection config
  index.ts          App entry point
```

## Notes / assumptions

- `synchronize: true` is enabled outside production for convenience during review — for a real
  production rollout, switch to `migration:generate` / `migration:run`.
- The `User` entity includes fields matching the provided frontend mock data (`role`, `status`,
  `avatar`, browser/last-login tracking) plus `username`/`password` for auth, since the mock
  data didn't include credentials.
- Photos are stored on local disk under `/uploads` and served statically; swap the `multer`
  storage engine for S3/Cloud storage in `src/config/upload.ts` if needed for production.
