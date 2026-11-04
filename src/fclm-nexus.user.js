// ==UserScript==
// @name FCLM Nexus
// @namespace fclm-nexus
// @version 0.4.3
// @require https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
// @match https://fclm-portal.amazon.com/reports/ppaTimeOnTask*
// @grant none
// @run-at document-idle
// @noframes
// ==/UserScript==
(function(){
'use strict';
const roles={'100200':'Admin Home Area','100231':'ICQA ProblemSolve','100232':'ICQA Kaizen','100234':'Lead/PA-Receive','100244':'Flow SLAM Lead/PA','100245':'Pack Water Spider','100250':'Picking Kaizen','100287':'Transship Transport','100289':'Transfer In 5S','100292':'TransOut WaterSpider','100293':'Transfer Out Kaizen'};
function range(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Invalid date');return [date.replaceAll('-','/'),new Date(Date.parse(date)+86400000).toISOString().slice(0,10).replaceAll('-','/')];}
function stamp(ms){if(ms===null||ms===''||ms===0)return '';if(typeof ms!=='number'||!Number.isFinite(ms)||ms<=0)throw Error('Invalid timestamp');const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(p=>[p.type,p.value]));const {year:y,month:m,day:d,hour:h,minute:n,second:s}=p;const offset=Math.round((Date.UTC(+y,+m-1,+d,+h,+n,+s)-Math.floor(ms/1000)*1000)/60000);return y+'-'+m+'-'+d+'T'+h+':'+n+':'+s+'.'+String(ms%1000).padStart(3,'0')+(offset<0?'-':'+')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+String(Math.abs(offset)%60).padStart(2,'0');}
function workbookRows(workbook,sheetName,library){
 const sheet=workbook.Sheets[sheetName];if(!sheet)throw Error('Select a worksheet');
 const bounds=library.utils.decode_range(sheet['!ref']||'A1');
 if(bounds.e.r>100003)throw Error('Worksheet exceeds 100,000 data rows');
 const rows=library.utils.sheet_to_json(sheet,{header:1,range:{s:{r:0,c:0},e:{r:Math.max(4,bounds.e.r),c:7}},defval:'',raw:true,blankrows:true});
 const norm=value=>String(value??'').replace(/\u00a0/g,' ').trim();
 const header=rows.slice(0,20).findIndex(row=>/^employee\s*id$/i.test(norm(row[3])));
 const first=header<0?4:header+1,out=[],seen=new Set(),errors=[];
 const summary={firstRow:first+1,missingId:0,missingRole:0,blank:0,duplicates:0};
 for(let i=first;i<rows.length;i++){
  const row=rows[i];if(!row.some(value=>norm(value))){summary.blank++;continue;}
  const id=norm(row[3]),role=norm(row[7]);
  if(!id){summary.missingId++;continue;}
  if(!/^\d+$/.test(id)){errors.push('Excel row '+(i+1)+': invalid employee ID in D ('+id+') — skipped');continue;}
  if(!role)summary.missingRole++;
  const process=Object.keys(roles).find(k=>roles[k].toLowerCase()===role.toLowerCase());
  if(role&&!process){errors.push('Excel row '+(i+1)+': unsupported role in H ('+role+') — skipped');continue;}
  // Blank roles remain available for segment reporting.
  if(seen.has(id))summary.duplicates++;seen.add(id);
  out.push({id,name:norm(row[1]),role:process?roles[process]:role,process:process||'',row:i+1});
 }
 out.summary=summary;out.errors=errors;return out;
}

function segments(data){if(!Array.isArray(data?.report?.functionSegments))throw Error('Unexpected API response; check login/contract');return data.report.functionSegments;}
function body(e,date,source,s){const [start,end]=range(date);const p={startDate:start,startHour:'00',startMinute:'00',endDate:end,endHour:'00',endMinute:'00',employeeId:e.id,oldWarehouseId:'DIG1',warehouseId:source};if(s)Object.assign(p,{warehouseId:'NXU7',laborFuncStartTime:stamp(s.startTime),laborFuncEndTime:stamp(s.endTime),previousLaborProcess:s.processId||'',previousJobRole:s.processName||'',newLaborProcessId:e.process,newJobRole:e.role});return p;}
function eligible(s){return s.processName===null;}
function key(s){return JSON.stringify([s.startTime,s.endTime,s.processId,s.processName]);}


function reportDayEnd(date){
 const next=range(date)[1].replaceAll('/','-');
 const offset=stamp(Date.parse(next+'T00:00:00Z')).slice(-5);
 return Date.parse(next+'T00:00:00'+offset.slice(0,3)+':'+offset.slice(3));
}
function createTimeTotals(date,startedAt){
 const totals={DIG1:{totalMs:0,changedMs:0,saCount:0},NXU7:{totalMs:0,changedMs:0,saCount:0}},seen=new Map(),employees={DIG1:new Set(),NXU7:new Set()};
 const dayEnd=reportDayEnd(date);
 return {
  totals,
  include(employee,station,segment,reportEnd){
   const start=segment.startTime,open=segment.endTime===null||segment.endTime===''||segment.endTime===0;
   if(typeof start!=='number'||!Number.isFinite(start)||start<=0)throw Error('Invalid segment start timestamp');
   let end=segment.endTime;
   if(open)end=Math.min(startedAt,dayEnd,typeof reportEnd==='number'&&Number.isFinite(reportEnd)&&reportEnd>0?reportEnd:Infinity);
   if(typeof end!=='number'||!Number.isFinite(end)||end<start)throw Error('Invalid segment end timestamp');
   // Attribute a repeated/moved segment to the station where it was first read.
   const id=JSON.stringify([String(employee.id),start,open?'OPEN':segment.endTime]);
   if(seen.has(id))return seen.get(id);
   const record={station,duration:end-start,changed:false};seen.set(id,record);totals[station].totalMs+=record.duration;employees[station].add(String(employee.id));totals[station].saCount=employees[station].size;return record;
  },
  changed(record){if(!record.changed){totals[record.station].changedMs+=record.duration;record.changed=true;}}
 };
}
function formatTimeTotals(totals){
 const duration=ms=>(ms/60000).toFixed(2)+' minutes ('+(ms/3600000).toFixed(2)+' hours)';
 return ['\nTime totals by site (processed segments)',...['DIG1','NXU7'].flatMap(site=>[site+' — SAs: '+(totals[site].saCount??0),site+' — Total: '+duration(totals[site].totalMs),site+' — Changed: '+duration(totals[site].changedMs)])];
}

async function processEmployees(people,date,request,say,isStopped=()=>false,visibleEmployees=[],timeOptions={}){
 range(date);let total=0,updated=0,failed=0;const errors=[];
 const time=createTimeTotals(date,timeOptions.startedAt??Date.now());
 function record(employee,station,detail){failed++;errors.push((employee.row?'Excel row '+employee.row+' · ':'')+(employee.name||employee.id)+' · '+station+' · '+detail);}
 const imported=new Set(people.map(person=>person.id));
 try{
 for(const person of visibleEmployees)if(!imported.has(person.id))say('\n'+(person.name||person.id)+'\nNot in imported rota');
 for(const employee of people){
  if(isStopped())break;say('\n'+(employee.name||employee.id));let instance=0;
  for(const station of ['DIG1','NXU7']){
   if(isStopped())break;let list,dataEnd;
   try{const report=await request(body(employee,date,station),false);list=segments(report);dataEnd=report.endTime;}
   catch(error){record(employee,station,'read failed: '+error.message+' — skipped');say(station+' — read failed; skipped');if(error.fatal||isStopped())throw error;continue;}
   if(!list.length)say(station+': no segments');
   for(const segment of list){
    if(isStopped())break;total++;instance++;let line=instance+'. '+station;
    try{
     if(!segment||typeof segment!=='object')throw Error('Invalid segment data');
     line+=' · '+(segment.processName??'None');
     const timeRecord=time.include(employee,station,segment,dataEnd);
     if(!eligible(segment)){say(line);continue;}
     if(!employee.role){say(line+' — not updated: no rota role');continue;}
     if(!employee.process){say(line+' — not updated: unsupported role '+employee.role);continue;}
     if(!stamp(segment.startTime))throw Error('Missing segment start');
     await request(body(employee,date,station,segment),true);
     if(isStopped()){say(line+' — result unknown (stopped)');record(employee,station,'segment '+instance+': write result unknown after Stop');break;}
     const after=await request(body(employee,date,'NXU7'),false);
     const match=segments(after).some(current=>current&&current.startTime===segment.startTime && (current.endTime||'')===(segment.endTime||'') && String(current.processId)===employee.process);
     if(match){time.changed(timeRecord);updated++;say(line+' → '+employee.role+' (updated)');}
     else{record(employee,station,'segment '+instance+': update not confirmed');say(line+' — update not confirmed');}
    }catch(error){
     record(employee,station,'segment '+instance+': '+error.message+' — skipped; inspect any uncertain write before retrying');say(line+' — failed: '+error.message);
     if(error.fatal||isStopped())throw error;
    }
   }
  }
 }
 }finally{if(timeOptions.onErrors)timeOptions.onErrors(errors);else if(errors.length){say('\nProcessing errors ('+errors.length+')');for(const error of errors)say(error);}if(timeOptions.onTotals)timeOptions.onTotals(time.totals);}
 return {total,updated,failed,siteTimes:time.totals};
}
function visibleEmployees(){
 const out=new Map();if(!document.querySelectorAll)return [];
 for(const table of document.querySelectorAll('table')){
  const heading=table.querySelector('tr');if(!heading || !/Employee ID/i.test(heading.textContent) || !/Employee Name/i.test(heading.textContent))continue;
  for(const row of table.querySelectorAll('tr')){const cells=row.querySelectorAll('td');const id=cells[0]?.textContent.trim();if(/^\d+$/.test(id||'')&&cells[1])out.set(id,{id,name:cells[1].textContent.trim()});}
 }
 return [...out.values()];
}


function logFilename(date,now=new Date()){range(date);return 'fclm-nexus-results-'+date+'T'+now.toISOString().slice(11).replace(/[:.]/g,'-')+'.txt';}

function composeReport(lines,totals,processingErrors=[],importErrors=[],info){
 const sections=[];
 if(info){
  const rota=info.rotaDate.split('-').reverse().join('/');
  const run=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(info.startedAt));
  sections.push('FCLM Nexus Report\nRota date: '+rota+'\nRun date/time: '+run);
 }
 if(totals)sections.push('========== TIME TOTALS ==========\n'+formatTimeTotals(totals).join('\n').trim());
 const errors=[];
 if(processingErrors.length)errors.push('Processing errors ('+processingErrors.length+')\n'+processingErrors.join('\n'));
 if(importErrors.length)errors.push('Import errors ('+importErrors.length+')\n'+importErrors.join('\n'));
 if(errors.length)sections.push('========== ERRORS ==========\n'+errors.join('\n\n'));
 const details=lines.join('\n').trim();if(details)sections.push('========== CHANGES AND SEGMENT RESULTS ==========\n'+details);
 return sections.join('\n\n');
}

function renderReport(element,text){
 const previousTop=element.scrollTop;
 const follow=element.scrollHeight-element.clientHeight-previousTop<=1;
 element.textContent=text;
 element.scrollTop=follow?element.scrollHeight:previousTop;
}

if(typeof module==='object'&&module.exports){module.exports={roles,range,stamp,segments,body,eligible,key,workbookRows,processEmployees,renderReport,createTimeTotals,formatTimeTotals,composeReport,logFilename};return;}
if(document.getElementById('fclm-nexus'))return;
const host=document.createElement('div');host.id='fclm-nexus';document.body.append(host);const ui=host.attachShadow({mode:'open'});
ui.innerHTML='<style>:host{position:fixed;right:20px;top:155px;z-index:2147483646;font:14px Arial,sans-serif}[hidden]{display:none!important}section{box-sizing:border-box;background:white;color:#172333;padding:20px;width:min(580px,calc(100vw - 32px));max-height:calc(100vh - 175px);overflow:auto;border:1px solid #aab0b7;border-radius:5px;box-shadow:0 5px 25px #0003}h2{font-size:19px;margin:0 0 15px}.close{float:right}button,input,select{font:inherit;margin:5px 5px 5px 0;padding:7px;border:1px solid #a0a0ad;border-radius:4px;background:linear-gradient(#fff,#e7e7eb);color:#111}button{cursor:pointer}button:disabled{cursor:default;color:#777}label{display:block;margin:10px 0}#status{color:#526171}pre{max-height:250px;overflow:auto;white-space:pre-wrap;font:12px monospace}details{margin:0 0 14px;padding:10px;background:#f5f7f9;border:1px solid #d8dfe5;border-radius:4px}summary{cursor:pointer;font-weight:600}details ol{padding-left:20px;line-height:1.5;margin-bottom:8px}details p{line-height:1.4;margin:8px 0 0}</style><section id="panel" hidden aria-label="FCLM Nexus"><button id="close" class="close" aria-label="Close FCLM Nexus">×</button><h2>FCLM Nexus</h2><details id="instructions"><summary>Instructions · new users</summary><ol><li>Choose the rota date you want to process.</li><li>Click <strong>Import Excel file</strong> and select your .xlsx or .xls rota. Select the correct worksheet.</li><li>Use column B for names, D for employee IDs and H for assigned functions, such as Picking Kaizen. Keep an Employee ID header in D near the top of the sheet.</li><li>Click <strong>Run</strong> to apply updates immediately. The script checks DIG1 and NXU7 and assigns eligible unclassified segments to NXU7.</li><li>Read each numbered function under the employee name. <strong>(updated)</strong> means the assignment was confirmed. Missing roles, failures and unconfirmed updates show a short reason.</li></ol><p>Scroll up to pause automatic scrolling; return to the bottom to resume. <strong>Stop</strong> stops further processing; completed changes remain. Closing this panel does not stop a run.</p><p>The top of the report shows total and confirmed changed time for DIG1 and NXU7 in minutes and hours. Duplicate segments count once; open segments are measured at run start, capped at the report day.</p><p>Results download automatically when the run finishes, fails or stops. Look for <strong>fclm-nexus-results-[rota-date]T[time].txt</strong> in your browser download folder. To save directly to Downloads, set that as the browser download folder and turn off Ask where to save.</p></details><label>Rota date <input id="date" type="date"></label><button id="import">Import Excel file</button><input id="file" type="file" accept=".xlsx,.xls" hidden><label id="sheet-label" hidden>Worksheet <select id="sheet"></select></label><p id="status">No workbook imported.</p><button id="run" disabled>Run</button><button id="stop">Stop</button><pre id="log" aria-live="polite"></pre></section>';
const $=id=>ui.getElementById(id);$('date').value=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
// Use the native breadcrumb markup and styling instead of a floating imitation.
const launcher=document.createElement('li');launcher.id='fclm-nexus-launcher';launcher.className='fcpn-head-item';
const toggle=document.createElement('a');toggle.id='fclm-nexus-toggle';toggle.href='#';toggle.textContent='FCLM Nexus';toggle.setAttribute('role','button');toggle.setAttribute('aria-expanded','false');launcher.append(toggle);
function openPanel(open){$('panel').hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)$('import').focus();}
toggle.onclick=event=>{event.preventDefault();openPanel($('panel').hidden);};
toggle.onkeydown=event=>{if(event.key===' '){event.preventDefault();openPanel($('panel').hidden);}};
$('close').onclick=()=>{openPanel(false);toggle.focus();};
ui.addEventListener('keydown',event=>{if(event.key==='Escape')$('close').onclick();});
function placeLauncher(){
 const bar=document.querySelector('#fcpn-breadcrumb ul.fcpn-head-container');
 if(!bar){if(launcher.isConnected)launcher.remove();return;}
 if(launcher.parentElement===bar)return;
 const items=[...bar.children];const anchor=items.find(el=>el.textContent.trim()==='PPA Time On Task');
 // Reuse the portal's breadcrumb link/span hierarchy to retain its sprite geometry.
 const sample=anchor||items.filter(el=>el.classList.contains('fcpn-head-item')).at(-1);
 if(sample){
  const clone=sample.cloneNode(true);for(const el of [clone,...clone.querySelectorAll('*')]){el.removeAttribute('id');for(const attr of [...el.attributes])if(attr.name.startsWith('on'))el.removeAttribute(attr.name);}
  const oldLink=clone.querySelector('a');
  if(oldLink){const content=oldLink.querySelector('span')?.cloneNode(false);toggle.replaceChildren();if(content){content.textContent='FCLM Nexus';toggle.append(content);}else toggle.textContent='FCLM Nexus';toggle.className=oldLink.className;oldLink.replaceWith(toggle);launcher.replaceChildren(...clone.childNodes);}
 }
 if(anchor)anchor.after(launcher);else bar.append(launcher);
}
placeLauncher();new MutationObserver(placeLauncher).observe(document.body,{childList:true,subtree:true});
let busy=false,stopped=false,controller,logs=[],people=[],workbook=null,importErrors=[],processingErrors=[],siteTimes,reportInfo;
function reportText(){return composeReport(logs,siteTimes,processingErrors,importErrors,reportInfo);}
function refreshReport(){renderReport($('log'),reportText());}
function say(message){logs.push(message);refreshReport();}
function clearImport(){people=[];importErrors=[];processingErrors=[];siteTimes=undefined;reportInfo=undefined;$('run').disabled=true;}
function selectSheet(){clearImport();logs=[];$('log').textContent='';try{people=workbookRows(workbook,$('sheet').value,XLSX);importErrors=people.errors||[];$('status').textContent=people.length+' rota rows loaded'+(importErrors.length?' · '+importErrors.length+' rows skipped':'');$('run').disabled=!people.length;if(!people.length){reportInfo={rotaDate:$('date').value,startedAt:Date.now()};say('No valid employee rows.');downloadResults();}}catch(error){$('status').textContent=error.message;}}
$('import').onclick=()=>{if(!busy){$('file').value='';$('file').click();}};
$('file').onchange=async()=>{
 const file=$('file').files[0];if(!file||busy)return;clearImport();workbook=null;$('sheet').replaceChildren();$('sheet-label').hidden=true;
 busy=true;$('import').disabled=true;$('sheet').disabled=true;$('status').textContent='Reading workbook…';
 try{if(!/\.(xlsx|xls)$/i.test(file.name))throw Error('Choose an .xlsx or .xls file');if(file.size>20*1024*1024)throw Error('Workbook exceeds 20 MB');if(typeof XLSX==='undefined')throw Error('Excel reader unavailable; reinstall script and allow its SheetJS dependency');
 workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});if(!workbook.SheetNames.length)throw Error('Workbook has no worksheets');
 for(const name of workbook.SheetNames){const option=document.createElement('option');option.value=name;option.textContent=name;$('sheet').append(option);}
 $('sheet').value=workbook.SheetNames[0];$('sheet-label').hidden=false;selectSheet();
 }catch(e){clearImport();$('status').textContent='Import failed: '+e.message;}
 finally{busy=false;$('import').disabled=false;$('sheet').disabled=false;}
};
$('sheet').onchange=()=>{if(!busy)selectSheet();};
async function request(payload,write=false){
 controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/ajax//employee/updatePPATimeSegment',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest','Accept':write?'*/*':'application/json'},body:new URLSearchParams(payload),signal:controller.signal});
  if(response.redirected||response.status===401||response.status===403){const error=Error('Authentication failed ('+response.status+')');error.fatal=true;throw error;}
  if(response.status!==200)throw Error('HTTP '+response.status);
  const text=await response.text();
  if(/^\s*(?:<!doctype|<html)/i.test(text)){const error=Error('Received HTML instead of FCLM result; check login');error.fatal=true;throw error;}
  if(write){
   // Python accepts HTTP 200 for writes. Do not require a report schema here.
   if(text.trim().startsWith('{')){let result;try{result=JSON.parse(text);}catch{}if(result&&(result.success===false||result.error)){throw Error(String(result.error||result.message||'Update rejected'));}}
   return;
  }
  const data=JSON.parse(text);segments(data);return data;
 }finally{clearTimeout(timer);controller=undefined;}
}
$('stop').onclick=()=>{stopped=true;controller?.abort();say('Stop requested.');};
$('run').onclick=async()=>{
 if(busy||!people.length)return;busy=true;stopped=false;logs=[];processingErrors=[];siteTimes=undefined;$('log').textContent='';
 reportInfo={rotaDate:$('date').value,startedAt:Date.now()};
 for(const id of ['run','import','sheet','date'])$(id).disabled=true;
 try{await processEmployees(people,$('date').value,request,say,()=>stopped,visibleEmployees(),{startedAt:reportInfo.startedAt,onTotals:value=>{siteTimes=value;},onErrors:value=>{processingErrors=value;}});}
 catch(error){say((stopped?'Stopped: ':'Failed: ')+error.message);}
 finally{refreshReport();busy=false;for(const id of ['import','sheet','date'])$(id).disabled=false;$('run').disabled=!people.length;try{downloadResults();}catch(error){say('Automatic download failed: '+error.message);}}
};
function downloadResults(){
 const url=URL.createObjectURL(new Blob([reportText()],{type:'text/plain;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=logFilename(reportInfo?.rotaDate||$('date').value);link.hidden=true;
 document.body.append(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
})();
