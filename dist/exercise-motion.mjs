// Which demonstration (see MOTIONS in src/body3d.mjs) to play for an exercise name, Thai or English.
// First match wins, so narrower patterns (split squat, pushdown) come before broader ones.
const RULES = [
 ['lunge', /lunge|split squat|ลันจ์|สปลิต/i],
 ['deadlift', /deadlift|good morning|เดดลิฟ/i],
 ['squat', /squat|สควอ?[ตท]|กอบเล็ต/i],
 ['pushdown', /push.?down|พุชดาวน์/i],
 ['overheadExtension', /^(?!.*(lying|skull|kickback)).*(overhead|french).*(tricep|extension)|เหยียดแขน/i],
 ['pushup', /push.?up|วิดพื้น/i],
 ['pullup', /pull.?up|chin.?up|pulldown|pull.?down|ดึงข้อ|พูลดาวน์/i],
 ['shoulderPress', /shoulder press|overhead press|military press|arnold press|push press|\bohp\b|โชลเดอร์เพรส|ดันไหล่/i],
 ['lateralRaise', /lateral raise|side raise|เลเทอรัล|ยกข้าง/i],
 ['bench', /bench press|chest press|เบนช์|เชสต์เพรส|ดันอก|(incline|decline|floor).*press/i],
 ['row', /^(?!.*(upright|rowing|machine row)).*\b(row|rows)\b|โรว์/i],
 ['curl', /^(?!.*(leg|hamstring|nordic|wrist|crunch)).*curl|เคิร์ล|ไบเซ|หน้าแขน/i],
 ['crunch', /crunch|sit.?up|ครันช์|ซิทอัพ/i],
];
export function motionFor(name) {
 name = (name || '').trim();
 return RULES.find(([, re]) => re.test(name))?.[0] ?? null;
}
