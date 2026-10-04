import {cropPlacement} from './photo-crop.mjs?v=1';
async function cropPhoto(image){
 const dialog=document.createElement('dialog');dialog.className='photo-crop-dialog';
 dialog.innerHTML='<h2>จัดกรอบรูปโปรไฟล์</h2><p class="muted">ลากรูปเพื่อจัดตำแหน่ง แล้วซูมให้พอดีกับกรอบ</p><canvas width="256" height="256" tabindex="0" aria-label="กรอบรูป เลื่อนด้วยการลากหรือปุ่มลูกศร"></canvas><label>ซูมรูป<input type="range" aria-label="ซูมรูป"></label><button type="button" class="quiet crop-fit">เห็นรูปเต็ม</button><div class="crop-actions"><button type="button" class="quiet crop-cancel">ยกเลิก</button><button type="button" class="primary crop-confirm">ใช้รูปนี้</button></div>';
 document.body.append(dialog);
 const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=dialog.querySelector('input');
 const width=image.naturalWidth,height=image.naturalHeight,fit=256/Math.max(width,height),cover=256/Math.min(width,height);
 let scale=cover,x=(256-width*scale)/2,y=0,drag=null;
 slider.min=fit;slider.max=cover*3;slider.step=(cover*3-fit)/500;slider.value=scale;
 function draw(){
  const p=cropPlacement(width,height,scale,x,y);x=p.x;y=p.y;ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(image,x,y,p.width,p.height);
 }
 slider.oninput=()=>{const next=Number(slider.value),ratio=next/scale;x=128-(128-x)*ratio;y=128-(128-y)*ratio;scale=next;draw();};
 dialog.querySelector('.crop-fit').onclick=()=>{scale=fit;slider.value=scale;x=0;y=0;draw();};
 canvas.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const ratio=256/canvas.getBoundingClientRect().width;x+=(e.clientX-drag.x)*ratio;y+=(e.clientY-drag.y)*ratio;drag.x=e.clientX;drag.y=e.clientY;draw();};
 const stop=()=>{drag=null;};canvas.onpointerup=stop;canvas.onpointercancel=stop;canvas.onlostpointercapture=stop;
 canvas.onkeydown=e=>{const moves={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(moves[e.key]){e.preventDefault();x+=moves[e.key][0];y+=moves[e.key][1];draw();}};
 draw();
 return new Promise(resolve=>{
  let result=null;
  dialog.onclose=()=>{dialog.remove();resolve(result);};
  dialog.querySelector('.crop-cancel').onclick=()=>dialog.close();
  dialog.querySelector('.crop-confirm').onclick=async()=>{const confirm=dialog.querySelector('.crop-confirm');confirm.disabled=true;result=await new Promise(done=>canvas.toBlob(done,'image/jpeg',0.8));dialog.close();};
  dialog.showModal();
 });
}
import {api} from './account.js?v=2';
export function initProfile(me){
 const photo=document.getElementById('profile-photo'),fallback=document.getElementById('profile-photo-fallback'),file=document.getElementById('profile-photo-file'),choose=document.getElementById('profile-photo-choose'),remove=document.getElementById('profile-photo-remove'),message=document.getElementById('profile-photo-message');
 document.getElementById('profile-photo-name').textContent=me.display_name;
 document.getElementById('profile-photo-code').textContent=me.member_code||'';
 fallback.textContent=me.display_name?.trim().slice(0,1)||'B';
 function show(avatar){photo.hidden=!avatar;fallback.hidden=!!avatar;remove.hidden=!avatar;if(avatar)photo.src=avatar;else photo.removeAttribute('src');}
 function busy(value){choose.disabled=value;remove.disabled=value;file.disabled=value;}
 window.addEventListener('backup-restored',()=>api('/api/me').then(updated=>show(updated.avatar)).catch(error=>message.textContent=error.message));
 show(me.avatar);choose.onclick=()=>file.click();
 file.onchange=async()=>{
  const selected=file.files[0];if(!selected)return;busy(true);message.textContent='กำลังบันทึกรูป…';
  let url;
  try{
   url=URL.createObjectURL(selected);const image=new Image();image.src=url;await image.decode();
   const blob=await cropPhoto(image);if(!blob){message.textContent='';return;}if(blob.size>65536)throw Error('รูปนี้บันทึกไม่ได้ กรุณาลองรูปอื่น');
   const result=await api('/api/me/avatar',{method:'PUT',headers:{'Content-Type':'image/jpeg'},body:blob});show(result.avatar);message.textContent='บันทึกรูปโปรไฟล์แล้ว';
  }catch(error){message.textContent=error.message==='The source image cannot be decoded.'?'อ่านรูปไม่ได้ กรุณาเลือก JPG, PNG หรือ WebP':error.message;}
  finally{if(url)URL.revokeObjectURL(url);file.value='';busy(false);}
 };
 remove.onclick=async()=>{busy(true);try{await api('/api/me/avatar',{method:'DELETE'});show(null);message.textContent='นำรูปโปรไฟล์ออกแล้ว';}catch(error){message.textContent=error.message;}finally{busy(false);}};
}
