// The unit tests import single modules, never the whole app, so a syntax error in app.mjs would
// pass them all and break the window. Parse every module the way the browser will.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

test('every UI module parses', () => {
  const modules = readdirSync(root).filter(name => name.endsWith('.mjs'));
  assert.ok(modules.includes('app.mjs') && modules.length > 20);
  for (const name of modules) {
    const result = spawnSync(process.execPath, ['--check', join(root, name)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
  }
});
