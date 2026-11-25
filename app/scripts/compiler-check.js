#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// INTAKE-80-3: the rules-of-React check for the React Compiler. Runs babel-plugin-react-compiler (the copy
// babel-preset-expo already pulls in; no new dependency) over the app's own code and lists every component
// or hook the compiler would skip, with file and reason. A skipped component still works, it just isn't
// memoized, so each one is either fixed or added to ALLOWED below with a reason.
//   node app/scripts/compiler-check.js          (from the repo root, or `node scripts/compiler-check.js` in app/)
// Exits 1 if any bailout is not allowlisted, 2 if the check itself can't run.
'use strict';
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
// "file:Name" -> reason it is fine to leave uncompiled. Add only with a reason; prefer fixing.
const ALLOWED = {
  // INTAKE-80 (Nov 23): the first run's bailouts, kept uncompiled on purpose (scope call: no refactors in
  // the switch-on PR). Uncompiled = exactly the pre-compiler behaviour. Any NEW bailout still fails.
  'src/screens/Birthdays.tsx:DateForm': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/EmailCodeFlow.tsx:EmailCodeFlow': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/GalleryGrid.tsx:GalleryGrid': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/screens/GalleryTop.tsx:GalleryTopBar': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/screens/GroupsScreen.tsx:GroupsScreen': "conditional/optional chaining inside try/catch not supported yet; left uncompiled",
  'src/screens/JoinScreen.tsx:JoinScreen': "uses `check` before its declaration (hoisted function); left uncompiled",
  'src/screens/MessagesScreen.tsx:ChatScreen': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/PhotoSwipe.tsx:PhotoSwipe': "conditional/optional chaining inside try/catch not supported yet; left uncompiled",
  'src/screens/PhotosScreen.tsx:PhotosScreen': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/screens/PostCard.tsx:ReactionButton': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/screens/SearchScreen.tsx:SearchScreen': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/ShareScreen.tsx:ShareScreen': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  // B31 (Nov 25): writes asked.current during render so the async sign-in callback reads the latest data-plan answer
  // after app.reload(); moving it to an effect would change that timing. Left uncompiled (today's behaviour).
  'src/screens/SignInScreen.tsx:SignInScreen': "writes ref.current during render (latest-value ref); left uncompiled (today's behaviour)",
  'src/screens/ShareScreen.tsx:Stamp': "`new` expression the compiler can't reorder; left uncompiled",
  'src/screens/StartFamily.tsx:StartFamily': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/StartFamily.tsx:FirstInvite': "throw inside try/catch not supported yet; left uncompiled",
  'src/screens/TextCodeFlow.tsx:TextCodeFlow': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/screens/TimelineScreen.tsx:TimelineScreen': "manual useMemo/useCallback deps differ from inferred ones (follow-up: fix deps)",
  'src/screens/VideoPlayer.tsx:Playing': "mutates a value returned from a hook (follow-up: move into the hook)",
  'src/screens/ViewerScreen.tsx:ViewerScreen': "try/finally not supported by the compiler yet; left uncompiled (today's behaviour)",
  'src/state/AppContext.tsx:AppProvider': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/ui/kit.tsx:BottomSheet': "reads ref.current during render; left uncompiled (today's behaviour)",
  'src/ui/typing.ts:useTypingField': "reads ref.current during render; left uncompiled (today's behaviour)",
};

let babel;
try {
  babel = require(require.resolve('@babel/core', { paths: [APP] }));
  require.resolve('babel-plugin-react-compiler', { paths: [APP] });
  require.resolve('@babel/preset-typescript', { paths: [APP] });
} catch (e) {
  console.error(`INTAKE-80-3: can't run, a babel package is missing (run npm ci in app/): ${e.message}`);
  process.exit(2);
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(ent.name) && !/\.d\.ts$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

// app/src covers the routes too (expo-router root is app/src/app); app/app is included if it ever exists.
const roots = ['src', 'app'].map((d) => path.join(APP, d)).filter((d) => fs.existsSync(d));
const files = roots.flatMap((r) => walk(r, [])).sort();

function reasonOf(ev) {
  const d = ev.detail || ev.data || ev;
  const r = (d && (d.reason || (d.options && d.options.reason))) || ev.reason || String(d);
  const desc = d && (d.description || (d.options && d.options.description));
  return desc ? `${r}: ${desc}` : r;
}
function lineOf(ev) {
  const loc = ev.fnLoc || ev.loc || (ev.detail && (ev.detail.loc || (ev.detail.primaryLocation && ev.detail.primaryLocation())));
  return loc && loc.start ? loc.start.line : '?';
}

// The logger gives the function's location, not always its name: read it off that line.
function nameAt(src, line) {
  const text = typeof line === 'number' ? src.split('\n')[line - 1] || '' : '';
  const m = text.match(/function\s+([A-Za-z0-9_$]+)/) || text.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*[:=]/);
  return m ? m[1] : '(anonymous)';
}

const bailouts = [];
let compiled = 0;
for (const file of files) {
  const rel = path.relative(APP, file);
  const src = fs.readFileSync(file, 'utf8');
  const logger = {
    logEvent(_filename, ev) {
      if (ev.kind === 'CompileSuccess') compiled++;
      else if (ev.kind === 'CompileError' || ev.kind === 'CompileSkip' || ev.kind === 'PipelineError') {
        const line = lineOf(ev);
        bailouts.push({ file: rel, line, name: ev.fnName || nameAt(src, line), kind: ev.kind, reason: reasonOf(ev) });
      }
    },
  };
  try {
    babel.transformSync(src, {
      filename: file,
      babelrc: false,
      configFile: false,
      code: false,
      presets: [[require.resolve('@babel/preset-typescript', { paths: [APP] }), { isTSX: file.endsWith('.tsx'), allExtensions: true }]],
      plugins: [[require.resolve('babel-plugin-react-compiler', { paths: [APP] }), { target: '19', panicThreshold: 'none', logger }]],
    });
  } catch (e) {
    bailouts.push({ file: rel, line: '?', name: '(file)', kind: 'BabelError', reason: String(e.message).split('\n')[0] });
  }
}

// One function can log several errors; keep one row per (file, function, reason).
const seen = new Set();
const rows = bailouts.filter((b) => {
  const k = `${b.file}|${b.name}|${b.line}|${b.reason}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
const open = rows.filter((b) => !(`${b.file}:${b.name}` in ALLOWED));
for (const b of rows) {
  const tag = `${b.file}:${b.name}` in ALLOWED ? 'allowed' : 'FAIL';
  console.log(`${tag} - INTAKE-80-3 ${b.file}:${b.line} ${b.name} [${b.kind}] ${b.reason}`);
}
console.log(`INTAKE-80-3: ${files.length} files, ${compiled} functions compiled, ${rows.length} bailouts (${open.length} not allowlisted)`);
process.exit(open.length ? 1 : 0);
