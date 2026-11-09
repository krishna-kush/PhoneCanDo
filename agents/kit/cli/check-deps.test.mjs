// Tests for check-deps.mjs and deps/: a small repo tree that obeys the law,
// then one break per rule, each of which must be reported.
//   node --test kit/cli/check-deps.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { checkDeps } from './check-deps.mjs';
import { importsOf } from './deps/source.mjs';

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const KIT_API_BUILD = `plugins { kotlin("jvm") }
dependencies {
    // Kotlin stdlib only.
    testImplementation(kotlin("test-junit5"))
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
`;

// A tree that obeys every rule.
function good() {
  return {
    'agents/settings.gradle.kts': 'include(":kit-api")\ninclude(":builtin")\n',
    'agents/kit/kotlin/api/build.gradle.kts': KIT_API_BUILD,
    'agents/kit/kotlin/api/src/main/kotlin/AgentKind.kt': 'package com.phonecando.agents.kit\n\ninterface AgentKind\n',
    'agents/native/demo/kotlin/build.gradle.kts':
      'dependencies {\n    api(project(":kit-api"))\n    compileOnly("org.json:json:20250517")\n}\n',
    'agents/native/demo/kotlin/src/main/kotlin/DemoKind.kt':
      'package com.phonecando.agents.demo\n\n// import android.util.Log was here once\nimport com.phonecando.agents.kit.AgentKind\nimport org.json.JSONObject\n\nval quote = \'"\'\n',
    'agents/builtin/kotlin/build.gradle.kts':
      'val agentKinds = listOf("demo")\ndependencies {\n    api(project(":kit-api"))\n    agentKinds.forEach { implementation(project(":$it")) }\n}\n',
    'agents/kit/ts/contract/web.ts': "export type WebAdapterSpec = { authUrl: string; glob?: '**/*.ts' };\n",
    'agents/kit/ts/contract/view.ts':
      "// import x from 'not-a-real-import';\n/* import 'nor-this' */\nimport type { WebAdapterSpec } from './web.ts';\nexport type KindView = { id: string; web: WebAdapterSpec | null };\n",
    'agents/kit/ts/manifest/validate.ts': "import { MAX } from './rules.ts';\nexport const ok = MAX > 0;\n",
    'agents/kit/ts/manifest/rules.ts': 'export const MAX = 1;\n',
    'agents/kit/ts/manifest/validate.test.ts':
      "import { test } from 'node:test';\nimport { ok } from './validate.ts';\nimport fixtures from '../../schema/fixtures/x.json' with { type: 'json' };\n",
    'agents/native/demo/agent.json': '{}\n',
    'agents/native/demo/config/plugins/x.ts': "import { tool } from '@opencode-ai/plugin';\n",
    'app/src/engine/agents/registry.ts': "import type { KindView } from '../../../../agents/kit/ts/contract/view.ts';\n",
    'app/src/engine/user-agents.ts': "import { ok } from '../../../agents/kit/ts/manifest/validate.ts';\n",
    'app/src/ui/terminal/session.ts':
      "import type {\n  KindView,\n} from '../../../../agents/kit/ts/contract/view.ts';\nexport type { WebAdapterSpec } from '../../../../agents/kit/ts/contract/web.ts';\n",
    'scripts/apk-audit.mjs': "import { loadManifests } from '../agents/kit/cli/manifests.mjs';\n",
    'app/scripts/vectors/test_x.js': "const fs = require('node:fs'); fs.readFileSync('../../../agents/native/demo/agent.json');\n",
  };
}

