export function initInstall({win=window,doc=document,nav=navigator}={}){
 const dialog=doc.getElementById('install-dialog'),buttons=['install','install-app'].map(id=>doc.getElementById(id)).filter(Boolean),status=doc.getElementById('install-status'),native=doc.getElementById('install-native'),title=doc.getElementById('install-title'),guides=doc.getElementById('install-guides');
 const mode=win.matchMedia('(display-mode: standalone)');let pending=null,busy=false,installed=mode.matches||nav.standalone===true;
 const ios=/iPhone|iPad|iPod/i.test(nav.userAgent)||(/Macintosh/i.test(nav.userAgent)&&nav.maxTouchPoints>1);
 doc.getElementById('install-android').open=!ios;doc.getElementById('install-ios').open=ios;
 function render(){
  for(const b of buttons){b.textContent=installed?'แอปติดตั้งแล้ว':'เพิ่มลงหน้าจอโฮม';b.disabled=busy;}
  title.textContent=installed?'เปิด BanMeaw จากหน้าจอหลัก':'เพิ่ม BanMeaw ลงหน้าจอหลัก';guides.hidden=installed;native.hidden=installed||!pending;native.disabled=busy;
 }
 function show(message=''){status.textContent=message||(installed?'คุณเปิดใช้งานแบบแอปได้จากไอคอน BanMeaw บนหน้าจอหลัก':'เปิดเว็บใน Chrome บน Android หรือ Safari บน iPhone แล้วทำตามขั้นตอนด้านล่าง');render();if(!dialog.open)dialog.showModal();}
 async function install(){
  if(busy)return;if(installed||!pending){show();return;}
  const event=pending;pending=null;busy=true;render();
  try{await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')show(installed?'เพิ่มแอปเรียบร้อยแล้ว':'ยืนยันการติดตั้งแล้ว รอไอคอน BanMeaw บนหน้าจอหลัก');else show('ยังไม่ได้เพิ่มแอป คุณเพิ่มภายหลังได้จากเมนูเบราว์เซอร์');}
  catch{show('หากปุ่มติดตั้งยังใช้ไม่ได้ ให้เพิ่มจากเมนูเบราว์เซอร์ตามขั้นตอนด้านล่าง');}
  finally{busy=false;render();}
 }
 win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(!installed){pending=event;render();}});
 win.addEventListener('appinstalled',()=>{installed=true;pending=null;status.textContent='เพิ่มแอปเรียบร้อยแล้ว เปิดจากไอคอน BanMeaw ได้เลย';render();});
 mode.addEventListener?.('change',event=>{installed=event.matches||nav.standalone===true;render();});
 for(const button of buttons)button.onclick=install;native.onclick=install;doc.getElementById('close-dialog').onclick=()=>dialog.close();render();
 if('serviceWorker' in nav&&win.isSecureContext)nav.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')initInstall();
