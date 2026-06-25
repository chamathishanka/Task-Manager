# Build Log — Task Management System

A running, detailed record of **how** the project was built and **why** each
decision was made. Written for two audiences: the engineer continuing the work,
and the interviewer who will discuss the thought process behind the app.

This document grows phase by phase. It currently covers **Phase 1** and
**Phase 2**.

---

## 0. High-level decisions (the "why" behind the whole project)

| Decision | Choice | Why |
| --- | --- | --- |
| Repository layout | **Single monorepo** (`/client` + `/server`) | One link to submit, one README, atomic commits across frontend/backend, easy to review. Separate hosting does **not** require separate repos — Vercel/Render just point at a subfolder. |
| Frontend | React + Vite + TypeScript | Assignment-preferred. Vite = fast dev/build. TS = type safety, a stated evaluation point. |
| Backend | Express + TypeScript | Assignment-required. TS end-to-end keeps types consistent across the stack. |
| Database | MongoDB + Mongoose | Flexible schema, fast to build, and MongoDB Atlas free tier never expires — important for keeping the live demo up through the interview. |
| Auth strategy | JWT: short-lived access token in memory + refresh token in httpOnly cookie | Avoids the common "JWT in localStorage" XSS pitfall. Refresh cookie is not readable by JS. |
| Hosting | Frontend → Vercel, Backend → Render, DB → MongoDB Atlas | All have usable free tiers; standard, well-documented combo. |

### Architectural principle: layered backend

Requests flow through clear layers so each file has one job:

```
route  ->  middleware (validate / auth / rbac)  ->  controller  ->  service  ->  model
```

- **routes** — declare endpoints and which middleware/handler runs. Thin.
- **middleware** — cross-cutting concerns (validation, auth, role checks, errors).
- **controllers** — read the request, call a service, shape the response. No business logic, no DB queries.
- **services** — business logic and database access. Reusable, testable.
- **models** — Mongoose schemas = the shape of the data.

This separation is the main thing the "code quality / maintainability" criterion
rewards, and it makes the app easy to extend (Task feature in Phase 3 reuses the
exact same skeleton).

---

## Phase 1 — Monorepo + backend foundation

**Goal:** a running, type-safe Express server that connects to MongoDB and
answers a health check — with linting/formatting in place from day one.

### What was created

```
task-manager/
├─ .gitignore
├─ README.md
├─ client/                 # (empty for now — built in Phase 4)
└─ server/
   ├─ .env                 # real local secrets (gitignored)
   ├─ .env.example         # template committed to git
   ├─ .prettierrc.json
   ├─ eslint.config.js
   ├─ package.json
   ├─ tsconfig.json
   └─ src/
      ├─ index.ts          # entry point — connect DB, start server
      ├─ app.ts            # builds the Express app (middleware + routes)
      ├─ config/
      │  ├─ env.ts         # validated environment variables
      │  └─ db.ts          # MongoDB connection
      └─ middleware/
         └─ errorHandler.ts
```

### Key decisions & details

**1. TypeScript with `NodeNext` modules + `"type": "module"`**
The project uses native ES Modules. Consequence you'll see everywhere: local
imports end in **`.js`** (e.g. `import { env } from "./config/env.js"`) even
though the source file is `.ts`. That's correct for `NodeNext` — the path refers
to the *compiled* output. `strict: true` is on, which (with the lint rule below)
enforces "no `any`".

**2. `tsx` for development**
`npm run dev` runs `tsx watch src/index.ts` — runs TypeScript directly with
hot-reload, no separate compile step while developing. `npm run build` uses real
`tsc` to emit `dist/` for production; `npm start` runs that compiled output.

**3. Validated environment config (`config/env.ts`)**
Instead of reading `process.env.X` scattered across the codebase, all env access
is centralized. A `required()` helper **throws on startup** if a critical
variable is missing — fail fast and loud rather than getting a confusing
`undefined` deep in the app later.

**4. Connection split from app (`config/db.ts` + `index.ts`)**
`index.ts` `await`s `connectDB()` **before** `app.listen()`. So if the server is
accepting requests, the database is guaranteed connected. `app.ts` only *builds*
the app (no side effects), which keeps it importable by tests later without
opening a DB connection or a port.

