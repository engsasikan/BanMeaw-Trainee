import {validateBackup} from './backup-data.mjs?v=2';
import {auth,api} from './account.js?v=2';
import {localDay} from './store.mjs';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function initPasswordReset(){
 const dialog=el('dialog',undefined,'account-reset-dialog'),title=el('h2','ลืมรหัสผ่าน'),form=el('form'),email=el('input'),password=el('input'),confirmation=el('input'),submit=el('button','ส่งลิงก์ตั้งรหัสผ่าน','primary'),message=el('p'),close=el('button','ปิด','quiet');
 const emailLabel=el('label','อีเมล'),passwordLabel=el('label','รหัสผ่านใหม่'),confirmLabel=el('label','ยืนยันรหัสผ่านใหม่');
 email.type='email';email.autocomplete='email';email.required=true;emailLabel.append(email);
 for(const field of [password,confirmation]){field.type='password';field.autocomplete='new-password';field.minLength=8;field.maxLength=128;}
 passwordLabel.append(password);confirmLabel.append(confirmation);message.setAttribute('role','status');close.type='button';close.onclick=()=>dialog.close();
 form.append(emailLabel,passwordLabel,confirmLabel,submit,message);dialog.append(title,form,close);document.body.append(dialog);
 let token=null;
 function mode(reset){
  title.textContent=reset?'ตั้งรหัสผ่านใหม่':'ลืมรหัสผ่าน';emailLabel.hidden=reset;email.disabled=reset;
  passwordLabel.hidden=confirmLabel.hidden=!reset;password.disabled=confirmation.disabled=!reset;password.required=confirmation.required=reset;submit.textContent=reset?'บันทึกรหัสผ่านใหม่':'ส่งลิงก์ตั้งรหัสผ่าน';
 }
 const forgot=el('button','ลืมรหัสผ่าน?','quiet');forgot.type='button';forgot.id='forgot-password';document.getElementById('account-form').after(forgot);
 forgot.onclick=()=>{token=null;mode(false);message.textContent='';email.value=document.getElementById('account-email').value;dialog.showModal();email.focus();};
 form.onsubmit=async e=>{
  e.preventDefault();if(token&&password.value!==confirmation.value){message.textContent='รหัสผ่านทั้งสองช่องไม่ตรงกัน';return;}
  submit.disabled=true;
  try{
   const result=token?await auth.resetPassword({newPassword:password.value,token}):await auth.requestPasswordReset({email:email.value.trim(),redirectTo:location.origin+'/?reset=1'});
   if(result?.error)throw Error(result.error.message||'ดำเนินการไม่สำเร็จ');
   if(token){token=null;password.value=confirmation.value='';history.replaceState(null,'',location.pathname);mode(false);message.textContent='ตั้งรหัสผ่านใหม่แล้ว ปิดหน้าต่างนี้และเข้าสู่ระบบด้วยรหัสผ่านใหม่';}
   else message.textContent='หากอีเมลนี้มีบัญชี ระบบจะส่งลิงก์ให้ กรุณาตรวจกล่องจดหมายและสแปม';
  }catch(error){message.textContent=error.message;}finally{submit.disabled=false;}
 };
 const params=new URLSearchParams(location.search);
 if(params.get('reset')==='1'){
  token=params.get('token');mode(Boolean(token));dialog.showModal();
  if(!token||params.has('error')){token=null;mode(false);message.textContent='ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่';}
 }
}
export function initBackup({tell,loadRecords,isSaving,setBusy}){
 const oldImport=document.getElementById('import-file').onchange;
 const buttons=['export','import','refresh-data'];
 let busy=false;
 const disable=value=>{busy=value;setBusy(value);buttons.forEach(id=>document.getElementById(id).disabled=value);};
 const info=el('p','สำรองอาหาร การฝึก ค่าร่างกาย แผน เป้าหมายอาหาร คะแนน และประวัติรางวัลเป็นไฟล์เดียว ประวัติคะแนนและรางวัลเก็บไว้อ้างอิง ส่วนยอดที่ใช้แลกยึดตามบัญชีในระบบ','backup-note');
 document.getElementById('account-tools').append(info);
 document.getElementById('export').textContent='สำรองข้อมูลทั้งหมด';
 document.getElementById('export').onclick=async()=>{
  if(busy||isSaving())return;disable(true);tell('กำลังเตรียมข้อมูลสำรองทั้งหมด…');
  try{
   const backup=await api('/api/backup'),blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='banmeaw-backup-'+localDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
   tell('สำรองครบแล้ว: บันทึก '+backup.records.length+' รายการ · ร่างกาย '+backup.body.length+' รายการ · แผน '+backup.plans.length+' รายการ');
  }catch(error){tell('สำรองไม่สำเร็จ: '+error.message);}finally{disable(false);}
 };
 document.getElementById('import-file').onchange=async event=>{
  const file=event.target.files[0];if(!file||busy||isSaving())return;
  let imported=0,skipped=0;disable(true);
  try{
   if(file.size>15000000)throw Error('ไฟล์ใหญ่เกิน 15 MB');
   const payload=JSON.parse(await file.text());
   if([1,2].includes(payload.version)){disable(false);await oldImport(event);return;}
   if(payload.version!==3||!payload.profile?.id||!Array.isArray(payload.body)||!Array.isArray(payload.plans)||!Array.isArray(payload.reports))throw Error('รูปแบบไฟล์ไม่ถูกต้อง');
   const me=await api('/api/me');if(payload.profile.id!==me.id)throw Error('ไฟล์สำรองเป็นของบัญชีอื่น');
   validateBackup(payload,me.id);
   tell('กำลังนำเข้าเฉพาะรายการที่ยังไม่มี…');
   for(const type of ['plans','records','body','reports','profile']){
    const rows=type==='profile'?[{sex:payload.profile.sex??null,avatar:payload.profile.avatar??null}]:payload[type];
    for(let i=0;i<rows.length;){
     const chunk=[];let bytes=0;
     while(i<rows.length&&chunk.length<25){
      const nextBytes=new TextEncoder().encode(JSON.stringify(rows[i])).length;
      if(chunk.length&&bytes+nextBytes>240000)break;
      if(nextBytes>240000)throw Error('รายการหนึ่งในไฟล์ใหญ่เกินไป');
      chunk.push(rows[i++]);bytes+=nextBytes;
     }
     const result=await api('/api/backup',{method:'POST',body:JSON.stringify({ownerId:me.id,type,rows:chunk})});
     imported+=result.added;skipped+=result.skipped;tell('นำเข้าแล้ว '+imported+' รายการ · ข้ามรายการซ้ำหรือไม่มีสิทธิ์ '+skipped+' รายการ');
    }
   }
   await loadRecords();window.dispatchEvent(new Event('backup-restored'));
   tell('นำเข้าเสร็จ '+imported+' รายการ · ข้าม '+skipped+' รายการ ข้อมูลทีมและคำแนะนำเก็บไว้อ้างอิงในไฟล์ ไม่สร้างทีม/สิทธิ์ใหม่');
  }catch(error){tell('นำเข้าไม่สำเร็จ: '+error.message+(imported?' (นำเข้าไปแล้ว '+imported+' รายการ ลองไฟล์เดิมได้โดยไม่เพิ่มซ้ำ)':''));}
  finally{event.target.value='';disable(false);}
 };
}
