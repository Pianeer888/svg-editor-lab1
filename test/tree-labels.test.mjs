import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rect } from '../dist/model/Rect.js';
import { SvgDocument } from '../dist/model/SvgDocument.js';
import { ModifiedStar } from '../dist/plugins/modified-star/ModifiedStar.js';
import { SavePointStore } from '../dist/plugins/modified-star/SavePointStore.js';

test('save points belong to the label instance and advance only after successful I/O', () => {
  const doc = new SvgDocument();
  const shape = new Rect('r', 0, 0, 1, 1);
  doc.add(shape);
  const star = new ModifiedStar();
  const label = () => star.decorate(shape, doc);
  let shouldFail = false;
  const store = new SavePointStore({
    load() { return { document: doc, warnings: [] }; },
    save() { if (shouldFail) throw new Error('write failed'); },
  }, document => star.markClean(document));

  assert.equal(label(), '*');
  store.save('drawing.svg', doc);
  assert.equal(label(), '');
  assert.equal(new ModifiedStar().decorate(shape, doc), '*');
  shape.move(3, 0);
  shouldFail = true;
  assert.throws(() => store.save('drawing.svg', doc), /write failed/);
  assert.equal(label(), '*');
  shape.move(-3, 0);
  assert.equal(label(), '');
  shape.move(3, 0);
  store.load('drawing.svg');
  assert.equal(label(), '');
});

test('both CLI compositions show ordered labels and undo restores the saved tree', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'svg-tree-labels-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const entry = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const config = fileURLToPath(new URL('../plugins.config.json', import.meta.url));
  const input = [
    'init', 'create box b 0 0 10 10 label', 'tree', 'save drawing.svg', 'tree',
    'set b fill red', 'tree', 'undo', 'tree', 'redo', 'tree', 'read drawing.svg', 'tree',
  ].join('\n') + '\n';
  const results = [[], ['--config', config]].map(args =>
    spawnSync(process.execPath, [entry, ...args], { cwd, input, encoding: 'utf8' }));
  for (const result of results) {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.doesNotMatch(result.stdout, /error:/);
  }
  assert.equal(results[0].stdout, results[1].stdout);
  const boxes = results[0].stdout.match(/^└── box#b.*$/gm);
  assert.deepEqual(boxes, ['└── box#b  (box) *', ...Array(5).fill('└── box#b  (box)')]);
  const frames = results[0].stdout.match(/rect#b-rect  x=.*$/gm);
  assert.deepEqual(frames.map(line => line.endsWith(' *')), [true, false, true, false, true, false]);
});
