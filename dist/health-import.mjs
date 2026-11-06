// Read the Apple Health export (export.zip, or export.xml from it) in the browser, a piece at a time,
// and boil it down to daily totals and workouts. The file itself is never uploaded.
const TYPES={
 HKQuantityTypeIdentifierStepCount:'steps',
 HKQuantityTypeIdentifierActiveEnergyBurned:'activeKcal',
 HKQuantityTypeIdentifierAppleExerciseTime:'exerciseMin',
 HKQuantityTypeIdentifierDistanceWalkingRunning:'distanceKm',
 HKQuantityTypeIdentifierRestingHeartRate:'restingHr',
 HKQuantityTypeIdentifierBodyMass:'weight',
 HKCategoryTypeIdentifierSleepAnalysis:'sleepMin',
};
const SUMMED=['steps','activeKcal','exerciseMin','distanceKm','sleepMin'];
const attrs=line=>{const out={};for(const m of line.matchAll(/(\w+)="([^"]*)"/g))out[m[1]]=m[2];return out;};
// "2024-01-01 08:00:00 +0700" → "2024-01-01T08:00:00+07:00"
export const isoDate=s=>{const m=/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(s||'');return m?m[1]+'T'+m[2]+m[3]+':'+m[4]:null;};
const minutesBetween=(a,b)=>(Date.parse(isoDate(b))-Date.parse(isoDate(a)))/60000;
const unitNumber=(value,unit)=>{const n=Number(value);if(!Number.isFinite(n))return null;
 if(unit==='kJ')return n/4.184;if(unit==='mi')return n*1.609344;if(unit==='m')return n/1000;if(unit==='lb')return n*0.45359237;if(unit==='g')return n/1000;if(unit==='hr')return n*60;if(unit==='s')return n/60;return n;};

// Feed it the export one line at a time. iPhone and Watch both count steps, so sums are kept per source
// and the day takes the biggest source rather than adding them together (close to what the Health app shows).
export function createHealthAggregator(){
 const days=new Map(),workouts=[];let open=null;
 const day=d=>{if(!days.has(d))days.set(d,{sums:{},hr:[],weight:null});return days.get(d);};
 function line(text){
  if(open){
   if(text.includes('<WorkoutStatistics')){const a=attrs(text),n=unitNumber(a.sum,a.unit);if(n!=null){if(a.type==='HKQuantityTypeIdentifierActiveEnergyBurned')open.kcal=n;else if(/Distance/.test(a.type||''))open.distanceKm=n;}}
   if(text.includes('</Workout>')){workouts.push(open);open=null;}
   return;
  }
  if(text.includes('<Workout ')){
   const a=attrs(text),start=isoDate(a.startDate);if(!start)return;
   const w={activity:a.workoutActivityType,start,day:a.startDate.slice(0,10),durationMin:unitNumber(a.duration,a.durationUnit)??minutesBetween(a.startDate,a.endDate),distanceKm:a.totalDistance?unitNumber(a.totalDistance,a.totalDistanceUnit):null,kcal:a.totalEnergyBurned?unitNumber(a.totalEnergyBurned,a.totalEnergyBurnedUnit):null,source:a.sourceName||null};
   if(/\/>\s*$/.test(text))workouts.push(w);else open=w;
   return;
  }
  if(!text.includes('<Record '))return;
  const type=/type="([^"]+)"/.exec(text)?.[1],field=TYPES[type];if(!field)return;
  const a=attrs(text);
  if(field==='sleepMin'){
   if(!/Asleep/.test(a.value||''))return;
   const d=day((a.endDate||'').slice(0,10)),src=a.sourceName||'?',m=minutesBetween(a.startDate,a.endDate);
   if(Number.isFinite(m)&&m>0)(d.sums.sleepMin??={})[src]=(d.sums.sleepMin[src]||0)+m;
   return;
  }
  const n=unitNumber(a.value,a.unit),date=(a.startDate||'').slice(0,10);if(n==null||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const d=day(date);
  if(field==='restingHr')d.hr.push(n);
  else if(field==='weight'){if(!d.weight||a.startDate>=d.weight.at)d.weight={at:a.startDate,n};}
  else{const src=a.sourceName||'?';(d.sums[field]??={})[src]=(d.sums[field][src]||0)+n;}
 }
 function result(){
  const out=[];
  for(const [date,d] of [...days].sort(([a],[b])=>a.localeCompare(b))){
   const row={day:date};
   for(const f of SUMMED){const bySource=d.sums[f];row[f]=bySource?Math.max(...Object.values(bySource)):null;}
   row.restingHr=d.hr.length?d.hr.reduce((a,b)=>a+b,0)/d.hr.length:null;row.weight=d.weight?.n??null;
   for(const k of Object.keys(row))if(typeof row[k]==='number')row[k]=Math.round(row[k]*100)/100;
   if(Object.entries(row).some(([k,v])=>k!=='day'&&v!=null))out.push(row);
  }
  return {days:out,workouts};
 }
 return {line,result};
}

