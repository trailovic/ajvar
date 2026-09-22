'use client';

import {useEffect, useState} from 'react';
import {Clock, CookingPot, Copy, Utensils} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import type {SharedRecipe} from '@/lib/recipe-sharing';

export default function SharedRecipeView({token}: {token: string}) {
  const [recipe, setRecipe] = useState<SharedRecipe | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [copyMessage, setCopyMessage] = useState('');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRecipe(null); setChecked([]); setImageFailed(false);
    void fetch('/api/shared-recipes/' + encodeURIComponent(token), {cache: 'no-store', credentials: 'omit', signal: controller.signal}).then(async response => {
      const result = await response.json() as SharedRecipe & {error?: string};
      if (!response.ok) throw new Error(result.error || 'This recipe could not load.');
      setRecipe(result);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'This recipe could not load.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt]);

  async function copy() {
    try { await navigator.clipboard.writeText(window.location.origin + window.location.pathname); setCopyMessage('Link copied.'); }
    catch { setCopyMessage('Copy the address from your browser to share this recipe.'); }
  }

  return <div className="shared-recipe-page">
    <header className="topbar"><a className="brand" href="/" aria-label="Ajvar home"><span className="brand-icon"><CookingPot/></span>ajvar<span className="brand-dot">.</span></a><a className="text-button" href="/">Explore Ajvar</a></header>
    <main className="shared-recipe-content">
      {loading && <p role="status">Opening your shared recipe…</p>}
      {error && <section className="empty-state"><h1>Recipe unavailable</h1><p role="alert">{error}</p><button className="button outline" onClick={() => setAttempt(value => value + 1)}>Try again</button></section>}
      {recipe && <article>
        <div className="eyebrow">SHARED WITH YOU</div>
        <div className="recipe-category">{[recipe.course, recipe.cuisine].filter(Boolean).join(' · ')}</div>
        <h1>{recipe.title}</h1><p className="shared-description">{recipe.description}</p>
        <p className="shared-author">By {recipe.author}</p>
        {recipe.image && !imageFailed && <img className="detail-photo" src={recipe.image} alt={recipe.title} referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/>}
        <div className="detail-meta"><span><Clock size={17}/>Prep {recipe.prep} min · Cook {recipe.cook} min</span><span><Utensils size={17}/>{recipe.servings} servings</span></div>
        <button className="button outline shared-copy" onClick={() => void copy()}><Copy size={16}/> Copy recipe link</button><p role="status">{copyMessage}</p>
        <div className="recipe-instructions"><section><h2>Ingredients</h2><p className="form-help">Tick off as you cook.</p><div className="ingredient-checks">{recipe.ingredients.map((ingredient, index) => <label key={index} className={checked.includes(index) ? 'is-checked' : ''}><Checkbox checked={checked.includes(index)} onCheckedChange={value => setChecked(old => value ? [...old, index] : old.filter(item => item !== index))}/><span><strong>{ingredient.amount} {ingredient.unit}</strong> {ingredient.name}</span></label>)}</div></section>
          <section><h2>Let’s make it</h2><ol className="method">{recipe.steps.map((step, index) => <li key={index}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section></div>
        {recipe.credit && <p className="photo-credit">Photo: <a href={recipe.credit.url} target="_blank" rel="noreferrer">{recipe.credit.label}</a>. Serving inspiration.</p>}
      </article>}
      <footer><a className="footer-brand" href="/">ajvar.</a><span>A little love in every recipe.</span></footer>
    </main>
  </div>;
}
