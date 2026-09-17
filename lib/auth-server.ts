import {env} from 'cloudflare:workers';
import {createClient} from '@supabase/supabase-js';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/raw';
import {IdentityConflict,resolveProfileIdentity} from './auth-identity';

export class AuthenticationError extends Error {}
export function publicAuthConfig(){
 const url=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return {provider:'chatgpt' as const};
 return {provider:'email' as const,url,key};
}
export async function getAjvarUser(request:Request){
 const config=publicAuthConfig();
 if(config.provider==='chatgpt')return getChatGPTUser();
 // Once email auth is enabled, old ChatGPT cookies cannot sign someone back in.
 const authorization=request.headers.get('authorization');
 if(!authorization)return null;
 if(!/^Bearer [^\s]+$/i.test(authorization)||authorization.length>12000)throw new AuthenticationError();
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(authorization.slice(7));
 if(error){if(error.status&&error.status>=500)throw Error('Authentication service unavailable');throw new AuthenticationError();}
 const user=data.user;
 if(!user?.id||!user.email||!user.email_confirmed_at||user.is_anonymous)throw new AuthenticationError();
 try{
  const userId=await resolveProfileIdentity(database(),user.id,user.email);
  return {userId,email:user.email.trim().toLowerCase(),fullName:undefined};
 }catch(error){if(error instanceof IdentityConflict)throw new AuthenticationError();throw error;}
}
