'use client';

import {useEffect, useState} from 'react';
import {Copy, Link2, Share2} from 'lucide-react';
import {authFetch} from '@/lib/auth-client';
import type {Recipe} from '@/lib/types';

async function manageLink(recipeId: string, action: 'get' | 'create' | 'revoke') {
  const response = await authFetch('/api/recipe-share', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({recipeId, action}),
  });
  const result = await response.json() as {path: string | null; error?: string};
  if (!response.ok) throw new Error(result.error || 'Could not update sharing.');
  return result.path;
}

export default function RecipeShare({recipe, isOwner}: {recipe: Recipe; isOwner: boolean}) {
  const [expanded, setExpanded] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    setOrigin(window.location.origin);
    if (!isOwner) {
      setPath('/share/public-' + encodeURIComponent(recipe.id));
      setLoaded(true);
      return;
    }
    setBusy(true);
    setLoaded(false);
    setError('');
    void manageLink(recipe.id, 'get').then(value => {
      if (active) { setPath(value); setLoaded(true); }
    }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [expanded, isOwner, recipe.id]);

  if (!isOwner && recipe.visibility !== 'public') return null;

  async function changeLink(action: 'create' | 'revoke') {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await manageLink(recipe.id, action);
      setPath(next); setConfirmRevoke(false);
      setMessage(action === 'create' ? 'Your link is ready to copy.' : 'Link disabled. Previous copies no longer work.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  async function copy() {
    if (!path) return;
    setMessage(''); setError('');
    try { await navigator.clipboard.writeText(origin + path); setMessage('Link copied. Paste it anywhere.'); }
    catch { setError('Could not copy automatically. Select the link below and copy it manually.'); }
  }

  return <section className="recipe-sharing" aria-label="Recipe link sharing">
    <button type="button" className="button outline" aria-expanded={expanded} disabled={busy} onClick={() => setExpanded(value => !value)}><Share2 size={16}/> Share recipe</button>
    {expanded && <div className="share-panel">
      <h2><Link2 size={18}/> Share with a link</h2>
      <p>Anyone with this link can read and forward this recipe. No Ajvar account needed.</p>
      <p>{recipe.visibility === 'public' ? 'This recipe is already public.' : 'It stays out of Home and public search. Your current visibility setting will not change.'}</p>
      {busy && <p role="status">Updating sharing…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loaded && (path ? <>
        <label className="share-link-label">Recipe link<input aria-label="Recipe share link" readOnly value={origin + path} onFocus={event => event.currentTarget.select()}/></label>
        <div className="share-actions"><button type="button" className="button primary" disabled={busy} onClick={() => void copy()}><Copy size={16}/> Copy link</button>
          {isOwner && <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmRevoke(true)}>Disable link</button>}
        </div>
        {confirmRevoke && <div className="share-revoke"><p>Disable this link? Anyone using a previous copy will lose link access. This cannot remove copies they already saved.</p><div className="share-actions"><button type="button" className="button outline" disabled={busy} onClick={() => void changeLink('revoke')}>Yes, disable link</button><button type="button" className="text-button" disabled={busy} onClick={() => setConfirmRevoke(false)}>Keep link</button></div></div>}
      </> : <button type="button" className="button primary" disabled={busy} onClick={() => void changeLink('create')}>Enable share link</button>)}
      {message && <p role="status">{message}</p>}
    </div>}
  </section>;
}
