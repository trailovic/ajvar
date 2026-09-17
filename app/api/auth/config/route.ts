import {publicAuthConfig} from '@/lib/auth-server';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(publicAuthConfig(),{headers:{'Cache-Control':'no-store'}});}
