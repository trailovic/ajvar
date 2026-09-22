import type {Recipe} from './types';

// Sharing exposes cooking content only, never account IDs or kitchen membership.
export type SharedRecipe = Pick<Recipe, 'title' | 'description' | 'course' | 'cuisine' | 'tags' | 'ingredients' | 'steps' | 'prep' | 'cook' | 'servings' | 'image' | 'author' | 'credit'>;

export function sharedRecipe(recipe: SharedRecipe): SharedRecipe {
  return {
    title: recipe.title, description: recipe.description, course: recipe.course,
    cuisine: recipe.cuisine, tags: recipe.tags, ingredients: recipe.ingredients,
    steps: recipe.steps, prep: recipe.prep, cook: recipe.cook,
    servings: recipe.servings, image: recipe.image, author: recipe.author,
    ...(recipe.credit ? {credit: recipe.credit} : {}),
  };
}

export function newShareToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const validShareToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
