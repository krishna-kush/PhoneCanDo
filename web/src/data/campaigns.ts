// Campaign links: https://phonecando.app/?c=<tag>, one tag per place we post
// a link. The page checks only the tag's shape: the list of tags we made
// lives in our database (D1 `campaigns`, kept with `./manage campaign add`)
// and never reaches the page. The page-view beacon (layouts/Base.astro)
// sends a well-formed tag and the download buttons carry it to /v1/dl
// (sections/Install.astro); our server counts it only when it is one of
// ours and ignores any other.

/** What a tag may be: lowercase letters, digits and dashes, at most 24. */
export const CAMPAIGN_TAG = /^[a-z0-9-]{1,24}$/;

/**
 * The campaign a page was opened with: `c` when it has a tag's shape. A
 * share link's `i` wins, so with `i` there `c` is ignored. Anything else: null.
 */
export function campaignOf(params: URLSearchParams): string | null {
  if (params.has('i')) return null;
  const tag = params.get('c');
  return tag !== null && CAMPAIGN_TAG.test(tag) ? tag : null;
}
