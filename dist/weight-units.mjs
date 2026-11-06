const POUNDS_PER_KG=1/0.45359237;
export function preferredWeightUnit(){try{return localStorage.getItem('workout-weight-unit')==='lb'?'lb':'kg';}catch{return 'kg';}}
export function toKg(value,unit){return value==null||value===''?null:Number(value)*(unit==='lb'?0.45359237:1);}
export function fromKg(value,unit){return value==null?'':Number((value*(unit==='lb'?POUNDS_PER_KG:1)).toFixed(2));}
export function formatWeight(value,unit=preferredWeightUnit()){return value==null?'ไม่ระบุ':value===0?'น้ำหนักตัว':fromKg(value,unit)+' '+unit+' / '+fromKg(value,unit==='lb'?'kg':'lb')+' '+(unit==='lb'?'kg':'lb');}
export function attachWeightUnit(input,host=input.parentElement){
 const label=document.createElement('label'),select=document.createElement('select');label.textContent='หน่วยน้ำหนัก';select.setAttribute('aria-label','หน่วยน้ำหนักที่ยก');
 for(const [value,text] of [['kg','kg · กิโลกรัม'],['lb','lb · ปอนด์']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 select.value=preferredWeightUnit();for(const option of select.children)option.defaultSelected=option.selected;let unit=select.value;label.append(select);host.append(label);
 const limits=()=>{input.max=fromKg(2000,unit);input.step='any';};limits();
 select.addEventListener('change',()=>{const kg=toKg(input.value,unit);unit=select.value;for(const option of select.children)option.defaultSelected=option.selected;input.value=fromKg(kg,unit);limits();try{localStorage.setItem('workout-weight-unit',unit);}catch{}window.dispatchEvent(new Event('workout-weight-unit'));});
 return {read:()=>toKg(input.value,unit),set:value=>{input.value=fromKg(value,unit);},select};
}
