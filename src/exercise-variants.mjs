// Authored movement families and name-derived presentation variants.
// These are illustrative animations, not individual motion-capture recordings.
const legs={upperleg:[.1,-1,0],lowerleg:[.1,-1,0]};
const sit={upperleg:[.12,0,1],lowerleg:[.08,-1,0]};
const arms={upperarm:[.1,-1,0],lowerarm:[.1,-1,0]};
const seated=(keys,props=['seat'])=>({anchor:'seated',seatFoot:'L',view:[50,12,.4,1.2],props,keys:keys.map(k=>({...sit,...k}))});
export const EXTRA_MOTIONS={
 swim:{anchor:'prone',surface:.5,view:[70,25,.3,1.3],keys:[
  {upperleg:[.1,-1,.1],lowerleg:[.1,-1,0],upperlegR:[-.1,-1,-.1],lowerlegR:[-.1,-1,0],upperarm:[.1,1,0],lowerarm:[.1,1,0],upperarmR:[-.1,-1,0],lowerarmR:[-.1,-1,0]},
  {upperleg:[.1,-1,-.1],lowerleg:[.1,-1,0],upperlegR:[-.1,-1,.1],lowerlegR:[-.1,-1,0],upperarm:[.1,-1,0],lowerarm:[.1,-1,0],upperarmR:[-.1,1,0],lowerarmR:[-.1,1,0]},
 ]},
 pulldown:seated([
  {upperarm:[.5,.85,.15],lowerarm:[.2,.98,.1]},
  {upperarm:[.8,-.55,.15],lowerarm:[-.05,.6,.8]},
 ],['seat','cable']),
 straightArmPulldown:{anchor:'feet',view:[65,10,.55,1.2],props:['cable'],keys:[
  {...legs,hips:[15,0,0],upperarm:[.15,.5,.85],lowerarm:[.1,.5,.85]},
  {...legs,hips:[15,0,0],upperarm:[.15,-.95,.2],lowerarm:[.1,-.95,.2]},
 ]},
 seatedChestPress:seated([
  {upperarm:[.8,-.3,-.1],lowerarm:[-.2,.2,.95]},
  {upperarm:[.2,0,1],lowerarm:[.1,0,1]},
 ],['seat','machineHandles']),
 pecDeck:seated([
  {upperarm:[1,0,0],lowerarm:[.2,1,0]},
  {upperarm:[.15,0,1],lowerarm:[0,1,0]},
 ],['seat','machineHandles']),
 reversePecDeck:seated([
  {upperarm:[.15,0,1],lowerarm:[.1,0,1]},
  {upperarm:[1,0,-.1],lowerarm:[1,0,0]},
 ],['seat','machineHandles']),
 seatedLegCurl:seated([
  {...arms,lowerleg:[.08,0,1]},
  {...arms,lowerleg:[.08,-1,-.15]},
 ]),
 standingLegCurl:{anchor:'footL',view:[70,10,.5],keys:[
  {...legs,...arms}, {...legs,...arms,lowerlegR:[-.1,-.1,-1]},
 ]},
 seatedHipAbduction:seated([
  {...arms,upperleg:[.06,0,1]},
  {...arms,upperleg:[.7,0,.7],lowerleg:[.1,-1,0]},
 ]),
 hipAdduction:seated([
  {...arms,upperleg:[.7,0,.7],lowerleg:[.1,-1,0]},
  {...arms,upperleg:[.06,0,1]},
 ]),
 facePull:{anchor:'feet',view:[40,10,.6,1.2],props:['cableHandles'],cableHeight:.85,keys:[
  {...legs,upperarm:[.2,.1,1],lowerarm:[.1,.1,1]},
  {...legs,upperarm:[1,.1,0],lowerarm:[-.1,.9,.4]},
 ]},
 standingCableRow:{anchor:'feet',view:[60,10,.5,1.3],props:['rowCable'],cableHeight:.5,keys:[
  {...legs,upperarm:[.2,-.2,1],lowerarm:[.1,-.2,1]},
  {...legs,upperarm:[.2,-.75,-.65],lowerarm:[.1,0,1]},
 ]},
 kneelingCableRow:{anchor:'kneel',view:[60,10,.35,1.3],props:['rowCable'],cableHeight:.6,keys:[
  {upperleg:[.1,-1,0],lowerleg:[.1,0,-1],upperarm:[.2,.2,1],lowerarm:[.1,.2,1]},
  {upperleg:[.1,-1,0],lowerleg:[.1,0,-1],upperarm:[.5,-.5,-.7],lowerarm:[.1,.1,1]},
 ]},
 invertedRow:{anchor:'hands',hang:.15,view:[65,15,.4,1.3],props:['pullbar'],keys:[
  {...legs,hips:[-45,0,0],upperarm:[.2,.65,.75],lowerarm:[.1,.65,.75]},
  {...legs,hips:[-45,0,0],upperarm:[.6,-.4,-.65],lowerarm:[-.1,.8,.6]},
 ]},
 rowingErg:seated([
  {upperleg:[.1,.4,1],lowerleg:[.1,-.8,.6],hips:[20,0,0],upperarm:[.1,-.2,1],lowerarm:[.1,-.2,1]},
  {upperleg:[.1,-.25,1],lowerleg:[.1,-.3,1],hips:[-10,0,0],upperarm:[.2,-.7,-.7],lowerarm:[.1,.1,1]},
 ],['seat','rowCable']),
 wallSit:{anchor:'feet',hold:true,view:[65,10,.4],props:['wall'],keys:[
  {...sit,...arms}, {...sit,...arms,upperleg:[.12,.15,1]},
 ]},
 sidePlank:{anchor:'side',hold:true,view:[10,18,.28,1.3],keys:[
  {upperleg:[.1,-1,0],lowerleg:[.1,-1,0],upperarm:[1,0,0],lowerarm:[1,0,0]},
  {upperleg:[.1,-1,0],lowerleg:[.1,-1,0],upperarm:[1,0,0],lowerarm:[1,0,0],lift:.03},
 ]},
 jumpRope:{anchor:'feet',hop:.06,view:[20,8,.5,1.2],props:['jumpRope'],keys:[
  {...legs,upperarm:[.3,-.95,0],lowerarm:[.3,-.8,.4]},
  {...legs,upperarm:[.3,-.95,0],lowerarm:[.3,-.8,-.4]},
 ]},
 // Burpee uses a sequence of full poses instead of borrowing jumping jacks.
 burpee:{anchor:'feet',view:[65,15,.45,1.2],sequence:true,keys:[
  {...legs,...arms},
  {hips:[70,0,0],upperleg:[.3,-.3,1],lowerleg:[.1,-.9,-.4],upperarm:[.1,-1,.1],lowerarm:[.1,-1,.1]},
  {hips:[75,0,0],upperleg:[.1,-1,-.1],lowerleg:[.1,-1,-.1],upperarm:[.1,-1,.15],lowerarm:[.1,-1,.15]},
  {hips:[70,0,0],upperleg:[.3,-.3,1],lowerleg:[.1,-.9,-.4],upperarm:[.1,-1,.1],lowerarm:[.1,-1,.1]},
  {...legs,upperarm:[.25,.97,0],lowerarm:[.15,.98,0],lift:.08},
  {...legs,...arms},
 ]},
};

