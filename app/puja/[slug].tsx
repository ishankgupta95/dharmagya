import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy `/puja/[slug]` route — renamed to `/pooja/[slug]`. Redirect preserves
 * the slug so old deep links resolve. See `app/puja/index.tsx`.
 */
export default function PujaSlugRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={{ pathname: '/pooja/[slug]', params: { slug } }} />;
}
