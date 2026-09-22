import type {Metadata} from 'next';
import SharedRecipeView from './shared-recipe-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared recipe — Ajvar',
  description: 'A recipe shared with you on Ajvar.',
  robots: {index: false, follow: false, noarchive: true},
  referrer: 'no-referrer',
};

export default async function SharedRecipePage({params}: {params: Promise<{token: string}>}) {
  const {token} = await params;
  // The HTML contains no recipe data. The no-store endpoint rechecks the live link.
  return <SharedRecipeView token={token}/>;
}
