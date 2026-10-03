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
