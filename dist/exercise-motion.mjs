// Which demonstration (see MOTIONS in src/body3d.mjs) to play for an exercise name, Thai or English.
const RULES = [
 ['squat', /squat|สควอ?[ตท]|กอบเล็ต/i],
 ['bench', /bench press|chest press|เบนช์|เชสต์เพรส|ดันอก|(incline|decline|floor).*(dumbbell|barbell)? ?press/i],
 ['row', /^(?!.*(upright|rowing|machine row)).*\b(row|rows)\b|โรว์/i],
 ['curl', /^(?!.*(leg|hamstring|nordic|wrist|crunch)).*curl|เคิร์ล|ไบเซ|หน้าแขน/i],
 ['crunch', /crunch|sit.?up|ครันช์|ซิทอัพ/i],
];
export function motionFor(name) {
 name = (name || '').trim();
 return RULES.find(([, re]) => re.test(name))?.[0] ?? null;
}
