# Neon + Cloudflare setup

The frontend now requires a signed-in account. API requests use a signed Neon Auth JWT; each record is scoped to that token's user ID. Passwords are handled by Neon Auth, never stored by this app as plaintext or MD5.

## Required configuration

In the Neon production branch, enable **Better Auth**. Add this trusted origin:

`https://banmeaw-trainee.sasikan-esm.workers.dev`

Enable email/password signup. If email verification is required, use the verification code flow offered on the login screen.

In Cloudflare **Worker runtime settings** (not only build settings), set:

| Name | Type | Value |
| --- | --- | --- |
| `DATABASE_URL` | Secret | Pooled PostgreSQL connection string for `banmeaw_trainee` |
| `NEON_AUTH_BASE_URL` | Variable | Branch Auth URL from Neon, including its full path |
| `ADMIN_EMAIL` | Variable, optional | Email of the initial administrator; only a verified email can receive this role |

Never add the database password to Wrangler configuration, Git or browser scripts. After any password rotation, update the runtime Secret too.

On the first authenticated API request, the Worker applies the idempotent, additive initial SQL schema in a transaction. It does not drop tables or reset data. The database role must be permitted to create tables and indexes. Users are inserted with the trainee role by default. Trainer assignment and trainer views are not implemented in this change.

## Deployment and verification

The committed browser bundle permits the existing Cloudflare command `npx wrangler deploy` to continue working. After browser dependency changes, rebuild and commit `dist/account.js`.

```sh
npm ci
npm run build
node --test tests/api.test.mjs
npx wrangler deploy --dry-run
```

After deployment, test two accounts: signup, email verification if enabled, signin, create/edit/delete meals and workouts, logout and signin on another device. Account B must not see account A's records. Stale edits must fail with a conflict instead of replacing newer data. Automated tests use an in-memory query double and do not confirm a live Neon connection.

Old browser records remain under `meal-diary-v1`. After login, **Data > Import local records** copies those records into the current account after confirmation. It keeps the original local data. Bulk imports are per-record, so a failure can leave a partial import; retrying deduplicates already imported IDs. Changes from other devices are loaded on page reload or **Refresh data**.

Missing Auth/database configuration shows a setup message and denies writes. This is not confirmation of a working live database connection.
