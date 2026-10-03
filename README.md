# BanMeaw Trainee

Thai meal and workout diary with an orange fitness-cat theme, desktop dashboard and iPhone home-screen support.

- Email/password signup, signin, signout and email verification through Neon Auth
- Meals and workouts stored in Neon PostgreSQL through a Cloudflare Worker API
- User-scoped records and revision checks to prevent stale edits
- Searchable Thai/English exercise picker, weights, sets and reps
- Daily dashboard, seven-day activity summary, JSON export/import
- Explicit import of old browser records into a signed-in account

Read [SETUP.md](SETUP.md) before deployment. DATABASE_URL and NEON_AUTH_BASE_URL must be configured on the Worker. Code and packaging tests do not verify live signup or a real database connection.

```sh
npm ci
npm run build
npm test
npm run dev
```

Cloudflare build settings: root /, no build command needed with the committed browser bundle, deploy command npx wrangler deploy. Rebuild and commit dist/account.js after changes to its source or dependencies.

New accounts default to trainee. Administrator bootstrap requires a verified ADMIN_EMAIL. Trainer assignment/views and AI evaluation remain future work. Never commit database credentials or passwords.
