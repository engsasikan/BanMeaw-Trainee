const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
export function closeTeamViewer(){const view=document.getElementById('team-detail-view');view.classList.remove('team-working');view.querySelector('.team-work-back').hidden=true;document.getElementById('team-viewer').hidden=true;}
export function openTeamViewer(){const view=document.getElementById('team-detail-view');view.classList.add('team-working');view.querySelector('.team-work-back').hidden=false;const box=document.getElementById('team-viewer');box.hidden=false;return box;}
export function organizeTeam(view,{onClose}){
 const tabs=node('div',undefined,'team-section-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','ส่วนของทีม');const panels=[],buttons=[];
 function close(){closeTeamViewer();onClose();}
 function select(key){close();panels.forEach((panel,i)=>{const active=panel.id==='team-section-'+key;panel.hidden=!active;buttons[i].setAttribute('aria-selected',String(active));buttons[i].tabIndex=active?0:-1;});}
 for(const [key,label] of [['members','สมาชิก'],['points','คะแนนและรางวัล'],['manage','จัดการทีม']]){const panel=node('section',undefined,'team-section-panel');panel.id='team-section-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','team-tab-'+key);panel.tabIndex=0;panels.push(panel);const tab=node('button',label,'quiet');tab.type='button';tab.id='team-tab-'+key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panel.id);tab.onclick=()=>select(key);buttons.push(tab);tabs.append(tab);}
 tabs.onkeydown=event=>{const i=buttons.indexOf(document.activeElement);if(i<0)return;const next=event.key==='ArrowRight'?(i+1)%3:event.key==='ArrowLeft'?(i+2)%3:event.key==='Home'?0:event.key==='End'?2:null;if(next===null)return;event.preventDefault();buttons[next].click();buttons[next].focus();};
 for(const child of [...view.children]){if(child.matches('.team-filters,.team-member-grid'))panels[0].append(child);if(child.matches('.team-game'))panels[1].append(child);if(child.matches('.team-invite-card,.team-delete'))panels[2].append(child);}
 panels[0].prepend(node('p','เลือกสมาชิกเพื่อดูบันทึก จัดแผนฝึก หรือกำหนดอาหาร','team-section-hint'));
 if(!panels[2].querySelector('.team-invite-card'))panels[2].prepend(node('p','การจัดการสมาชิกและคำเชิญทำได้โดยผู้สร้างทีม','muted'));
 const back=node('button','‹ กลับรายชื่อสมาชิก','quiet team-work-back');back.type='button';back.hidden=true;back.onclick=close;view.querySelector('.team-daily').after(tabs,...panels,back);select('members');
}
