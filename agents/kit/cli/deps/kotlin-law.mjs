// The Kotlin law: agents/ is a pure-JVM build the runner depends on, and its
// Gradle projects form kit-* <- kinds <- builtin, with the kit itself
// layered kit-api <- kit-manifest <- kit-render, kit-term beside kit-render
// on kit-api and kit-manifest, and kit-cli a leaf for CI. Zero deps.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { lineOf, relPath, stripKotlin, walk } from './source.mjs';

const HOST_IMPORTS = [
  'android.', 'androidx.', 'dalvik.', 'com.android.', 'com.google.android.',
  'expo.', 'host.exp.', 'com.facebook.react', 'com.phonecando.runner', 'com.phonecando.app',
];
const HOST_GROUPS = ['androidx.', 'com.android.', 'com.google.android', 'com.facebook.react', 'host.exp.', 'expo.'];

// The kit's layers, bottom first: each may depend only on the ones before it
// (kit-api <- kit-manifest <- kit-render). Other kit-* projects may depend on
// any kit-* project, unless KIT_BESIDE names what they may depend on.
const KIT_LAYERS = ['kit-api', 'kit-manifest', 'kit-render'];

// kit-term reads the manifest's PTY rules and raises kit-api's events; the
// runner uses it next to kit-render, which never needs it.
const KIT_BESIDE = { 'kit-term': ['kit-api', 'kit-manifest'] };

// Kit projects for CI only (kit-cli renders install scripts with kit-render):
// nothing depends on them and they are never published, so nothing ships them.
const KIT_LEAVES = ['kit-cli'];

