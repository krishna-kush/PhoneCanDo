// Hugging Face pages we open in the browser, and their buttons' copy.
// Pure (zero RN imports).

const HUB = 'https://huggingface.co';

/** A repository's page: its model card, licence and files. */
export function hubRepoUrl(repo: string): string {
  return `${HUB}/${repo.split('/').map(encodeURIComponent).join('/')}`;
}

/** Where a signed-in person makes an access token. */
export const HUB_TOKENS_URL = `${HUB}/settings/tokens`;

export const HUB_LINK_LABEL = {
  repo: 'See it on huggingface.co',
  gated: 'Accept its terms on huggingface.co',
  token: 'Make a token on huggingface.co',
};

/** When no app opens a link. */
export function openElsewhere(url: string): string {
  return `Open ${url} in a browser.`;
}
