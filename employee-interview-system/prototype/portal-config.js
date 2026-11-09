(function(root){
'use strict';
function normalize(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.periods)||!raw.periods.length||raw.periods.some(p=>typeof p!=='string'||!p.trim())||new Set(raw.periods).size!==raw.periods.length||!Array.isArray(raw.employees))throw Error('期別或員工設定尚未完整載入，請重新載入；資料不會被清除。');
 const issues=[],periods=[...raw.periods],policies=raw.periodPolicies&&typeof raw.periodPolicies==='object'&&!Array.isArray(raw.periodPolicies)?raw.periodPolicies:{};
 const activePeriod=periods.includes(raw.activePeriod)?raw.activePeriod:periods[0];if(activePeriod!==raw.activePeriod)issues.push('目前期別不存在，請人事確認預設期別設定。');
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 const periodPolicies=Object.fromEntries(periods.map(id=>{const p=policies[id],configured=!!p&&typeof p==='object'&&['startDate','endDate','basisDate','openDate','deadline'].every(k=>validDate(p[k]))&&['open','closed','archived'].includes(p.status)&&p.minimumMonths!==''&&p.minimumMonths!=null&&Number.isInteger(Number(p.minimumMonths))&&Number(p.minimumMonths)>=0&&Number(p.minimumMonths)<=1200&&p.startDate<=p.endDate&&p.openDate<=p.deadline&&p.basisDate>=p.startDate&&p.basisDate<=p.endDate;return [id,{...(configured?p:{}),id,name:typeof p?.name==='string'&&p.name.trim()?p.name:id,configured}]}));
 if(periods.some(p=>!periodPolicies[p].configured))issues.push('服務未提供完整期別規則。請重新啟動本機 Node 服務後再載入；缺漏規則不會自動開放填寫。');
 const periodStatus=raw.periodStatus&&typeof raw.periodStatus==='object'?raw.periodStatus:{};
 const employees=raw.employees.map(e=>{if(!e||typeof e.id!=='string')throw Error('員工設定格式不完整，已停止載入。');return {...e,assignments:e.assignments&&typeof e.assignments==='object'?e.assignments:{},applicablePeriods:Array.isArray(e.applicablePeriods)?e.applicablePeriods:[]}});
 return {...raw,periods,activePeriod,periodPolicies,periodStatus,employees,configIssues:issues};
}
const api={normalize};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.HRPortalConfig=api;
})(typeof window!=='undefined'?window:null);
