// Spotting plans someone else (a trainer) added, changed or removed for this member since they last looked.
// The app keeps a snapshot of upcoming trainer plans per account in this browser and compares it with what the
// server returns now. The first look only records the snapshot, so old plans are not announced.

// Upcoming plans made by someone else: {planId: {day, team, sig}}.
export function planSnapshot(plans,me,today){
 const snapshot={};
 for(const plan of plans){
  if(!plan.created_by||plan.created_by===me||plan.day<today)continue;
  snapshot[plan.id]={day:plan.day,team:plan.team_name,sig:JSON.stringify(plan.exercises)};
 }
 return snapshot;
}
// What changed between the saved snapshot and now. Past days never count as removed.
export function planChanges(previous,current,today){
 if(!previous)return {added:[],changed:[],removed:[]};
 const added=[],changed=[],removed=[];
 for(const [id,plan] of Object.entries(current)){
  if(!previous[id])added.push(plan);
  else if(previous[id].sig!==plan.sig)changed.push(plan);
 }
 for(const [id,plan] of Object.entries(previous))if(!current[id]&&plan.day>=today)removed.push(plan);
 const byDay=(a,b)=>a.day.localeCompare(b.day);
 return {added:added.sort(byDay),changed:changed.sort(byDay),removed:removed.sort(byDay)};
}
// "ทีม A: เพิ่ม 3 วัน · แก้ 1 วัน" for each team that has changes.
export function changeSummary({added,changed,removed}){
 const teams=new Map();
 const count=(list,key)=>{for(const plan of list){const entry=teams.get(plan.team)??{added:0,changed:0,removed:0};entry[key]++;teams.set(plan.team,entry);}};
 count(added,'added');count(changed,'changed');count(removed,'removed');
 return [...teams].map(([team,c])=>team+': '+[c.added&&'เพิ่ม '+c.added+' วัน',c.changed&&'แก้ '+c.changed+' วัน',c.removed&&'ยกเลิก '+c.removed+' วัน'].filter(Boolean).join(' · '));
}
