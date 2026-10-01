# React storefront

Products, Login, and Orders views with loading, empty, and error states. Uses in-memory login and plain CSS.

Follow the [root guide](../README.md). Copy [.env.example](.env.example) to `.env` and set `VITE_API_BASE_URL` to your API origin. This public variable must not contain secrets.

From this directory:

```bash
npm run dev
npm run build
npm run preview
```

Development uses `http://localhost:5173`; preview uses `http://localhost:4173`. Match the API's `FRONTEND_ORIGIN` to the browser origin. Keep the API running in both modes.

Build output is `dist/`. API configuration is embedded during build; rebuild after changes. Refresh clears login. Expired tokens send you to Login. Orders display seed records; there is no checkout or order creation.
