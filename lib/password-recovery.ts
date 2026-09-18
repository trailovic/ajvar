import type {SupabaseClient,User} from '@supabase/supabase-js';
import {minimumPasswordLength} from './password-change';

// Recovery never adopts a session into the app. After resetting, the user
// explicitly signs in again; another tab's logged-in account stays untouched.
export class PasswordRecovery {
 private subject:string|null=null;
 private verifiedUntil=0;
 private resendAt=0;
 private closed=false;
 private email:string;
 constructor(private client:Pick<SupabaseClient,'auth'>,email:string,private now=Date.now){this.email=email.trim().toLowerCase();}
 private checkOpen(){if(this.closed)throw Error('Reopen password recovery to start again.');}
 private matches(user:User|null){return !!user?.id&&!!user.email_confirmed_at&&!user.is_anonymous&&user.email?.trim().toLowerCase()===this.email&&(!this.subject||user.id===this.subject);}
 async send(){
  this.checkOpen();
  if(this.now()<this.resendAt)throw Error('Please wait a minute before requesting another code.');
  this.verifiedUntil=0;
  const {error}=await this.client.auth.resetPasswordForEmail(this.email);
  if(error){
   if(error.status===429)throw Error('Please wait a minute before requesting another code.');
   // Do not distinguish a missing/unconfirmed account from a successful send.
   if(!['user_not_found','email_not_confirmed'].includes(error.code??''))throw Error('We couldn’t request a recovery code. Please try again shortly.');
  }
  this.checkOpen();this.resendAt=this.now()+60000;
 }
 async verify(code:string){
  this.checkOpen();this.verifiedUntil=0;
  if(!this.resendAt||!/^\d{8}$/.test(code))throw Error('Enter the eight-digit code from your email.');
  const {data,error}=await this.client.auth.verifyOtp({email:this.email,token:code,type:'recovery'});
  if(this.closed){await this.cleanup();throw Error('Reopen password recovery to start again.');}
  if(error||!data.session)throw Error('That code is incorrect or has expired. Try again or request a new code.');
  if(!this.matches(data.user)||!this.matches(data.session.user)||data.user!.id!==data.session.user.id){
   await this.dispose();throw Error('The verification did not match this email. Start password recovery again.');
  }
  this.subject=data.user!.id;this.verifiedUntil=this.now()+10*60*1000;
 }
 async save(password:string){
  this.checkOpen();
  if(!this.verifiedUntil||this.now()>=this.verifiedUntil)throw Error('Your verification has expired. Go back and request a new code.');
  if(password.length<minimumPasswordLength)throw Error('Use at least 12 characters for your password.');
  const {data:identity,error:identityError}=await this.client.auth.getUser();
  this.checkOpen();
  if(identityError||!this.matches(identity.user)){this.verifiedUntil=0;throw Error('Your verification has expired. Go back and request a new code.');}
  const {data,error}=await this.client.auth.updateUser({password});
  if(error){
   if(error.code==='weak_password')throw Error('Choose a stronger password. Use a long, unique passphrase.');
   if(error.code==='same_password')throw Error('Choose a password different from your current password.');
   if(error.status===429)throw Error('Too many attempts. Please wait a minute and try again.');
   throw Error('We couldn’t reset your password. Try again, or go back to verify your email again.');
  }
  const matched=this.matches(data.user);
  await this.dispose();
  if(!matched)throw Error('Your account session changed. Please return to login.');
  return {sessionRestored:false};
 }
 private async cleanup(){try{await this.client.auth.signOut({scope:'local'});}catch{/* Password save remains successful if cleanup is unavailable. */}}
 async dispose(){if(this.closed)return;this.closed=true;this.verifiedUntil=0;await this.cleanup();}
}
