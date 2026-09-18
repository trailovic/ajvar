"use client";

import {useEffect,useRef,useState} from 'react';
import {InputOTP,InputOTPGroup,InputOTPSlot} from '@/components/ui/input-otp';
import {authClient} from '@/lib/auth-client';
import {minimumPasswordLength} from '@/lib/password-change';
import PasswordSettings from './password-settings';

type Mode='login'|'register'|'code'|'recovery';
type PendingCode={email:string;kind:'signup'|'email'};


export default function EmailSignIn({onSignedIn,onBusy}:{onSignedIn:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [mode,setMode]=useState<Mode>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false);
 const [code,setCode]=useState(''),[pending,setPending]=useState<PendingCode|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState(0);
 const [authenticated,setAuthenticated]=useState(false);
 const working=useRef(false);

 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[remaining]);

 const work=async(action:()=>Promise<void>)=>{
  if(working.current)return;
  working.current=true;setBusy(true);onBusy(true);setError('');
  try{await action();}
  catch(e){setError(e instanceof Error?e.message:'Please try again.');}
  finally{working.current=false;setBusy(false);onBusy(false);}
 };
 const client=async()=>{
  const result=await authClient();
  if(!result)throw Error('Email sign-in is temporarily unavailable.');
  return result;
 };
 const finish=async()=>{
  // Retry loading after an API failure without reusing a consumed verification code.
  setPassword('');setCode('');setAuthenticated(true);
  await onSignedIn();
 };
 const switchMode=(next:Mode)=>{
  setMode(next);setPending(null);setCode('');setPassword('');setShowPassword(false);setError('');
 };
 const waitForCode=(address:string,kind:PendingCode['kind'])=>{
  setPassword('');setShowPassword(false);setPending({email:address,kind});setCode('');setRemaining(60);
 };
 const sendCode=async()=>{
  if(remaining>0)return;
  const auth=await client(),address=email.trim().toLowerCase();
  const {error}=await auth.auth.signInWithOtp({email:address,options:{shouldCreateUser:true}});
  if(error){
   if(error.status===429)throw Error('Please wait a minute before requesting another code.');
   throw Error('We couldn’t send a code. Check your email address and try again shortly.');
  }
  waitForCode(address,'email');
 };
 const resend=()=>work(async()=>{
  if(!pending||remaining>0)return;
  const auth=await client();
  const {error}=pending.kind==='signup'
   ?await auth.auth.resend({type:'signup',email:pending.email})
   :await auth.auth.signInWithOtp({email:pending.email,options:{shouldCreateUser:true}});
  if(error){
   if(error.status===429)throw Error('Please wait a minute before requesting another code.');
   throw Error('We couldn’t resend a code. Please try again shortly.');
  }
  setCode('');setRemaining(60);
 });
 const verify=async()=>{
  if(!pending||!/^\d{8}$/.test(code))return;
  const auth=await client();
  const {data,error}=await auth.auth.verifyOtp({email:pending.email,token:code,type:'email'});
  if(error||!data.session)throw Error('That code is incorrect or has expired. Try again or request a new code.');
  await finish();
 };
 const passwordSignIn=async()=>{
  const auth=await client(),address=email.trim().toLowerCase();
  if(mode==='register'){
   if(password.length<minimumPasswordLength)throw Error('Use at least 12 characters for your password.');
   const {data,error}=await auth.auth.signUp({email:address,password});
   if(error){
    if(error.status===429)throw Error('Too many attempts. Please wait a minute and try again.');
    if(error.code==='weak_password')throw Error('Choose a stronger password. Use a long, unique passphrase.');
    throw Error('We couldn’t create an account. Try again, or use email-code sign-in if you already have one.');
   }
   if(data.session){await finish();return;}
   // Supabase may obscure an existing account. Do not infer account existence.
   waitForCode(address,'signup');
   return;
  }
  const {data,error}=await auth.auth.signInWithPassword({email:address,password});
  if(error||!data.session){
   if(error?.status===429)throw Error('Too many attempts. Please wait a minute and try again.');
   throw Error('We couldn’t log you in. Check your email and password, or sign in with an email code.');
  }
  await finish();
 };
 const submit=()=>work(async()=>{
  if(authenticated){await onSignedIn();return;}
  if(pending){await verify();return;}
  if(mode==='code'){await sendCode();return;}
  await passwordSignIn();
 });

 const label=authenticated?'Continue to Ajvar':pending?'Verify email':mode==='register'?'Create account':mode==='code'?'Email me a code':'Log in';
 if(mode==='recovery')return <PasswordSettings recovery email={email} onBusy={onBusy} onBack={address=>{if(address)setEmail(address);switchMode('login');}}/>;
 return <form className="simple-form email-signin" aria-label="Ajvar sign-in" aria-busy={busy} onSubmit={event=>{event.preventDefault();void submit();}}>
  <fieldset disabled={busy}>
   {authenticated?<p className="form-help" role="status">You’re signed in. Continue to load your kitchen.</p>:pending?<>
    <p className="code-message">{pending.kind==='signup'?'If this address needs verification, check for a code at ':'Enter the code sent to '}<strong>{pending.email}</strong>.</p>
    <label htmlFor="email-code">Your verification code</label>
    <InputOTP id="email-code" maxLength={8} pattern="^[0-9]*$" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} autoFocus containerClassName="code-input"><InputOTPGroup>{[0,1,2,3,4,5,6,7].map(i=><InputOTPSlot index={i} key={i}/>)}</InputOTPGroup></InputOTP>
    <p className="form-help">Check your spam folder too. Your code expires in 10 minutes.</p>
   </>:<>
    <label>Email address<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" autoFocus/></label>
    {mode==='code'?<p className="form-help">We’ll email you a one-time code. No password needed.</p>:<>
     <label htmlFor="account-password">{mode==='register'?'Choose a password':'Password'}</label>
     <input id="account-password" type={showPassword?'text':'password'} autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={event=>setPassword(event.target.value)} required minLength={mode==='register'?minimumPasswordLength:undefined} aria-describedby={mode==='register'?'password-help':undefined}/>
     <button type="button" className="text-button password-visibility" aria-controls="account-password" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide password':'Show password'}</button>
     {mode==='register'&&<p id="password-help" className="form-help">Use at least 12 characters. We’ll verify your email before you choose your Ajvar username.</p>}
    </>}
   </>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <button className="button primary" disabled={busy||(!authenticated&&(pending?code.length!==8:mode==='code'&&remaining>0))} type="submit">{busy?'Please wait…':!authenticated&&!pending&&mode==='code'&&remaining?'Send code in '+remaining+'s':label}</button>
   {!authenticated&&(pending?<>
    <div className="code-actions"><button type="button" className="text-button" disabled={remaining>0} onClick={()=>void resend()}>{remaining?'Resend in '+remaining+'s':'Resend code'}</button><button type="button" className="text-button" onClick={()=>switchMode(mode)}>Use another email</button></div>
    {pending.kind==='signup'&&<button type="button" className="text-button auth-switch" onClick={()=>switchMode('login')}>Already have an account? Log in</button>}
   </>:<div className="auth-options">
    {mode==='login'&&<button type="button" className="text-button auth-switch" onClick={()=>switchMode('recovery')}>Forgot password?</button>}
    {mode!=='code'&&<button type="button" className="button outline" onClick={()=>switchMode('code')}>Email me a code instead</button>}
    {mode==='login'?<button type="button" className="text-button auth-switch" onClick={()=>switchMode('register')}>New here? Create an account</button>:<button type="button" className="text-button auth-switch" onClick={()=>switchMode('login')}>Log in with a password</button>}
    {mode==='code'&&<p className="form-help">New here? You’ll choose a username after verifying your email. Already have an Ajvar account? Use the same email to keep your recipes.</p>}
    {mode==='login'&&<p className="form-help">Previously signed in with a code, or forgot your password? You can still use an email code to get in.</p>}
   </div>)}
  </fieldset>
 </form>;
}
