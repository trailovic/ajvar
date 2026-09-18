"use client";

import {useEffect,useRef,useState} from 'react';
import {InputOTP,InputOTPGroup,InputOTPSlot} from '@/components/ui/input-otp';
import {authClient,passwordAuthClient} from '@/lib/auth-client';
import {minimumPasswordLength,PasswordChange} from '@/lib/password-change';
import {PasswordRecovery} from '@/lib/password-recovery';

export default function PasswordSettings({email,onBusy,onBack,recovery=false}:{email:string;onBusy:(busy:boolean)=>void;onBack:(email?:string)=>void;recovery?:boolean}){
 const [address,setAddress]=useState(email);
 const [step,setStep]=useState<'send'|'verify'|'password'|'done'>('send');
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('');
 const [showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [remaining,setRemaining]=useState(0),[sessionRestored,setSessionRestored]=useState(true);
 const flow=useRef<PasswordChange|PasswordRecovery|null>(null),working=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void flow.current?.dispose();};},[]);
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[remaining]);

 const getFlow=async()=>{
  if(flow.current)return flow.current;
  const isolated=await passwordAuthClient();
  const primary=recovery?null:await authClient();
  if(!recovery&&!primary)throw Error('Password settings are temporarily unavailable.');
  const next=recovery?new PasswordRecovery(isolated,address):new PasswordChange(primary!,isolated,email);
  if(!mounted.current){await next.dispose();throw Error('Password settings were closed.');}
  flow.current=next;
  return next;
 };
 const work=async(action:()=>Promise<void>)=>{
  if(working.current)return;
  working.current=true;setBusy(true);onBusy(true);setError('');
  try{await action();}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Please try again.');}
  finally{working.current=false;if(mounted.current)setBusy(false);onBusy(false);}
 };
 const send=()=>work(async()=>{
  await (await getFlow()).send();
  if(mounted.current){setStep('verify');setCode('');setRemaining(60);}
 });
 const verify=()=>work(async()=>{
  await (await getFlow()).verify(code);
  if(mounted.current){setCode('');setStep('password');}
 });
 const save=()=>work(async()=>{
  if(password!==confirmation)throw Error('The passwords don’t match. Please check them.');
  const result=await (await getFlow()).save(password);
  if(mounted.current){setPassword('');setConfirmation('');setShowPassword(false);setSessionRestored(result.sessionRestored);setStep('done');}
 });
 const goBack=()=>{
  setPassword('');setConfirmation('');setShowPassword(false);setCode('');setError('');setStep('verify');
 };
 return <form className="simple-form email-signin" aria-label={recovery?'Password recovery':'Password settings'} aria-busy={busy} onSubmit={event=>{event.preventDefault();void(step==='send'?send():step==='verify'?verify():step==='password'?save():Promise.resolve());}}>
  <fieldset disabled={busy}>
   {step==='send'&&recovery&&<><p className="code-message">Reset your password</p><label>Account email<input type="email" autoComplete="email" value={address} onChange={event=>{setAddress(event.target.value);if(flow.current){void flow.current.dispose();flow.current=null;}}} required maxLength={254} autoFocus/></label><p className="form-help">We’ll email you a code so you can choose a new password.</p></>}
   {step==='send'&&!recovery&&<p className="code-message">First, confirm it’s you. We’ll send a fresh verification code to <strong>{email}</strong>. You can keep using email codes after setting a password.</p>}
   {step==='verify'&&<>
    <p className="code-message">{recovery?'If an account exists for this email, we’ve sent a recovery code to ':'Enter the code sent to '}<strong>{recovery?address.trim():email}</strong>.</p>
    <label htmlFor="password-code">Your verification code</label>
    <InputOTP id="password-code" maxLength={8} pattern="^[0-9]*$" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} autoFocus containerClassName="code-input"><InputOTPGroup>{[0,1,2,3,4,5,6,7].map(i=><InputOTPSlot index={i} key={i}/>)}</InputOTPGroup></InputOTP>
    <p className="form-help">Your code expires in 10 minutes. Check your spam folder too.</p>
   </>}
   {step==='password'&&<>
    <p className="form-help" role="status">Email verified. Choose your new password.</p>
    <label>New password<input type={showPassword?'text':'password'} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} minLength={minimumPasswordLength} required autoFocus aria-describedby="new-password-help"/></label>
    <label>Confirm new password<input type={showPassword?'text':'password'} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} minLength={minimumPasswordLength} required/></label>
    <button type="button" className="text-button password-visibility" aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?'Hide passwords':'Show passwords'}</button>
    <p id="new-password-help" className="form-help">Use at least 12 characters. A long, unique passphrase works well.</p>
   </>}
   {step==='done'&&<div role="status"><p className="code-message">Your password is saved.</p><p className="form-help">You can now log in with your password or an email code.</p>{!recovery&&!sessionRestored&&<p className="form-help">Your password was saved, but we couldn’t refresh this session. Please sign in again with your new password or an email code.</p>}</div>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   {step!=='done'&&<button type="submit" className="button primary" disabled={busy||(step==='verify'&&code.length!==8)}>{busy?'Please wait…':step==='send'?'Email me a verification code':step==='verify'?'Verify email':'Save password'}</button>}
   {step==='verify'&&<div className="code-actions"><button type="button" className="text-button" disabled={remaining>0} onClick={()=>void send()}>{remaining?'Resend in '+remaining+'s':'Resend code'}</button></div>}
   {step==='password'&&<button type="button" className="text-button auth-switch" onClick={goBack}>Verify again</button>}
   <button type="button" className={step==='done'?'button primary':'signout-link'} onClick={()=>onBack(recovery?address.trim().toLowerCase():undefined)}>{recovery?'Back to login':'Back to account'}</button>
  </fieldset>
 </form>;
}