// Split a text stream into lines and hand each to the aggregator.
async function eachLine(stream,onLine){
 const reader=stream.pipeThrough(new TextDecoderStream()).getReader();let rest='';
 for(;;){const {value,done}=await reader.read();if(done)break;const parts=(rest+value).split('\n');rest=parts.pop();for(const p of parts)onLine(p);}
 if(rest)onLine(rest);
}
// Bytes passing through, for the progress bar.
const counter=(total,onProgress)=>{let seen=0,last=0;return new TransformStream({transform(chunk,c){seen+=chunk.byteLength;const p=total?seen/total:0;if(p-last>=.01){last=p;onProgress?.(Math.min(1,p));}c.enqueue(chunk);}});};

// Find export.xml inside export.zip without loading the whole zip (zip64 included, which large exports use).
export async function exportXmlStream(file){
 if(/\.xml$/i.test(file.name||''))return {stream:file.stream(),size:file.size};
 const tailLen=Math.min(file.size,65557+20),tailStart=file.size-tailLen,tail=new DataView(await file.slice(tailStart).arrayBuffer());
 let eocd=-1;for(let i=tail.byteLength-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50){eocd=i;break;}
 if(eocd<0)throw Error('ไฟล์นี้ไม่ใช่ export.zip ของแอป Health');
 let cdSize=tail.getUint32(eocd+12,true),cdOffset=tail.getUint32(eocd+16,true);
 if(cdOffset===0xffffffff||cdSize===0xffffffff){
  const loc=eocd-20;if(loc<0||tail.getUint32(loc,true)!==0x07064b50)throw Error('อ่านไฟล์ zip ไม่ได้');
  const z=new DataView(await file.slice(Number(tail.getBigUint64(loc+8,true)),Number(tail.getBigUint64(loc+8,true))+56).arrayBuffer());
  cdSize=Number(z.getBigUint64(40,true));cdOffset=Number(z.getBigUint64(48,true));
 }
 const cd=new DataView(await file.slice(cdOffset,cdOffset+cdSize).arrayBuffer()),names=new TextDecoder();
 for(let p=0;p+46<=cd.byteLength&&cd.getUint32(p,true)===0x02014b50;){
  const method=cd.getUint16(p+10,true),nameLen=cd.getUint16(p+28,true),extraLen=cd.getUint16(p+30,true),commentLen=cd.getUint16(p+32,true);
  let comp=cd.getUint32(p+20,true),plain=cd.getUint32(p+24,true),local=cd.getUint32(p+42,true);
  const name=names.decode(new Uint8Array(cd.buffer,cd.byteOffset+p+46,nameLen));
  for(let e=p+46+nameLen;e+4<=p+46+nameLen+extraLen;){const id=cd.getUint16(e,true),len=cd.getUint16(e+2,true);if(id===1){let q=e+4;if(plain===0xffffffff){plain=Number(cd.getBigUint64(q,true));q+=8;}if(comp===0xffffffff){comp=Number(cd.getBigUint64(q,true));q+=8;}if(local===0xffffffff){local=Number(cd.getBigUint64(q,true));}}e+=4+len;}
  if(/(^|\/)export\.xml$/.test(name)){
   const head=new DataView(await file.slice(local,local+30).arrayBuffer()),start=local+30+head.getUint16(26,true)+head.getUint16(28,true);
   const raw=file.slice(start,start+comp).stream();
   if(method===0)return {stream:raw,size:comp};
   if(method!==8)throw Error('ไฟล์ zip ใช้การบีบอัดแบบที่อ่านไม่ได้');
   if(typeof DecompressionStream==='undefined')throw Error('เบราว์เซอร์นี้แตกไฟล์ zip ไม่ได้ ให้แตกไฟล์ในแอปไฟล์ แล้วเลือก export.xml แทน');
   return {stream:raw,size:comp,inflate:true};
  }
  p+=46+nameLen+extraLen+commentLen;
 }
 throw Error('ไม่พบ export.xml ในไฟล์ zip นี้');
}

export async function readHealthExport(file,onProgress){
 const {stream,size,inflate}=await exportXmlStream(file),agg=createHealthAggregator();
 let s=stream.pipeThrough(counter(size,onProgress));if(inflate)s=s.pipeThrough(new DecompressionStream('deflate-raw'));
 await eachLine(s,agg.line);onProgress?.(1);
 return agg.result();
}
