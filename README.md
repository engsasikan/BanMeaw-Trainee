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

## Exercise library

The exercise picker includes 1,316 exercises from [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (names and muscle data, MIT License, © 2026 Hasan Emir Yıldırım). The dataset's images and GIFs belong to Gym visual and are not used. To regenerate `dist/exercise-library.mjs`:

```
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset.git work/exercises-dataset
node scripts/build-exercise-library.mjs
```

## Body shape data

When a girth was not measured, the 3D body uses what people of the same sex, height, weight and body fat usually measure (`src/girth-model.mjs`, built by `scripts/build-girth-model.mjs`):

- **ANSUR II** (US Army anthropometric survey, public data; 1,986 women and 4,082 men): chest, waist, hip, thigh, calf, upper arm, plus chest/waist breadth and depth, hip breadth, buttock depth and navel height, from height, weight and age. https://www.openlab.psu.edu/ansur2/
- **Body fat, men**: Kaggle `fedesoriano/body-fat-prediction-dataset` (252 men, body fat by underwater weighing): how girths change with body fat at the same height and weight.
- **Body fat, women**: the US Navy body-fat formula, applied to the difference from the usual body fat for that BMI (Deurenberg 1991).

The body is fitted to all of these at once (MakeHuman's weight macro plus bust, breast, torso, hip, buttock, thigh, calf and arm shape targets, each kept within its designed range), measured like a tape on the mesh. Only fitted coefficients are shipped, not the raw data.