// Rule 4: no host imports in agents/**/*.kt.
export function checkKotlinSources(root) {
  const errors = [];
  const files = walk(join(root, 'agents'), ['.kt']);
  for (const file of files) {
    const code = stripKotlin(readFileSync(file, 'utf8'));
    for (const m of code.matchAll(/^[ \t]*import\s+([\w.`]+)/gm)) {
      const imp = m[1].replace(/`/g, '');
      const bad = HOST_IMPORTS.find((p) => imp.startsWith(p));
      if (bad) errors.push(`${relPath(root, file)}:${lineOf(code, m.index)}: imports ${imp}; agents/ is pure JVM (no ${bad}*)`);
    }
  }
  return { errors, notes: [`kotlin: ${files.length} source file(s)`] };
}

// Every project by its build file: kit/kotlin/<x> is :kit-<x>, a kind's
// {native,image}/<id>/kotlin is :<id>, and builtin/kotlin is :builtin.
function findProjects(agents) {
  const projects = [];
  const kitBase = join(agents, 'kit/kotlin');
  for (const dir of existsSync(kitBase) ? readdirSync(kitBase) : []) {
    const file = join(kitBase, dir, 'build.gradle.kts');
    if (existsSync(file)) projects.push({ name: `kit-${dir}`, role: 'kit', file });
  }
  for (const type of ['native', 'image']) {
    const base = join(agents, type);
    for (const id of existsSync(base) ? readdirSync(base) : []) {
      const file = join(base, id, 'kotlin/build.gradle.kts');
      if (existsSync(file)) projects.push({ name: id, role: 'kind', file });
    }
  }
  const builtin = join(agents, 'builtin/kotlin/build.gradle.kts');
  if (existsSync(builtin)) projects.push({ name: 'builtin', role: 'builtin', file: builtin });
  return projects;
}

// `project(":x")` and typesafe `projects.x` edges; a non-literal name stays as written.
function projectDeps(code) {
  return [
    ...[...code.matchAll(/\bproject\s*\(\s*(?:path\s*=\s*)?"([^"]*)"/g)].map((m) => ({ target: m[1], index: m.index })),
    ...[...code.matchAll(/\bprojects\.([A-Za-z]\w*)/g)].map((m) => ({
      target: ':' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), index: m.index,
    })),
  ];
}

// Why `from` (a project of `role`) must not depend on :to, or null.
function edgeProblem(from, role, to, toRole) {
  if (KIT_LEAVES.includes(to)) return `:${to} is a leaf for CI: nothing depends on it, but ${from} does`;
  if (from === 'kit-api') return `kit-api depends on no project, but names :${to}`;
  if (role === 'kit' && toRole !== 'kit') return `kit project ${from} may depend only on kit-* projects, not :${to}`;
  const layer = KIT_LAYERS.indexOf(from);
  if (layer >= 0 && !KIT_LAYERS.slice(0, layer).includes(to)) {
    const below = KIT_LAYERS.slice(0, layer).map((p) => `:${p}`).join(', ');
    return `kit project ${from} may depend only on ${below}, not :${to} (${KIT_LAYERS.join(' <- ')})`;
  }
  const beside = KIT_BESIDE[from];
  if (beside && !beside.includes(to)) {
    return `kit project ${from} may depend only on ${beside.map((p) => `:${p}`).join(', ')}, not :${to}`;
  }
  if (role === 'kind' && toRole !== 'kit') {
    return `kind ${from} may depend only on kit-* projects, not :${to}${toRole === 'kind' ? ' (no kind depends on another kind)' : ''}`;
  }
  if (role === 'builtin' && toRole !== 'kit' && toRole !== 'kind') return `builtin may depend only on kit-* projects and kinds, not :${to}`;
  return null;
}

// Rules 4-5: build files are pure JVM and their project edges follow the law.
export function checkGradle(root) {
  const agents = join(root, 'agents');
  const errors = [];
  const projects = findProjects(agents);
  if (!projects.some((p) => p.name === 'kit-api')) {
    errors.push('agents/kit/kotlin/api/build.gradle.kts is missing; kit-api is the root of the law');
  }
  const settingsFile = join(agents, 'settings.gradle.kts');
  const settings = existsSync(settingsFile) ? stripKotlin(readFileSync(settingsFile, 'utf8')) : null;
  if (settings === null) errors.push('agents/settings.gradle.kts is missing');
  const roleOf = new Map(projects.map((p) => [p.name, p.role]));

  for (const { name, role, file } of projects) {
    const where = relPath(root, file);
    const code = stripKotlin(readFileSync(file, 'utf8'));
    if (role === 'kit' && settings !== null && !settings.includes(`":${name}"`)) {
      errors.push(`agents/settings.gradle.kts: does not include :${name} (${dirname(where)})`);
    }
    if (/com\.android\.(?:library|application)|kotlin\s*\(\s*"android"\s*\)/.test(code)) {
      errors.push(`${where}: applies an Android plugin; agents/ is pure JVM`);
    }
    if (KIT_LEAVES.includes(name) && /maven-publish/.test(code)) {
      errors.push(`${where}: ${name} is a leaf for CI and ships nowhere, so it is not published`);
    }
    for (const m of code.matchAll(/\b([A-Za-z]+)\s*\(\s*"([\w.-]+):([\w.-]+)(?::[^"]*)?"/g)) {
      const [, config, group, artifact] = m;
      const at = `${where}:${lineOf(code, m.index)}`;
      if (HOST_GROUPS.some((p) => group.startsWith(p))) errors.push(`${at}: ${group}:${artifact} is a host/Android dependency; agents/ is pure JVM`);
      else if (name === 'kit-api' && !/^test/.test(config)) errors.push(`${at}: kit-api is Kotlin stdlib only, but ${config} pulls ${group}:${artifact}`);
    }
    for (const { target, index } of projectDeps(code)) {
      const at = `${where}:${lineOf(code, index)}`;
      if (!/^:[\w-]+$/.test(target)) {
        // builtin may loop over the discovered kinds (settings.gradle.kts).
        if (role !== 'builtin') errors.push(`${at}: project("${target}") is not a literal :name, so its edge cannot be checked`);
        continue;
      }
      const to = target.slice(1);
      const problem = edgeProblem(name, role, to, to.startsWith('kit-') ? 'kit' : roleOf.get(to) ?? null);
      if (problem) errors.push(`${at}: ${problem}`);
    }
  }
  return { errors, notes: [`gradle: ${projects.map((p) => `:${p.name}`).join(', ') || 'no projects'}`] };
}