function check(files) {
  const root = mkdtempSync(join(tmpdir(), 'agents-deps-'));
  roots.push(root);
  for (const [path, body] of Object.entries(files)) {
    if (body === undefined) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return checkDeps(root).errors;
}

// Exactly one error, matching `re`.
function fails(files, re) {
  const errors = check(files);
  assert.equal(errors.length, 1, errors.join('\n'));
  assert.match(errors[0], re);
}

test('a tree that obeys the law passes', () => {
  assert.deepEqual(check(good()), []);
});

test('importsOf: statements, type-only, dynamic, require; comments ignored', () => {
  const src = [
    "import type { A } from './a.ts';",
    "import { type B, C } from './b.ts';",
    "export type { D } from './d.ts';",
    "export * from './e.ts';",
    "import './side.ts';",
    "const f = await import('./f.ts');",
    "const g = require('./g.js');",
    "// import h from './h.ts';",
    "/** import i from './i.ts'; */",
    "const s = 'import j from \"./j.ts\"';",
  ].join('\n');
  assert.deepEqual(
    importsOf(src).map(({ spec, typeOnly }) => `${spec}${typeOnly ? ' (type)' : ''}`).sort(),
    ['./a.ts (type)', './b.ts', './d.ts (type)', './e.ts', './f.ts', './g.js', './side.ts'],
  );
  assert.equal(importsOf("x;\n\nimport y from './y.ts';").at(0)?.line, 3);
});

test('TS: bare specifiers are refused in bundled code', () => {
  fails(
    { ...good(), 'agents/kit/ts/contract/web.ts': "export async function f() { await import('expo-file-system'); }\n" },
    /bare import 'expo-file-system'/,
  );
  fails({ ...good(), 'agents/kit/ts/manifest/validate.ts': "import { readFileSync } from 'node:fs';\n" }, /bare import 'node:fs'/);
});

test('TS: relative imports carry .ts', () => {
  fails(
    { ...good(), 'agents/kit/ts/contract/view.ts': "import type { WebAdapterSpec } from './web';\n" },
    /relative import '.\/web' needs its .ts extension/,
  );
});

test('TS: kinds and builtin have none', () => {
  fails({ ...good(), 'agents/native/demo/ts/kind.ts': 'export const demoKind = {};\n' }, /agents\/native\/demo\/ts\/kind.ts: kinds have no TS/);
  fails({ ...good(), 'agents/image/demo/ts/x.mjs': 'export {};\n' }, /agents\/image\/demo\/ts\/x.mjs: kinds have no TS/);
  fails({ ...good(), 'agents/builtin/ts/builtin.ts': 'export {};\n' }, /agents\/builtin\/ts\/builtin.ts: kinds have no TS/);
});

test('TS: kit modules follow TS_KIT_LAW and stay in agents/kit/ts', () => {
  fails(
    { ...good(), 'agents/kit/ts/manifest/validate.ts': "import type { KindView } from '../contract/view.ts';\n" },
    /agents\/kit\/ts\/manifest must not import agents\/kit\/ts\/contract/,
  );
  fails({ ...good(), 'agents/kit/ts/testkit/run.ts': 'export {};\n' }, /agents\/kit\/ts\/testkit has no row in TS_KIT_LAW/);
  fails({ ...good(), 'agents/kit/ts/loose.ts': 'export {};\n' }, /sits directly in agents\/kit\/ts/);
  fails(
    { ...good(), 'agents/kit/ts/contract/web.ts': "import { x } from '../../../../app/src/engine/runner.ts';\n" },
    /outside agents\//,
  );
  fails(
    { ...good(), 'agents/kit/ts/contract/web.ts': "import { x } from '../../../shared/phone-tools/tool.ts';\n" },
    /imports 'agents\/shared\/phone-tools\/tool.ts', outside agents\/kit\/ts/,
  );
});

test('TS: kit tests read kinds as files, never import them', () => {
  fails(
    { ...good(), 'agents/kit/ts/manifest/validate.test.ts': "import m from '../../../native/demo/agent.json' with { type: 'json' };\n" },
    /a kit test must not import a kind \(agents\/native\/demo\/agent.json\)/,
  );
});

test('outside: app/src takes the contract with import type only', () => {
  fails(
    { ...good(), 'app/src/engine/terminal.ts': "import { type PtyRecipe } from '../../../agents/kit/ts/contract/pty.ts';\n" },
    /with `import type` only/,
  );
  fails(
    { ...good(), 'web/src/lib/x.ts': "import type { KindView } from '../../../agents/kit/ts/contract/view.ts';\n" },
    /only app\/src imports agents\/kit\/ts\/contract/,
  );
});

test('outside: only app/src/engine imports the manifest', () => {
  fails(
    { ...good(), 'app/src/ui/env/x.ts': "import { ok } from '../../../../agents/kit/ts/manifest/validate.ts';\n" },
    /only app\/src\/engine imports agents\/kit\/ts\/manifest/,
  );
});

test('outside: nothing imports a kind or builtin, and the app bundles nothing else from agents/', () => {
  fails(
    { ...good(), 'scripts/x.mjs': "import m from '../agents/native/demo/agent.json' with { type: 'json' };\n" },
    /nothing outside agents\/ imports a kind or builtin/,
  );
  fails(
    { ...good(), 'app/src/engine/x.ts': "import { x } from '../../../agents/builtin/kotlin/x.ts';\n" },
    /nothing outside agents\/ imports a kind or builtin/,
  );
  fails(
    { ...good(), 'app/src/engine/x.ts': "import { loadManifests } from '../../../agents/kit/cli/manifests.mjs';\n" },
    /the app imports agents\/kit\/cli\/manifests.mjs/,
  );
});

test('Kotlin: no Android, Expo or runner imports', () => {
  for (const imp of ['android.util.Log', 'androidx.annotation.Keep', 'expo.modules.kotlin.Promise', 'com.phonecando.runner.Bridge']) {
    fails(
      { ...good(), 'agents/native/demo/kotlin/src/main/kotlin/X.kt': `package com.phonecando.agents.demo\n\nimport ${imp}\n` },
      new RegExp(`imports ${imp.replace(/\./g, '\\.')}; agents/ is pure JVM`),
    );
  }
});

test('Gradle: kit-api has no project deps and only the stdlib', () => {
  fails(
    { ...good(), 'agents/kit/kotlin/api/build.gradle.kts': KIT_API_BUILD.replace('dependencies {', 'dependencies {\n    api(project(":kit-term"))') },
    /kit-api depends on no project, but names :kit-term/,
  );
  fails(
    { ...good(), 'agents/kit/kotlin/api/build.gradle.kts': KIT_API_BUILD.replace('dependencies {', 'dependencies {\n    implementation("com.squareup.okio:okio:3.9.0")') },
    /kit-api is Kotlin stdlib only/,
  );
  fails({ ...good(), 'agents/kit/kotlin/api/build.gradle.kts': undefined }, /kit-api is the root of the law/);
});

test('Gradle: a kind depends only on kit-* projects', () => {
  const other = { 'agents/native/other/kotlin/build.gradle.kts': 'dependencies { api(project(":kit-api")) }\n' };
  fails(
    { ...good(), ...other, 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { api(project(":kit-api")); implementation(project(":other")) }\n' },
    /kind demo may depend only on kit-\* projects, not :other \(no kind depends on another kind\)/,
  );
  fails(
    { ...good(), 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { implementation(projects.builtin) }\n' },
    /kind demo may depend only on kit-\* projects, not :builtin/,
  );
  fails(
    { ...good(), 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { implementation(project(":$name")) }\n' },
    /is not a literal :name/,
  );
  // Typesafe accessors count too: projects.kitApi is :kit-api.
  assert.deepEqual(check({ ...good(), 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { api(projects.kitApi) }\n' }), []);
});

test('Gradle: kit-cli is a leaf that ships nowhere', () => {
  const cli = {
    'agents/settings.gradle.kts': 'include(":kit-api")\ninclude(":kit-cli")\ninclude(":builtin")\n',
    'agents/kit/kotlin/cli/build.gradle.kts': 'plugins { application }\ndependencies { implementation(project(":kit-api")) }\n',
  };
  assert.deepEqual(check({ ...good(), ...cli }), []);
  fails(
    { ...good(), ...cli, 'agents/builtin/kotlin/build.gradle.kts': 'dependencies { api(project(":kit-api")); implementation(project(":kit-cli")) }\n' },
    /:kit-cli is a leaf for CI: nothing depends on it, but builtin does/,
  );
  fails(
    { ...good(), ...cli, 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { api(projects.kitCli) }\n' },
    /:kit-cli is a leaf for CI: nothing depends on it, but demo does/,
  );
  fails(
    { ...good(), ...cli, 'agents/kit/kotlin/cli/build.gradle.kts': 'plugins { application; `maven-publish` }\ndependencies { implementation(project(":kit-api")) }\n' },
    /kit-cli is a leaf for CI and ships nowhere, so it is not published/,
  );
});

test('Gradle: kit projects stay among kit-*, and nothing is Android', () => {
  fails(
    {
      ...good(),
      'agents/settings.gradle.kts': 'include(":kit-api")\ninclude(":kit-term")\n',
      'agents/kit/kotlin/term/build.gradle.kts': 'dependencies { api(project(":kit-api")); implementation(project(":demo")) }\n',
    },
    /kit project kit-term may depend only on kit-\* projects, not :demo/,
  );
  fails(
    { ...good(), 'agents/kit/kotlin/term/build.gradle.kts': 'dependencies { api(project(":kit-api")) }\n' },
    /does not include :kit-term/,
  );
  fails(
    {
      ...good(),
      'agents/settings.gradle.kts': 'include(":kit-api")\ninclude(":kit-manifest")\ninclude(":kit-render")\n',
      'agents/kit/kotlin/manifest/build.gradle.kts': 'dependencies { api(project(":kit-api")); implementation(project(":kit-render")) }\n',
    },
    /kit project kit-manifest may depend only on :kit-api, not :kit-render/,
  );
  fails(
    { ...good(), 'agents/native/demo/kotlin/build.gradle.kts': 'plugins { id("com.android.library") }\ndependencies { api(project(":kit-api")) }\n' },
    /applies an Android plugin/,
  );
  fails(
    { ...good(), 'agents/native/demo/kotlin/build.gradle.kts': 'dependencies { api(project(":kit-api")); implementation("androidx.annotation:annotation:1.9.1") }\n' },
    /androidx.annotation:annotation is a host\/Android dependency/,
  );
});
