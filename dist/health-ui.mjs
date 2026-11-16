// Previously imported Health records still count toward the activity streak.
import {api} from './account.js?v=5';

export function initHealthHistory(){
 async function load(){
  try{
   const data=await api('/api/health');
   window.dispatchEvent(new CustomEvent('health-records',{detail:data}));
  }catch{}
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 load();
}
