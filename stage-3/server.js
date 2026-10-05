const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ledger = require('./ledger');

let state = emptyState();
function emptyState(){return {currency:'EUR',minor_units:2,authorization_ttl_seconds:600,users:[],tokens:[],payments:[],requests:[],splits:[],settlements:[],authorizations:[],operators:[],idempotency:[],reset_at:null,opening_balances:{},payment_revisions:{},statement_snapshots:[]};}
const now=()=>new Date().toISOString();
const id=(p)=>p+'_'+crypto.randomUUID().replaceAll('-','');
const json=(res,status,obj)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
const error=(res,status,code,message=code)=>json(res,status,{error:{code,message}});
function badBody(res){return error(res,400,'malformed_request');}
function parseNumber(x){return typeof x==='number'&&Number.isSafeInteger(x);}
function validAmount(x){return parseNumber(x)&&x>=1&&x<=1e9;}
function clone(x){return JSON.parse(JSON.stringify(x));}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;});req.on('end',()=>{try{resolve(JSON.parse(s||''));}catch(e){reject(e);}});req.on('error',reject);});}
function userByHandle(h){return state.users.find(u=>u.handle===h);}
function userById(i){return state.users.find(u=>u.id===i);}
function receipt(p,viewer){return {...p,settlement_id:p.settlement_id||null,authorization_id:p.authorization_id||null};}
function requestOut(r){return {...r};}
function auth(req,res){const h=req.headers.authorization;if(typeof h!=='string'||!h.startsWith('Bearer ')||!h.slice(7)) {error(res,401,'unauthenticated');return null;}const u=state.users.find(x=>x.tokens.includes(h.slice(7)));if(!u)error(res,401,'unauthenticated');return u||null;}
function validFieldTypes(b,allowed){for(const [k,t] of Object.entries(allowed)){if(Object.hasOwn(b,k)&&b[k]!==undefined&&typeof b[k]!==t)return false;}return true;}
function keyInfo(req,res,user,method,path,body){const key=req.headers['idempotency-key'];if(typeof key!=='string'||!key.length){error(res,400,'missing_idempotency_key');return {stop:true};}if(key.length>255)return {stop:true,status:422,code:'validation_failed'};const old=state.idempotency.find(x=>x.user_id===user.id&&x.key===key&&x.method===method&&x.path===path);if(old){if(canonical(old.body)!==canonical(body))return {stop:true,status:409,code:'idempotency_key_reuse'};json(res,200,old.response);return {stop:true};}return {stop:false,key,save:(response)=>state.idempotency.push({user_id:user.id,key,method,path,body:clone(body),response:clone(response)})};}
function amountRule(x){return validAmount(x);}
function recordPaymentRevision(p){
 if(!state.payment_revisions)state.payment_revisions={};
 if(!state.payment_revisions[p.payment_id])state.payment_revisions[p.payment_id]=[{revision:1,amount:p.amount,effective_at:p.created_at,recorded_at:p.created_at,reason:''}];
 if(!state.last_recorded_at||ledger.compareInstant(p.created_at,state.last_recorded_at)>0)state.last_recorded_at=p.created_at;
}
function payment(from,to,amount,note,visibility,request_id=null,settlement_id=null,created_at=now(),authorization_id=null){
 from.balance-=amount;to.balance+=amount;
 const p={payment_id:id('p'),from_user_id:from.id,from_handle:from.handle,to_user_id:to.id,to_handle:to.handle,amount,currency:state.currency,note,visibility,request_id,created_at,settlement_id,authorization_id};state.payments.push(p);recordPaymentRevision(p);return p;
}
function refreshExpirations(at=now()){for(const a of state.authorizations||[])if(a.status==='open'&&ledger.validInstant(a.expires_at)&&ledger.compareInstant(a.expires_at,at)<=0){a.status='expired';a.closed_at=a.expires_at;}}
function authRemaining(a){return a.status==='open'?Math.max(0,a.amount-a.captured_amount):0;}
function authView(a){return {...a,closed_at:a.closed_at??null,payment_ids:Array.isArray(a.payment_ids)?a.payment_ids:[],remaining_amount:authRemaining(a)};}
function heldFor(u){refreshExpirations();return (state.authorizations||[]).filter(a=>a.status==='open'&&a.from_user_id===u.id).reduce((n,a)=>n+authRemaining(a),0);}
function availableFor(u){return u.balance-heldFor(u);}
function authorizationIdValid(v){return typeof v==='string'&&v.length>0&&v.length<=64;}
function validateAuthorizationRecords(records,users,currency,at=now()){
 if(!Array.isArray(records))return null;const byId=new Map(users.map(u=>[u.id,u])),ids=new Set(),out=[];
 for(const raw of records){if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const a={...raw};
  if(!authorizationIdValid(a.authorization_id||a.id)||ids.has(a.authorization_id||a.id))return null;
  a.authorization_id=a.authorization_id||a.id;delete a.id;
  const from=byId.get(a.from_user_id),to=byId.get(a.to_user_id);
  if(!from||!to||a.from_user_id===a.to_user_id||!parseNumber(a.amount)||a.amount<1||a.amount>1e9||typeof a.note!=='string'||Array.from(a.note).length>200||!['public','private'].includes(a.visibility)||!['open','captured','voided','expired'].includes(a.status)||typeof a.expires_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(a.expires_at)||!Number.isFinite(Date.parse(a.expires_at)))return null;
  a.from_handle=from.handle;a.to_handle=to.handle;a.currency=currency;
  a.captured_amount=a.captured_amount===undefined?0:a.captured_amount;
  if(!parseNumber(a.captured_amount)||a.captured_amount<0||a.captured_amount>a.amount)return null;
  a.payment_ids=a.payment_ids===undefined?(a.payment_id?[a.payment_id]:[]):a.payment_ids;
  if(!Array.isArray(a.payment_ids)||a.payment_ids.some(p=>!authorizationIdValid(p)))return null;
  a.payment_id=a.payment_ids.length?a.payment_ids[a.payment_ids.length-1]:(a.payment_id||null);
  a.created_at=typeof a.created_at==='string'?a.created_at:now();
  if(a.status==='open'&&ledger.compareInstant(a.expires_at,at)<=0)a.status='expired';
  ids.add(a.authorization_id);out.push(a);
 }
 return out;
}
function page(req,res,who,kind){const q=new URL(req.url,'http://local').searchParams;for(const k of q.keys()){}let limit=50,offset=0;for(const [k,v] of q){if(k==='limit'||k==='offset'){if(!/^\d+$/.test(v))return error(res,422,'validation_failed');const n=Number(v);if(!Number.isSafeInteger(n))return error(res,422,'validation_failed');if(k==='limit')limit=n;else offset=n;}}
 if(limit<1||limit>200||offset<0)return error(res,422,'validation_failed');let rows;
 if(kind==='activity') {rows=state.payments.filter(p=>p.visibility==='public'||p.from_user_id===who.id||p.to_user_id===who.id).sort((a,b)=>ledger.compareInstant(b.created_at,a.created_at));}
 else {const dir=q.get('direction'),status=q.get('status');if(dir!==null&&!['incoming','outgoing'].includes(dir))return error(res,422,'validation_failed');if(status!==null&&!['pending','paid','declined','cancelled'].includes(status))return error(res,422,'validation_failed');rows=state.requests.filter(r=>(r.payer_id===who.id||r.requester_id===who.id)&&(!dir||(dir==='incoming'?r.payer_id===who.id:r.requester_id===who.id))&&(!status||r.status===status)).sort((a,b)=>b.created_at.localeCompare(a.created_at));}
 const items=rows.slice(offset,offset+limit);json(res,200,kind==='activity'?{payments:items.map(x=>receipt(x,who)),has_more:offset+limit<rows.length}:{requests:items.map(requestOut),has_more:offset+limit<rows.length});}
