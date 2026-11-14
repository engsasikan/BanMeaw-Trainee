const POUNDS_PER_KG=1/0.45359237;
export function preferredWeightUnit(){try{return localStorage.getItem('workout-weight-unit')==='lb'?'lb':'kg';}catch{return 'kg';}}
export function toKg(value,unit){return value==null||value===''?null:Number(value)*(unit==='lb'?0.45359237:1);}
export function fromKg(value,unit){return value==null?'':Number((value*(unit==='lb'?POUNDS_PER_KG:1)).toFixed(2));}
export function formatWeight(value,unit=preferredWeightUnit()){return value==null?'ไม่ระบุ':value===0?'น้ำหนักตัว':fromKg(value,unit)+' '+unit+' / '+fromKg(value,unit==='lb'?'kg':'lb')+' '+(unit==='lb'?'kg':'lb');}
export function formatLoggedWeight({weight,weightUnit='kg'}){
 if(weight==null)return 'ไม่ระบุ';if(weight===0)return 'น้ำหนักตัว';
 const n=Number(weight),shown=Number(n.toFixed(2));
 // Older entries typed in lb were stored as raw kg (20 lb → 9.071847400000001 kg); show them as the lb the person typed.
 if(weightUnit!=='lb'&&shown!==n){const lb=n*POUNDS_PER_KG,half=Math.round(lb*2)/2;if(Math.abs(lb-half)<0.01)return half+' lb';}
 return shown+' '+weightUnit;
}
export function attachWeightUnit(input,host=input.parentElement){
 const label=document.createElement('label'),select=document.createElement('select');label.textContent='หน่วยน้ำหนัก';select.setAttribute('aria-label','หน่วยน้ำหนักที่ยก');
 for(const [value,text] of [['kg','kg · กิโลกรัม'],['lb','lb · ปอนด์']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 select.value=preferredWeightUnit();for(const option of select.children)option.defaultSelected=option.selected;label.append(select);host.append(label);
 const limits=()=>{input.max=fromKg(2000,select.value);input.step='any';};limits();
 select.addEventListener('change',()=>{for(const option of select.children)option.defaultSelected=option.selected;limits();try{localStorage.setItem('workout-weight-unit',select.value);}catch{}window.dispatchEvent(new Event('workout-weight-unit'));});
 return {read:()=>({weight:input.value===''?null:Number(input.value),weightUnit:select.value}),set:(value,unit='kg')=>{select.value=unit;input.value=value??'';limits();},select};
}
