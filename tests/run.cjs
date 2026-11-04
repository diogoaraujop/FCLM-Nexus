// Run: node tests/run.cjs. Synthetic data only; no network calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/fclm-nexus.user.js'),'utf8');const sandbox={module:{exports:{}},Intl,Date};vm.runInNewContext(source,sandbox);const c=sandbox.module.exports;let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const person={id:'123',name:'Test Person',role:'Picking Kaizen',process:'100250'};
const segment={startTime:Date.parse('2026-01-15T16:00:00Z'),endTime:Date.parse('2026-01-15T21:00:00Z'),processName:null,processId:null,trackingType:'INDIRECT'};
const lib={utils:{decode_range:()=>({e:{r:10}}),sheet_to_json:s=>s.rows}};
const rows=[['Title'],[],['Manager','Full Name','','Employee ID'],['','Test Person','','123','','','','Picking Kaizen']];
test('historical date bounds',()=>assert.equal(c.range('2024-02-29')[1],'2024/03/01'));
test('invalid date rejected',()=>assert.throws(()=>c.range('2025-02-29')));
test('winter offset',()=>assert.match(c.stamp(segment.startTime),/\+0000$/));
test('summer offset',()=>assert.match(c.stamp(Date.parse('2026-07-01T12:00:00Z')),/\+0100$/));
test('open segment',()=>assert.equal(c.stamp(null),''));
test('invalid timestamp',()=>assert.throws(()=>c.stamp(undefined)));
test('null-only updates',()=>{assert.equal(c.eligible(segment),true);assert.equal(c.eligible({...segment,processName:''}),false);});
test('read has no assignment',()=>assert.equal(c.body(person,'2026-01-15','DIG1').newJobRole,undefined));
test('write targets NXU7',()=>assert.equal(c.body(person,'2026-01-15','DIG1',segment).warehouseId,'NXU7'));
test('detect header and retain name',()=>assert.equal(c.workbookRows({Sheets:{R:{rows}}},'R',lib)[0].name,'Test Person'));
test('retain employees without roles for reporting',()=>{const r=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Test','','123']]}}},'R',lib);assert.equal(r.length,1);assert.equal(r[0].role,'');});
test('unknown role skipped and recorded',()=>{const result=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Test','','123','','','','Other']]}}},'R',lib);assert.equal(result.length,0);assert.match(result.errors[0],/unsupported role/);});
test('empty sheet returns no runnable rows',()=>assert.equal(c.workbookRows({Sheets:{R:{rows:[[]]}}},'R',lib).length,0));
test('preview and apply removed',()=>{assert.doesNotMatch(source,/id="preview"|id="apply"|confirm\(/);assert.match(source,/id="run"/);});
test('manual export button removed',()=>assert.doesNotMatch(source,/id="export"|Export log/));
test('no Sandbox branding',()=>assert.doesNotMatch(source,/Sandbox/));

test('duplicate employee with different roles kept in Excel order',()=>{const r=c.workbookRows({Sheets:{R:{rows:[...rows,['','Test Person','','123','','','','Admin Home Area']]}}},'R',lib);assert.equal(r.length,2);assert.equal(r[0].role,'Picking Kaizen');assert.equal(r[1].role,'Admin Home Area');assert.equal(r.summary.duplicates,1);});
test('blank role followed by assigned role imports',()=>{const r=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Test','','123'],rows[3]]}}},'R',lib);assert.equal(r.length,2);assert.equal(r[0].role,'');assert.equal(r[1].process,'100250');});
test('identical duplicate rows also retained',()=>assert.equal(c.workbookRows({Sheets:{R:{rows:[...rows,rows[3]]}}},'R',lib).length,2));

function reportElement(top=100){return {scrollTop:top,clientHeight:100,scrollHeight:200,set textContent(value){this.text=value;this.scrollHeight+=100;}};}
test('report follows new results at bottom',()=>{const element=reportElement();c.renderReport(element,'new');assert.equal(element.scrollTop,300);});
test('reading older results preserves scroll position',()=>{const element=reportElement(20);c.renderReport(element,'new');assert.equal(element.scrollTop,20);c.renderReport(element,'more');assert.equal(element.scrollTop,20);});
test('scrolling partway down keeps auto-scroll paused',()=>{const element=reportElement(70);c.renderReport(element,'new');assert.equal(element.scrollTop,70);});
test('returning to bottom resumes auto-scroll',()=>{const element=reportElement(20);c.renderReport(element,'new');element.scrollTop=element.scrollHeight-element.clientHeight;c.renderReport(element,'more');assert.equal(element.scrollTop,400);});

test('invalid ID skipped without losing later valid rows',()=>{const result=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Bad','','#N/A'],rows[3]]}}},'R',lib);assert.equal(result.length,1);assert.equal(result[0].id,'123');assert.match(result.errors[0],/Excel row 4: invalid employee ID/);});
test('multiple import errors retained in row order',()=>{const result=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Bad','','x'],['','Bad role','','456','','','','Wrong'],rows[3]]}}},'R',lib);assert.equal(result.length,1);assert.equal(result.errors.length,2);assert.match(result.errors[1],/Excel row 5/);});

const minute=60000,begin=Date.parse('2026-01-15T16:00:00Z');
test('closed totals and changed totals per site',()=>{const meter=c.createTimeTotals('2026-01-15',begin+120*minute);const d=meter.include(person,'DIG1',{startTime:begin,endTime:begin+60*minute});const n=meter.include(person,'NXU7',{startTime:begin+60*minute,endTime:begin+90*minute});meter.changed(d);assert.equal(meter.totals.DIG1.totalMs,60*minute);assert.equal(meter.totals.DIG1.changedMs,60*minute);assert.equal(meter.totals.NXU7.totalMs,30*minute);assert.equal(meter.totals.NXU7.changedMs,0);});
test('duplicates and moved segments counted once at source',()=>{const meter=c.createTimeTotals('2026-01-15',begin+120*minute),s={startTime:begin,endTime:begin+60*minute};meter.changed(meter.include(person,'DIG1',s));meter.changed(meter.include(person,'DIG1',s));meter.changed(meter.include(person,'NXU7',s));assert.equal(meter.totals.DIG1.totalMs,60*minute);assert.equal(meter.totals.DIG1.changedMs,60*minute);assert.equal(meter.totals.NXU7.totalMs,0);});
test('different employees with same interval each count',()=>{const meter=c.createTimeTotals('2026-01-15',begin+120*minute),s={startTime:begin,endTime:begin+30*minute};meter.include(person,'DIG1',s);meter.include({...person,id:'456'},'DIG1',s);assert.equal(meter.totals.DIG1.totalMs,60*minute);});
test('open segments use frozen run start including changed time',()=>{const meter=c.createTimeTotals('2026-01-15',begin+45*minute);for(const end of [null,'',0])meter.changed(meter.include(person,'DIG1',{startTime:begin,endTime:end}));assert.equal(meter.totals.DIG1.totalMs,45*minute);assert.equal(meter.totals.DIG1.changedMs,45*minute);});
test('historical open segment capped at report end',()=>{const meter=c.createTimeTotals('2026-01-15',Date.parse('2026-11-04T12:00:00Z'));meter.include(person,'DIG1',{startTime:begin,endTime:null},begin+60*minute);assert.equal(meter.totals.DIG1.totalMs,60*minute);});
test('historical open segment capped at selected day',()=>{const meter=c.createTimeTotals('2026-01-15',Date.parse('2026-11-04T12:00:00Z'));meter.include(person,'DIG1',{startTime:begin,endTime:null});assert.equal(meter.totals.DIG1.totalMs,8*60*minute);});
test('summer local day cap',()=>{const start=Date.parse('2026-07-15T22:00:00Z');const meter=c.createTimeTotals('2026-07-15',Date.parse('2026-11-04T12:00:00Z'));meter.include(person,'DIG1',{startTime:start,endTime:null});assert.equal(meter.totals.DIG1.totalMs,60*minute);});
test('invalid time is excluded',()=>{const meter=c.createTimeTotals('2026-01-15',begin);assert.throws(()=>meter.include(person,'DIG1',{startTime:begin,endTime:begin-1}));assert.equal(meter.totals.DIG1.totalMs,0);});
test('minutes and decimal hours formatted from precise totals',()=>{const lines=c.formatTimeTotals({DIG1:{totalMs:90.5*minute,changedMs:30*minute},NXU7:{totalMs:0,changedMs:0}}).join('\n');assert.match(lines,/90.50 minutes \(1.51 hours\)/);assert.match(lines,/Changed: 30.00 minutes \(0.50 hours\)/);});
async function timeIntegration(){
 const closed={...segment,startTime:begin,endTime:begin+60*minute},open={...segment,startTime:begin+60*minute,endTime:null};let changed=false;const calls=[];
 const result=await c.processEmployees([person,person],'2026-01-15',async(p,write)=>{calls.push(p);if(write){changed=true;return;}return {report:{functionSegments:p.warehouseId==='DIG1'?[{...closed,processName:changed?'Picking Kaizen':null,processId:changed?'100250':null}]:[{...closed,processName:'Picking Kaizen',processId:'100250'},{...open,processName:'Assigned',processId:'100200'}]}};},()=>{},()=>false,[],{startedAt:begin+90*minute});
 assert.equal(result.siteTimes.DIG1.totalMs,60*minute);assert.equal(result.siteTimes.DIG1.changedMs,60*minute);assert.equal(result.siteTimes.NXU7.totalMs,30*minute);assert.equal(result.siteTimes.NXU7.changedMs,0);
 const unconfirmed=await c.processEmployees([person],'2026-01-15',async(p,write)=>write?undefined:{report:{functionSegments:[closed]}},()=>{},()=>false,[],{startedAt:begin+90*minute});assert.equal(unconfirmed.siteTimes.DIG1.changedMs+unconfirmed.siteTimes.NXU7.changedMs,0);
 let partial;await assert.rejects(()=>c.processEmployees([person],'2026-01-15',async(p,write)=>{if(write){const e=Error('Auth');e.fatal=true;throw e;}return {report:{functionSegments:[closed]}};},()=>{},()=>false,[],{startedAt:begin+90*minute,onTotals:value=>{partial=value;}}));assert.equal(partial.DIG1.totalMs,60*minute);assert.equal(partial.DIG1.changedMs,0);
}

test('summary and errors precede employee details',()=>{const text=c.composeReport(['\nExample Person','1. DIG1 · None'],{DIG1:{totalMs:60000,changedMs:0},NXU7:{totalMs:0,changedMs:0}},['Read failed'],['Excel row 5: invalid ID']);assert.match(text,/^Time totals by site/);assert.ok(text.indexOf('Processing errors')<text.indexOf('Import errors'));assert.ok(text.indexOf('Import errors')<text.indexOf('Example Person'));assert.equal(text.match(/Read failed/g).length,1);});
test('empty summary or errors do not create empty headings',()=>assert.equal(c.composeReport(['Example Person']), 'Example Person'));
test('import-only report starts with errors',()=>assert.match(c.composeReport(['No valid employee rows.'],undefined,[],['Excel row 5: invalid ID']),/^Import errors/));

test('log filename uses selected date rather than current date',()=>assert.equal(c.logFilename('2026-11-02',new Date('2026-11-04T12:34:56.789Z')),'fclm-nexus-results-2026-11-02T12-34-56-789Z.txt'));
test('invalid selected date cannot name a log',()=>assert.throws(()=>c.logFilename('2026-02-30')));
async function scenario(mode){
 let requests=[],logs=[],assigned=false;const employee=mode==='norole'?{...person,role:'',process:''}:mode==='unknown'?{...person,role:'Other',process:''}:person;
 const request=async(p,write)=>{requests.push({p,write});if(write){if(mode==='writefail')throw Error('HTTP 500');if(mode==='fatal'){const error=Error('Login');error.fatal=true;throw error;}assigned=mode!=='unconfirmed';return;}return {report:{functionSegments:[{...segment,processName:assigned?'Picking Kaizen':null,processId:assigned?'100250':null},{...segment,startTime:segment.startTime+1000,processName:'Already assigned',processId:100200}]}};};
 if(mode==='fatal'){await assert.rejects(()=>c.processEmployees([employee],'2026-01-15',request,s=>logs.push(s)),/Login/);return;}
 const result=await c.processEmployees([employee],'2026-01-15',request,s=>logs.push(s),()=>mode==='stopped',[{id:'999',name:'Missing Person'}]);
 if(mode==='stopped'){assert.equal(requests.length,0);return;}
 assert.equal(result.total,4);assert.equal(logs.filter(s=>/^\d+\./.test(s)).length,4);assert.match(logs.join('\n'),/Test Person/);assert.match(logs.join('\n'),/Already assigned/);assert.match(logs.join('\n'),/Missing Person\nNot in imported rota/);assert.doesNotMatch(logs.join('\n'),/2026-|Tracking:|Total time|Process ID/);
 if(mode==='norole'||mode==='unknown'){assert.equal(requests.filter(r=>r.write).length,0);assert.match(logs.join('\n'),/not updated:/);return;}
 if(mode==='writefail'){assert.equal(result.failed,2);assert.equal(result.updated,0);}else if(mode==='unconfirmed'){assert.equal(result.updated,0);assert.match(logs.join('\n'),/update not confirmed/);}else{assert.equal(result.updated,1);assert.match(logs.join('\n'),/None → Picking Kaizen \(updated\)/);}
}
async function duplicateWorkflow(){
 const people=c.workbookRows({Sheets:{R:{rows:[...rows.slice(0,3),['','Test','','123'],rows[3],['','Test','','123','','','','Admin Home Area']]}}},'R',lib);let assigned=false,read=0,writes=[];
 await c.processEmployees(people,'2026-01-15',async(p,write)=>{if(write){assigned=true;writes.push(p.newJobRole);return;}read++;return {report:{functionSegments:[{...segment,processName:assigned?'Picking Kaizen':null}]}};},()=>{});
 assert.equal(read,7);assert.deepEqual(writes,['Picking Kaizen']);
}

async function runtimeErrors(){
 let calls=[],lines=[];const people=[{...person,row:4},{...person,id:'456',name:'Next Person',row:5}];
 await c.processEmployees(people,'2026-01-15',async(p)=>{calls.push(p.employeeId+':'+p.warehouseId);if(p.employeeId==='123')throw Error('NetworkError when attempting to fetch resource.');return {report:{functionSegments:[]}};},line=>lines.push(line));
 assert.ok(calls.includes('456:DIG1'));assert.ok(calls.includes('456:NXU7'));assert.match(lines.slice(-3).join('\n'),/Processing errors \(2\)/);assert.match(lines.at(-1),/Excel row 4.*NetworkError.*skipped/);
 let writes=0;lines=[];
 await c.processEmployees([person],'2026-01-15',async(p,write)=>{if(write){writes++;return;}return {report:{functionSegments:[{...segment,startTime:undefined},{...segment,processName:'Already assigned'}]}};},line=>lines.push(line));
 assert.equal(writes,0);assert.equal(lines.filter(line=>line.includes('Already assigned')).length,2);assert.match(lines.at(-1),/Invalid segment start timestamp/);
}
async function browserWriteResponse(reply){
 const ids=['date','run','stop','export','log','panel','close','import','file','sheet','sheet-label','status'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:'',disabled:false,hidden:id==='panel',files:[],textContent:'',focus(){},click(){},append(){},replaceChildren(){}}]));
 let downloads=[];const make=()=>({click(){downloads.push(this.download);},remove(){},style:{},className:'',setAttribute(){},append(){},focus(){},attachShadow:()=>({set innerHTML(v){},getElementById:id=>elements[id],addEventListener(){}})});
 let writes=0;const context={Blob:require('node:buffer').Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},Intl,Date,URLSearchParams,AbortController,setTimeout:(fn,delay)=>{if(delay===60000)return 0;return setTimeout(fn,delay);},clearTimeout,MutationObserver:class{observe(){}},XLSX:{...lib,read:()=>({SheetNames:['R'],Sheets:{R:{rows:[...rows,['','Bad record','','invalid']]}}})},document:{getElementById:()=>null,querySelector:()=>null,body:{append(){}},createElement:make},fetch:async(url,opts)=>{const p=Object.fromEntries(opts.body);const write=!!p.newJobRole;if(write)writes++;return {status:200,redirected:false,text:async()=>write?reply:JSON.stringify({report:{functionSegments:[writes&&!reply.includes('false')?{...segment,processId:'100250',processName:'Picking Kaizen'}:segment]}})};}};
 vm.runInNewContext(source,context);elements.date.value='2026-01-15';elements.file.files=[{name:'test.xlsx',size:100,arrayBuffer:async()=>new ArrayBuffer(0)}];await elements.file.onchange();assert.equal(elements.run.disabled,false);await elements.run.onclick();assert.equal(writes,reply.includes('false')?2:1);assert.equal(downloads.length,1);assert.match(elements.log.textContent,/^Time totals by site/);assert.ok(elements.log.textContent.indexOf('Import errors (1)')<elements.log.textContent.indexOf('\n\nTest Person'));assert.match(elements.log.textContent,/Import errors \(1\)/);assert.match(elements.log.textContent,/invalid employee ID in D \(invalid\) — skipped/);assert.match(elements.log.textContent,/NXU7 — Changed: [0-9.]+ minutes \([0-9.]+ hours\)/);assert.match(downloads[0],/^fclm-nexus-results-2026-01-15T.*Z\.txt$/);
 if(reply.includes('false'))assert.match(elements.log.textContent,/failed: Rejected/);else assert.match(elements.log.textContent,/None → Picking Kaizen \(updated\)/);
}

(async()=>{await timeIntegration();passed++;console.log('PASS combined, confirmed and partial-run time integration');await runtimeErrors();passed++;console.log('PASS network and malformed segment errors skipped with footer');await duplicateWorkflow();passed++;console.log('PASS duplicate rows processed in order without overwriting classified segments');for(const reply of ['','{"success":true}','{"success":false,"message":"Rejected"}']){await browserWriteResponse(reply);passed++;console.log('PASS browser write response '+(reply||'empty'));}for(const mode of ['normal','norole','unknown','writefail','fatal','stopped','unconfirmed']){await scenario(mode);passed++;console.log('PASS direct workflow '+mode);}console.log(passed+' checks passed');})().catch(error=>{console.error(error);process.exitCode=1;});
