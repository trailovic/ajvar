import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../lib/auth-server.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
const env={SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'public-key'};
let answer,seenToken,linked=0,legacy=0;
class IdentityConflict extends Error {}
const createClient=()=>({auth:{getUser:async token=>{seenToken=token;return answer;}}});
const {getAjvarUser,AuthenticationError}=new Function('env','createClient','getChatGPTUser','database','IdentityConflict','resolveProfileIdentity',source+';return {getAjvarUser,AuthenticationError};')(env,createClient,async()=>{legacy++;return {userId:'old'};},()=>({}),IdentityConflict,async(_db,subject,email)=>{linked++;assert.equal(subject,'verified-subject');assert.equal(email,'user@example.test');return 'stable-profile';});
const request=authorization=>new Request('https://ajvar.test/api/hub',{headers:{'oai-authenticated-user-id':'forged',...(authorization?{authorization}:{})}});
assert.equal(await getAjvarUser(request()),null);assert.equal(legacy,0);
await assert.rejects(()=>getAjvarUser(request('Basic forged')),AuthenticationError);
answer={data:{user:null},error:{status:401}};await assert.rejects(()=>getAjvarUser(request('Bearer invalid')),AuthenticationError);assert.equal(linked,0);
answer={data:{user:{id:'verified-subject',email:'user@example.test'}},error:null};await assert.rejects(()=>getAjvarUser(request('Bearer unconfirmed')),AuthenticationError);assert.equal(linked,0);
answer.data.user.email_confirmed_at='2026-09-16';answer.data.user.is_anonymous=true;await assert.rejects(()=>getAjvarUser(request('Bearer anonymous')),AuthenticationError);
answer.data.user.is_anonymous=false;assert.deepEqual(await getAjvarUser(request('Bearer verified')), {userId:'stable-profile',email:'user@example.test',fullName:undefined});assert.equal(seenToken,'verified');assert.equal(linked,1);
answer={data:{user:null},error:{status:503}};await assert.rejects(()=>getAjvarUser(request('Bearer token')),/unavailable/);
delete env.SUPABASE_URL;assert.equal((await getAjvarUser(request())).userId,'old');assert.equal(legacy,1);
console.log('Authentication checks passed: trusted verification, email confirmation, anonymous denial, spoofed headers, outage handling and gated legacy fallback.');
