// A strength set is counted either in reps or, for holds like a plank, in seconds.
// Records, plan items and set logs carry `seconds` (1–3600) instead of `reps` when timed.
export const MAX_SECONDS=3600;
export const isTimed=x=>x!=null&&x.seconds!=null;
// Exercises that are held rather than repeated start out timed.
const TIMED_NAME=/plank|แพลงก์|แพลงค์|wall sit|hold|hollow|dead hang|l-sit|side bridge|isometric|วอลซิท/i;
export const looksTimed=name=>TIMED_NAME.test(String(name||''));
export function formatSeconds(total){
 const s=Math.round(Number(total));if(!Number.isFinite(s))return '';
 if(s<60)return s+' วิ';
 const m=Math.floor(s/60),rest=s%60;return rest?m+':'+String(rest).padStart(2,'0')+' นาที':m+' นาที';
}
// "12 ครั้ง" or "45 วิ"; empty when neither is known.
export function effortText(x){return isTimed(x)?formatSeconds(x.seconds):x?.reps!=null?x.reps+' ครั้ง':'';}
export const validSeconds=v=>Number.isInteger(v)&&v>=1&&v<=MAX_SECONDS;
// Adds a "ครั้ง / วินาที" switch next to a count input. The input keeps the number; the switch says what it counts.
export function attachEffortUnit(input,{label,host=label||input.parentElement,repsText='ครั้ง',secondsText='วินาที'}={}){
 const select=document.createElement('select');select.className='effort-unit';select.setAttribute('aria-label','นับเป็นครั้งหรือวินาที');
 for(const [value,text] of [['reps',repsText],['seconds',secondsText]]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 const baseLabel=label?.firstChild?.nodeType===3?label.firstChild.textContent:null;select.value='reps';
 const apply=()=>{const timed=select.value==='seconds';input.max=timed?MAX_SECONDS:1000;input.step=1;
  if(baseLabel!=null)label.firstChild.textContent=timed?baseLabel.replace(/ครั้ง/g,'วินาที'):baseLabel;};
 select.addEventListener?.('change',apply);host?.append(select);apply();
 return {select,timed:()=>select.value==='seconds',set(timed){select.value=timed?'seconds':'reps';apply();},
  // {reps} or {seconds} from the input, null when empty
  read(){const n=input.value===''?null:Number(input.value);return select.value==='seconds'?{reps:null,seconds:n}:{reps:n};}};
}
