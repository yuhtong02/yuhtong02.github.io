/* Integration adapter for the unchanged original appraisal form. Mock data only. */
'use strict';
(function(){
const api=window.HRDemo,doc=document,el=id=>doc.getElementById(id);
const portalMode=new URLSearchParams(location.search).get('entry')==='portal';
let portalContext=null;
// Archive browser-only legacy ink before server synchronization replaces caches.
// Never overwrite an existing archive, and never discard originals on quota errors.
try{
 const archiveKey='hr-stage6-signature-backup-v1';
 if(!window.HRGoogleCache.getItem(archiveKey)){
  const entries=[];
  for(const [source,storage,keys]of [['local',window.HRGoogleCache,['hr-integrated-demo-v1','portal:hr-integrated-demo-v1','employee-self-review-demo-v6-staff','employee-self-review-demo-v6-supervisor']],['session',window.HRGoogleCache,['hr-signature-comparison-v1']]])for(const key of keys){const value=storage.getItem(key);if(value&&value.includes('data:image/'))entries.push({source,key,value})}
  if(entries.length)window.HRGoogleCache.setItem(archiveKey,JSON.stringify({createdAt:new Date().toISOString(),entries}));
 }
}catch(error){const warning=doc.createElement('p');warning.setAttribute('role','alert');warning.textContent='歷史手寫資料無法備份，已停止同步。請保留原資料，釋放瀏覽器儲存空間後重試。';doc.querySelector('main').prepend(warning);return}
const periods=['115-H2','116-H1'];
const store=api.createStore(portalMode?{getItem:k=>window.HRGoogleCache.getItem('portal:'+k),setItem:(k,v)=>window.HRGoogleCache.setItem('portal:'+k,v),removeItem:k=>window.HRGoogleCache.removeItem('portal:'+k)}:window.HRGoogleCache);
const legacyReadDraft=readDraft;
let paperReady=false,contextReady=false,serverConfig=null,syncGeneration=0,requestQueue=Promise.resolve();
Object.assign(api.states,{printed:'已列印',received:'紙本已收回',archived:'已歸檔／結案'});
// Tab-scoped convenience state for fake identities only; never authentication.
const SESSION_KEY=portalMode?'hr-portal-mock-session-v1':'hr-mock-session-v1';
let mockSession=null,mockActive=false,workflowRecovery={};
try{
 const saved=JSON.parse(window.HRGoogleCache.getItem('hr-demo-roster')||'[]');
 if(Array.isArray(saved))for(const employee of api.employees){
  const row=saved.find(x=>x&&x.id===employee.id);
  if(row)for(const key of ['name','department','site'])if(typeof row[key]==='string')employee[key]=row[key];
 }
}catch(error){/* Keep the fictional defaults if mock storage is damaged. */}
const style=doc.createElement('link');style.rel='stylesheet';style.href='original-form-workflow.css';doc.head.append(style);

const open=doc.createElement('button');open.type='button';open.id='openWorkflow';open.className='admin-entry';open.textContent='整合流程（模擬）';
const state=doc.createElement('span');state.id='workflowState';state.className='hint';
doc.addEventListener('DOMContentLoaded',()=>{
 el('identityDemoForm').addEventListener('submit',()=>{
  if(el('identityDemo').hidden){
   if(!open.isConnected)doc.querySelector('.employee-footer').append(open,state);
   // Typing the fake identity gate is not an unsaved appraisal edit.
   dirty=false;mockActive=true;if(!portalMode){restoreSessionForm();persistRecovery();syncPaper().catch(error=>message(error.message))}
  }
 });
 if(portalMode){
  fetch('/api/portal/session').then(async response=>{
   if(!response.ok){HRGoogleNavigate('/');return}portalContext=await response.json();doc.body.classList.add('portal-site',portalContext.role==='employee'?'portal-employee-page':'portal-hr-page');
   const configResponse=await fetch('/api/config');if(!configResponse.ok)throw Error('模擬工作階段失效');
   serverConfig=window.HRPortalConfig.normalize(await configResponse.json());updatePeriods(serverConfig);paperReady=true;
   api.employees.splice(0,api.employees.length,...serverConfig.employees);employeeOptions();
   const cached=JSON.parse(window.HRGoogleCache.getItem(SESSION_KEY)||'null');
   const compatible=cached?.active&&cached.portalId===portalContext.id;
   mockSession=compatible?cached:null;workflowRecovery=compatible?cached.workflowRecovery||{}:{};
   const selected=portalContext.role!=='employee'&&compatible&&portalContext.scopes.some(k=>k.employeeId===cached.employeeId&&k.period===cached.period)?cached:portalContext.scopes[0]||{employeeId:portalContext.employeeId,period:serverConfig.activePeriod};
   if(selected){el('employee').value=selected.employeeId;el('period').value=selected.period}
   el('actor').value=portalContext.role==='employee'?'employee':'hr';
   if(portalContext.role==='employee'&&!serverConfig.periods.includes(portalContext.activePeriod))throw Error('員工期別與設定不一致，請聯繫人事確認。');
   const assigned=serverConfig.employees.find(e=>e.id===el('employee').value);role.value=assigned?.assignments?.[period()]||assigned?.assignedType||'staff';setRole(role.value);
   previous={employee:el('employee').value,period:period()};
   mockActive=true;dirty=false;doc.querySelector(".employee-footer").append(open,state);
   await syncPaper();if(!contextReady)throw Error('資料初始化尚未完成，請重新載入。');applyPortalUI();if(portalContext.role!=='employee'&&!dialog.open)dialog.showModal();window.HRPortalContext=portalContext;const script=doc.createElement('script');script.src='portal-ui.js';doc.body.append(script);
  }).catch(error=>window.HRPortalBoot.fail(error));
  return;
 }
 try{const cached=JSON.parse(window.HRGoogleCache.getItem(SESSION_KEY)||'null');
  if(cached?.version===1&&cached.active===true&&api.employees.some(e=>e.id===cached.employeeId)&&periods.includes(cached.period)&&['employee','supervisor','hr'].includes(cached.actor)&&['staff','supervisor'].includes(cached.formRole)){
   cached.actor=cached.actor==='supervisor'?'employee':cached.actor;mockSession=cached;workflowRecovery=cached.workflowRecovery&&typeof cached.workflowRecovery==='object'?cached.workflowRecovery:{};el('employee').value=cached.employeeId;el('period').value=cached.period;el('actor').value=cached.actor;
   role.value=cached.formRole;setRole(role.value);previous={employee:cached.employeeId,period:cached.period};
   // Reuse the unchanged fake-only gate. No password, token or real identity.
   el('identityDemoName').value='測試員工';el('identityDemoDigits').value='0000';el('identityDemoForm').requestSubmit();
  }
 }catch(error){message('模擬登入狀態無法恢復，請重新輸入測試資料。')}
});
const dialog=doc.createElement(portalMode?'section':'dialog');dialog.id='workflowDialog';dialog.setAttribute('aria-labelledby','workflowTitle');
if(portalMode){dialog.hidden=true;dialog.open=false;dialog.showModal=()=>{dialog.hidden=false;dialog.open=true;dialog.setAttribute('open','')};dialog.close=()=>{dialog.hidden=true;dialog.open=false;dialog.removeAttribute('open');dialog.dispatchEvent(new Event('close'))}}
dialog.innerHTML=`
 <div class="actions"><h2 id="workflowTitle">面談與考績流程（模擬）</h2><button type="button" id="closeWorkflow" class="secondary">返回原版自評表</button></div>
 <p class="warning">本機虛構資料 · 不連接正式資料庫、不寄信；模擬角色不代表正式身分驗證。</p>
 <div class="grid"><div><label for="actor">模擬角色</label><select id="actor"><option value="employee">測試員工</option><option value="hr">測試人事</option></select></div><div><label for="period">考績期別</label><select id="period"><option value="115-H2">115 年下半年（測試）</option><option value="116-H1">116 年上半年（測試）</option></select></div></div>
 <label for="employee">選擇虛構員工／目前紀錄</label><select id="employee"></select>
 <p id="flowIdentity" class="hint"></p><p id="flowStatus" role="status" aria-live="polite"></p><p id="progress" class="hint"></p>
 <section id="workflowSelf" class="card"><h2>員工自評流程</h2><p>填寫人事指定的表單，可先儲存草稿，完成後確認送出。人事統一下載列印，主管紙本評核。此處僅使用模擬身分與虛構資料。</p><button type="button" id="submitSelf">確認送出</button><p id="selfState" class="hint"></p></section>
 <section id="workflowReview" hidden><p>主管採紙本評分與簽核，不提供線上評核。</p></section>
 <section id="workflowHr" class="card" hidden><h2>人事管理</h2><details><summary>維護目前虛構員工資料</summary><label for="editName">虛構姓名</label><input id="editName" maxlength="80"><label for="editDepartment">模擬部門</label><input id="editDepartment" maxlength="80"><label for="editSite">模擬工地</label><input id="editSite" maxlength="80"><label for="assignedType">依職務指定表單</label><select id="assignedType"><option value="staff">一般職員</option><option value="supervisor">主管人員</option></select><button type="button" id="assignForm">儲存指定表單（僅人事）</button><button type="button" id="saveEmployee">儲存模擬員工資料</button></details><p id="periodState"></p><button type="button" id="togglePeriod" class="secondary">切換本期開放／截止</button>
 <div class="grid"><div><label for="searchName">查詢員工／部門／工地／期別</label><input id="searchName"></div><div><label for="filterStatus">依狀態篩選</label><select id="filterStatus"><option value="">全部</option></select></div></div>
 <div class="grid"><div><label for="filterPeriod">考績期別</label><select id="filterPeriod"><option value="">全部</option><option>115-H2</option><option>116-H1</option></select></div><div><label for="filterType">表單類型</label><select id="filterType"><option value="">全部</option><option value="staff">一般職員</option><option value="supervisor">主管人員</option></select></div><div><label for="filterDepartment">部門</label><select id="filterDepartment"><option value="">全部</option></select></div></div><label for="returnReason">退回修改原因（操作前填寫）</label><input id="returnReason"><div class="workflow-table"><table><thead><tr><th>期別</th><th>員工／部門／工地</th><th>狀態</th><th>自評</th><th>紙本流程</th><th>操作</th></tr></thead><tbody id="rows"></tbody></table></div>
 <div class="actions"><button type="button" id="batchWord" class="secondary">批次 Word ZIP（篩選已送出）</button><button type="button" id="batchExcel" class="secondary">批次 Excel（每人一張表）</button><button type="button" id="exportCsv" class="secondary">匯出篩選結果 CSV</button><button type="button" id="resetDemo" class="secondary">重設整合測試資料</button></div></section>
 <details id="storedRecord"><summary>目前已儲存紀錄／舊版整合資料</summary><div id="recordDetail"></div></details>`;
doc.body.append(dialog);
const logout=doc.createElement('button');logout.type='button';logout.id='logoutMock';logout.className='secondary';logout.textContent='登出（模擬）';
el('closeWorkflow').after(logout);
logout.addEventListener('click',()=>attempt(async()=>{await requestQueue;if(paperReady)await fetch(portalMode?'/api/portal/logout':'/api/mock/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});window.HRGoogleCache.removeItem(SESSION_KEY);mockActive=false;mockSession=null;dirty=false;if(portalMode)HRGoogleNavigate('/');else location.reload()}));
function updatePeriods(config){if(!config?.periods)return;periods.splice(0,periods.length,...config.periods);for(const id of ['period','filterPeriod']){const select=el(id),prior=select.value;select.replaceChildren(...(id==='filterPeriod'?[new Option('全部','')]:[]),...periods.map(p=>new Option(p,p)));if([...select.options].some(o=>o.value===prior))select.value=prior}}
function employeeOptions(){
 const previous=el('employee').value;
 el('employee').replaceChildren(...api.employees.map(e=>new Option([e.name,e.department,e.site].join('｜'),e.id)));
 if(previous)el('employee').value=previous;
}
employeeOptions();
for(const value of ['draft','self-submitted','printed','received','archived'])el('filterStatus').add(new Option(api.states[value],value));
for(const [selector,id]of [['#name','employeeBasics'],['#interview','employeeInterview'],['#projectRows','employeeProjects'],['#scores','employeeScores'],['#save','employeeActions']])doc.querySelector(selector)?.closest('section')?.setAttribute('id',id);
const fillProgress=doc.createElement('section');fillProgress.className='fill-progress';fillProgress.id='fillProgress';fillProgress.innerHTML='<div><strong id="fillProgressText">填寫進度</strong><p id="saveState" role="status"></p></div><progress id="fillProgressBar" max="21" value="0" aria-label="表單填寫進度"></progress>';
el('employeeBasics').before(fillProgress);
el('confirmationMeaning').textContent='系統記錄姓名與時間；自動帶入姓名不是親筆簽名，不宣稱具有相同法律效力。目前登入僅供模擬。';
el('employeeActions').classList.add('employee-actions');
const draftTools=doc.createElement('details'),draftSummary=doc.createElement('summary'),draftButtons=doc.createElement('div');draftTools.id='draftTools';draftSummary.textContent='草稿與填寫檢查';draftButtons.className='draft-tool-buttons';draftTools.append(draftSummary,draftButtons);for(const id of ['resume','reset','check'])draftButtons.append(el(id));el('employeeActions').querySelector('.actions').after(draftTools);
const scenarioPreview=doc.querySelector('.period-preview');if(scenarioPreview){const disclosure=doc.createElement('details'),summary=doc.createElement('summary');disclosure.className='preview-disclosure';summary.textContent='模擬狀態情境（僅示意）';scenarioPreview.before(disclosure);disclosure.append(summary,scenarioPreview)}
const hrLayout=doc.createElement('div');hrLayout.className='workflow-layout';hrLayout.id='hrLayout';
const nav=doc.createElement('nav');nav.className='workflow-nav';nav.setAttribute('aria-label','人事後台導覽');
for(const [label,target]of [['進度總覽','hrOverview'],['員工名冊','hrRosterTools'],['查詢與篩選','hrFilters'],['考績清單','hrResults'],['完整內容','storedRecord']]){const a=doc.createElement('a');a.textContent=label;a.href='#'+target;nav.append(a)}
el('workflowHr').before(hrLayout);hrLayout.append(nav,el('workflowHr'));
el('workflowHr').querySelector('details').id='hrRosterTools';el('searchName').closest('.grid').id='hrFilters';el('rows').closest('.workflow-table').id='hrResults';
const scrollHint=doc.createElement('p');scrollHint.className='table-scroll-hint';scrollHint.textContent='手機可左右滑動清單，查看狀態、匯出及紙本操作。';el('hrResults').before(scrollHint);
const overview=doc.createElement('section');overview.id='hrOverview';overview.className='status-overview';overview.setAttribute('aria-label','表單狀態總覽');el('workflowHr').querySelector('h2').after(overview);
function formatTime(value){const d=new Date(value);return Number.isNaN(d.getTime())?'時間待確認':new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(d)}
function statusKey(r){return r.status==='draft'?(r.returnedAt?'returned':r.formData?'draft':'empty'):r.status}
function displayStatus(r){return ({empty:'未填寫',draft:'草稿',returned:'已退回','self-submitted':'已送出',printed:'已列印',received:'已收件',archived:'已歸檔'})[statusKey(r)]||api.states[r.status]||'舊紀錄'}
function statusBadge(r){const badge=doc.createElement('span');badge.className='status-badge';badge.dataset.state=statusKey(r);badge.textContent=displayStatus(r);return badge}
function updateFillProgress(){
 const ids=[...Array.from({length:5},(_,i)=>'q'+i),...Array.from({length:4},(_,i)=>['project'+(i+1),'outcome'+(i+1)]).flat(),...Array.from({length:8},(_,i)=>'score'+i),...(el('override').checked?['manual','reason']:[])];
 const done=ids.filter(id=>el(id)?.value.trim()).length;el('fillProgressBar').max=ids.length;el('fillProgressBar').value=done;el('fillProgressText').textContent='填寫進度 '+done+'／'+ids.length;
 const r=record();el('saveState').textContent=r.status!=='draft'?'已送出並鎖定':dirty?'有尚未儲存的修改':r.updatedAt?'草稿已儲存 · '+formatTime(r.updatedAt):'尚未儲存草稿';
 const receipt=el('submissionReceipt');receipt.replaceChildren();if(portalMode&&portalContext?.role==='employee'&&r.eligibility){let notice=el('eligibilityNotice');if(!notice){notice=doc.createElement('p');notice.id='eligibilityNotice';el('fillProgress').before(notice)}notice.textContent=JSON.stringify(r.eligibility);doc.dispatchEvent(new CustomEvent('eligibility-updated',{detail:r.eligibility}))}
 if(r.confirmation&&r.status!=='draft'){
  const title=doc.createElement('strong');title.textContent='已確認送出';const p=doc.createElement('p');p.textContent=r.confirmation.name+' · '+formatTime(r.confirmation.confirmedAt)+'（模擬身分）';receipt.append(title,p);
 }else receipt.textContent=r.returnedAt?'人事已退回，修改完成後請再次確認送出。':r.status!=='draft'?'已送出（舊紀錄）':'完成填寫後按「確認送出」即可，不需要手寫簽名。';
}
for(const event of ['input','change'])doc.addEventListener(event,e=>{if(e.target.closest('main')&&!e.target.closest('#identityDemo'))updateFillProgress()});
const period=()=>el('period').value;
const record=()=>store.get(period(),el('employee').value);
const periodOpen=()=>portalMode&&paperReady?record().eligibility?.canWrite===true:window.HRGoogleCache.getItem('hr-demo-period-'+period())!=='closed';
// A workflow reviewer role applies inside the modal, not to the employee form
// after returning. Submitted records and closed periods remain read-only.
const editable=()=>(!portalMode||serverConfig?.periodPolicies?.[period()]?.configured===true)&&(!portalMode||portalContext?.role==='employee')&&(!dialog.open||el('actor').value==='employee')&&periodOpen()&&record().status==='draft'&&contextReady;
const allRecords=()=>periods.flatMap(p=>api.employees.map(e=>store.get(p,e.id))).filter(r=>!portalMode||(portalContext?.role==='employee'||portalContext?.permissions.includes('selfReview'))&&portalContext?.scopes.some(k=>k.employeeId===r.employeeId&&k.period===r.period)&&(!serverConfig||serverRecords.has(r.period+':'+r.employeeId)));
let serverRecords=new Set();
function applyPortalUI(){
 if(!portalMode||!portalContext)return;
 el('actor').value=portalContext.role==='employee'?'employee':'hr';el('actor').disabled=true;
 el('actor').parentElement.hidden=true;
 el('workflowTitle').textContent=portalContext.role==='super'?'最高人事｜考績管理（模擬）':portalContext.role==='hr'?'人事｜考績管理（模擬）':'員工自評流程（模擬）';
 el('employee').disabled=portalContext.role==='employee';
 const can=p=>portalContext.role!=='employee'&&portalContext.permissions.includes(p);
 for(const [id,p]of [['saveEmployee','employee'],['assignForm','employee'],['togglePeriod','period'],['batchWord','word'],['batchExcel','word'],['exportCsv','word']])el(id).disabled=!can(p);
 el('resetDemo').disabled=portalContext.role!=='super';
 for(const b of el('rows').querySelectorAll('[data-action]'))b.disabled=!can(({docx:'word',xlsx:'word',view:'selfReview',return:'editReview',printed:'editReview',received:'editReview',archived:'editReview'})[b.dataset.action]);
 if(el('openAdmin'))el('openAdmin').hidden=true;
}
const filtered=()=>allRecords().filter(r=>(!el('filterPeriod').value||r.period===el('filterPeriod').value)&&(!el('filterDepartment').value||r.department===el('filterDepartment').value)&&(!el('filterType').value||r.formRole===el('filterType').value)&&(!el('filterStatus').value||r.status===el('filterStatus').value)&&(!el('searchName').value.trim()||[r.period,r.employeeId,r.employeeName,r.department,r.site].join(' ').includes(el('searchName').value.trim())));
function message(text){el('flowStatus').textContent=text;if(!portalMode||portalContext?.role==='employee')el('status').textContent=text}
function attempt(fn){try{const result=fn();if(result?.catch)result.catch(error=>message(error.message))}catch(error){message(error.message)}}
function lockForm(){
 const locked=!editable();
 for(const id of [...fields,'role','override','save','resume','reset',...Array.from({length:8},(_,i)=>'score'+i)])el(id).disabled=locked;
 el('role').disabled=true;el('name').readOnly=true;el('submit').disabled=locked||!paperReady;el('submit').textContent='確認送出';

}
// The original script and its checker are untouched. Only its existing save/restore
// controls are connected to employee+period storage, without changing their labels.
readDraft=function(){
 if(paperReady){const r=record();return r.formData?{data:r.formData,signatureImage:r.signatureImage,savedAt:r.updatedAt}:null}
 const saved=record().draftForms?.[role.value];
 if(saved)return saved;
 if(record().formRole===role.value&&record().formData)return {data:record().formData,signatureImage:record().signatureImage,savedAt:record().updatedAt};
 if(el('employee').value==='__PENDING__'&&period()==='115-H2')return legacyReadDraft();
 return null;
};
function originalValues(){
 const data=snapshot();
 return {formData:data,formRole:role.value,interview:questions.map((q,i)=>q+'：'+data['q'+i]).join('\n'),results:Array.from({length:4},(_,i)=>data['project'+(i+1)]+'：'+data['outcome'+(i+1)]).join('\n'),scores:Object.fromEntries(Array.from({length:8},(_,i)=>[i,data['score'+i]])),selfScore:data.override?(data.manual===''?null:Number(data.manual)):total(),};
}
async function storeSelf(action){if(storeSelf.pending)return;storeSelf.pending=true;try{
 if(!editable())throw Error('目前角色、期別或狀態不可編輯員工自評');
 if(action==='submit-self'){
  const values=originalValues();
  window.HROriginalForm.validateOriginalForm(values.formData,values.formRole);
  if(!(portalMode?await window.HRUI.confirm('確定送出目前自評表？送出後資料將鎖定，如需修改須由人事退回。',{title:'確認送出'}):confirm('確定送出目前自評表？送出後資料將鎖定，如需修改須由人事退回。')))return;
 }
 const selectedPeriod=period(),selectedEmployee=el('employee').value;
 message(action==='save-self'?'正在儲存測試草稿…':'正在送出測試自評…');
 for(const id of [...fields,'override',...Array.from({length:8},(_,i)=>'score'+i)])el(id).disabled=true;el('submit').disabled=el('save').disabled=true;const next=await remote(action==='save-self'?'/api/self/draft':'/api/self/submit',{...originalValues(),expectedRevision:record().revision||0,period:selectedPeriod,submissionConfirmed:action==='submit-self'},{actor:'employee',employeeId:selectedEmployee});
 store.save(selectedPeriod,next);dirty=false;updateDraftInfo();render();
 el('checkStatus').textContent='';
 message(action==='save-self'?'草稿已儲存，之後可繼續填寫。':'已確認送出，資料已鎖定；如需修改請由人事退回。');}finally{storeSelf.pending=false;lockForm()}
}
function resetVisible(data,type){
 loading=true;el('role').disabled=false;clearForm();role.value=type||'staff';setRole(role.value);if(data)restore(data);
 loading=false;dirty=false;updateDraftInfo();lockForm();updateFillProgress();
}
async function loadCurrent(){
 if(!editable())throw Error('目前不可恢復員工草稿');
 const saved=readDraft();if(!saved){message('這個類別目前沒有已儲存的草稿');return}
 if(dirty&&!(portalMode?await window.HRUI.confirm('恢復草稿會覆蓋目前尚未暫存的內容，確定嗎？'):confirm('恢復草稿會覆蓋目前尚未暫存的內容，確定嗎？')))return;
 resetVisible(saved.data,role.value,saved.signatureImage,false);
 message('已恢復完整草稿，可繼續填寫。');
}
function capture(id,handler){el(id).addEventListener('click',event=>{event.stopImmediatePropagation();attempt(handler)},true)}
capture('save',()=>storeSelf('save-self'));
capture('resume',loadCurrent);
capture('reset',async()=>{
 if(!editable())throw Error('目前不可清除員工草稿');
 if(!(portalMode?await window.HRUI.confirm('確定刪除目前類別的本機草稿並清空畫面？此操作無法復原。'):confirm('確定刪除目前類別的本機草稿並清空畫面？此操作無法復原。')))return;
 const r=await remote('/api/self/clear',{period:period(),expectedRevision:record().revision||0},{actor:'employee',employeeId:el('employee').value});store.save(period(),r);
 if(el('employee').value==='__PENDING__'&&period()==='115-H2')window.HRGoogleCache.removeItem(keyForRole());
 resetVisible(null,role.value,'');render();message('已清除目前類別的本機演練草稿。');
});
role.addEventListener('change',()=>{role.value=record().formRole||'staff';setRole(role.value);lockForm();message('表單類型由人事指定，員工不可自行切換。')});
function selectionChanged(previous){
 if(dirty&&!confirm('切換紀錄會清除尚未暫存的內容，確定嗎？')){el('employee').value=previous.employee;el('period').value=previous.period;return false}
 const r=record();resetVisible(r.status!=='draft'?r.formData:null,r.status!=='draft'?r.formRole:role.value,r.status!=='draft'?r.signatureImage:'',r.status!=='draft');
 if(!r.formData||r.status==='draft')el('department').value=r.department;
 render();syncPaper().catch(error=>message(error.message));return true;
}
let previous={employee:el('employee').value,period:period()};
for(const id of ['employee','period'])el(id).addEventListener('change',()=>{attempt(()=>{if(selectionChanged(previous))previous={employee:el('employee').value,period:period()}})});
function recoveryKey(){return [period(),el('employee').value,role.value].join(':')}
function persistRecovery(){
 if(!mockActive)return false;
 try{
  const r=record(),recovery={...(mockSession?.recovery||{})};
  if(r.status==='draft')recovery[recoveryKey()]={...(recovery[recoveryKey()]||{}),data:snapshot(),savedAt:new Date().toISOString(),baseUpdatedAt:r.updatedAt,templateSha:r.templateSha};
  else delete recovery[recoveryKey()];
  const next={version:1,active:true,employeeId:el('employee').value,period:period(),actor:el('actor').value,formRole:role.value,recovery,workflowRecovery,...(portalMode?{portalId:portalContext?.id}:{})};
  window.HRGoogleCache.setItem(SESSION_KEY,JSON.stringify(next));mockSession=next;return true;
 }catch(error){message('本分頁無法保存模擬恢復狀態，請使用原版暫存草稿。');return false}
}
function restoreSessionForm(){
 const r=record();
 if(r.status!=='draft'){resetVisible(r.formData,r.formRole,r.signatureImage,true);el('department').value=r.department;render();return}
 const recovery=mockSession?.recovery?.[recoveryKey()];
 const saved=recovery&&recovery.baseUpdatedAt===r.updatedAt&&recovery.templateSha===r.templateSha?recovery:readDraft();
 if(saved){resetVisible(saved.data,role.value);el('department').value=r.department;if(!portalMode||portalContext?.role==='employee')message('已恢復草稿，可繼續填寫。')}
 render();
}
// Original input listeners invalidate the signature first; then save a recovery
// snapshot. This is not a formal save or a change to the submitted record.
for(const event of ['input','change'])doc.addEventListener(event,e=>{if(e.target.closest('main')&&!e.target.closest('#identityDemo'))persistRecovery()});
for(const id of ['save','resume','reset'])el(id).addEventListener('click',()=>queueMicrotask(persistRecovery),true);
window.addEventListener('beforeunload',()=>{if(persistRecovery())dirty=false},true);
window.addEventListener('pagehide',persistRecovery);
function workflowKey(kind,r=record()){return [kind,r.period,r.employeeId].join(':')}
function workflowBase(kind,r){return kind==='review'?JSON.stringify([r.status,r.updatedAt,r.reviewScore,r.reviewComment]):JSON.stringify([r.employeeName,r.department,r.site])}
function pendingWorkflow(kind,r=record()){
 const key=workflowKey(kind,r),saved=workflowRecovery[key];
 if(saved&&saved.base===workflowBase(kind,r))return saved.values;
 delete workflowRecovery[key];return null;
}
function rememberWorkflow(kind){
 const r=record(),values=kind==='review'?{score:el('reviewScore').value,comment:el('reviewComment').value}:{name:el('editName').value,department:el('editDepartment').value,site:el('editSite').value};
 const saved=kind==='review'?{score:String(r.reviewScore??''),comment:r.reviewComment||''}:{name:r.employeeName,department:r.department,site:r.site};
 const key=workflowKey(kind,r);
 if(JSON.stringify(values)===JSON.stringify(saved))delete workflowRecovery[key];else workflowRecovery[key]={base:workflowBase(kind,r),values};
 persistRecovery();
 applyPortalUI();
}
for(const id of ['editName','editDepartment','editSite'])el(id).addEventListener('input',()=>rememberWorkflow('hr'));
function returnToForm(){
 const kind=el('actor').value==='hr'?'hr':null;
 if(kind&&pendingWorkflow(kind)&&!confirm('尚有未儲存的'+(kind==='review'?'主管評核':'人事資料')+'。返回後內容會保留於目前分頁，但尚未正式儲存。確定返回？'))return;
 if(dirty)message('原版表單尚有未暫存內容，返回不會清除；請記得暫存。');
 persistRecovery();if(dialog.open)dialog.close();
}
function textRow(container,label,value){const p=doc.createElement('p'),strong=doc.createElement('strong');strong.textContent=label+'：';p.append(strong,doc.createTextNode(String(value??'')));container.append(p)}
function details(container,r){
 container.replaceChildren();textRow(container,'員工',[r.employeeName,r.department,r.site,portalMode?window.HRUI.period(r.period):r.period].join('｜'));textRow(container,'狀態',api.states[r.status]);
 if(r.formData){
  const data=r.formData,layout=doc.createElement('div');layout.className='workflow-detail-layout';container.append(layout);
  function group(title){const section=doc.createElement('section');section.className='record-group';const h=doc.createElement('h3');h.textContent=title;section.append(h);layout.append(section);return section}
  const interview=group('五項面談');questions.forEach((q,i)=>textRow(interview,q,data['q'+i]));
  const scores=group((r.formRole==='supervisor'?'主管人員':'一般職員')+'自評');
  const table=doc.createElement('table');table.className='record-score-table';const head=doc.createElement('tr');
  for(const label of ['項目','自評','配分範圍']){const th=doc.createElement('th');th.textContent=label;head.append(th)}const thead=doc.createElement('thead');thead.append(head);table.append(thead);const body=doc.createElement('tbody');
  window.HROriginalForm.rubrics[r.formRole].forEach((rubric,i)=>{const row=doc.createElement('tr');for(const value of [rubric.name,data['score'+i],Math.min(...rubric.levels.flat())+'～'+Math.max(...rubric.levels.flat())]){const td=doc.createElement('td');td.textContent=value;row.append(td)}body.append(row)});
  table.append(body);scores.append(table);textRow(scores,'採用總分',r.selfScore);if(data.override)textRow(scores,'人工調整原因',data.reason);
  const projects=group('四筆工作與成果'),list=doc.createElement('ol');list.className='record-projects';
  for(let i=1;i<=4;i++){const li=doc.createElement('li');textRow(li,'工作與專案',data['project'+i]);textRow(li,'達成狀況與具體成果',data['outcome'+i]);list.append(li)}projects.append(list);
  const note=group('送出確認與紙本狀態');textRow(note,'填表姓名',r.confirmation?.name||data.name);textRow(note,'確認時間',r.confirmation?.confirmedAt?formatTime(r.confirmation.confirmedAt):'尚未確認送出');textRow(note,'流程',displayStatus(r));
  textRow(note,'確認方式','系統帶入姓名，不是親筆簽名；目前僅為模擬身分。');
  if(r.signatureImage&&el('actor').value==='hr'){const legacy=doc.createElement('details'),label=doc.createElement('summary');label.textContent='歷史手寫資料（唯讀保留）';const image=doc.createElement('img');image.src=r.signatureImage;image.alt='歷史手寫資料';image.style.maxWidth='100%';image.style.maxHeight='220px';legacy.append(label,image);note.append(legacy)}
 }else if(r.workflowVersion===3){textRow(container,'指定表單',r.formRole==='supervisor'?'主管人員':'一般職員');textRow(container,'填寫進度','尚無已儲存的目前表單內容')}
 else{ textRow(container,'舊版面談（完整保留）',r.interview);textRow(container,'舊版工作成果（完整保留）',r.results);textRow(container,'舊版逐項評分',Object.values(r.scores||{}).join('／'));textRow(container,'舊版簽名代稱',r.signature) }
 textRow(container,'採用總分',r.selfScore);textRow(container,'紙本流程',api.states[r.status]);
 if(r.versions?.length){const history=doc.createElement('details'),title=doc.createElement('summary');title.textContent='退回／重新分配前的版本（唯讀）';history.append(title);for(const v of r.versions)textRow(history,v.reason||'歷史版本',JSON.stringify({type:v.formRole,data:v.formData,selfScore:v.selfScore}));container.append(history)}
 if(r.legacySelf){const legacy=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent='轉換前舊版草稿備份';legacy.append(summary);textRow(legacy,'面談',r.legacySelf.interview);textRow(legacy,'工作成果',r.legacySelf.results);container.append(legacy)}
}
let appraisalPage=1;
function render(){
 const r=record(),actor=el('actor').value;
 hrLayout.hidden=actor!=='hr';
 el('workflowSelf').hidden=actor!=='employee';el('workflowReview').hidden=actor!=='supervisor';el('workflowHr').hidden=actor!=='hr';
 el('flowIdentity').textContent=[r.employeeName,r.department,r.site,r.supervisor].join('｜');
 state.textContent=r.period+' · '+r.employeeName+' · '+api.states[r.status];
 el('selfState').textContent=api.states[r.status]+' · '+(periodOpen()?'本期開放':'本期已截止');
 el('submitSelf').disabled=!editable();lockForm();
 el('progress').textContent='目前範圍共 '+allRecords().length+' 筆考績紀錄；下方依填寫與紙本進度統計。';
 overview.replaceChildren();for(const [key,label]of [['empty','未填寫'],['draft','草稿'],['self-submitted','已送出'],['returned','已退回'],['archived','已歸檔']]){const card=doc.createElement('div'),title=doc.createElement('span'),number=doc.createElement('strong');title.textContent=label;number.textContent=allRecords().filter(x=>key==='self-submitted'?['self-submitted','printed','received'].includes(statusKey(x)):statusKey(x)===key).length;card.dataset.state=key;card.append(title,number);overview.append(card)}
 if(portalMode&&portalContext.role!=='employee'&&!portalContext.permissions.includes('selfReview'))el('recordDetail').replaceChildren();else details(el('recordDetail'),r);
 el('assignedType').value=r.formRole||'staff';el('editName').value=r.employeeName;el('editDepartment').value=r.department;el('editSite').value=r.site;
 const pendingHr=pendingWorkflow('hr',r);if(pendingHr){el('editName').value=pendingHr.name;el('editDepartment').value=pendingHr.department;el('editSite').value=pendingHr.site}
 el('periodState').textContent=r.period+'：'+(periodOpen()?'本期開放填寫／評核':'本期已截止，仍可查詢及結案');
 const matched=filtered(),pageSize=Number(el('appraisalPageSize')?.value||20),pageCount=Math.max(1,Math.ceil(matched.length/pageSize));appraisalPage=Math.max(1,Math.min(appraisalPage,pageCount));if(el('appraisalPageInfo')){el('appraisalPageInfo').textContent=appraisalPage+' / '+pageCount+' ('+matched.length+')';el('appraisalPrev').disabled=appraisalPage===1;el('appraisalNext').disabled=appraisalPage===pageCount}
 const rows=(portalMode?matched.slice((appraisalPage-1)*pageSize,appraisalPage*pageSize):matched).map(x=>{const tr=doc.createElement('tr');for(const [column,value] of [x.period,[x.employeeName,x.department,x.site,x.formRole==='supervisor'?'主管表':'一般職員表'].join('／'),api.states[x.status],x.selfScore??'—','紙本評核'].entries()){const td=doc.createElement('td');if(column===1){const name=doc.createElement('strong');name.textContent=x.employeeName;const meta=doc.createElement('div');meta.className='workflow-person-detail';meta.textContent=x.department+'｜'+x.site;const type=doc.createElement('div');type.className='workflow-person-detail';type.textContent=x.formRole==='supervisor'?'主管人員表':'一般職員表';const heading=doc.createElement('div');heading.className='workflow-person-heading';heading.append(name,type);td.append(heading,meta)}else if(column===2)td.append(statusBadge(x));else td.textContent=value;tr.append(td)}const td=doc.createElement('td');
 const controls=doc.createElement('div');controls.className='workflow-row-actions';td.append(controls);
 function button(label,action){const b=doc.createElement('button');b.type='button';b.className='secondary';b.dataset.action=action;b.dataset.employee=x.employeeId;b.dataset.period=x.period;b.textContent=label;controls.append(b)}
 button('查看','view');if(x.status!=='draft'){button('Word','docx');button('Excel','xlsx');button('退回修改','return');const next={'self-submitted':['登記已列印','printed'],printed:['登記紙本收回','received'],received:['歸檔／結案','archived']}[x.status];if(next)button(...next)}tr.append(td);return tr});
 el('rows').replaceChildren(...rows);if(!rows.length){const tr=doc.createElement('tr'),td=doc.createElement('td');td.colSpan=6;td.textContent='沒有符合條件的測試紀錄';tr.append(td);el('rows').append(tr)}
 persistRecovery();applyPortalUI();updateFillProgress();if(portalMode)doc.dispatchEvent(new Event('workflow-rendered'));
}
open.addEventListener('click',()=>attempt(()=>{if(!dialog.open)dialog.showModal();render()}));
el('closeWorkflow').addEventListener('click',()=>attempt(returnToForm));
dialog.addEventListener('cancel',event=>{event.preventDefault();attempt(returnToForm)});
dialog.addEventListener('close',()=>{
 lockForm();persistRecovery();
 // Native dialog.close() restores focus to its opener. Do not steal focus
 // asynchronously from the first field the employee starts typing into.
});
el('actor').addEventListener('change',()=>{render();syncPaper().catch(error=>message(error.message))});
el('submitSelf').addEventListener('click',()=>{el('check').click();attempt(()=>storeSelf('submit-self'))});
capture('submit',()=>{el('check').click();return storeSelf('submit-self')});
el('saveEmployee').addEventListener('click',()=>attempt(async()=>{await remote('/api/hr/roster',{employeeId:el('employee').value,name:el('editName').value,department:el('editDepartment').value,site:el('editSite').value});await syncPaper();message('已儲存虛構員工資料。')}));
el('assignForm').addEventListener('click',()=>attempt(async()=>{await remote('/api/hr/assign',{employeeId:el('employee').value,formRole:el('assignedType').value});await syncPaper();message('已依職務指定表單；既有不同類型草稿保留於版本紀錄，不混用。')}));
el('togglePeriod').addEventListener('click',()=>attempt(async()=>{await remote('/api/hr/period',{period:period(),status:periodOpen()?'closed':'open'});await syncPaper()}));
for(const id of ['searchName','filterStatus','filterPeriod','filterType','filterDepartment'])el(id).addEventListener(id==='searchName'?'input':'change',render);
el('rows').addEventListener('click',event=>attempt(async()=>{
 if(el('actor').value!=='hr')throw Error('僅模擬人事可操作');const d=event.target.dataset;if(!d.action)return;
 const k={period:d.period,employeeId:d.employee};if(d.action==='return')k.expectedRevision=allRecords().find(r=>r.period===d.period&&r.employeeId===d.employee)?.revision||0;
 if(['docx','xlsx'].includes(d.action))return downloadPaper(d.action,[k]);
 if(d.action==='view'){el('period').value=d.period;el('employee').value=d.employee;if(selectionChanged(previous)){previous={employee:d.employee,period:d.period};el('storedRecord').open=true;requestAnimationFrame(()=>el('storedRecord').scrollIntoView({block:'start'}))}return}
 if(d.action==='return'){if(el('rows').dataset.returnPending)return;if(!el('returnReason').value.trim()){message('請填寫退回原因');el('returnReason').focus();return}el('rows').dataset.returnPending='true';event.target.disabled=true;try{if(portalMode&&!await window.HRUI.confirm('確定退回此員工的 '+d.period+' 自評？原送出版本會保留。',{title:'確認退回修改'}))return;await remote('/api/hr/return',{...k,reason:el('returnReason').value});message('已退回修改。')}finally{delete el('rows').dataset.returnPending;event.target.disabled=false}}else await remote('/api/hr/paper',{...k,stage:d.action});await syncPaper();
}));
function csvCell(value){let text=String(value??'');if(/^[\s]*[=+@\-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
el('exportCsv').addEventListener('click',()=>attempt(async()=>{
 if(el('actor').value!=='hr')throw Error('僅模擬人事可匯出');
 const header=['期別','員工','部門','工地','主管','狀態','自評','主管評分','主管評語','模擬簽名','表單類別',...questions,...Array.from({length:4},(_,i)=>['專案'+(i+1),'成果'+(i+1)]).flat(),...Array.from({length:8},(_,i)=>'自評項目'+(i+1)),'調整分數','調整原因'];
 const selected=filtered();const source=portalMode?(await remote('/api/portal/csv',{keys:selected.filter(r=>r.status!=='draft'&&r.formData).map(r=>({employeeId:r.employeeId,period:r.period}))})).records:selected;
 const rows=source.map(r=>{const data=r.formData||{};return [r.period,r.employeeName,r.department,r.site,r.supervisor,api.states[r.status],r.selfScore,r.reviewScore,r.reviewComment,r.signature,r.formRole||'舊版',...questions.map((_,i)=>data['q'+i]??(i===0?r.interview:'')),...Array.from({length:4},(_,i)=>[data['project'+(i+1)],data['outcome'+(i+1)]??(i===0?r.results:'')]).flat(),...Array.from({length:8},(_,i)=>data['score'+i]??r.scores?.[i]),data.override?data.manual:'',data.override?data.reason:'']});
 const csv='\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='面談考績_模擬資料.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}));
el('resetDemo').addEventListener('click',()=>attempt(async()=>{
 if(el('actor').value!=='hr')throw Error('僅模擬人事可重設');
 if(!confirm('確定清除全部整合模擬紀錄、虛構名冊修改及期別狀態？原版獨立草稿將保留。'))return;
 await remote('/api/hr/reset',{});store.reset();workflowRecovery={};window.HRGoogleCache.removeItem(SESSION_KEY);window.HRGoogleCache.removeItem('hr-demo-roster');periods.forEach(p=>window.HRGoogleCache.removeItem('hr-demo-period-'+p));dirty=false;location.reload();
}));
// Preserve the original identity gate, stylesheet, preview, and every form element.
// The only additional visible entry is at the original footer after its identity gate.
state.textContent=(portalMode?window.HRUI.period(record().period):record().period)+' · '+record().employeeName+' · '+api.states[record().status];
lockForm();
if(record().draftForms?.[role.value]){updateDraftInfo();el('status').textContent='偵測到原版完整草稿，請按「恢復已存草稿」繼續填寫。'}

function remote(endpoint,body,context={actor:el('actor').value,employeeId:el('employee').value}){
 const run=async()=>{
  if(!paperReady)throw Error('請以 node server/mock-server.cjs 開啟本機測試站；檔案模式僅供預覽。');
  let response;
  if(!portalMode){response=await fetch('/api/mock/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(context)});if(!response.ok)throw Error('無法建立模擬角色')}
  response=await fetch(endpoint,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){if(portalMode&&response.status===401){window.HRGoogleCache.removeItem(SESSION_KEY);HRGoogleNavigate('/')}throw Error((await response.json()).error||'操作失敗')}
  return endpoint==='/api/hr/export'?response:response.json();
 };const result=requestQueue.then(run,run);requestQueue=result.catch(()=>{});return result;
}
async function syncPaper(){
 if(!paperReady||!mockActive)return;const generation=++syncGeneration;contextReady=false;lockForm();
 try{
  const result=await remote('/api/records');const config=await fetch('/api/config').then(r=>r.json()).then(window.HRPortalConfig.normalize);if(generation!==syncGeneration)return;
  serverConfig=config;updatePeriods(config);
  if(portalMode){const response=await fetch('/api/portal/session');if(!response.ok)throw Error('模擬工作階段已失效');portalContext=await response.json();api.employees.splice(0,api.employees.length,...config.employees);serverRecords=new Set(result.records.map(r=>r.period+':'+r.employeeId))}
  for(const p of periods)window.HRGoogleCache.setItem('hr-demo-period-'+p,config.periodStatus[p]||'open');
  for(const e of config.employees)Object.assign(api.employees.find(x=>x.id===e.id),e);employeeOptions();
  for(const r of result.records)store.save(r.period,r);
  const current=record();if(!current.formRole){contextReady=portalMode&&portalContext?.role!=='employee';if(contextReady)render();return}
  const typeChanged=role.value!==current.formRole;
  const recover=mockSession?.recovery?.[[period(),el('employee').value,current.formRole].join(':')];
  const compatible=recover&&recover.templateSha===current.templateSha&&recover.baseUpdatedAt===current.updatedAt;
  // A late metadata response must never clear typing that started after the
  // request. A newly assigned different template is still applied separately.
  const preserveLive=dirty&&!typeChanged&&previous.employee===el('employee').value&&previous.period===period();
  if(!preserveLive){
   if(typeChanged||!current.formData&&!compatible)resetVisible(null,current.formRole,'');
   role.value=current.formRole;setRole(role.value);contextReady=true;restoreSessionForm();
  }else contextReady=true;
  if(current.status==='draft')el('name').value=current.employeeName;el('department').value=current.department;
  const prior=el('filterDepartment').value;el('filterDepartment').replaceChildren(new Option('全部',''),...[...new Set(config.employees.map(e=>e.department))].map(d=>new Option(d,d)));el('filterDepartment').value=prior;
  render();
 }catch(error){if(generation===syncGeneration){contextReady=false;lockForm();message(error.message)}}
}
async function downloadPaper(format,keys){
 if(el('actor').value!=='hr')throw Error('只有模擬人事可下載 Word／Excel');
 const response=await remote('/api/hr/export',{format,keys});
 const report=JSON.parse(decodeURIComponent(response.headers.get('X-Export-Report')||'%7B%7D'));
 const url=URL.createObjectURL(await response.blob()),a=doc.createElement('a');a.href=url;a.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'面談考績.'+(format==='word-zip'?'zip':format);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 message((report.notice||'匯出完成')+(report.warnings?.length?' 有 '+report.warnings.length+' 個內容過長欄位可能溢頁，未縮字或刪減。':''));
}
for(const [id,format] of [['batchWord','word-zip'],['batchExcel','xlsx']])el(id).addEventListener('click',()=>attempt(()=>downloadPaper(format,filtered().filter(r=>r.status!=='draft'&&r.formData).map(r=>({period:r.period,employeeId:r.employeeId})))));
const legacy=window.HRGoogleCache.getItem('hr-integrated-demo-v1');if(legacy&&!window.HRGoogleCache.getItem('hr-integrated-demo-before-paper'))window.HRGoogleCache.setItem('hr-integrated-demo-before-paper',legacy);
if(portalMode)window.HRWorkflow={refresh:syncPaper,selectRecord:async(employeeId,selectedPeriod)=>{el('employee').value=employeeId;el('period').value=selectedPeriod;previous={employee:employeeId,period:selectedPeriod};await syncPaper();el('storedRecord').open=true;el('storedRecord').scrollIntoView({block:'start'})},context:()=>portalContext,config:()=>serverConfig,records:allRecords,setAppraisalPage:n=>{appraisalPage=n;render()},saveBeforeSwitch:async()=>{if(dirty&&editable())await storeSelf('save-self');else if(dirty)throw Error('請先儲存或保留目前的修改，再切換。')}};
if(!portalMode&&(location.protocol==='http:'||location.protocol==='https:')){
 fetch('/api/config').then(r=>{if(!r.ok)throw Error('本機測試伺服器尚未啟動');return r.json()}).then(config=>{serverConfig=config;paperReady=true;return syncPaper()}).catch(error=>message(error.message));
}else if(!portalMode)message('請執行 node server/mock-server.cjs 使用表單分配、送出及人事 Word／Excel 匯出；檔案模式僅供預覽。');
})();