**5. Security & parsing middleware (in `app.ts`)**
- `helmet()` — sets safe HTTP headers.
- `cors({ origin: clientUrl, credentials: true })` — only the frontend origin is
  allowed, and `credentials: true` is required for the refresh cookie to work
  cross-origin.
- `express.json()` — parse JSON bodies.
- `cookieParser()` — read the refresh-token cookie.

**6. Central error handling (`middleware/errorHandler.ts`)**
- `notFound` — any unmatched route returns a consistent JSON 404.
- `errorHandler` — single place that turns errors into JSON responses.
  Registered **last** so it catches everything.

**7. Tooling from the start**
ESLint (flat config) + Prettier were set up immediately, not bolted on later.
The lint rule `@typescript-eslint/no-explicit-any: "error"` enforces the "no
`any`" quality goal mechanically.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `GET /api/health` | `{ "status": "ok", "time": ... }` |
| Unknown route | `404 { "message": "Route not found: ..." }` |
| MongoDB | connected to local `taskManager` DB |

> **Database note:** development uses **local** MongoDB
> (`mongodb://localhost:27017/taskManager`). It lives only on the dev machine.
> The cloud database (MongoDB Atlas) is set up at deploy time (Phase 9) by
> swapping the `MONGODB_URI` env var — no code changes. Local dev data is
> disposable and re-created by the seed script (Phase 3).

---

## Phase 2 — Authentication + Authorization (RBAC)

**Goal:** users can register and log in; protected endpoints require a valid
token; roles (`admin` / `user`) gate access. This is the security backbone every
later feature relies on.

### What was added

```
server/src/
├─ models/
│  └─ User.ts                  # Mongoose user schema + password compare
├─ utils/
│  ├─ AppError.ts              # error class carrying an HTTP status
│  └─ tokens.ts               # sign/verify access & refresh JWTs
├─ types/
│  └─ express.d.ts            # adds `req.user` to Express types
├─ middleware/
│  ├─ auth.ts                 # requireAuth + requireRole (RBAC)
│  └─ validate.ts             # generic Zod body validator
├─ validators/
│  └─ auth.validator.ts       # register/login input schemas
├─ services/
│  └─ auth.service.ts         # register + credential verification
├─ controllers/
│  └─ auth.controller.ts      # register/login/refresh/logout/me
└─ routes/
   └─ auth.routes.ts          # /api/auth/* endpoints
```

New dependencies: `bcryptjs`, `jsonwebtoken` (+ their `@types`).

### The authentication model (most important part)

Two tokens, deliberately stored in two different places:

| Token | Lifetime | Stored where | Purpose |
| --- | --- | --- | --- |
| **Access token** | 15 min | In memory on the client (a JS variable) | Sent as `Authorization: Bearer <token>` on every API call |
| **Refresh token** | 7 days | **httpOnly cookie** | Used only to get a new access token when it expires |

**Why this design?**
- A short-lived access token limits the damage if it leaks.
- The refresh token is in an **httpOnly** cookie, so client-side JavaScript
  cannot read it — this defends against XSS token theft (the weakness of the
  common "store JWT in localStorage" approach).
- The cookie is scoped to `Path=/api/auth`, so it's only sent to the auth
  endpoints that actually need it, not on every API request.
- In production the cookie is `Secure` + `SameSite=None` (required because the
  Vercel frontend and Render backend are on different domains); in development
  it's `SameSite=Lax` over plain HTTP so it works locally.

**Refresh rotation:** every call to `/api/auth/refresh` issues a *new* refresh
token as well as a new access token — a small hardening step.

### Key decisions & details

**1. Password security (`User.ts` + `auth.service.ts`)**
- Passwords are **never stored** — only a `bcrypt` hash (cost factor 10).
- `passwordHash` has `select: false`, so it's excluded from query results by
  default. Login explicitly re-includes it with `.select("+passwordHash")`.
- A `toJSON` transform strips `passwordHash` and `__v` from every serialized
  user, so the hash can never leak through an API response. (Verified: it does
  not appear in register/login/me responses.)
