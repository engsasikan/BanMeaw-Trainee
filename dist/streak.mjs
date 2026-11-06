// Days in a row with something logged (a meal, a workout or a weigh-in).
// A day not yet logged today does not break the streak: it still counts up to yesterday.
import {localDay} from './store.mjs';
const shift=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return localDay(d);};
export const MILESTONES=[3,7,14,21,30,50,75,100,150,200,365];

export function loggedDays(diary=[],body=[]){
 const days=new Set();
 for(const r of diary)if(r?.day)days.add(r.day);
 for(const r of body)if(r?.day&&r.weight!=null)days.add(r.day);
 return days;
}

export function streak(days,today){
 const todayDone=days.has(today);
 let current=0,day=todayDone?today:shift(today,-1);
 while(days.has(day)){current++;day=shift(day,-1);}
 let best=0,run=0,prev=null;
 for(const d of [...days].filter(d=>d<=today).sort()){run=prev&&shift(prev,1)===d?run+1:1;best=Math.max(best,run);prev=d;}
 return {current,best,todayDone};
}

export function streakText({current,best,todayDone}){
 if(!current)return {title:'เริ่มสถิติใหม่วันนี้',note:best>1?'สถิติดีที่สุด '+best+' วัน':'บันทึกอะไรก็ได้ 1 อย่างเพื่อเริ่มนับ'};
 const note=todayDone?(current>=best?'สถิติดีที่สุดของคุณ!':'สถิติดีที่สุด '+best+' วัน'):'บันทึกวันนี้เพื่อต่อสถิติ';
 return {title:current+' วันติด',note};
}
