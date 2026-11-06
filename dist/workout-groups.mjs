// Only explicitly linked records belong together; preserve first appearance and member order.
export function groupWorkouts(rows){
 const groups=[],byId=new Map();
 for(const row of rows){if(!row.supersetId){groups.push({rows:[row]});continue;}const key=row.day+'|'+row.supersetId;let group=byId.get(key);if(!group){group={rows:[]};byId.set(key,group);groups.push(group);}group.rows.push(row);}
 return groups;
}
export function renderWorkoutGroups(root,rows,createCard,{onDeleteGroup}={}){
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 let number=0;
 for(const group of groupWorkouts(rows)){
  if(group.rows.length===1){root.append(createCard(group.rows[0]));continue;}
  const box=el('section',undefined,'workout-superset'),title=el('h3','Super set '+(++number),'workout-superset-title');
  box.setAttribute('aria-labelledby','workout-superset-'+number);title.id='workout-superset-'+number;
  const head=el('div',undefined,'workout-superset-head');head.append(title,el('span',group.rows.length+' ท่าต่อเนื่อง','workout-superset-count'));
  if(onDeleteGroup){const actions=el('div',undefined,'entry-actions superset-actions'),remove=el('button','ลบ Super set ทั้งกลุ่ม','delete');remove.type='button';remove.setAttribute('aria-label','ลบ Super set '+number+' ทั้ง '+group.rows.length+' ท่า');remove.onclick=()=>onDeleteGroup(group.rows);actions.append(remove);head.append(actions);}
  const sameSets=group.rows.every(r=>r.sets===group.rows[0].sets)&&group.rows[0].sets!=null;
  box.append(head,el('p','ทำท่าตามลำดับต่อกัน แล้วจึงพัก'+(sameSets?' · ทำทั้งหมด '+group.rows[0].sets+' รอบ':''),'workout-superset-hint'));
  const list=el('ol',undefined,'workout-superset-list');
  group.rows.forEach((row,index)=>{const item=el('li',undefined,'workout-superset-item'),step=el('span','ท่าที่ '+(index+1),'workout-superset-step');item.append(step,createCard(row));if(index<group.rows.length-1)item.append(el('p','↓ ต่อด้วยท่าที่ '+(index+2)+' โดยไม่พัก','workout-superset-next'));list.append(item);});
  box.append(list);root.append(box);
 }
}
