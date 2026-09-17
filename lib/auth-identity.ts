export class IdentityConflict extends Error {}

export async function resolveProfileIdentity(db:D1Database, subject:string, email:string){
 const mapped=await db.prepare('SELECT profile_id FROM auth_identities WHERE subject=?').bind(subject).first<{profile_id:string}>();
 if(mapped)return mapped.profile_id;
 // Only called after Supabase verifies both the token and the email address.
 const existing=await db.prepare('SELECT id FROM profiles WHERE email=?').bind(email.trim().toLowerCase()).first<{id:string}>();
 const profileId=existing?.id??'supabase:'+subject;
 await db.prepare('INSERT OR IGNORE INTO auth_identities(subject,profile_id) VALUES(?,?)').bind(subject,profileId).run();
 const saved=await db.prepare('SELECT profile_id FROM auth_identities WHERE subject=?').bind(subject).first<{profile_id:string}>();
 if(!saved)throw new IdentityConflict('That profile is already linked to another login.');
 return saved.profile_id;
}
