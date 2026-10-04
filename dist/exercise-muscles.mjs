// Muscles each exercise works, in the 3D model's base muscle names (see scripts/body-anatomy.mjs):
// pec, deltoid, biceps, triceps, flexor (forearm), trap, lat, erector, abs, oblique, serratus,
// glute, quad, hamstring, adductor, calf, tibialis. p = primary, s = secondary.
const E = (p, s = []) => ({primary: p, secondary: s});
const WALK = E(['quad', 'glute', 'calf'], ['hamstring', 'tibialis']);
const BENCH = E(['pec'], ['triceps', 'deltoid']);
const FLY = E(['pec'], ['deltoid']);
const PULLDOWN = E(['lat'], ['biceps', 'trap', 'flexor']);
const ROW = E(['lat', 'trap'], ['biceps', 'deltoid', 'erector']);
const PRESS = E(['deltoid'], ['triceps', 'trap']);
const CURL = E(['biceps'], ['flexor']);
const TRICEPS = E(['triceps']);
const CRUNCH = E(['abs'], ['oblique']);

export const EXERCISE_MUSCLES = {
 'เดินชัน': E(['glute', 'hamstring', 'calf'], ['quad', 'erector']), 'เดินเร็ว': WALK, 'วิ่ง': E(['quad', 'calf', 'hamstring', 'glute'], ['abs']),
 'ปั่นจักรยาน': E(['quad', 'glute'], ['calf', 'hamstring']), 'เครื่องเดินวงรี': E(['quad', 'glute', 'hamstring'], ['calf', 'lat']),
 'ขึ้นบันได': E(['quad', 'glute'], ['calf', 'hamstring']), 'ว่ายน้ำ': E(['lat', 'deltoid', 'pec'], ['triceps', 'abs', 'quad']),
 'กระโดดเชือก': E(['calf'], ['quad', 'deltoid']), 'Treadmill': WALK, 'Stationary Bike': E(['quad', 'glute'], ['calf', 'hamstring']),
 'Rowing Machine': E(['lat', 'quad', 'glute'], ['hamstring', 'biceps', 'trap', 'erector']), 'Elliptical': E(['quad', 'glute', 'hamstring'], ['calf', 'lat']),
 'Jump Rope': E(['calf'], ['quad', 'deltoid']),
 'Barbell Squat': E(['quad', 'glute'], ['adductor', 'hamstring', 'erector']), 'Goblet Squat': E(['quad', 'glute'], ['abs', 'adductor']),
 'Leg Press': E(['quad', 'glute'], ['hamstring', 'adductor']), 'Leg Extension': E(['quad']), 'Leg Curl': E(['hamstring'], ['calf']),
 'Romanian Deadlift': E(['hamstring', 'glute'], ['erector', 'lat']), 'Deadlift': E(['hamstring', 'glute', 'erector'], ['quad', 'trap', 'lat', 'flexor']),
 'Lunge': E(['quad', 'glute'], ['hamstring', 'adductor', 'calf']), 'Bulgarian Split Squat': E(['quad', 'glute'], ['hamstring', 'adductor']),
 'Hip Thrust': E(['glute'], ['hamstring']), 'Glute Bridge': E(['glute'], ['hamstring']), 'Calf Raise': E(['calf']),
 'Barbell Bench Press': BENCH, 'Dumbbell Bench Press': BENCH, 'Incline Dumbbell Press': E(['pec', 'deltoid'], ['triceps']),
 'Chest Press Machine': BENCH, 'Cable Fly': FLY, 'Pec Deck Fly': FLY, 'Push-up': E(['pec'], ['triceps', 'deltoid', 'abs']),
 'Lat Pulldown': PULLDOWN, 'Pull-up': PULLDOWN, 'Assisted Pull-up': PULLDOWN,
 'Seated Cable Row': ROW, 'Dumbbell Row': ROW, 'Barbell Row': ROW,
 'Face Pull': E(['deltoid', 'trap'], ['biceps']), 'Rear Delt Fly': E(['deltoid'], ['trap']),
 'Dumbbell Shoulder Press': PRESS, 'Overhead Press': E(['deltoid'], ['triceps', 'trap', 'abs']), 'Lateral Raise': E(['deltoid'], ['trap']),
 'Dumbbell Biceps Curl': CURL, 'Barbell Biceps Curl': CURL, 'Hammer Curl': E(['biceps', 'flexor']),
 'Triceps Pushdown': TRICEPS, 'Overhead Triceps Extension': TRICEPS, 'Dips': E(['triceps', 'pec'], ['deltoid']),
 'Plank': E(['abs'], ['oblique', 'deltoid', 'glute']), 'Crunch': CRUNCH, 'Cable Crunch': CRUNCH,
 'Hanging Leg Raise': E(['abs'], ['oblique', 'flexor']), 'Russian Twist': E(['oblique'], ['abs']),
};

