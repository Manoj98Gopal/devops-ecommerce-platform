# Application Discovery – DevOps Handover

## 1. Application Overview

**Application:** DevOps E-commerce Platform

**Architecture:**

```text
Frontend → Backend API → PostgreSQL
                     └→ Redis
```

### Components

| Component | Technology        | Purpose                     |
| --------- | ----------------- | --------------------------- |
| Frontend  | React + Vite      | User interface              |
| Backend   | Node.js + Express | REST API                    |
| Database  | PostgreSQL        | Persistent application data |
| Cache     | Redis             | Product caching             |

---

## 2. Repository Structure

```text
devops-ecommerce-platform/
├── frontend/
│   ├── package.json
│   ├── package-lock.json
│   ├── node_modules/ (local, ignored)
│   └── dist/ (build output, ignored)
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── node_modules/ (local, ignored)
└── docs/
```

Frontend and backend are independent npm projects. Install each with `npm ci` in its own directory. The backend runs JavaScript directly and does not require a compiled build. Commands below run from the repository root.

---

## 3. Runtime Requirements

| Requirement | Version  |
| ----------- | -------- |
| Node.js     | >= 22.12 |
| PostgreSQL  | >= 14    |
| Redis       | >= 6     |

---

## 4. Application Ports

| Component   | Port | Configuration  |
| ----------- | ---: | -------------- |
| Frontend    | 5173 | Vite           |
| Backend API | 3000 | `PORT`         |
| PostgreSQL  | 5432 | `DATABASE_URL` |
| Redis       | 6379 | `REDIS_URL`    |

> Ports are configurable where supported; these are the current local defaults.

---

## 5. Backend API

| Method | Endpoint        | Purpose         | Dependency         |
| ------ | --------------- | --------------- | ------------------ |
| GET    | `/api/health`   | Health check    | PostgreSQL + Redis |
| GET    | `/api/products` | Product catalog | PostgreSQL + Redis |
| POST   | `/api/login`    | Authentication  | PostgreSQL         |
| GET    | `/api/orders`   | User orders     | PostgreSQL         |

---

## 6. Infrastructure Dependencies

### PostgreSQL

Primary persistent data store.

Database:

```text
Database: ecommerce
User: ecommerce
Host: localhost
Port: 5432
```

Used for:

* Users
* Products
* Orders
* Order items

Database schema is managed through versioned migrations.

### Redis

Used as a cache for the product catalog.

```text
Host: localhost
Port: 6379
Cache key: ecommerce:products:v1
Default TTL: 60 seconds
```

Redis is **not the primary data store**.

If Redis is unavailable, product requests can fall back to PostgreSQL, while the health endpoint reports the dependency as degraded.

---

## 7. Configuration / Environment Variables

### Backend

```text
NODE_ENV
PORT
FRONTEND_ORIGIN
DATABASE_URL
REDIS_URL
JWT_SECRET
PRODUCT_CACHE_TTL_SECONDS
SEED_USER_EMAIL
SEED_USER_PASSWORD
```

### Frontend

```text
VITE_API_BASE_URL
```

Secrets must be provided through environment configuration and must not be committed to Git.

---

## 8. Database Operations

### Migration

```bash
npm --prefix backend run db:migrate
```

Purpose:

```text
Create/update database schema
```

### Seed

```bash
npm --prefix backend run db:seed
```

Purpose:

```text
Insert development/demo data
```

Migration state is tracked using:

```text
schema_migrations
```

---

## 9. Application Commands

### Start Backend

```bash
npm --prefix backend run dev
```

### Start Frontend

```bash
npm --prefix frontend run dev
```

### Test

```bash
npm --prefix backend test
```

### Build Frontend

```bash
npm --prefix frontend run build
```

---

## 10. Health & Verification

Health endpoint:

```bash
curl -i http://localhost:3000/api/health
```

Expected behavior:

```text
PostgreSQL + Redis available → HTTP 200
Dependency unavailable        → HTTP 503
```

Product verification:

```bash
curl -i http://localhost:3000/api/products
```

The product API exposes:

```text
X-Cache: HIT
X-Cache: MISS
```

to indicate Redis cache behavior.

---

## 11. Current Infrastructure State

### Host

```text
Ubuntu 24.04.4 LTS
```

### Docker

```text
Docker 29.6.1
```

Docker daemon is running.

### Existing container

```text
linux-system
```

Ports already used by this container:

```text
2222 → container 22
8080 → container 80
```

### Current application infrastructure

```text
PostgreSQL → not currently running
Redis      → not currently running
```

Required application ports `5432` and `6379` are currently available.

---

## 12. Operational Notes

* PostgreSQL is the source of truth for application data.
* Redis is a performance/cache layer.
* Backend health depends on both PostgreSQL and Redis.
* Frontend API URL is configured using `VITE_API_BASE_URL`.
* Backend CORS configuration uses `FRONTEND_ORIGIN`.
* Frontend API configuration is embedded during the build.
* `.env` files contain environment-specific configuration/secrets and must not be committed.
* Database schema changes must be made through migrations.
