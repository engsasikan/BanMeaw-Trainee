# BanMeaw Trainee

A Thai fitness diary with a dark charcoal and orange theme, designed for desktop and iPhone home-screen use.

## Current features

- Text meal logging by date, meal type and optional time
- Workout logging with searchable exercise selection, weight, sets and reps
- Dashboard with daily counts and a seven-day activity chart
- JSON backup export and import
- Web app manifest and fitness-cat icons

## Run locally

Serve the `dist` directory using any static HTTP server. For example, with Node.js installed:

```sh
npx serve dist
```

## Data and deployment status

This version stores records in browser localStorage on each device. Shared data, login, Admin/Trainer/Trainee permissions and AI evaluation are not implemented yet.

Neon configuration is included as an initial setup only. No database connection or database migration has been deployed. Cloudflare Workers hosting for the new application is planned but not configured in this version.

Do not commit environment files or database credentials.

## Cloudflare Workers deployment

The root `wrangler.jsonc` serves the existing `dist` folder as static assets. In Workers Builds use:

- Root directory: `/`
- Build command: leave empty
- Deploy command: `npx wrangler deploy`

For local preview use `npx wrangler dev`. Validate packaging without publishing using `npx wrangler deploy --dry-run`.

## Neon connection setup (pending)

1. In Cloudflare select the Worker > Settings > Variables and Secrets.
2. Add a Secret named `DATABASE_URL` using the pooled Neon connection string.
3. Keep this value out of Git and browser JavaScript.
4. Authenticate the local Neon CLI with `neon login` to enable controlled schema setup.

`db/001_initial.sql` is the proposed initial schema. It has not been applied. Database-backed APIs and identity enforcement must be implemented before records are shared. Do not expose an unauthenticated diary endpoint or treat a browser-supplied user ID as identity.