// Custom names: match keywords (Thai or English) to the closest pattern.
const KEYWORDS = [
 [/calf|น่อง|เขย่ง/i, E(['calf'])], [/squat|สควอ?[ตท]/i, EXERCISE_MUSCLES['Barbell Squat']], [/deadlift|เดดลิฟ/i, EXERCISE_MUSCLES['Deadlift']],
 [/lunge|ลันจ์/i, EXERCISE_MUSCLES['Lunge']], [/leg press|เลกเพรส/i, EXERCISE_MUSCLES['Leg Press']], [/leg curl|งอขา|หลังขา/i, E(['hamstring'])],
 [/leg extension|เหยียดขา|หน้าขา/i, E(['quad'])], [/hip thrust|bridge|ก้น|สะโพก/i, E(['glute'], ['hamstring'])],
 [/bench|chest|push.?up|วิดพื้น|อก/i, BENCH], [/fly|ฟลาย/i, FLY], [/pull.?up|chin|pulldown|ดึงข้อ/i, PULLDOWN], [/row|โรว์|พาย/i, ROW],
 [/shoulder|overhead press|military|ไหล่/i, PRESS], [/lateral|rear delt/i, E(['deltoid'], ['trap'])], [/shrug|บ่า/i, E(['trap'])],
 [/curl|ไบเซ|หน้าแขน/i, CURL], [/tricep|ไตรเซ|หลังแขน|dip/i, TRICEPS],
 [/plank|แพลงก์/i, EXERCISE_MUSCLES['Plank']], [/crunch|sit.?up|ซิทอัพ|ท้อง|abs/i, CRUNCH], [/twist|oblique|เอว/i, E(['oblique'], ['abs'])],
 [/run|วิ่ง|jog/i, EXERCISE_MUSCLES['วิ่ง']], [/walk|เดิน|treadmill|ลู่/i, WALK], [/bike|cycl|ปั่น/i, EXERCISE_MUSCLES['ปั่นจักรยาน']], [/swim|ว่าย/i, EXERCISE_MUSCLES['ว่ายน้ำ']],
];
export function musclesFor(name, aliases = '') {
 const exact = EXERCISE_MUSCLES[name?.trim()];
 if (exact) return exact;
 const text = (name || '') + ' ' + aliases;
 return KEYWORDS.find(([re]) => re.test(text))?.[1] ?? null;
}
export const MUSCLE_LABELS = {pec: 'อก', deltoid: 'ไหล่', biceps: 'ต้นแขนหน้า', triceps: 'ต้นแขนหลัง', flexor: 'แขนท่อนล่าง', trap: 'บ่า', lat: 'ปีกหลัง',
 erector: 'หลังล่าง', abs: 'หน้าท้อง', oblique: 'ข้างท้อง', serratus: 'ซี่โครงข้าง', glute: 'ก้น', quad: 'ต้นขาหน้า', hamstring: 'ต้นขาหลัง',
 adductor: 'ต้นขาด้านใน', calf: 'น่อง', tibialis: 'หน้าแข้ง'};