const clone=x=>JSON.parse(JSON.stringify(x));
const mirror=a=>[-a[0],a[1],a[2]];
export function configureMotion(base,profile){
 if(!base)return null;
 const m=clone(base);if(!profile)return m;
 const {equipment,posture,grip,side,angle,motion:id}=profile;
 if(['bench','fly','skullCrusher','pullover'].includes(id))m.view=[50,22,.4,1.5];
 const upper=['curl','shoulderPress','lateralRaise','frontRaise','overheadExtension','shrug','wristCurl'].includes(id);
 if(posture==='seated'&&upper){m.anchor='seated';m.seatFoot='L';m.view=[50,12,.4,1.25];m.props=[...(m.props||[]).filter(p=>p!=='bench'),'seat'];m.keys.forEach(k=>Object.assign(k,sit,{hips:[0,0,0]}));}
 if(posture==='kneeling'&&upper){m.anchor='kneel';m.view=[50,12,.35,1.2];m.keys.forEach(k=>Object.assign(k,{upperleg:[.1,-1,0],lowerleg:[.1,0,-1]}));}
 if(posture==='floor'&&m.anchor==='lying'){m.surface=.02;m.props=(m.props||[]).filter(p=>p!=='bench');m.props.push('mat');m.keys.forEach(k=>Object.assign(k,{upperleg:[.14,-.5,.85],lowerleg:[.04,-.55,-.83]}));}
 if(posture==='floor'&&id==='pullover')m.keys[0].upperarm=m.keys[0].lowerarm=[.12,.98,.05];
 if(id==='curl'&&/preacher|spider|concentration/i.test(profile.name)){
  m.anchor='seated';m.seatFoot='L';m.props=[...(m.props||[]).filter(p=>p!=='bench'),'seat'];m.view=[60,12,.4,1.25];
  m.keys.forEach(k=>Object.assign(k,sit,{hips:[15,0,0],upperarm:[.15,-.8,.6]}));
 }
 if(id==='curl'&&angle===30){m.anchor='seated';m.seatFoot='L';m.props=[...(m.props||[]),'seat'];m.keys.forEach(k=>Object.assign(k,sit,{hips:[-25,0,0]}));}
 if(id==='row'&&/incline|chest supported|lying/i.test(profile.name)){
  m.anchor='prone';m.surface=.5;m.props=[...(m.props||[]),'bench'];m.view=[65,18,.35,1.3];
  m.keys.forEach(k=>Object.assign(k,{hips:[0,0,0],upperleg:[.1,-1,0],lowerleg:[.1,-1,0]}));
  Object.assign(m.keys[0],{upperarm:[.1,0,1],lowerarm:[.1,0,1]});Object.assign(m.keys[1],{upperarm:[.35,-.8,.2],lowerarm:[.1,0,1]});
 }
 if(angle&&m.anchor==='lying'){
  m.benchAngle=angle;m.keys.forEach(k=>{k.hips=[(k.hips?.[0]||0)+angle,0,0];});
 }
 const supports=(m.props||[]).filter(p=>!['dumbbells','onedumbbell','barbell','kettlebell','cable','cableHandles','machineHandles','bandHandles'].includes(p));
 const loaded=['curl','row','bench','shoulderPress','fly','lateralRaise','frontRaise','shrug','skullCrusher','kickback','deadlift','uprightRow','pullover','overheadExtension','kettlebellSwing','farmerWalk','squat','lunge','stepUp'];
 if(loaded.includes(id)&&equipment!=='unspecified'){
  let prop=equipment==='dumbbell'?'dumbbells':equipment==='barbell'?'barbell':equipment==='kettlebell'?'kettlebell':equipment==='cable'?'cableHandles':equipment==='band'?'bandHandles':equipment==='machine'?'machineHandles':null;
  if(prop&&id==='squat'&&equipment==='barbell')prop='shoulderBar';
  if(prop==='shoulderBar'){
   m.frontRack=/front|zercher/i.test(profile.name);
   m.keys.forEach(k=>Object.assign(k,{upperarm:[.9,-.1,-.2],lowerarm:[-.1,.8,-.5]}));
   if(/overhead/i.test(profile.name)){prop='barbell';m.keys.forEach(k=>Object.assign(k,{upperarm:[.5,.85,0],lowerarm:[.25,1,0]}));}
  }
  if(id==='squat'&&/goblet|กอบเล็ต/i.test(profile.name)){
   prop=equipment==='kettlebell'?'kettlebell':'onedumbbell';m.keys.forEach(k=>Object.assign(k,{upperarm:[.3,-.6,.7],lowerarm:[-.1,.8,.2]}));
  }
  m.props=[...supports,...(prop?[prop]:[])];
  m.keys.forEach(k=>{if(prop)k.grip=1;});
 }
 if(grip==='neutral')m.keys.forEach(k=>{k.twist=-16;});
 if(grip==='reverse')m.keys.forEach(k=>{k.twist=-75;});
 if(grip==='wide'||grip==='narrow')m.keys.forEach(k=>{if(k.upperarm){k.upperarm[0]*=grip==='wide'?1.35:.5;}if(k.lowerarm){k.lowerarm[0]*=grip==='wide'?1.35:.5;}});
 if(side==='single'&&(upper||['row','standingCableRow','seatedCableRow','wideSeatedCableRow','declineSeatedCableRow','bench','fly','kickback','pulldown','seatedChestPress'].includes(id))){
  m.singleArm=true;
  m.keys.forEach(k=>{k.upperarmR=[-.1,-1,0];k.lowerarmR=[-.1,-1,0];});
  m.props=(m.props||[]).map(p=>p==='cable'||p==='rowCable'?'cableHandles':p);
 }
 if(side==='alternating'&&upper){
  // Use opposite ends of the same range on the right arm.
  const a=clone(m.keys[0]),b=clone(m.keys[1]);
  m.keys[0].upperarmR=mirror(b.upperarm||a.upperarm);m.keys[0].lowerarmR=mirror(b.lowerarm||a.lowerarm);
  m.keys[1].upperarmR=mirror(a.upperarm);m.keys[1].lowerarmR=mirror(a.lowerarm);
 }
 if(profile.stance==='wide')m.keys.forEach(k=>{if(k.upperleg)k.upperleg[0]*=2.2;if(k.lowerleg)k.lowerleg[0]*=1.5;});
 if(profile.legSide==='single'&&id==='squat'){
  m.anchor='footL';m.view=[55,12,.45,1.3];m.keys.forEach(k=>Object.assign(k,{upperlegR:[-.06,.15,1],lowerlegR:[-.06,0,1]}));
 }
 if(profile.legSide==='single'&&id==='deadlift'){
  m.anchor='footL';m.view=[70,12,.45,1.3];Object.assign(m.keys[1],{upperlegR:[-.1,-.1,-1],lowerlegR:[-.1,-.1,-1]});
 }
 if(profile.legSide==='single'&&['legExtension','seatedLegCurl','legPress'].includes(id)){
  const start=m.keys[0];m.keys.forEach(k=>{k.upperlegR=mirror(start.upperleg);k.lowerlegR=mirror(start.lowerleg);});
 }
 m.profileName=profile.name;return m;
}