- `comparePassword()` is a schema method that wraps `bcrypt.compare`.

**2. Roles & the "no self-promotion" rule**
- `role` is an enum (`admin` | `user`) defaulting to `user`.
- Public registration **always** creates a `user` — the API ignores any `role`
  in the request body. Admins are created only via the seed script (Phase 3).
  This prevents anyone from registering themselves as an admin.

**3. Typed JWTs (`utils/tokens.ts`)**
A single `JwtPayload` type (`{ sub, role }`) is used for signing and verifying,
so the token contents are consistent and type-checked everywhere.

**4. RBAC middleware (`middleware/auth.ts`)**
- `requireAuth` — reads the `Bearer` token, verifies it, and attaches
  `req.user = { id, role }`. Rejects missing/invalid/expired tokens with 401.
- `requireRole(...roles)` — a factory returning middleware that returns 403
  unless `req.user.role` is allowed. Used in Phase 3 to gate admin-only routes.

**5. Typing `req.user` (`types/express.d.ts`)**
Express's `Request` doesn't know about `user`. A global declaration-merge adds
`user?: { id, role }` so controllers get full type-safety/autocomplete with no
casting.

**6. Input validation (`middleware/validate.ts` + `validators/`)**
`validate(schema)` is a reusable middleware that runs a Zod schema against
`req.body`. On failure it returns a structured 400 listing each bad field; on
success it replaces `req.body` with the parsed, typed data. Validation lives at
the edge so controllers/services can trust their input.

**7. Consistent errors (`utils/AppError.ts`)**
Services throw `new AppError(message, status)` (e.g. `409` for duplicate email,
`401` for bad credentials). The central `errorHandler` reads that status; unknown
errors default to 500 (and only 5xx are logged to the console). This keeps error
responses uniform across the API.

**8. Leaning on Express 5**
Express 5 automatically forwards rejected promises from async route handlers to
the error handler. That's why the controllers use plain `async`/`await` and
`throw` with **no try/catch wrappers** — cleaner code. (In Express 4 this would
need a helper or `express-async-errors`.)

**9. Brute-force protection**
`express-rate-limit` caps `/login` and `/register` at 30 requests per 15 minutes
per IP.

### Endpoints added

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Create a `user` account |
| POST | `/api/auth/login` | public | Return access token + set refresh cookie |
| POST | `/api/auth/refresh` | refresh cookie | Issue a new access token (rotates refresh) |
| POST | `/api/auth/logout` | — | Clear the refresh cookie |
| GET | `/api/auth/me` | access token | Return the current user |

### Verification (manually exercised against the running server)

| Test | Expected | Result |
| --- | --- | --- |
| Register valid | 201, user without `passwordHash` | pass |
| Register duplicate email | 409 `Email already in use` | pass |
| Register invalid input | 400 with per-field errors | pass |
| Login valid | `accessToken` + `Set-Cookie: refreshToken … HttpOnly` | pass |
| Login wrong password | 401 `Invalid credentials` | pass |
| `GET /me` with token | current user | pass |
| `GET /me` without token | 401 `Unauthorized` | pass |
| `tsc --noEmit` / `lint` | clean | pass |

---

## Current status

- ✅ **Phase 1** — Monorepo + backend foundation
- ✅ **Phase 2** — Auth + RBAC
- ⏭️ **Phase 3 (next)** — Task model + CRUD + RBAC scoping + filtering/search + seed script (creates demo admin & user accounts)

### Roadmap (remaining)

| Phase | Scope |
| --- | --- |
| 3 | Task CRUD, ownership scoping (admin sees all; user sees created/assigned), filter/search/sort/pagination, seed script |
| 4 | Frontend auth: login/register UI, protected routes, axios refresh interceptor |
| 5 | Task UI: list (table + cards), detail page, create/edit forms |
| 6 | Kanban board (drag-drop) + dashboard stats |
| 7 | AI features (Gemini): task description/priority suggester, admin standup summary |
| 8 | Tests + UX polish (loading/empty/error states, dark mode, overdue highlighting) |
| 9 | Deploy (Vercel + Render + Atlas) + finalize README |
