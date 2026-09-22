import {database} from '@/db/raw';
import {collection} from '@/lib/collection';
import {sharedRecipe, validShareToken, type SharedRecipe} from '@/lib/recipe-sharing';

export const dynamic = 'force-dynamic';
const respond = (value: unknown, status = 200) => Response.json(value, {
  status, headers: {'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Referrer-Policy': 'no-referrer'},
});

export async function GET(_request: Request, {params}: {params: Promise<{token: string}>}) {
  const {token} = await params;
  try {
    let row;
    if (token.startsWith('public-') && token.length <= 107) {
      const id = token.slice(7);
      const starter = collection.find(recipe => recipe.id === id);
      if (starter) return respond(sharedRecipe(starter));
      // Public recipe links never grant access once the recipe becomes private.
      row = await database().prepare("SELECT r.title,r.description,r.course,r.data,p.name AS author FROM recipes r JOIN profiles p ON p.id=r.owner WHERE r.id=? AND r.visibility='public'").bind(id).first();
    } else if (validShareToken(token)) {
      // A separate capability, deliberately independent of discovery visibility.
      row = await database().prepare('SELECT r.title,r.description,r.course,r.data,p.name AS author FROM recipe_links l JOIN recipes r ON r.id=l.recipe_id JOIN profiles p ON p.id=r.owner WHERE l.token=?').bind(token).first();
    }
    if (!row) return respond({error: 'This link is unavailable. It may have been turned off by the author.'}, 404);
    const recipe = {...JSON.parse(row.data as string), title: row.title, description: row.description, course: row.course, author: row.author} as SharedRecipe;
    return respond(sharedRecipe(recipe));
  } catch {
    console.error('Shared recipe read failed');
    return respond({error: 'This recipe could not load. Please try again.'}, 503);
  }
}
