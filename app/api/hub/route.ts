import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/db/raw';
import {z} from 'zod';
export const dynamic='force-dynamic';
const respond=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, oai-authenticated-user-id'}});
const idSchema=z.string().min(1).max(100);
const recipeSchema=z.object({id:z.string().max(100).optional(),revision:z.number().int().nonnegative(),title:z.string().trim().min(2).max(140),description:z.string().trim().max(2000),course:z.enum(['Breakfast','Lunch','Dinner','Snack','Dessert','Side']),cuisine:z.string().trim().max(80),tags:z.string().trim().max(250),ingredients:z.array(z.object({amount:z.string().trim().max(30),unit:z.string().trim().max(30),name:z.string().trim().min(1).max(250)})).min(1).max(100),steps:z.array(z.string().trim().min(1).max(3000)).min(1).max(60),prep:z.number().int().min(0).max(1440),cook:z.number().int().min(0).max(2880),servings:z.number().int().min(1).max(1000),visibility:z.enum(['private','kitchen','public']),kitchenIds:z.array(idSchema).max(30),image:z.string().max(2000).refine(v=>!v||(/^https:\/\//i.test(v)&&URL.canParse(v)),'Use a full https photo URL.')});
export async function GET(){
 try{
 const user=await getChatGPTUser();const db=database();const uid=user?.userId??'';
 const profile=user?await db.prepare('SELECT id,username,name,email FROM profiles WHERE id=?').bind(uid).first():null;
 const ks=user?(await db.prepare('SELECT k.id,k.name,k.owner FROM kitchens k JOIN members m ON m.kitchen_id=k.id WHERE m.user_id=? ORDER BY k.created_at').bind(uid).all()).results:[];
 const memberRows=user?(await db.prepare('SELECT m.kitchen_id,p.id,p.username,p.name FROM members m JOIN profiles p ON p.id=m.user_id WHERE m.kitchen_id IN (SELECT kitchen_id FROM members WHERE user_id=?) ORDER BY p.name').bind(uid).all()).results:[];
 const rows=(await db.prepare("SELECT r.*,p.name AS author FROM recipes r JOIN profiles p ON p.id=r.owner WHERE r.visibility='public' OR r.owner=? OR (r.visibility='kitchen' AND EXISTS (SELECT 1 FROM shares s JOIN members m ON m.kitchen_id=s.kitchen_id WHERE s.recipe_id=r.id AND m.user_id=?)) ORDER BY r.created_at DESC").bind(uid,uid).all()).results;
 // A visitor sees only share destinations they belong to; authors see all their own destinations.
 const sr=user?(await db.prepare('SELECT s.recipe_id,s.kitchen_id FROM shares s JOIN recipes r ON r.id=s.recipe_id WHERE r.owner=? OR s.kitchen_id IN (SELECT kitchen_id FROM members WHERE user_id=?)').bind(uid,uid).all()).results:[];
 return respond({user:user?{id:uid,email:user.email,name:user.fullName??user.email.split('@')[0]}:null,profile,kitchens:ks.map(k=>({...k,members:memberRows.filter(m=>m.kitchen_id===k.id).map(({kitchen_id,...m})=>m)})),recipes:rows.map(r=>({...JSON.parse(r.data as string),id:r.id,owner:r.owner,title:r.title,description:r.description,course:r.course,visibility:r.visibility,revision:r.revision,author:r.author,createdAt:r.created_at,kitchenIds:sr.filter(s=>s.recipe_id===r.id).map(s=>s.kitchen_id)}))});
 }catch(e){console.error('Ajvar read failed',e);return respond({error:'The kitchen is temporarily unavailable. Please try again.'},503);}
}
export async function POST(request:Request){
 try{
 if(request.headers.get('sec-fetch-site')==='cross-site')return respond({error:'Please save from Ajvar.'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return respond({error:'Please save from Ajvar.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return respond({error:'A JSON request is required.'},415);
 const raw=await request.text();if(raw.length>180000)return respond({error:'This recipe is too large. Please shorten it.'},413);
 let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request.'},400)}
 const user=await getChatGPTUser();if(!user)return respond({error:'Sign in to save to your kitchen.'},401);
 const db=database(),uid=user.userId;
 if(body.action==='profile'){
 const p=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/,'Use 3–24 letters, numbers or underscores.'),name:z.string().trim().min(1).max(80)}).parse(body);
 try{await db.prepare('INSERT INTO profiles(id,username,email,name) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,email=excluded.email,name=excluded.name').bind(uid,p.username,user.email.trim().toLowerCase(),p.name).run();}catch(e){if(String(e).includes('UNIQUE'))return respond({error:'That username or email already belongs to an account.'},409);throw e}return respond({ok:true});
 }
 const profile=await db.prepare('SELECT id FROM profiles WHERE id=?').bind(uid).first();if(!profile)return respond({error:'Choose your Ajvar username first.'},403);
 if(body.action==='createKitchen'){
 const name=z.string().trim().min(2).max(80).parse(body.name),id=crypto.randomUUID();
 await db.batch([db.prepare('INSERT INTO kitchens(id,name,owner,created_at) VALUES(?,?,?,?)').bind(id,name,uid,new Date().toISOString()),db.prepare('INSERT INTO members(kitchen_id,user_id) VALUES(?,?)').bind(id,uid)]);return respond({ok:true,id},201);
 }
 if(body.action==='addMember'){
 const kid=idSchema.parse(body.kitchenId),identifier=z.string().trim().toLowerCase().min(3).max(254).parse(body.identifier);
 if(!await db.prepare('SELECT 1 FROM members WHERE kitchen_id=? AND user_id=?').bind(kid,uid).first())return respond({error:'You must belong to this kitchen.'},403);
 const target=await db.prepare('SELECT id FROM profiles WHERE username=? OR email=?').bind(identifier.replace(/^@/,''),identifier).first<{id:string}>();
 if(!target)return respond({error:'No Ajvar account matches. Ask them to sign in and choose a username first.'},404);
 await db.prepare('INSERT OR IGNORE INTO members(kitchen_id,user_id) VALUES(?,?)').bind(kid,target.id).run();return respond({ok:true});
 }
 if(body.action==='saveRecipe'){
 const r=recipeSchema.parse(body.recipe);const existing=r.id?await db.prepare('SELECT owner,revision FROM recipes WHERE id=?').bind(r.id).first<{owner:string;revision:number}>():null;
 if(r.id&&(!existing||existing.owner!==uid))return respond({error:'Only the author can edit this recipe.'},403);
 if(existing&&existing.revision!==r.revision)return respond({error:'This recipe changed in another window. Reopen it to get the latest version before editing.'},409);
 const kitchenIds=r.visibility==='private'?[]:[...new Set(r.kitchenIds)];
 if(r.visibility==='kitchen'&&!kitchenIds.length)return respond({error:'Choose at least one kitchen to share with.'},400);
 const allowed=(await db.prepare('SELECT kitchen_id FROM members WHERE user_id=?').bind(uid).all()).results.map(x=>x.kitchen_id);
 if(kitchenIds.some(k=>!allowed.includes(k)))return respond({error:'You can only share with kitchens you belong to.'},403);
 const id=r.id||crypto.randomUUID(),stamp=new Date().toISOString()+'|'+crypto.randomUUID();
 const data=JSON.stringify({cuisine:r.cuisine,tags:r.tags,ingredients:r.ingredients,steps:r.steps,prep:r.prep,cook:r.cook,servings:r.servings,image:r.image});
 const first=existing?db.prepare('UPDATE recipes SET title=?,description=?,course=?,visibility=?,data=?,updated_at=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?').bind(r.title,r.description,r.course,r.visibility,data,stamp,id,uid,r.revision):db.prepare('INSERT INTO recipes(id,owner,title,description,course,visibility,data,created_at,updated_at,revision) VALUES(?,?,?,?,?,?,?,?,?,1)').bind(id,uid,r.title,r.description,r.course,r.visibility,data,new Date().toISOString(),stamp);
 const statements=[first,db.prepare('DELETE FROM shares WHERE recipe_id=? AND EXISTS(SELECT 1 FROM recipes WHERE id=? AND updated_at=?)').bind(id,id,stamp),...kitchenIds.map(k=>db.prepare('INSERT INTO shares(recipe_id,kitchen_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM recipes WHERE id=? AND updated_at=?)').bind(id,k,id,stamp))];
 const result=await db.batch(statements);if(!result[0].meta.changes)return respond({error:'This recipe changed in another window. Reopen it before editing.'},409);
 return respond({ok:true,id},existing?200:201);
 }
 return respond({error:'Unknown action.'},400);
 }catch(e){if(e instanceof z.ZodError)return respond({error:e.issues[0]?.message??'Please check the form.'},400);console.error('Ajvar save failed',e);return respond({error:'We could not save that. Your form is still here; please try again.'},503);}
}
