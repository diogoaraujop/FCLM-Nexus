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
async function browserWriteResponse(reply){
 const ids=['date','run','stop','export','log','panel','close','import','file','sheet','sheet-label','status'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:'',disabled:false,hidden:id==='panel',files:[],textContent:'',focus(){},click(){},append(){},replaceChildren(){}}]));
 let downloads=[];const make=()=>({click(){downloads.push(this.download);},remove(){},style:{},className:'',setAttribute(){},append(){},focus(){},attachShadow:()=>({set innerHTML(v){},getElementById:id=>elements[id],addEventListener(){}})});
 let writes=0;const context={Blob:require('node:buffer').Blob,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},Intl,Date,URLSearchParams,AbortController,setTimeout:(fn,delay)=>{if(delay===60000)return 0;return setTimeout(fn,delay);},clearTimeout,MutationObserver:class{observe(){}},XLSX:{...lib,read:()=>({SheetNames:['R'],Sheets:{R:{rows:[...rows,['','Bad record','','invalid']]}}})},document:{getElementById:()=>null,querySelector:()=>null,body:{append(){}},createElement:make},fetch:async(url,opts)=>{const p=Object.fromEntries(opts.body);const write=!!p.newJobRole;if(write)writes++;return {status:200,redirected:false,text:async()=>write?reply:JSON.stringify({report:{functionSegments:[writes&&!reply.includes('false')?{...segment,processId:'100250',processName:'Picking Kaizen'}:segment]}})};}};
 vm.runInNewContext(source,context);elements.date.value='2026-01-15';elements.file.files=[{name:'test.xlsx',size:100,arrayBuffer:async()=>new ArrayBuffer(0)}];await elements.file.onchange();assert.equal(elements.run.disabled,false);await elements.run.onclick();assert.equal(writes,reply.includes('false')?2:1);assert.equal(downloads.length,1);assert.match(elements.log.textContent,/Import errors \(1\)/);assert.match(elements.log.textContent,/invalid employee ID in D \(invalid\) — skipped$/);assert.match(downloads[0],/^fclm-nexus-results-\d{4}-\d{2}-\d{2}T.*Z\.txt$/);
 if(reply.includes('false'))assert.match(elements.log.textContent,/failed: Rejected/);else assert.match(elements.log.textContent,/None → Picking Kaizen \(updated\)/);
}

(async()=>{await duplicateWorkflow();passed++;console.log('PASS duplicate rows processed in order without overwriting classified segments');for(const reply of ['','{"success":true}','{"success":false,"message":"Rejected"}']){await browserWriteResponse(reply);passed++;console.log('PASS browser write response '+(reply||'empty'));}for(const mode of ['normal','norole','unknown','writefail','fatal','stopped','unconfirmed']){await scenario(mode);passed++;console.log('PASS direct workflow '+mode);}console.log(passed+' checks passed');})().catch(error=>{console.error(error);process.exitCode=1;});
