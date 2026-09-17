"use client";
import {useEffect,useState} from 'react';
import {InputOTP,InputOTPGroup,InputOTPSlot} from '@/components/ui/input-otp';
import {authClient} from '@/lib/auth-client';

export default function EmailSignIn({onSignedIn,onBusy}:{onSignedIn:()=>Promise<void>;onBusy:(busy:boolean)=>void}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState(0);
 useEffect(()=>{if(!remaining)return;const timer=setTimeout(()=>setRemaining(n=>Math.max(0,n-1)),1000);return()=>clearTimeout(timer);},[remaining]);
 const work=async(action:()=>Promise<void>)=>{setBusy(true);onBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);onBusy(false);}};
 const send=()=>work(async()=>{
  const client=await authClient();if(!client)throw Error('Email sign-in is not available yet.');
  const {error}=await client.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:true}});
  if(error){if(error.status===429)throw Error('Please wait a minute before requesting another code.');throw Error('We couldn’t send a code. Check your email address and try again shortly.');}
  setSent(true);setCode('');setRemaining(60);
 });
 const verify=()=>work(async()=>{
  const client=await authClient();if(!client)throw Error('Email sign-in is temporarily unavailable.');
  const {error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token:code,type:'email'});
  if(error)throw Error('That code is incorrect or has expired. Try again or request a new code.');
  await onSignedIn();
 });
 return <form className="simple-form email-signin" onSubmit={event=>{event.preventDefault();void(sent?verify():send());}}>
  <fieldset disabled={busy}>
   {sent?<><p className="code-message">Enter the code sent to <strong>{email.trim()}</strong>.</p><label htmlFor="email-code">Your sign-in code</label><InputOTP id="email-code" maxLength={8} pattern="^[0-9]*$" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={setCode} autoFocus containerClassName="code-input"><InputOTPGroup>{[0,1,2,3,4,5,6,7].map(i=><InputOTPSlot index={i} key={i}/>)}</InputOTPGroup></InputOTP><p className="form-help">Check your spam folder too. Your code expires in 10 minutes.</p></>:<><label>Email address<input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" autoFocus/></label><p className="form-help">We’ll email you a one-time code. No password needed.</p></>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <button className="button primary" disabled={busy||(sent&&code.length!==8)} type="submit">{busy?(sent?'Checking…':'Sending…'):sent?'Sign in':'Email me a code'}</button>
   {sent&&<div className="code-actions"><button type="button" className="text-button" disabled={busy||remaining>0} onClick={()=>void send()}>{remaining?`Resend in ${remaining}s`:'Resend code'}</button><button type="button" className="text-button" onClick={()=>{setSent(false);setCode('');setError('');}}>Use another email</button></div>}
   {!sent&&<p className="form-help">New here? You’ll choose a username after verifying your email. Already have an Ajvar account? Use the same email to keep your recipes.</p>}
  </fieldset>
 </form>;
}
