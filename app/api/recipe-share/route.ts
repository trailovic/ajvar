import {getAjvarUser, AuthenticationError} from '@/lib/auth-server';
import {database} from '@/db/raw';
import {newShareToken} from '@/lib/recipe-sharing';
import {z} from 'zod';

export const dynamic = 'force-dynamic';
const respond = (value: unknown, status = 200) => Response.json(value, {
  status, headers: {'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization, oai-authenticated-user-id'},
});
const requestSchema = z.object({action: z.enum(['get', 'create', 'revoke']), recipeId: z.string().min(1).max(100)});

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
      return respond({error: 'Please manage sharing from Ajvar.'}, 403);
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return respond({error: 'A JSON request is required.'}, 415);
    const raw = await request.text();
    if (raw.length > 2000) return respond({error: 'Request is too large.'}, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return respond({error: 'Invalid request.'}, 400); }
    const {action, recipeId} = requestSchema.parse(input);
    const user = await getAjvarUser(request);
    if (!user) return respond({error: 'Sign in to manage sharing.'}, 401);
    const db = database();
    // Use the same response for a missing recipe and another author's recipe.
    const recipe = await db.prepare('SELECT id FROM recipes WHERE id=? AND owner=?').bind(recipeId, user.userId).first();
    if (!recipe) return respond({error: 'Only the author can manage this link.'}, 403);
    if (action === 'revoke') {
      await db.prepare('DELETE FROM recipe_links WHERE recipe_id=?').bind(recipeId).run();
      return respond({path: null});
    }
    if (action === 'create') {
      // Concurrent clicks keep one stable link; revoking then enabling creates a new token.
      await db.prepare('INSERT INTO recipe_links(recipe_id,token) VALUES(?,?) ON CONFLICT(recipe_id) DO NOTHING').bind(recipeId, newShareToken()).run();
    }
    const link = await db.prepare('SELECT token FROM recipe_links WHERE recipe_id=?').bind(recipeId).first<{token: string}>();
    return respond({path: link ? '/share/' + link.token : null});
  } catch (error) {
    if (error instanceof AuthenticationError) return respond({error: 'Your session has expired. Please sign in again.'}, 401);
    if (error instanceof z.ZodError) return respond({error: 'Invalid sharing request.'}, 400);
    console.error('Recipe link operation failed', error);
    return respond({error: 'Sharing is temporarily unavailable. Please try again.'}, 503);
  }
}
