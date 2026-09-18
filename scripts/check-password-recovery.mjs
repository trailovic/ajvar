import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const policy=asModule(compile('../lib/password-change.ts'));
const source=compile('../lib/password-recovery.ts').replace("'./password-change'",JSON.stringify(policy));
const {PasswordRecovery}=await import(asModule(source));
const user={id:'recovery-subject',email:'cook@example.test',email_confirmed_at:'2026-09-18',is_anonymous:false};
const session={user,access_token:'temporary-access',refresh_token:'temporary-refresh'};
function fixture(){
 let now=1000000,identity=user,verified=user,sendError=null,verifyError=null,updateError=null,cleanupFails=false,pendingVerification=null;
 const calls=[];
 const client={auth:{
  resetPasswordForEmail:async email=>{calls.push(['request',email]);return {error:sendError};},
  verifyOtp:async args=>{calls.push(['verify',args]);if(pendingVerification)await pendingVerification;return {data:{user:verified,session:{...session,user:verified}},error:verifyError};},
  getUser:async()=>({data:{user:identity},error:null}),
  updateUser:async args=>{calls.push(['update',args]);return {data:{user:identity},error:updateError};},
  signOut:async args=>{calls.push(['cleanup',args]);if(cleanupFails)throw Error('offline');return {error:null};},
 }};
 return {flow:new PasswordRecovery(client,' COOK@example.test ',()=>now),calls,
  advance:ms=>{now+=ms;},identity:value=>{identity=value;},verified:value=>{verified=value;},
  sendError:value=>{sendError=value;},verifyError:value=>{verifyError=value;},updateError:value=>{updateError=value;},
  cleanupFails:()=>{cleanupFails=true;},pauseVerification:()=>{let resume;pendingVerification=new Promise(resolve=>{resume=resolve;});return resume;},
 };
}
const updates=f=>f.calls.filter(([name])=>name==='update');
async function verifiedFixture(){const f=fixture();await f.flow.send();await f.flow.verify('12345678');return f;}

let f=fixture();
await assert.rejects(()=>f.flow.save('a long new password'),/verification has expired/);
await assert.rejects(()=>f.flow.verify('12345678'),/eight-digit/);
assert.equal(f.calls.length,0);
await f.flow.send();assert.deepEqual(f.calls[0],['request',user.email]);
await assert.rejects(()=>f.flow.send(),/wait a minute/);
await f.flow.verify('12345678');assert.deepEqual(f.calls[1],['verify',{email:user.email,token:'12345678',type:'recovery'}]);
await assert.rejects(()=>f.flow.save('short'),/12 characters/);
await f.flow.save('  a long exact password  ');
assert.deepEqual(updates(f),[['update',{password:'  a long exact password  '}]]);
assert.deepEqual(f.calls.at(-1),['cleanup',{scope:'local'}]);
await assert.rejects(()=>f.flow.save('another long password'),/Reopen/);
console.log('PASS recovery-only token verification, password validation and one-time save');

for(const code of ['user_not_found','email_not_confirmed']){
 f=fixture();f.sendError({code,status:400});await f.flow.send();await assert.rejects(()=>f.flow.send(),/wait a minute/);
}
f=fixture();f.sendError({status:429});await assert.rejects(()=>f.flow.send(),/wait a minute/);
f=fixture();f.sendError({status:503});await assert.rejects(()=>f.flow.send(),/couldn’t request/);
console.log('PASS missing accounts use the same request result; outages and rate limits remain actionable');

f=fixture();await f.flow.send();f.verifyError({code:'otp_expired'});
await assert.rejects(()=>f.flow.verify('12345678'),/incorrect or has expired/);
await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);assert.equal(updates(f).length,0);
console.log('PASS incorrect/expired codes cannot authorize a reset');

for(const invalid of [{...user,email:'other@example.test'},{...user,email_confirmed_at:null},{...user,is_anonymous:true}]){
 f=fixture();await f.flow.send();f.verified(invalid);await assert.rejects(()=>f.flow.verify('12345678'),/did not match/);
 assert.equal(updates(f).length,0);assert.deepEqual(f.calls.at(-1),['cleanup',{scope:'local'}]);
}
f=await verifiedFixture();f.identity({...user,id:'different-subject'});await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
assert.equal(updates(f).length,0);
console.log('PASS verified email, confirmation status and stable subject bind the reset');

f=await verifiedFixture();f.advance(10*60*1000);await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
f=await verifiedFixture();f.advance(60000);await f.flow.send();await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
console.log('PASS expiration and resending require verification again');

f=await verifiedFixture();f.updateError({code:'weak_password'});await assert.rejects(()=>f.flow.save('long enough password'),/stronger/);
f.updateError({code:'same_password'});await assert.rejects(()=>f.flow.save('long enough password'),/different/);
f.updateError(null);f.cleanupFails();await f.flow.save('a different long password');
await assert.rejects(()=>f.flow.save('another long password'),/Reopen/);
console.log('PASS policy errors permit correction; cleanup failure does not hide a successful reset');

f=fixture();await f.flow.send();const resume=f.pauseVerification();const verification=f.flow.verify('12345678');await f.flow.dispose();resume();
await assert.rejects(()=>verification,/Reopen/);assert.equal(updates(f).length,0);
assert.equal(f.calls.filter(([name])=>name==='cleanup').length,2);
console.log('PASS closing during verification revokes any late-created recovery session');
