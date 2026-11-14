import qrcode from 'qrcode-generator';
import decodeQr from 'jsqr';

export function openMemberQr({code,onScan,teamInvite=false}){
 const dialog=document.createElement('dialog');
 const title=document.createElement('h2');
 title.id='member-qr-title';title.textContent=teamInvite?'QR เชิญเข้าทีม':onScan?'สแกน QR สมาชิก':'QR สมาชิกของฉัน';
 dialog.setAttribute('aria-labelledby',title.id);
 const close=document.createElement('button');
 close.type='button';close.className='quiet';close.textContent='ปิด';close.onclick=()=>dialog.close();
 dialog.append(title);
 let stream,timer,closed=false;
 dialog.addEventListener('close',()=>{
  closed=true;clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());dialog.remove();
 },{once:true});
 if(onScan){
  const video=document.createElement('video');
  video.playsInline=true;video.muted=true;video.autoplay=true;video.hidden=true;
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='กำลังเปิดกล้อง…';
  dialog.append(video,status);
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
  function scan(){
   if(closed||!dialog.open)return;
   if(video.readyState>=2&&video.videoWidth){
    canvas.width=Math.min(480,video.videoWidth);canvas.height=Math.round(video.videoHeight*canvas.width/video.videoWidth);
    context.drawImage(video,0,0,canvas.width,canvas.height);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    const code=decodeQr(pixels.data,pixels.width,pixels.height)?.data.trim().toUpperCase();
    if(code){
     if(/^BM-[A-F0-9]{6}$/.test(code)){dialog.close();onScan(code);return;}
     status.textContent='ใช้ QR สมาชิกจาก BanMeaw Trainee';
    }
   }
   timer=setTimeout(scan,180);
  }
  (async()=>{
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
    if(closed||!dialog.open){stream.getTracks().forEach(track=>track.stop());return;}
    video.srcObject=stream;video.hidden=false;await video.play();
    if(!closed){status.textContent='วาง QR ของสมาชิกให้อยู่ในภาพ';scan();}
   }catch{
    stream?.getTracks().forEach(track=>track.stop());video.hidden=true;
    status.textContent='เปิดกล้องไม่ได้ ปิดหน้าต่างแล้วกรอก ID สมาชิกได้เลย';
   }
  })();
 }else{
  const qr=qrcode(0,'M');qr.addData(code);qr.make();
  const image=document.createElement('img');image.src=qr.createDataURL(8,32);
  image.alt=teamInvite?'QR เชิญเข้าทีม':'QR สำหรับ ID '+code;image.width=232;image.height=232;
  const text=document.createElement('p');text.textContent=teamInvite?'ให้สมาชิกสแกนด้วยกล้องมือถือ QR ใช้ได้ 24 ชั่วโมง':' '+code;
  dialog.append(image,text);
  if(teamInvite){
   const link=document.createElement('input');link.value=code;link.readOnly=true;link.setAttribute('aria-label','ลิงก์เชิญเข้าทีม');
   link.onclick=()=>link.select();dialog.append(link);
  }
 }
 dialog.className='member-qr-dialog';dialog.append(close);document.body.append(dialog);dialog.showModal();
}
