# Express API

Follow the [root guide](../README.md) to configure PostgreSQL, Redis, and `backend/.env`. Install dependencies at the root with `npm ci`.

From this directory:

```bash
npm run db:migrate
npm run db:seed
npm run dev
npm test
npm start
```

`dev` watches files; `start` runs without watching. Environment loading always resolves `backend/.env`. Restart after environment changes.

Required runtime variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (32+ characters), and `FRONTEND_ORIGIN`. `PORT` defaults to 3000; `PRODUCT_CACHE_TTL_SECONDS` defaults to 60. Seed-only variables are `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`. See [.env.example](.env.example).

Add ordered SQL migrations such as `002_add_inventory.sql`. Do not edit applied files. The runner uses an advisory lock to serialize migrations and rolls back the batch on failure. There is no rollback command; use a new migration for schema changes.

JWT verification supplies the user ID for orders; request user IDs are ignored. Queries parameterize user input. Redis failures fall back to PostgreSQL for products. Tests use doubles; follow the root curl checks to validate real services.
