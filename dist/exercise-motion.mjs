// Which demonstration (see MOTIONS in src/body3d.mjs) to play for an exercise name, Thai or English.
// First match wins, so narrower patterns (stretches, split squat, pushdown) come before broader ones.
const RULES = [
 // Stretches first: 'Calf Stretch' is not a calf raise, 'Triceps Stretch' is not an extension.
 ['lyingFigure4', /lying.*piriformis|piriformis.*lying|figure.?(4|four)|ยืดสะโพกนอน/i],
 ['kneeToChest', /(lying glutes?|knee to chest|roller hip) stretch|knee.?to.?chest|กอดเข่า/i],
 ['seatedFigure4', /(glute|gluteus|piriformis).*stretch|ยืดก้น/i],
 ['seatedHamstring', /chair leg extended|seated.*hamstring.*stretch/i],
 ['ironCross', /iron cross/i],
 ['rockingFrog', /frog/i],
 ['worldGreatest', /world.?s? greatest/i],
 ['kneeCircles', /knee circles|circles knee/i],
 ['rollerBack', /roller back/i],
 ['quadStretch', /(quad|rectus femoris|hip flexor).*stretch|ยืดต้นขาหน้า/i],
 ['hamstringStretch', /(hamstring|runners|lower back|spine|toe touch).*stretch|stretch.*hamstring|ยืดต้นขาหลัง|ยืดหลังขา/i],
 ['calfStretch', /(calf|calves|peroneals|tibialis|achilles).*stretch|ยืดน่อง/i],
 ['tricepsStretch', /tricep.*stretch|ยืดหลังแขน/i],
 ['chestStretch', /(chest|pec|pectoral).*stretch|ยืดอก/i],
 ['shoulderStretch', /(rear delt|deltoid|shoulder|upper back|cross.?body).*stretch|ยืดไหล่/i],
 ['neckStretch', /neck.*stretch|ยืดคอ/i],
 ['sideStretch', /(lateral|side|lat|oblique).*stretch|ยืดข้างลำตัว|ยืดเอว/i],
 ['lunge', /lunge|split squat|ลันจ์|สปลิต/i],
 ['kettlebellSwing', /swing|สวิง/i],
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
