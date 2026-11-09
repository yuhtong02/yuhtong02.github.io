/* Standalone fake-data workflow. Not a security boundary or real backend. */
(function(root){
'use strict';
const originalForm=typeof module!=='undefined'&&module.exports?require('./original-form-schema.js'):root.HROriginalForm;
const KEY='hr-integrated-demo-v1';
const states={draft:'員工草稿','self-submitted':'員工已送出','review-draft':'主管草稿','review-submitted':'主管已送出',closed:'已結案'};
const allowed={employee:['self'],supervisor:['supervisor'],hr:['hr']};
const employees=[{id:'__PENDING__',name:'',department:'',site:'',supervisor:''}];
const fresh=(period)=>({period,employeeId:'',employeeName:'',department:'',status:'draft',interview:'',results:'',selfScore:null,reviewScore:null,reviewComment:'',updatedAt:null});
function validScore(v){return (typeof v==='number'||typeof v==='string') && String(v).trim()!=='' && v!==null && Number.isFinite(Number(v)) && Number(v)*2%1===0 && Number(v)>=0 && Number(v)<=100}
function transition(r,action,values){
 const n={...r},v=values||{};
 if(action==='save-self'||action==='submit-self'){
   if(r.status!=='draft')throw Error('員工自評已送出，不可再修改');
   if(action==='submit-self'&&v.formData){const adopted=originalForm.validateOriginalForm(v.formData,v.formRole,v.signatureImage,v.signatureConfirmed);if(adopted!==Number(v.selfScore))throw Error('採用總分不一致')}
   if(action==='submit-self'&&!v.formData&&v.scores){const scores=Object.values(v.scores);if(scores.length!==8||scores.some(x=>String(x).trim()===''||!validScore(x))||scores.reduce((a,x)=>a+Number(x),0)!==Number(v.selfScore)||!String(v.signature||'').trim())throw Error('請完成逐項評分、總分與模擬簽名')}
   if(action==='submit-self'&&(!String(v.interview||'').trim()||!String(v.results||'').trim()||!validScore(v.selfScore)))throw Error('請填妥面談、工作成果及 0～100 分自評');
   if(v.selfScore!==''&&v.selfScore!==null&&!validScore(v.selfScore))throw Error('自評分數必須為 0～100，以 0.5 分為單位');
   Object.assign(n,{interview:String(v.interview||''),results:String(v.results||''),signature:String(v.signature||''),signatureImage:String(v.signatureImage||''),scores:v.scores||{},selfScore:v.selfScore===''||v.selfScore===null?null:Number(v.selfScore)});
   if(v.formData){
    n.formData=JSON.parse(JSON.stringify(v.formData));n.formRole=v.formRole;
    n.signatureConfirmed=v.signatureConfirmed===true;
    n.draftForms={...(r.draftForms||{}),[v.formRole]:{data:n.formData,signatureImage:n.signatureImage,savedAt:new Date().toISOString()}};
    if(!r.formData&&(r.interview||r.results))n.legacySelf=r.legacySelf||{interview:r.interview,results:r.results,selfScore:r.selfScore,scores:r.scores,signature:r.signature,signatureImage:r.signatureImage};
   }
   n.status=action==='submit-self'?'self-submitted':'draft';
 }else if(action==='save-review'||action==='submit-review'){
   if(!['self-submitted','review-draft'].includes(r.status))throw Error('目前不可編輯主管評核');
   if(action==='submit-review'&&(!validScore(v.reviewScore)||!String(v.reviewComment||'').trim()))throw Error('請填寫 0～100 分主管評分及評語');
   if(v.reviewScore!==''&&v.reviewScore!==null&&!validScore(v.reviewScore))throw Error('主管評分必須為 0～100，以 0.5 分為單位');
   Object.assign(n,{reviewScore:v.reviewScore===''||v.reviewScore===null?null:Number(v.reviewScore),reviewComment:String(v.reviewComment||'')});
   n.status=action==='submit-review'?'review-submitted':'review-draft';
 }else if(action==='close'){
   if(r.status!=='review-submitted')throw Error('主管尚未完成評核');
   n.status='closed';
 }else throw Error('未知操作');
 n.updatedAt=new Date().toISOString();
 return n;
}
function createStore(storage){
 const read=()=>{try{const d=JSON.parse(storage.getItem(KEY)||'{}');return d&&typeof d==='object'&&!Array.isArray(d)?d:{}}catch(e){return {}}};
 const get=(p,id='__PENDING__')=>{const d=read(),e=employees.find(e=>e.id===id);if(!e)throw Error('未知測試員工');const k=id==='__PENDING__'?p:p+':'+id;return d[k]&&d[k].period===p?{...d[k],employeeName:e.name,department:e.department,site:e.site,supervisor:e.supervisor}:{...fresh(p),employeeId:id,employeeName:e.name,department:e.department,site:e.site,supervisor:e.supervisor}};
 const save=(p,r)=>{const d=read();d[r.employeeId==='__PENDING__'?p:p+':'+r.employeeId]=r;storage.setItem(KEY,JSON.stringify(d));return r};
 const reset=()=>storage.removeItem(KEY);
 return {get,save,reset};
}
const api={transition,createStore,fresh,validScore,states,allowed,employees,validateOriginalForm:originalForm.validateOriginalForm};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.HRDemo=api;
})(typeof window!=='undefined'?window:null);
