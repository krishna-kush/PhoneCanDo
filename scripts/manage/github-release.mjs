// ./manage release <version> --via-github: the release built, signed and
// drafted by .github/workflows/release.yml on GitHub's runners instead of
// here, so no APK leaves this computer. Starts the workflow on prod, follows
// it (its sign job waits for a reviewer: the release environment's rule) and
// points to the pull request its pr job opened with the files the release
// changed, to merge after publishing. docs/release/github-release.md.
import { green, heading } from '../terminal/style.mjs';
import { releaseEnv } from './env.mjs';
import { CommandFailed, die, stop } from './errors.mjs';
import { capture, pause, sh } from './run.mjs';

export const WORKFLOW = 'release.yml';

// The workflow's inputs by flag; any other flag is for a release built here.
const VALUES = { '--notes': 'notes', '--label': 'label' };
const SWITCHES = { '--allow-red-ci': 'allow_red_ci', '--publish': 'publish' };
// Always on via GitHub (the workflow passes it: no terminal to ask there).
const ALWAYS_ON = ['--accept-all'];

/** --notes/--label/switches -> the workflow's inputs, or a usage error. */
export function workflowInputs(version, args) {
  const inputs = { version };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (VALUES[arg]) {
      if (args[i + 1] === undefined) die(`${arg} needs a value`);
      inputs[VALUES[arg]] = args[++i];
    } else if (SWITCHES[arg]) {
      inputs[SWITCHES[arg]] = 'true';
    } else if (!ALWAYS_ON.includes(arg)) {
      die(
        `${arg} is for a release built here; --via-github takes ` +
          `${[...Object.keys(VALUES), ...Object.keys(SWITCHES)].join(', ')}`,
      );
    }
  }
  return inputs;
}

const runIds = (repo) => {
  const out = capture(['gh', 'run', 'list', '-R', repo, '--workflow', WORKFLOW, '--limit', '10', '--json', 'databaseId']);
  return out ? JSON.parse(out).map((run) => run.databaseId) : [];
};

// The run `gh workflow run` just started: the newest id not there before.
function newRun(repo, before) {
  for (let i = 0; i < 20; i++) {
    const id = runIds(repo).find((runId) => !before.includes(runId));
    if (id) return id;
    pause(3000);
  }
  return stop(`could not find the ${WORKFLOW} run just started; see gh run list -R ${repo} --workflow ${WORKFLOW}`);
}

export function releaseViaGithub(version, args) {
  const inputs = workflowInputs(version, args);
  const repo = releaseEnv().GITHUB_REPO;
  if (!repo) die('no GitHub repo: set GITHUB_REPO=owner/repo');
  heading(`Release v${version} on GitHub (${WORKFLOW} on prod)`);
  const before = runIds(repo);
  sh(['gh', 'workflow', 'run', WORKFLOW, '-R', repo, '--ref', 'prod', ...Object.entries(inputs).flatMap(([k, v]) => ['-f', `${k}=${v}`])]);
  const id = newRun(repo, before);
  const url = `https://github.com/${repo}/actions/runs/${id}`;
  console.log(`${url}\nIt builds first (about 30 minutes, no key), then waits there for your approval to sign and upload.`);
  try {
    sh(['gh', 'run', 'watch', String(id), '-R', repo, '--exit-status', '--interval', '15']);
  } catch (error) {
    if (error instanceof CommandFailed) stop(`the release run did not finish green: ${url}`);
    throw error;
  }
  const branch = `release/v${version}`;
  const pr = capture(['gh', 'pr', 'list', '-R', repo, '--head', branch, '--state', 'open', '--json', 'url', '-q', '.[0].url']).trim();
  const published = inputs.publish === 'true';
  console.log(green(`\nv${version} is on GitHub${published ? ', published' : ' as a draft'}.`));
  console.log(`Pull request with its files: ${pr || `the open one from ${branch}`}`);
  if (!published) {
    console.log(`Test its APKs (gh release download v${version} -R ${repo}), publish it`);
    console.log(`(gh release edit v${version} --draft=false -R ${repo}), then merge the pull request.`);
  } else {
    console.log('Merge the pull request to put it on the site.');
  }
}
