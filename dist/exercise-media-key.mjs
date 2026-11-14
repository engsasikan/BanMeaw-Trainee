// Name normalisation shared by the ExerciseDB build script and the app,
// so "3/4 Sit-up" and ExerciseDB's "3/4 sit-up" (or "... (male)") meet on the same key.
export const mediaKey=name=>(name||'').toLowerCase().replace(/\s*\((male|female)\)/g,'').replace(/[^a-z0-9]+/g,' ').trim();
