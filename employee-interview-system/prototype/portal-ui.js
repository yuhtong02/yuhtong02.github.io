'use strict';
(async()=>{
 const c=window.HRPortalContext;if(!c)return;if(c.identitySource==='oidc'){document.querySelector('.environment-tag').textContent='身分驗證隔離測試（虛構資料）'}
 async function loadScript(src){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('介面程式無法載入，請重新載入。'));document.body.append(script)})}
 const basicHint=document.getElementById('department').closest('section').querySelector(':scope > p.hint');if(basicHint)basicHint.textContent='姓名、部門及本期表單由後端依模擬登入身分帶入。';
 const el=id=>document.getElementById(id),banner=document.createElement('section');banner.className='site-toolbar';banner.id='portalBanner';
 const title=document.createElement('h2');title.textContent=({employee:'我的面談考績表',hr:'一般人事後台',super:'最高人事後台'})[c.role];
 const notice=document.createElement('p');notice.textContent=c.canManage&&Number.isFinite(c.expiresAt)?'人事登入有效至 '+new Date(c.expiresAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+' · 閒置'+(c.idleTimeoutMinutes||15)+'分鐘自動失效':c.id;
 const exit=document.createElement('button');exit.type='button';exit.textContent='登出並返回入口';exit.id='portalLogout';exit.onclick=()=>el('logoutMock').click();banner.append(title,notice,exit);document.querySelector('main').prepend(banner);
 const identity=document.createElement('p');identity.id='formIdentity';identity.textContent='本期：'+c.activePeriod+' · '+(el('role').value==='supervisor'?'主管人員面談考績表':'一般職員面談考績表');banner.after(identity);
 if(c.role!=='employee'){
  banner.after(el('workflowDialog'));const toggle=document.createElement('button');toggle.type='button';toggle.id='toggleNavigation';toggle.textContent='功能選單';toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{const open=document.body.classList.toggle('nav-expanded');toggle.setAttribute('aria-expanded',String(open))};banner.prepend(toggle);
  document.querySelector('.workflow-nav').replaceChildren();
 }
 if(c.role==='super'){await loadScript('grant-management.js');await window.HRGrantReady}
 if(c.role!=='employee'){await loadScript('assignment-list.js');await loadScript('roster-ui.js');await window.HRRosterReady}
 if(c.role!=='employee')await loadScript('annual-overview.js');
 if(c.role!=='employee'){await loadScript('faq-ui.js');await loadScript('qualification-list.js')}await loadScript('stage8-ui.js');await window.HRManagementReady;await window.HRPortalBoot.styles();window.HRPortalBoot.ready();
})().catch(error=>window.HRPortalBoot.fail(error));
