"use client";
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let pending:Promise<SupabaseClient|null>|undefined;
export function authClient(){
 if(!pending)pending=fetch('/api/auth/config',{cache:'no-store'}).then(async response=>{
  if(!response.ok)throw Error('Sign-in is temporarily unavailable. Please try again.');
  const config=await response.json() as {provider:'chatgpt'}|{provider:'email';url:string;key:string};
  return config.provider==='email'?createClient(config.url,config.key,{auth:{storageKey:'ajvar-auth',detectSessionInUrl:false}}):null;
 }).catch(error=>{pending=undefined;throw error;});
 return pending;
}
export async function authFetch(input:string,init:RequestInit={}){
 const client=await authClient(),headers=new Headers(init.headers);
 if(client){
  const {data,error}=await client.auth.getSession();
  if(error)throw Error('Please sign in again.');
  if(data.session)headers.set('Authorization','Bearer '+data.session.access_token);
 }
 return fetch(input,{...init,headers});
}
