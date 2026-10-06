# DevOps e-commerce training application

Minimal React + Vite storefront, Express API, PostgreSQL persistence, and Redis product caching. Built as a starting point for Docker, Linux, AWS, Terraform, CI/CD, Jenkins, Kubernetes, monitoring, and DevSecOps exercises. Deployment and infrastructure configuration are left for later.

## Prerequisites

- Node.js 22.12+ (24 LTS recommended) and npm
- PostgreSQL 14+ running locally, with `psql`
- Redis 6+ running locally, with `redis-cli`

Install and start PostgreSQL and Redis using your OS package manager or vendor installers.

## Setup

Frontend and backend are independent npm projects. Each has its own `package.json`, `package-lock.json`, and local `node_modules/`. Run from the repository root:

```bash
npm --prefix backend ci
npm --prefix frontend ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Create a dedicated database role. For Linux peer authentication:

```bash
sudo -u postgres psql
```

On other installations connect using `psql -U <admin> -d postgres`. Inside psql:

```sql
CREATE ROLE ecommerce LOGIN;
\password ecommerce
CREATE DATABASE ecommerce OWNER ecommerce;
\q
```

The password command prompts without putting the password in shell history.

Edit `backend/.env`:

- Set `DATABASE_URL` with your role, chosen password, host, port, and database. Percent-encode special characters in URL passwords.
- Set `REDIS_URL` to your local Redis instance, including authentication if required.
- Generate `JWT_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste the result.
- Set `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` (at least 8 characters, at most 72 bytes).
- Keep `FRONTEND_ORIGIN` aligned with the browser URL, initially `http://localhost:5173`.

Example secrets are placeholders and must be replaced. Git ignores `.env` files. Frontend `VITE_` variables are public: never put secrets in them.

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
```

Migrations are transactional and recorded in `schema_migrations`. The seed adds three products, a bcrypt-hashed demo user, and a delivered sample order. Repeating seed does not duplicate products or orders; it updates the configured user's password. Changing the seed email creates another user and sample order.

## Run

In one terminal:

```bash
npm --prefix backend run dev
```

In a second terminal:

```bash
npm --prefix frontend run dev
```

Open **http://localhost:5173**. Browse Products and sign in with your configured seed credentials to view Orders. Login is held in memory, so refreshing signs you out. Tokens expire after one hour.

## Verify and build

```bash
npm --prefix backend test
npm --prefix frontend run build
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/products
curl -i http://localhost:3000/api/products
```

Tests exercise API behavior with isolated database/cache doubles; no external services are required. The curl checks validate your live connections after migrations and seeding. Products show `X-Cache: MISS` followed by `HIT` while Redis is available; an existing cache may make both hits.

Start the backend without watching using `npm --prefix backend start`. Frontend build output is `frontend/dist`. To check that build locally:

```bash
npm --prefix frontend run preview
```

Preview defaults to port 4173. Set `FRONTEND_ORIGIN=http://localhost:4173` in the backend environment and restart the API. Preview is a local build check, not a production web server. The API URL is embedded at frontend build time.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/health` | 200 when PostgreSQL and Redis respond; 503 with dependency status otherwise |
| GET | `/api/products` | Public catalog; `{ products: [...] }` |
| POST | `/api/login` | JSON email/password; returns token, safe user fields, and expiry |
| GET | `/api/orders` | Requires `Authorization: Bearer <token>`; returns only that user's orders |

Prices use integer USD cents. Order items preserve purchase prices. Login is limited to ten attempts per minute per IP in process memory. Invalid input returns 400, invalid credentials 401, unknown routes 404, and unexpected failures a generic 500. Requests log method, path, status, and duration without bodies or tokens.

Redis caches products for 60 seconds by default. Cache failures fall back to PostgreSQL while health reports degraded. After manually editing products, wait for the TTL or delete only `ecommerce:products:v1` through your Redis connection. PostgreSQL outages prevent database-backed requests; a cached catalog may remain available. SIGINT/SIGTERM closes HTTP and service connections.

## Structure and scope

- `frontend/`: React pages and Vite configuration; [frontend guide](frontend/README.md)
- `backend/src/`: API, configuration, database and Redis clients; [backend guide](backend/README.md)
- `backend/migrations/`: versioned PostgreSQL schema
- `backend/scripts/`: migration runner and repeatable seed
- `backend/test/`: HTTP behavior tests

There is no registration, cart, checkout, payment, or order creation. Orders come from seed data. This is a production-like training baseline, not a complete commercial store. Future exercises can add TLS, managed secrets, distributed rate limiting, deployment, and monitoring.

## Troubleshooting

- Connection refused: start PostgreSQL/Redis and check environment hosts and ports.
- Database authentication error: verify role password and URL encoding.
- Missing tables: run migrations against the same database used by the API.
- Empty data: run seed and sign in as that user.
- Redis health down: check `REDIS_URL`; the client retries automatically.
- Browser network/CORS errors: align `VITE_API_BASE_URL` and `FRONTEND_ORIGIN`, then restart.
- Port occupied: stop the conflicting process or change ports and matching URLs. Vite uses a strict development port.
