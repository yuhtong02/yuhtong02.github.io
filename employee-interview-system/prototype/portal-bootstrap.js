'use strict';
window.HRUI={
 async reason(message){if(this.pending)return null;const input=document.createElement('textarea');input.id='systemConfirmReason';input.maxLength=1000;input.setAttribute('aria-label','調整原因');let valid=false;const promise=this.confirm(message,{title:'確認歸檔狀態調整',accept:'確認調整'});const dialog=document.getElementById('systemConfirm');if(!dialog)return null;dialog.querySelector('.toolbar').before(input);const accept=dialog.querySelector('#systemConfirmAccept');accept.disabled=true;input.oninput=()=>{valid=!!input.value.trim();accept.disabled=!valid};const result=await promise;return result&&valid?input.value.trim():null},
 period(value){return String(value??'').replace(/\b(\d{3,4})-H([12])\b/g,(_,y,h)=>y+' 年'+(h==='1'?'上半年':'下半年'))},
 async confirm(message,{title='確認操作',accept='確認',details=[]}={}){
  if(window.HRUI.pending)return false;window.HRUI.pending=true;
  const previous=document.activeElement,d=document.createElement('dialog');d.className='system-confirm';d.id='systemConfirm';d.setAttribute('aria-labelledby','systemConfirmTitle');
  const heading=document.createElement('h2');heading.id='systemConfirmTitle';heading.textContent=title;const text=document.createElement('p');text.textContent=window.HRUI.period(message);d.append(heading,text);
  if(details.length){const list=document.createElement('ul');list.className='confirm-details';for(const item of details){const li=document.createElement('li');li.textContent=window.HRUI.period(item);list.append(li)}d.append(list)}
  const actions=document.createElement('div');actions.className='toolbar';const cancel=document.createElement('button'),yes=document.createElement('button');cancel.type=yes.type='button';cancel.id='systemConfirmCancel';cancel.className='secondary';cancel.textContent='取消';yes.id='systemConfirmAccept';yes.textContent=accept;actions.append(cancel,yes);d.append(actions);document.body.append(d);
  return new Promise(resolve=>{let done=false;function finish(value){if(done)return;done=true;d.close();d.remove();window.HRUI.pending=false;previous?.focus();resolve(value)}cancel.onclick=()=>finish(false);yes.onclick=()=>finish(true);d.addEventListener('cancel',e=>{e.preventDefault();finish(false)});d.addEventListener('close',()=>finish(false));d.showModal();cancel.focus()})
 },
 notify(message){const p=document.createElement('p');p.className='system-notice';p.role='status';p.textContent=this.period(message);document.body.append(p);setTimeout(()=>p.remove(),5000)},
 decorate(){for(const root of document.querySelectorAll('option,#flowIdentity,#formIdentity,#periodState,#rows td:first-child,#rosterRows td:nth-child(5),#importRows td:nth-child(4),#paperList,#grantPreview,#existingGrantSummary,#assignmentPreview,#periodMessage,#policyImpact,#assignmentMessage,#annualSummary,#flowStatus')){const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode()){const text=window.HRUI.period(n.nodeValue);if(text!==n.nodeValue){if(root.tagName==='OPTION'&&!root.hasAttribute('value'))root.value=root.value;n.nodeValue=text}}}}
};
document.addEventListener('DOMContentLoaded',()=>{let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;window.HRUI.decorate()})}).observe(document.body,{subtree:true,childList:true,characterData:true});window.HRUI.decorate()});
if(new URLSearchParams(location.search).get('entry')==='portal'){
 document.documentElement.dataset.portalLoading='true';
 const css=document.createElement('link');css.rel='stylesheet';css.href='site.css';document.head.append(css);
 const gate=document.createElement('style');gate.textContent='html[data-portal-loading] main{visibility:hidden!important}html[data-portal-loading] body{overflow-y:scroll}.portal-loading-status{max-width:700px;margin:32px auto;padding:20px}.portal-loading-status button{margin:12px 8px 0 0}';document.head.append(gate);
 window.HRPortalBoot={
  async styles(){await Promise.all([...document.querySelectorAll('link[rel=stylesheet]')].map(link=>link.sheet?Promise.resolve():new Promise((resolve,reject)=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',()=>reject(Error('介面樣式無法載入，請重新載入。')),{once:true})})))},
  ready(){delete document.documentElement.dataset.portalLoading;document.getElementById('portalLoadingStatus')?.remove();document.body.dataset.portalReady='true';window.HRGoogleBootstrapDone?.()},
  fail(error){const panel=document.getElementById('portalLoadingStatus');if(panel){panel.replaceChildren();const text=document.createElement('p');text.setAttribute('role','alert');text.textContent=error.message||'畫面無法載入，請重新載入。';const retry=document.createElement('button');retry.textContent='重新載入';retry.onclick=()=>location.reload();const logout=document.createElement('a');logout.href='/';logout.textContent='返回登入入口';panel.append(text,retry,logout)}}
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const header=document.querySelector('main>header'),logo=header?.querySelector('img');if(!header||!logo)return;
  header.className='site-header';logo.className='';logo.removeAttribute('style');const titles=document.createElement('div');titles.className='site-titles';titles.innerHTML='<p class="site-company">鈺通營造工程股份有限公司</p><h1>員工面談暨考績系統</h1>';const badge=document.createElement('span');badge.className='environment-tag';badge.textContent='測試環境';header.replaceChildren(logo,titles,badge);document.body.prepend(header);
  const loading=document.createElement('section');loading.id='portalLoadingStatus';loading.className='portal-loading-status';loading.setAttribute('role','status');loading.textContent='正在載入您的資料…';header.after(loading);
 });
}
