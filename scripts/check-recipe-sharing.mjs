// Real SQLite queries/migrations; mocked identity boundary, no live accounts or data.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import {z} from 'zod';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) {
  sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
}
const db = {
  prepare(sql) {
    const wrap = (values = []) => ({
      bind: (...args) => wrap(args),
      first: async () => sqlite.prepare(sql).get(...values) ?? null,
      all: async () => ({results: sqlite.prepare(sql).all(...values)}),
      run: async () => ({meta: {changes: Number(sqlite.prepare(sql).run(...values).changes)}}),
    });
    return wrap();
  },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
};
function load(path, dependencies, exports) {
  const source = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
  }).outputText.replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
  return new Function(...Object.keys(dependencies), source + ';return {' + exports.join(',') + '};')(...Object.values(dependencies));
}
class AuthenticationError extends Error {}
const getAjvarUser = async request => {
  if (request.headers.get('authorization') === 'invalid') throw new AuthenticationError();
  const id = request.headers.get('test-user');
  return id ? {userId: id, email: id + '@example.test'} : null;
};
const deps = {getAjvarUser, AuthenticationError, database: () => db, z};
const sharing = load('lib/recipe-sharing.ts', {}, ['sharedRecipe', 'newShareToken', 'validShareToken']);
const hub = load('app/api/hub/route.ts', deps, ['GET', 'POST']);
const links = load('app/api/recipe-share/route.ts', {...deps, ...sharing}, ['POST']);
const publicRoute = load('app/api/shared-recipes/[token]/route.ts', {...deps, ...sharing, collection: []}, ['GET']);
let checks = 0;
async function post(route, user, body, status = 200, headers = {}) {
  const response = await route.POST(new Request('https://ajvar.test/api/test', {
    method: 'POST', headers: {'Content-Type': 'application/json', ...(user ? {'test-user': user} : {}), ...headers}, body: JSON.stringify(body),
  }));
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result)); checks++;
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  return result;
}
async function snapshot(user) {
  const response = await hub.GET(new Request('https://ajvar.test/api/hub', {headers: user ? {'test-user': user} : {}}));
  assert.equal(response.status, 200); checks++;
  return response.json();
}
async function read(token, status = 200) {
  const response = await publicRoute.GET(new Request('https://ajvar.test/api/shared-recipes/' + token), {params: Promise.resolve({token})});
  assert.equal(response.status, status); checks++;
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  return response.json();
}
for (const user of ['author', 'other']) await post(hub, user, {action: 'profile', username: user, name: user});
const recipe = {id: '', revision: 0, title: 'Private test soup', description: 'Not discoverable', course: 'Dinner', cuisine: 'Italian', tags: '', ingredients: [{amount: '1', unit: 'cup', name: 'Beans'}], steps: ['Cook.'], prep: 5, cook: 20, servings: 2, visibility: 'private', kitchenIds: [], image: ''};
const recipeId = (await post(hub, 'author', {action: 'saveRecipe', recipe}, 201)).id;
const body = action => ({action, recipeId});
assert.equal((await post(links, 'author', body('get'))).path, null);
for (const action of ['get', 'create', 'revoke']) {
  await post(links, null, body(action), 401);
  await post(links, 'other', body(action), 403);
}
await post(links, 'author', {...body('create'), recipeId: 'missing'}, 403);
await post(links, 'author', body('create'), 403, {Origin: 'https://evil.test'});
await post(links, 'author', body('create'), 403, {'sec-fetch-site': 'cross-site'});
await post(links, 'author', body('create'), 401, {authorization: 'invalid'});
await post(links, 'author', body('create'), 415, {'Content-Type': 'text/plain'});
await post(links, 'author', body('unknown'), 400);
const {path} = await post(links, 'author', body('create'));
const token = path.split('/').pop();
assert(sharing.validShareToken(token));
assert.equal((await post(links, 'author', body('create'))).path, path);
const shared = await read(token);
assert.equal(shared.title, recipe.title);
for (const secret of ['id', 'owner', 'email', 'kitchenIds', 'visibility', 'revision', 'token']) assert(!(secret in shared));
for (const user of [null, 'other']) assert(!(await snapshot(user)).recipes.some(item => item.id === recipeId));
assert(!(JSON.stringify(await snapshot('author')).includes(token)));
let saved = (await snapshot('author')).recipes.find(item => item.id === recipeId);
assert.equal(saved.visibility, 'private');
await post(hub, 'author', {action: 'saveRecipe', recipe: {...saved, title: 'Updated private soup'}});
assert.equal((await read(token)).title, 'Updated private soup');
await read(recipeId, 404);
await read('public-' + recipeId, 404);
await read('a'.repeat(64), 404);
await read('invalid-token', 404);
await post(links, 'author', body('revoke'));
await read(token, 404);
await post(links, 'author', body('revoke')); // Idempotent.
const replacement = (await post(links, 'author', body('create'))).path.split('/').pop();
assert.notEqual(replacement, token);
await read(replacement);
await read(token, 404);
saved = (await snapshot('author')).recipes.find(item => item.id === recipeId);
await post(hub, 'author', {action: 'saveRecipe', recipe: {...saved, visibility: 'public'}});
await read('public-' + recipeId);
saved = (await snapshot('author')).recipes.find(item => item.id === recipeId);
await post(hub, 'author', {action: 'saveRecipe', recipe: {...saved, visibility: 'private'}});
await read('public-' + recipeId, 404);
await read(replacement); // Opt-in capability survives visibility changes.
sqlite.prepare('DELETE FROM recipes WHERE id=?').run(recipeId);
await read(replacement, 404);
assert.equal(sqlite.prepare('SELECT count(*) AS n FROM recipe_links').get().n, 0);
sqlite.close();
console.log(`${checks} request checks passed: migrations, owner-only controls, anonymous reads, private discovery, safe payload, CSRF, stable links, edits, revocation, rotation and deletion.`);
