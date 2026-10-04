import {api} from './account.js?v=2';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const description=g=>Number(g.calories).toLocaleString('th-TH')+' kcal / วัน · โปรตีน '+Number(g.protein).toLocaleString('th-TH')+' กรัม / วัน';
export async function nutritionEditor(root,team,member){
 const path='/api/teams/'+team.id+'/nutrition/'+encodeURIComponent(member.id),box=el('section',undefined,'nutrition-editor'),heading=el('h3','เป้าหมายอาหารของ '+member.display_name),status=el('p','กำลังโหลด…','muted');status.setAttribute('role','status');box.append(heading,status);root.append(box);
 try{const {goal}=await api(path);if(!box.isConnected)return;
 const form=el('form'),calories=el('input'),protein=el('input'),save=el('button','บันทึกเป้าหมาย','primary');
 for(const [input,label,min,max,step,value] of [[calories,'แคลอรีต่อวัน (kcal)',1,20000,1,goal?.calories],[protein,'โปรตีนต่อวัน (กรัม)',0.1,1000,0.1,goal?.protein]]){const field=el('label',label);input.type='number';input.min=min;input.max=max;input.step=step;input.required=true;input.inputMode='decimal';input.value=value??'';field.append(input);form.append(field);}
 status.textContent=goal?'เป้าหมายปัจจุบัน: '+description(goal):'ยังไม่ได้กำหนดเป้าหมายอาหาร';form.append(save);box.append(form);
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;status.textContent='กำลังบันทึก…';try{const result=await api(path,{method:'PUT',body:JSON.stringify({calories:Number(calories.value),protein:Number(protein.value)})});status.textContent='บันทึกแล้ว: '+description(result.goal);}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};
 }catch(error){status.textContent='โหลดเป้าหมายไม่ได้: '+error.message;const retry=el('button','ลองใหม่','quiet');retry.type='button';retry.onclick=()=>{box.remove();nutritionEditor(root,team,member);};box.append(retry);}
}
export function initNutrition(){
 const box=document.getElementById('nutrition-goals');let seq=0;
 async function load(){const request=++seq;box.replaceChildren(el('h3','เป้าหมายอาหารต่อวัน'),el('p','กำลังโหลด…','muted'));
 try{const {goals}=await api('/api/nutrition');if(request!==seq)return;box.replaceChildren(el('h3','เป้าหมายอาหารต่อวัน'));
 if(!goals.length)box.append(el('p','ยังไม่มีเป้าหมายอาหารจากเทรนเนอร์','muted'));
 for(const goal of goals){const card=el('div',undefined,'nutrition-goal');card.append(el('strong',description(goal)),el('p',goal.team_name+' · กำหนดโดย '+goal.trainer_name,'muted'));box.append(card);}
 }catch(error){if(request===seq){box.replaceChildren(el('p','โหลดเป้าหมายไม่ได้: '+error.message,'muted'));const retry=el('button','ลองใหม่','quiet');retry.type='button';retry.onclick=load;box.append(retry);}}
 }
 document.querySelectorAll('[data-view="food"]').forEach(button=>button.addEventListener('click',load));
 window.addEventListener('diary-records',()=>{if(!document.getElementById('food-panel').hidden)load();});
}
