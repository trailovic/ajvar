import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../lib/password-change.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {PasswordChange}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const user={id:'supabase-subject',email:'cook@example.test',email_confirmed_at:'2026-09-18',is_anonymous:false};
const session={user,access_token:'verified-access',refresh_token:'verified-refresh'};
function fixture(){
 let now=1000000,current=user,verified=user,updateError=null,restoreError=null,verifyError=null;
 const calls=[];
 const primary={auth:{getUser:async()=>({data:{user:current},error:null}),setSession:async tokens=>{calls.push(['adopt',tokens]);return {data:{session},error:restoreError};}}};
 const isolated={auth:{
  signInWithOtp:async args=>{calls.push(['send',args]);return {error:null};},
  verifyOtp:async args=>{calls.push(['verify',args]);return {data:{user:verified,session:{...session,user:verified}},error:verifyError};},
  getSession:async()=>({data:{session},error:null}),
  updateUser:async args=>{calls.push(['update',args]);return {data:{user},error:updateError};},
  signOut:async args=>{calls.push(['cleanup',args]);return {error:null};},
 }};
 return {flow:new PasswordChange(primary,isolated,'COOK@example.test',()=>now),calls,
  advance:ms=>{now+=ms;},switchAccount:()=>{current={...user,id:'another-subject'};},
  mismatch:()=>{verified={...user,id:'another-subject'};},
  updateError:value=>{updateError=value;},restoreError:()=>{restoreError=Error('offline');},
  badCode:()=>{verifyError=Error('expired');},
 };
}
let f=fixture();
await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
await assert.rejects(()=>f.flow.verify('12345678'),/eight-digit/);
assert.equal(f.calls.length,0);
console.log('PASS saving requires a requested and verified code');

f=fixture();await f.flow.send();
assert.deepEqual(f.calls[0],['send',{email:user.email,options:{shouldCreateUser:false}}]);
await assert.rejects(()=>f.flow.send(),/wait a minute/);
await f.flow.verify('12345678');
assert.equal(f.calls[1][1].type,'email');
await assert.rejects(()=>f.flow.save('short'),/12 characters/);
assert.deepEqual(await f.flow.save('  long exact password  '),{sessionRestored:true});
assert.deepEqual(f.calls.find(([name])=>name==='update'),['update',{password:'  long exact password  '}]);
assert.deepEqual(f.calls.find(([name])=>name==='adopt'),['adopt',{access_token:session.access_token,refresh_token:session.refresh_token}]);
await f.flow.dispose();assert.ok(!f.calls.some(([name])=>name==='cleanup'));
await assert.rejects(()=>f.flow.save('another long password'),/Reopen/);
console.log('PASS same-account update, cooldown, password preservation and session handoff');

f=fixture();await f.flow.send();f.badCode();
await assert.rejects(()=>f.flow.verify('12345678'),/incorrect or has expired/);
await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
assert.ok(!f.calls.some(([name])=>name==='update'));
console.log('PASS invalid codes cannot authorize a password update');

f=fixture();await f.flow.send();f.mismatch();
await assert.rejects(()=>f.flow.verify('12345678'),/did not match/);
assert.ok(f.calls.some(([name])=>name==='cleanup'));
assert.ok(!f.calls.some(([name])=>name==='adopt'||name==='update'));
console.log('PASS a different Supabase subject cannot replace the account session');

f=fixture();await f.flow.send();await f.flow.verify('12345678');f.switchAccount();
await assert.rejects(()=>f.flow.save('long enough password'),/session changed/);
assert.ok(!f.calls.some(([name])=>name==='update'));
console.log('PASS switching accounts during verification blocks the update');

f=fixture();await f.flow.send();await f.flow.verify('12345678');f.advance(10*60*1000);
await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
await f.flow.send();await assert.rejects(()=>f.flow.save('long enough password'),/verification has expired/);
console.log('PASS expired verification and resending both require a new code');

f=fixture();await f.flow.send();await f.flow.verify('12345678');f.updateError({code:'weak_password'});
await assert.rejects(()=>f.flow.save('long enough password'),/stronger password/);
assert.ok(!f.calls.some(([name])=>name==='adopt'));
f.updateError({code:'same_password'});await assert.rejects(()=>f.flow.save('long enough password'),/different/);
f.updateError(null);assert.deepEqual(await f.flow.save('different long password'),{sessionRestored:true});
console.log('PASS provider password policy errors allow a corrected retry');

f=fixture();await f.flow.send();await f.flow.verify('12345678');f.restoreError();
assert.deepEqual(await f.flow.save('long enough password'),{sessionRestored:false});
assert.equal(f.calls.filter(([name])=>name==='update').length,1);
assert.ok(f.calls.some(([name])=>name==='cleanup'));
console.log('PASS session refresh failure still reports the successful password save');

f=fixture();await f.flow.send();await f.flow.verify('12345678');await f.flow.dispose();
await assert.rejects(()=>f.flow.save('long enough password'),/Reopen/);
assert.deepEqual(f.calls.at(-1),['cleanup',{scope:'local'}]);
console.log('PASS cancelling revokes only the temporary verification session');
