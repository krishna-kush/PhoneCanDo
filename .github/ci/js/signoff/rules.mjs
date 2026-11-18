// What counts as a signed-off commit (pure, zero deps). A pull request's
// commits carry a Signed-off-by trailer (git commit -s): the contributor's
// record that they agree to section 7 of LICENSE.

// `git log --format=%H%x1f%an%x1f%ae%x1f%B%x1e` output, one record per commit.
export function parseLog(text) {
  return text
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim())
    .map((record) => {
      const [sha, name, email, body = ''] = record.split('\x1f');
      return { sha, name, email, body };
    });
}

// A line of its own, with a name and an email, as `git commit -s` writes it.
const SIGN_OFF = /^Signed-off-by:[ \t]*\S[^\n<]*<[^<>\s]+@[^<>\s]+>[ \t]*$/im;

export const signedOff = (body) => SIGN_OFF.test(body);

export const unsigned = (commits) => commits.filter((commit) => !signedOff(commit.body));