function pageAuthorizations(req,res,who){refreshExpirations();const q=new URL(req.url,'http://local').searchParams;let limit=50,offset=0;for(const [k,v] of q){if(k==='limit'||k==='offset'){if(!/^\d+$/.test(v))return error(res,422,'validation_failed');const n=Number(v);if(!Number.isSafeInteger(n))return error(res,422,'validation_failed');if(k==='limit')limit=n;else offset=n;}}if(limit<1||limit>200||offset<0)return error(res,422,'validation_failed');const dir=q.get('direction'),status=q.get('status');if(dir!==null&&!['incoming','outgoing'].includes(dir))return error(res,422,'validation_failed');if(status!==null&&!['open','captured','voided','expired'].includes(status))return error(res,422,'validation_failed');const rows=state.authorizations.filter(a=>(a.from_user_id===who.id||a.to_user_id===who.id)&&(!dir||(dir==='outgoing'?a.from_user_id===who.id:a.to_user_id===who.id))&&(!status||a.status===status)).sort((a,b)=>b.created_at.localeCompare(a.created_at));const items=rows.slice(offset,offset+limit);return json(res,200,{authorizations:items.map(authView),has_more:offset+limit<rows.length});}
function paging(q){let limit=50,offset=0;for(const key of ['limit','offset'])if(q.has(key)){const value=q.get(key);if(!/^\d+$/.test(value))return null;const n=Number(value);if(!Number.isSafeInteger(n))return null;if(key==='limit')limit=n;else offset=n;}if(limit<1||limit>200||offset<0)return null;return {limit,offset};}
function statementPage(req,res,who,requestStartedAt){
 const q=new URL(req.url,'http://local').searchParams,pg=paging(q);if(!pg)return error(res,422,'validation_failed');
 if(q.has('snapshot')){
  if(q.has('from')||q.has('to')||q.has('known_at'))return error(res,422,'validation_failed');
  const snap=state.statement_snapshots.find(x=>x.token===q.get('snapshot')&&x.user_id===who.id);if(!snap)return error(res,404,'not_found');
  const entries=snap.result.entries.slice(pg.offset,pg.offset+pg.limit);
  return json(res,200,{...snap.result,entries,has_more:pg.offset+pg.limit<snap.result.entries.length,snapshot:snap.token});
 }
 const from=q.has('from')?q.get('from'):null,to=q.has('to')?q.get('to'):requestStartedAt,knownAt=q.has('known_at')?q.get('known_at'):requestStartedAt;
 if(from!==null&&!ledger.validInstant(from)||!ledger.validInstant(to)||!ledger.validInstant(knownAt))return error(res,422,'validation_failed');
 if(from!==null&&ledger.compareInstant(from,to)>0)return error(res,422,'validation_failed');
 const result=ledger.statement(state,who.id,from,to,knownAt),token=crypto.randomBytes(24).toString('hex');
 state.statement_snapshots.push({token,user_id:who.id,result:clone(result)});
 const entries=result.entries.slice(pg.offset,pg.offset+pg.limit);
 return json(res,200,{...result,entries,has_more:pg.offset+pg.limit<result.entries.length,snapshot:token});
}
function rfcNowAfter(previous){
 const current=now();if(!previous||ledger.compareInstant(current,previous)>0)return current;
 const parsed=ledger.instant(previous),width=Math.max(9,parsed.fraction.length),scale=10n**BigInt(width);
 let n=BigInt((parsed.fraction||'').padEnd(width,'0'))+1n,sec=parsed.seconds;
 if(n>=scale){sec+=1n;n=0n;}
 const date=new Date(Number(sec)*1000).toISOString().replace(/\.\d{3}Z$/,'');
 const fraction=String(n).padStart(width,'0').replace(/0+$/,'');return fraction?date+'.'+fraction+'Z':date+'Z';
}
function paymentCorrection(req,res,user,path,requestStartedAt){
 return (async()=>{
  let b;try{b=await readBody(req);}catch{return badBody(res);}
  if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);
  const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;
  const paymentId=path.match(/^\/payments\/([^/]+)\/corrections$/)[1],p=state.payments.find(x=>x.payment_id===paymentId);
  if(!p)return error(res,404,'not_found');if(p.from_user_id!==user.id)return error(res,403,'forbidden');
  if(p.settlement_id||p.authorization_id)return error(res,422,'linked_payment_immutable');
  if(!Object.hasOwn(b,'expected_revision')||!Object.hasOwn(b,'amount')||!Object.hasOwn(b,'effective_at')||!Object.hasOwn(b,'reason'))return error(res,422,'validation_failed');
  if(!parseNumber(b.expected_revision)||b.expected_revision<1||!parseNumber(b.amount)||b.amount<0||b.amount>1e9||typeof b.effective_at!=='string'||!ledger.validInstant(b.effective_at)||ledger.compareInstant(b.effective_at,requestStartedAt)>0||typeof b.reason!=='string'||Array.from(b.reason).length<1||Array.from(b.reason).length>200)return error(res,422,'validation_failed');
  const revisions=state.payment_revisions[p.payment_id]||[],current=revisions[revisions.length-1];
  if(!current)return error(res,404,'not_found');if(b.expected_revision!==current.revision)return error(res,409,'stale_revision');
  const delta=b.amount-current.amount,from=userById(p.from_user_id),to=userById(p.to_user_id);
  if(delta>0&&availableFor(from)<delta||delta<0&&availableFor(to)<-delta)return error(res,409,'insufficient_funds');
  if(delta>0&&to.balance+delta>Number.MAX_SAFE_INTEGER||delta<0&&from.balance-delta>Number.MAX_SAFE_INTEGER)return error(res,422,'validation_failed');
  const recorded_at=rfcNowAfter(state.last_recorded_at||current.recorded_at),revision={revision:current.revision+1,amount:b.amount,effective_at:b.effective_at,recorded_at,reason:b.reason};
  const trial={...state,payment_revisions:{...state.payment_revisions}};
  if(!ledger.historicalSafe(trial,recorded_at,{payment_id:p.payment_id,revision}))return error(res,409,'historical_overdraft');
  if(delta>0){from.balance-=delta;to.balance+=delta;}else if(delta<0){from.balance-=delta;to.balance+=delta;}
  revisions.push(revision);state.payment_revisions[p.payment_id]=revisions;state.last_recorded_at=recorded_at;
  const out={payment_id:p.payment_id,revision:revision.revision,amount:revision.amount,effective_at:revision.effective_at,recorded_at:revision.recorded_at,reason:revision.reason};k.save(out);return json(res,201,out);
 })();
}
function serveFile(res,name,type){try{const data=fs.readFileSync(path.join(__dirname,name));res.writeHead(200,{'content-type':type});res.end(data);}catch{return error(res,500,'internal_error');}}
function acceptsHtml(req){return typeof req.headers.accept==='string'&&req.headers.accept.split(',').some(x=>x.trim().startsWith('text/html'));}
function validateFixture(f){
 if(!f||typeof f!=='object'||Array.isArray(f)||!['EUR','JPY','BHD'].includes(f.currency)||!Number.isInteger(f.minor_units)||!Array.isArray(f.users))return false;
 const exp={EUR:2,JPY:0,BHD:3};if(f.minor_units!==exp[f.currency])return false;
 const ttl=f.authorization_ttl_seconds===undefined?600:f.authorization_ttl_seconds;if(!parseNumber(ttl)||ttl<1)return false;
 const users=[],ids=new Set(),handles=new Set();
 for(const x of f.users){if(!x||typeof x!=='object'||typeof x.id!=='string'||!x.id.length||x.id.length>64||typeof x.email!=='string'||typeof x.password!=='string'||typeof x.display_name!=='string'||typeof x.handle!=='string'||!/^[a-z0-9_]{1,20}$/.test(x.handle)||!parseNumber(x.balance)||Math.abs(x.balance)>Number.MAX_SAFE_INTEGER||x.balance<0||ids.has(x.id)||handles.has(x.handle))return false;ids.add(x.id);handles.add(x.handle);const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(x.password,salt,64).toString('hex');users.push({id:x.id,email:x.email,password_hash:hash,password_salt:salt,display_name:x.display_name,handle:x.handle,balance:x.balance,tokens:[]});}
 const byId=i=>users.find(x=>x.id===i);const payments=[];
 if(f.payments!==undefined&&!Array.isArray(f.payments))return false;
 for(const p of f.payments||[]){const a=byId(p.from_user_id),b=byId(p.to_user_id);if(!a||!b||!parseNumber(p.amount)||p.amount<0||p.amount>1e9||typeof p.id!=='string'||!p.id.length||p.id.length>64||typeof p.note!=='string'||!['public','private'].includes(p.visibility))return false;payments.push({payment_id:p.id,from_user_id:a.id,from_handle:a.handle,to_user_id:b.id,to_handle:b.handle,amount:p.amount,currency:f.currency,note:p.note,visibility:p.visibility,request_id:null,created_at:typeof p.created_at==='string'?p.created_at:now(),settlement_id:null,authorization_id:null});}
 if(f.requests!==undefined&&!Array.isArray(f.requests))return false;const requests=[];
 for(const r of f.requests||[]){const a=byId(r.requester_id),b=byId(r.payer_id);if(!a||!b||!parseNumber(r.amount)||r.amount<0||r.amount>1e9||typeof r.id!=='string'||!r.id.length||r.id.length>64||typeof r.note!=='string'||!['pending','paid','declined','cancelled'].includes(r.status))return false;requests.push({request_id:r.id,requester_id:a.id,requester_handle:a.handle,payer_id:b.id,payer_handle:b.handle,amount:r.amount,currency:f.currency,note:r.note,status:r.status,payment_id:null,created_at:typeof r.created_at==='string'?r.created_at:now()});}
 const operators=Array.isArray(f.settlement_operator_ids)?f.settlement_operator_ids:[];if(operators.some(x=>!byId(x)))return false;
 const authorizations=validateAuthorizationRecords(f.authorizations===undefined?[]:f.authorizations,users,f.currency);
 if(!authorizations)return false;
 for(const u of users){const held=authorizations.filter(a=>a.status==='open'&&a.from_user_id===u.id&&ledger.compareInstant(a.created_at,now())<=0).reduce((n,a)=>n+authRemaining(a),0);if(held>u.balance)return false;}
 return {currency:f.currency,minor_units:f.minor_units,authorization_ttl_seconds:ttl,users,tokens:[],payments,requests,splits:[],settlements:[],authorizations,operators,idempotency:[]};
}
function validateFixtureStage3(input){
 try{
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const resetAt=now(),fixture=clone(input);
  if(fixture.payments!==undefined&&!Array.isArray(fixture.payments))return null;
  for(const p of fixture.payments||[]){
   if(!p||typeof p!=='object'||Array.isArray(p))return null;
   if(p.created_at===undefined)p.created_at=resetAt;
   if(!ledger.validInstant(p.created_at)||ledger.compareInstant(p.created_at,resetAt)>0)return null;
  }
  if(fixture.authorizations!==undefined&&!Array.isArray(fixture.authorizations))return null;
  for(const a of fixture.authorizations||[]){
   if(!a||typeof a!=='object'||Array.isArray(a))return null;
   if(a.created_at===undefined)a.created_at=resetAt;
   if(!ledger.validInstant(a.created_at))return null;
  }
  const result=validateFixture(fixture);if(!result)return null;
  result.reset_at=resetAt;result.opening_balances=Object.fromEntries(result.users.map(u=>[u.id,u.balance]));
  for(const p of result.payments){
   result.opening_balances[p.from_user_id]+=p.amount;
   result.opening_balances[p.to_user_id]-=p.amount;
  }
  if(Object.values(result.opening_balances).some(v=>!Number.isSafeInteger(v)||v<0))return null;
  result.payment_revisions=Object.fromEntries(result.payments.map(p=>[p.payment_id,[{revision:1,amount:p.amount,effective_at:p.created_at,recorded_at:p.created_at,reason:''}]]));
  result.statement_snapshots=[];result.last_recorded_at=resetAt;
  for(const a of result.authorizations){
   if(a.status==='expired'&&!a.closed_at)a.closed_at=a.expires_at;
   if(a.status==='open')a.closed_at=null;
  }
  if(!ledger.historicalSafe(result,resetAt))return null;
  return result;
 }catch{return null;}
}
function importValidate(x){if(!x||x.track!=='pocketful'||x.format_version!==1||!x.state||typeof x.state!=='object'||Array.isArray(x.state))return null;const s=x.state,units={EUR:2,JPY:0,BHD:3};if(units[s.currency]!==s.minor_units)return null;for(const k of ['users','tokens','payments','requests','splits','settlements','operators','idempotency'])if(!Array.isArray(s[k]))return null;try{const z=clone(s),ids=new Set(),handles=new Set();for(const u of z.users){if(!u||typeof u.id!=='string'||!u.id.length||u.id.length>64||typeof u.email!=='string'||typeof u.password_hash!=='string'||typeof u.password_salt!=='string'||typeof u.display_name!=='string'||typeof u.handle!=='string'||!/^[a-z0-9_]{1,20}$/.test(u.handle)||!parseNumber(u.balance)||u.balance<0||!Array.isArray(u.tokens)||u.tokens.some(t=>typeof t!=='string')||ids.has(u.id)||handles.has(u.handle))return null;ids.add(u.id);handles.add(u.handle);}const hasUser=id=>ids.has(id);for(const p of z.payments)if(!p||typeof p.payment_id!=='string'||!p.payment_id.length||p.payment_id.length>64||p.request_id!==null&&(typeof p.request_id!=='string'||!p.request_id.length||p.request_id.length>64)||!hasUser(p.from_user_id)||!hasUser(p.to_user_id)||!parseNumber(p.amount)||p.amount<0||p.amount>1e9||typeof p.note!=='string'||!['public','private'].includes(p.visibility)||typeof p.created_at!=='string')return null;for(const r of z.requests)if(!r||typeof r.request_id!=='string'||!r.request_id.length||r.request_id.length>64||!hasUser(r.requester_id)||!hasUser(r.payer_id)||!parseNumber(r.amount)||r.amount<0||r.amount>1e9||typeof r.note!=='string'||!['pending','paid','declined','cancelled'].includes(r.status)||typeof r.created_at!=='string')return null;if(z.operators.some(id=>!hasUser(id)))return null;for(const k of z.idempotency)if(!k||!hasUser(k.user_id)||typeof k.key!=='string'||!k.key.length||k.key.length>255||typeof k.method!=='string'||typeof k.path!=='string'||!k.body||typeof k.body!=='object'||!k.response||typeof k.response!=='object')return null;return z;}catch{return null;}}
function importValidateStage2(x){
 const base=importValidate(x);if(!base)return null;
 const z=clone(base);z.authorization_ttl_seconds=z.authorization_ttl_seconds===undefined?600:z.authorization_ttl_seconds;
 if(!parseNumber(z.authorization_ttl_seconds)||z.authorization_ttl_seconds<1)return null;
 const auths=validateAuthorizationRecords(z.authorizations===undefined?[]:z.authorizations,z.users,z.currency);if(!auths)return null;z.authorizations=auths;
 for(const p of z.payments){if(p.authorization_id===undefined)p.authorization_id=null;else if(p.authorization_id!==null&&!authorizationIdValid(p.authorization_id))return null;}
 for(const u of z.users){const held=auths.filter(a=>a.status==='open'&&a.from_user_id===u.id).reduce((n,a)=>n+authRemaining(a),0);if(held>u.balance)return null;}
 return z;
}
function deriveOpeningBalances(z){
 const opening=Object.fromEntries(z.users.map(u=>[u.id,u.balance]));
 for(const p of z.payments){opening[p.from_user_id]+=p.amount;opening[p.to_user_id]-=p.amount;}
 return opening;
}
function importValidateStage3(x){
 try{
  const z=importValidateStage2(x);if(!z)return null;const nowAt=now();
  if(z.reset_at!==undefined&&z.reset_at!==null&&!ledger.validInstant(z.reset_at))return null;
  if(!z.reset_at)z.reset_at=nowAt;
  if(!z.payment_revisions||typeof z.payment_revisions!=='object'||Array.isArray(z.payment_revisions))z.payment_revisions={};
  for(const p of z.payments){
   if(!ledger.validInstant(p.created_at))return null;
   if(!z.payment_revisions[p.payment_id])z.payment_revisions[p.payment_id]=[{revision:1,amount:p.amount,effective_at:p.created_at,recorded_at:p.created_at,reason:''}];
   const revisions=z.payment_revisions[p.payment_id];if(!Array.isArray(revisions)||!revisions.length)return null;
   for(let i=0;i<revisions.length;i++){
    const r=revisions[i];
    if(!r||r.revision!==i+1||!parseNumber(r.amount)||r.amount<0||r.amount>1e9||typeof r.reason!=='string'||Array.from(r.reason).length>200||!ledger.validInstant(r.effective_at)||!ledger.validInstant(r.recorded_at)||ledger.compareInstant(r.effective_at,r.recorded_at)>0)return null;
    if(i&&ledger.compareInstant(revisions[i-1].recorded_at,r.recorded_at)>=0)return null;
   }
   if(revisions[0].amount!==p.amount||revisions[0].effective_at!==p.created_at||revisions[0].recorded_at!==p.created_at||revisions[0].reason!=='')return null;
  }
  if(Object.keys(z.payment_revisions).some(id=>!z.payments.some(p=>p.payment_id===id)))return null;
  if(!z.opening_balances||typeof z.opening_balances!=='object'||Array.isArray(z.opening_balances))z.opening_balances=deriveOpeningBalances(z);
  for(const u of z.users)if(!parseNumber(z.opening_balances[u.id])||z.opening_balances[u.id]<0)return null;
  if(Object.keys(z.opening_balances).some(id=>!z.users.some(u=>u.id===id)))return null;
  if(!Array.isArray(z.statement_snapshots))z.statement_snapshots=[];
  const snapshotTokens=new Set();for(const snap of z.statement_snapshots){if(!snap||typeof snap.token!=='string'||!snap.token||snapshotTokens.has(snap.token)||!z.users.some(u=>u.id===snap.user_id)||!snap.result||typeof snap.result!=='object'||!parseNumber(snap.result.opening_balance)||!parseNumber(snap.result.closing_balance)||!Array.isArray(snap.result.entries))return null;snapshotTokens.add(snap.token);}
  for(const a of z.authorizations){
   if(!ledger.validInstant(a.created_at))return null;
   if(a.status==='open')a.closed_at=null;
   else if(a.closed_at!==undefined&&a.closed_at!==null&&!ledger.validInstant(a.closed_at))return null;
   else if(a.status==='expired'&&!a.closed_at)a.closed_at=a.expires_at;
   else if(a.status==='captured'&&!a.closed_at){const ids=a.payment_ids||[a.payment_id].filter(Boolean);const last=z.payments.find(p=>p.payment_id===ids[ids.length-1]);if(last)a.closed_at=last.created_at;}
   // Stage 2 exports did not record void event times; keep that history unknown rather than invent one.
   const captureRows=z.payments.filter(p=>p.authorization_id===a.authorization_id),captureIds=captureRows.map(p=>p.payment_id);
   if(captureIds.length!==a.payment_ids.length||captureIds.some((id,i)=>id!==a.payment_ids[i])||captureRows.some(p=>p.from_user_id!==a.from_user_id||p.to_user_id!==a.to_user_id||p.note!==a.note||p.visibility!==a.visibility)||captureRows.reduce((n,p)=>n+p.amount,0)!==a.captured_amount)return null;
   if(a.payment_id!==(a.payment_ids.length?a.payment_ids[a.payment_ids.length-1]:null))return null;
  }
  const authIds=new Set(z.authorizations.map(a=>a.authorization_id));
  if(z.payments.some(p=>p.authorization_id&&!authIds.has(p.authorization_id)))return null;
  let latest=z.reset_at;for(const rows of Object.values(z.payment_revisions))for(const r of rows)if(ledger.compareInstant(r.recorded_at,latest)>0)latest=r.recorded_at;
  z.last_recorded_at=ledger.validInstant(z.last_recorded_at)&&ledger.compareInstant(z.last_recorded_at,latest)>=0?z.last_recorded_at:latest;
  const knownAt=ledger.compareInstant(z.last_recorded_at,nowAt)>0?z.last_recorded_at:nowAt;
  for(const u of z.users){const expected=ledger.balanceAt(z,u.id,knownAt,knownAt);if(expected!==u.balance)return null;}
  if(!ledger.historicalSafe(z,knownAt))return null;
  return z;
 }catch{return null;}
}
async function handler(req,res){const requestStartedAt=now(),url=new URL(req.url,'http://local');const path=url.pathname;
 if(req.method==='GET'&&path==='/health')return json(res,200,{status:'ok'});
 if(req.method==='GET'&&path==='/app.js')return serveFile(res,'app.js','text/javascript; charset=utf-8');
 if(req.method==='GET'&&path==='/styles.css')return serveFile(res,'styles.css','text/css; charset=utf-8');
 if(req.method==='GET'&&acceptsHtml(req)&&['/','/requests','/split','/signup','/login','/authorizations'].includes(path))return serveFile(res,'index.html','text/html; charset=utf-8');
 if(req.method==='POST'&&path==='/_test/reset'){let b;try{b=await readBody(req);}catch{return badBody(res);}const s=validateFixtureStage3(b);if(!s)return error(res,422,'validation_failed');state=s;res.writeHead(204);return res.end();}
 if(req.method==='GET'&&path==='/_test/export'){refreshExpirations();return json(res,200,{track:'pocketful',format_version:1,state:clone(state)});}
 if(req.method==='POST'&&path==='/_test/import'){let b;try{b=await readBody(req);}catch{return badBody(res);}const s=importValidateStage3(b);if(!s)return error(res,422,'validation_failed');state=s;refreshExpirations();res.writeHead(204);return res.end();}
 if(req.method==='POST'&&['/auth/signup','/auth/login'].includes(path)){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);if(!validFieldTypes(b,{email:'string',password:'string',display_name:'string'}))return badBody(res);if(path.endsWith('signup')){if(b.email===undefined||b.password===undefined||b.display_name===undefined)return error(res,422,'validation_failed');if(typeof b.email!=='string'||typeof b.password!=='string'||typeof b.display_name!=='string'||!/^[^@\s]+@[^@\s]+$/.test(b.email)||b.password.length<8)return error(res,422,'validation_failed');if(state.users.some(u=>u.email.toLowerCase()===b.email.toLowerCase()))return error(res,409,'email_taken');const handle=b.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g,'_').slice(0,20);if(userByHandle(handle))return error(res,409,'handle_taken');const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(b.password,salt,64).toString('hex');const u={id:id('u'),email:b.email,password_hash:hash,password_salt:salt,display_name:b.display_name,handle,balance:0,tokens:[]};const token=crypto.randomBytes(32).toString('hex');u.tokens.push(token);state.users.push(u);state.opening_balances[u.id]=0;return json(res,201,{user_id:u.id,display_name:u.display_name,token});}if(b.email===undefined||b.password===undefined)return error(res,422,'validation_failed');const u=state.users.find(x=>x.email.toLowerCase()===String(b.email).toLowerCase());if(!u||!u.password_hash||crypto.scryptSync(String(b.password),u.password_salt,64).toString('hex')!==u.password_hash)return error(res,401,'unauthenticated');const token=crypto.randomBytes(32).toString('hex');u.tokens.push(token);return json(res,200,{user_id:u.id,display_name:u.display_name,token});}
 const user=auth(req,res);if(!user)return;
 if(req.method==='GET'&&path==='/me'){
  const q=url.searchParams,hasAsOf=q.has('as_of'),hasKnownAt=q.has('known_at');
  if(hasAsOf&&!ledger.validInstant(q.get('as_of'))||hasKnownAt&&!ledger.validInstant(q.get('known_at')))return error(res,422,'validation_failed');
  if(!hasAsOf&&!hasKnownAt){refreshExpirations();const held=heldFor(user),available=user.balance-held;return json(res,200,{user_id:user.id,display_name:user.display_name,handle:user.handle,balance:user.balance,total:user.balance,available,held,currency:state.currency,minor_units:state.minor_units});}
  const asOf=hasAsOf?q.get('as_of'):requestStartedAt,knownAt=hasKnownAt?q.get('known_at'):requestStartedAt;
  const total=ledger.balanceAt(state,user.id,asOf,knownAt),held=ledger.heldAt(state,user.id,asOf,knownAt),available=total-held;
  if(!Number.isSafeInteger(total)||!Number.isSafeInteger(held)||!Number.isSafeInteger(available))return error(res,422,'validation_failed');
  const out={user_id:user.id,display_name:user.display_name,handle:user.handle,balance:total,total,available,held,currency:state.currency,minor_units:state.minor_units};
  if(hasAsOf)out.as_of=q.get('as_of');if(hasKnownAt)out.known_at=q.get('known_at');return json(res,200,out);
 }
 if(req.method==='GET'&&path==='/statement')return statementPage(req,res,user,requestStartedAt);
 const revisionsMatch=path.match(/^\/payments\/([^/]+)\/revisions$/);
 if(req.method==='GET'&&revisionsMatch){const p=state.payments.find(x=>x.payment_id===revisionsMatch[1]);if(!p)return error(res,404,'not_found');if(p.from_user_id!==user.id&&p.to_user_id!==user.id)return error(res,404,'not_found');return json(res,200,{revisions:clone(state.payment_revisions[p.payment_id]||[])});}
 if(req.method==='POST'&&/^\/payments\/[^/]+\/corrections$/.test(path))return paymentCorrection(req,res,user,path,requestStartedAt);
 if(req.method==='GET'&&path==='/activity')return page(req,res,user,'activity');if(req.method==='GET'&&path==='/requests')return page(req,res,user,'requests');if(req.method==='GET'&&path==='/authorizations')return pageAuthorizations(req,res,user);
 if(req.method==='POST'&&path==='/payments'){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;if(b.to_handle===undefined||b.amount===undefined)return error(res,422,'validation_failed');if(typeof b.to_handle!=='string')return badBody(res);const note=b.note===undefined?'':b.note,vis=b.visibility===undefined?'public':b.visibility;if(!amountRule(b.amount)||typeof note!=='string'||Array.from(note).length>200||!['public','private'].includes(vis))return error(res,422,'validation_failed');const to=userByHandle(b.to_handle);if(!to)return error(res,404,'not_found');if(to.id===user.id)return error(res,422,'self_payment');if(availableFor(user)<b.amount)return error(res,409,'insufficient_funds');if(to.balance+b.amount>Number.MAX_SAFE_INTEGER)return error(res,422,'validation_failed');const p=payment(user,to,b.amount,note,vis);const out={payment_id:p.payment_id,from_user_id:p.from_user_id,from_handle:p.from_handle,to_user_id:p.to_user_id,to_handle:p.to_handle,amount:p.amount,currency:p.currency,note:p.note,visibility:p.visibility,request_id:null,created_at:p.created_at,settlement_id:null,authorization_id:null};k.save(out);return json(res,201,out);}
 if(req.method==='POST'&&path==='/requests'){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;if(b.payer_handle===undefined||b.amount===undefined)return error(res,422,'validation_failed');if(typeof b.payer_handle!=='string')return badBody(res);const note=b.note===undefined?'':b.note;if(!amountRule(b.amount)||typeof note!=='string'||Array.from(note).length>200)return error(res,422,'validation_failed');const payer=userByHandle(b.payer_handle);if(!payer)return error(res,404,'not_found');if(payer.id===user.id)return error(res,422,'self_request');const r={request_id:id('rq'),requester_id:user.id,requester_handle:user.handle,payer_id:payer.id,payer_handle:payer.handle,amount:b.amount,currency:state.currency,note,status:'pending',payment_id:null,created_at:now()};state.requests.push(r);k.save(r);return json(res,201,r);}
 const match=path.match(/^\/requests\/([^/]+)\/(pay|decline|cancel)$/);if(match){const [,rid,action]=match;let r=state.requests.find(x=>x.request_id===rid);if(!r)return error(res,404,'not_found');if(action==='pay'){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;if(r.payer_id!==user.id)return error(res,403,'forbidden');if(r.status!=='pending')return error(res,409,'request_not_pending');const vis=b.visibility===undefined?'public':b.visibility;if(!['public','private'].includes(vis))return error(res,422,'validation_failed');const from=user,to=userById(r.requester_id);if(availableFor(from)<r.amount)return error(res,409,'insufficient_funds');if(to.balance+r.amount>Number.MAX_SAFE_INTEGER)return error(res,422,'validation_failed');const p=payment(from,to,r.amount,r.note,vis,r.request_id);r.status='paid';r.payment_id=p.payment_id;const out={payment_id:p.payment_id,from_user_id:p.from_user_id,from_handle:p.from_handle,to_user_id:p.to_user_id,to_handle:p.to_handle,amount:p.amount,currency:p.currency,note:p.note,visibility:p.visibility,request_id:p.request_id,created_at:p.created_at,settlement_id:null,authorization_id:null};k.save(out);return json(res,201,out);}
 if(action==='decline'){if(r.payer_id!==user.id)return error(res,403,'forbidden');if(r.status==='declined')return json(res,200,r);if(r.status!=='pending')return error(res,409,'request_not_pending');r.status='declined';return json(res,200,r);}if(r.requester_id!==user.id)return error(res,403,'forbidden');if(r.status==='cancelled')return json(res,200,r);if(r.status!=='pending')return error(res,409,'request_not_pending');r.status='cancelled';return json(res,200,r);}
 if(req.method==='POST'&&path==='/authorizations'){
  let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);
  const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;
  if(b.to_handle===undefined||b.amount===undefined)return error(res,422,'validation_failed');if(typeof b.to_handle!=='string')return badBody(res);
  const note=b.note===undefined?'':b.note,visibility=b.visibility===undefined?'public':b.visibility;
  if(!amountRule(b.amount)||typeof note!=='string'||Array.from(note).length>200||!['public','private'].includes(visibility))return error(res,422,'validation_failed');
  const to=userByHandle(b.to_handle);if(!to)return error(res,404,'not_found');if(to.id===user.id)return error(res,422,'self_payment');
  if(availableFor(user)<b.amount)return error(res,409,'insufficient_funds');
  const created_at=now(),expiresMs=Date.parse(created_at)+state.authorization_ttl_seconds*1000;let expires_at;try{expires_at=new Date(expiresMs).toISOString();}catch{return error(res,422,'validation_failed');}
 const a={authorization_id:id('a'),from_user_id:user.id,from_handle:user.handle,to_user_id:to.id,to_handle:to.handle,amount:b.amount,captured_amount:0,currency:state.currency,note,visibility,status:'open',expires_at,payment_id:null,payment_ids:[],created_at,closed_at:null};
  state.authorizations.push(a);const out=authView(a);k.save(out);return json(res,201,out);
 }
 const captureMatch=path.match(/^\/authorizations\/([^/]+)\/capture$/);
 if(req.method==='POST'&&captureMatch){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);
  const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;
  const a=state.authorizations.find(x=>x.authorization_id===captureMatch[1]);if(!a)return error(res,404,'not_found');
  if(a.to_user_id!==user.id)return error(res,403,'forbidden');
  if(a.status==='open'&&ledger.compareInstant(a.expires_at,now())<=0){a.status='expired';a.closed_at=a.expires_at;}if(a.status==='expired')return error(res,409,'authorization_expired');
  if(a.status!=='open')return error(res,409,'authorization_not_open');if(Object.hasOwn(b,'final')&&typeof b.final!=='boolean')return badBody(res);
  const remaining=authRemaining(a),amount=b.amount===undefined?remaining:b.amount;if(!parseNumber(amount)||amount<1)return error(res,422,'validation_failed');if(amount>remaining)return error(res,422,'capture_exceeds_authorization');
  const from=userById(a.from_user_id),to=userById(a.to_user_id);if(to.balance+amount>Number.MAX_SAFE_INTEGER)return error(res,422,'validation_failed');
  const created_at=now(),p=payment(from,to,amount,a.note,a.visibility,null,null,created_at,a.authorization_id);a.captured_amount+=amount;a.payment_ids.push(p.payment_id);a.payment_id=p.payment_id;
  const still=a.amount-a.captured_amount;if(b.final!==false||still===0){a.status='captured';a.closed_at=created_at;}
  const out=receipt(p,user);k.save(out);return json(res,201,out);
 }
 const voidMatch=path.match(/^\/authorizations\/([^/]+)\/void$/);
 if(req.method==='POST'&&voidMatch){refreshExpirations();const a=state.authorizations.find(x=>x.authorization_id===voidMatch[1]);if(!a)return error(res,404,'not_found');if(a.from_user_id!==user.id)return error(res,403,'forbidden');if(a.status==='voided')return json(res,200,authView(a));if(a.status!=='open')return error(res,409,'authorization_not_open');a.status='voided';a.closed_at=now();return json(res,200,authView(a));}
 if(req.method==='POST'&&path==='/splits'){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;const hs=b.participant_handles,note=b.note===undefined?'':b.note;if(b.amount===undefined||hs===undefined)return error(res,422,'validation_failed');if(!amountRule(b.amount)||!Array.isArray(hs)||!hs.length||hs.some(x=>typeof x!=='string')||new Set(hs).size!==hs.length||typeof note!=='string'||Array.from(note).length>200)return error(res,422,'validation_failed');const members=hs.map(userByHandle);if(members.some(x=>!x))return error(res,404,'not_found');const count=members.length,base=Math.floor(b.amount/count),extra=b.amount%count;const shares=members.map((u,i)=>({handle:u.handle,amount:base+(i<extra?1:0)}));const created=now(),split_id=id('sp'),requests=[];for(let i=0;i<members.length;i++){const payer=members[i];if(payer.id===user.id)continue;const sh=shares[i];const r={request_id:id('rq'),requester_id:user.id,requester_handle:user.handle,payer_id:payer.id,payer_handle:payer.handle,amount:sh.amount,currency:state.currency,note,status:'pending',payment_id:null,created_at:created};state.requests.push(r);requests.push(r);}const out={split_id,amount:b.amount,currency:state.currency,note,shares,requests,created_at:created};state.splits.push(out);k.save(out);return json(res,201,out);}
 if(req.method==='POST'&&path==='/settlements'){let b;try{b=await readBody(req);}catch{return badBody(res);}if(!b||typeof b!=='object'||Array.isArray(b))return badBody(res);const k=keyInfo(req,res,user,req.method,path,b);if(k.stop)return k.status?error(res,k.status,k.code):undefined;if(!state.operators.includes(user.id))return error(res,403,'forbidden');if(!Array.isArray(b.transfers)||b.transfers.length<1||b.transfers.length>32)return error(res,422,'validation_failed');const transfers=[];for(const t of b.transfers){if(!t||typeof t!=='object'||Array.isArray(t)||typeof t.from_handle!=='string'||typeof t.to_handle!=='string')return error(res,422,'validation_failed');const note=t.note===undefined?'':t.note,vis=t.visibility===undefined?'public':t.visibility;if(!amountRule(t.amount)||typeof note!=='string'||Array.from(note).length>200||!['public','private'].includes(vis))return error(res,422,'validation_failed');const from=userByHandle(t.from_handle),to=userByHandle(t.to_handle);if(!from||!to)return error(res,404,'not_found');if(from.id===to.id)return error(res,422,'self_payment');transfers.push({from,to,amount:t.amount,note,visibility:vis});}const deltas=new Map();for(const t of transfers){deltas.set(t.from.id,(deltas.get(t.from.id)||0)-t.amount);deltas.set(t.to.id,(deltas.get(t.to.id)||0)+t.amount);}if([...deltas].some(([uid,d])=>userById(uid).balance+d<heldFor(userById(uid))))return error(res,409,'insufficient_funds');if([...deltas].some(([uid,d])=>userById(uid).balance+d>Number.MAX_SAFE_INTEGER))return error(res,422,'validation_failed');const committed_at=now(),settlement_id=id('st'),payments=transfers.map(t=>({payment_id:id('p'),from_user_id:t.from.id,from_handle:t.from.handle,to_user_id:t.to.id,to_handle:t.to.handle,amount:t.amount,currency:state.currency,note:t.note,visibility:t.visibility,request_id:null,created_at:committed_at,settlement_id,authorization_id:null}));for(const [uid,d] of deltas)userById(uid).balance+=d;state.payments.push(...payments);for(const p of payments)recordPaymentRevision(p);const out={settlement_id,committed_at,payments};state.settlements.push(out);k.save(out);return json(res,201,out);}
 return error(res,404,'not_found');
}
const server=http.createServer((req,res)=>{Promise.resolve(handler(req,res)).catch(()=>{if(!res.headersSent)error(res,500,'internal_error');else res.end();});});server.listen(Number(process.env.PORT)||8080,'0.0.0.0');
