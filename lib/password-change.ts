import type {SupabaseClient,User} from '@supabase/supabase-js';

export const minimumPasswordLength=12;
const verificationLifetime=10*60*1000;
const normalize=(email:string)=>email.trim().toLowerCase();
type Client=Pick<SupabaseClient,'auth'>;

// Owns a temporary, non-persisted session. Only a verified code for the original
// Supabase subject may authorize the update; Ajvar profile IDs are not auth IDs.
export class PasswordChange {
 private subject:string|null=null;
 private verifiedUntil=0;
 private resendAt=0;
 private closed=false;
 constructor(private primary:Client,private isolated:Client,private email:string,private now=Date.now){}

 private matches(user:User|null){
  return !!user?.id&&!!user.email_confirmed_at&&!user.is_anonymous&&normalize(user.email??'')===normalize(this.email)&&(!this.subject||user.id===this.subject);
 }
 private async checkAccount(){
  if(this.closed)throw Error('Reopen password settings to start again.');
  const {data,error}=await this.primary.auth.getUser();
  if(error||!this.matches(data.user)){
   this.verifiedUntil=0;
   throw Error('Your account session changed or expired. Close this form and sign in again.');
  }
  if(this.closed)throw Error('Reopen password settings to start again.');
  this.subject=data.user!.id;
 }
 async send(){
  await this.checkAccount();
  if(this.now()<this.resendAt)throw Error('Please wait a minute before requesting another code.');
  this.verifiedUntil=0;
  const {error}=await this.isolated.auth.signInWithOtp({email:normalize(this.email),options:{shouldCreateUser:false}});
  if(error){
   if(error.status===429)throw Error('Please wait a minute before requesting another code.');
   throw Error('We couldn’t send a code. Please try again shortly.');
  }
  this.resendAt=this.now()+60000;
 }
 async verify(code:string){
  await this.checkAccount();
  this.verifiedUntil=0;
  if(!this.resendAt||!/^\d{8}$/.test(code))throw Error('Enter the eight-digit code from your email.');
  const {data,error}=await this.isolated.auth.verifyOtp({email:normalize(this.email),token:code,type:'email'});
  if(error||!data.session)throw Error('That code is incorrect or has expired. Try again or request a new code.');
  if(!this.matches(data.user)||!this.matches(data.session.user)){
   await this.dispose();
   throw Error('The verification did not match this account. Close this form and try again.');
  }
  await this.checkAccount();
  this.verifiedUntil=this.now()+verificationLifetime;
 }
 async save(password:string){
  await this.checkAccount();
  if(!this.verifiedUntil||this.now()>=this.verifiedUntil)throw Error('Your verification has expired. Go back and request a new code.');
  if(password.length<minimumPasswordLength)throw Error('Use at least 12 characters for your password.');
  const {data:sessionData,error:sessionError}=await this.isolated.auth.getSession();
  if(sessionError||!sessionData.session||!this.matches(sessionData.session.user)){
   this.verifiedUntil=0;
   throw Error('Your verification has expired. Go back and request a new code.');
  }
  const {data,error}=await this.isolated.auth.updateUser({password});
  if(error){
   if(error.code==='weak_password')throw Error('Choose a stronger password. Use a long, unique passphrase.');
   if(error.code==='same_password')throw Error('Choose a password different from your current password.');
   if(error.status===429)throw Error('Too many attempts. Please wait a minute and try again.');
   throw Error('We couldn’t save your password. Try again, or go back to verify your email again.');
  }
  this.verifiedUntil=0;
  if(!this.matches(data.user)){await this.dispose();throw Error('Your account session changed. Close this form and sign in again.');}
  // The password is saved even if refreshing the browser session fails. Never
  // report that as a failed password update or invite a duplicate mutation.
  try{
   await this.checkAccount();
   const {data:latest,error:latestError}=await this.isolated.auth.getSession();
   if(latestError||!latest.session||!this.matches(latest.session.user))throw Error('Session unavailable');
   const {error:restoreError}=await this.primary.auth.setSession({access_token:latest.session.access_token,refresh_token:latest.session.refresh_token});
   if(restoreError)throw restoreError;
   this.closed=true; // The main client now owns this session; do not revoke it.
   return {sessionRestored:true};
  }catch{
   await this.dispose();
   return {sessionRestored:false};
  }
 }
 async dispose(){
  if(this.closed)return;
  this.closed=true;this.verifiedUntil=0;
  // Only revoke the temporary verification session, never the account session.
  try{await this.isolated.auth.signOut({scope:'local'});}catch{/* Best-effort cleanup. */}
 }
}
