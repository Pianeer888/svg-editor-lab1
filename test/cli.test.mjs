import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { Cli } from '../dist/cli/Cli.js';
import { Tokenizer } from '../dist/cli/Tokenizer.js';

async function run(lines) {
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Cli(Readable.from([lines.join('\n') + '\n']), sink).run();
  return output;
}

test('quoted text stays one argument and missing quote is rejected', () => {
  assert.deepEqual(Tokenizer.parse('create text label 10 20 "Hello world"'), ['create', 'text', 'label', '10', '20', 'Hello world']);
  assert.throws(() => Tokenizer.parse('create text t 1 2 "unfinished'), /unterminated/);
});

test('CLI creates a nested document and displays structure and attributes', async () => {
  const output = await run([
    'init 400 200', 'create g flow', 'create rect start 30 70 120 60 #4a90d9 in flow',
    'create text label 40 90 "Hello world" in flow', 'tree', 'show start',
  ]);
  assert.match(output, /canvas 400x200 created/);
  assert.match(output, /g#flow created/);
  assert.match(output, /rect#start created in g#flow/);
  assert.match(output, /└── g#flow\n    ├── rect#start  x=30 y=70 w=120 h=60 fill=#4a90d9/);
  assert.match(output, /text#label  \(40,90\) "Hello world"/);
  assert.match(output, /rect#start  parent=g#flow/);
});

test('invalid create leaves the document unchanged', async () => {
  const output = await run(['init', 'create rect r 1 2 3 4', 'create circle r 1 2 3', 'create rect bad 1 2 3 4 in r', 'tree']);
  assert.match(output, /error: id already exists: r/);
  assert.match(output, /error: not a container: r/);
  assert.equal((output.match(/├── |└── /g) ?? []).length, 1);
});

test('create accepts all built-in types and rejects the future box type', async () => {
  const output = await run([
    'init', 'create rect r 1 2 3 4', 'create circle c 1 2 3',
    'create ellipse e 1 2 3 4', 'create line l 1 2 3 4 black',
    'create text t 1 2 "hello"', 'create g g1', 'create box b 1 2 3 4 "title"', 'tree',
  ]);
  for (const type of ['rect', 'circle', 'ellipse', 'line', 'text', 'g']) {
    assert.match(output, new RegExp(`${type}#[a-z0-9]+ created`));
  }
  assert.match(output, /error: unknown shape type: box/);
  assert.equal((output.match(/├── |└── /g) ?? []).length, 6);
});

test('edit commands undo, redo, and clear redo after a new edit', async () => {
  const output = await run([
    'init', 'create rect r 1 2 3 4', 'move r 10 0', 'show r',
    'undo', 'show r', 'redo', 'show r', 'undo', 'set r fill blue', 'redo', 'show r',
  ]);
  assert.match(output, /x=11 y=2 width=3 height=4/);
  assert.equal((output.match(/x=1 y=2 width=3 height=4/g) ?? []).length, 2);
  assert.match(output, /redid: rect#r moved by \(10,0\)/);
  assert.match(output, /error: nothing to redo/);
  assert.match(output, /fill=blue/);
});

test('delete undo restores the original position in its parent', async () => {
  const output = await run([
    'init', 'create g parent', 'create rect first 0 0 1 1 in parent',
    'create circle middle 1 1 2 in parent', 'create rect last 2 2 1 1 in parent',
    'delete middle', 'undo', 'tree parent',
  ]);
  assert.match(output, /├── rect#first[\s\S]*├── circle#middle[\s\S]*└── rect#last/);
});

test('failed edits do not change state or enter command history', async () => {
  const output = await run(['init', 'create rect r 1 2 3 4', 'scale r 0', 'set r bogus value', 'undo', 'tree']);
  assert.match(output, /error: scale factor must be positive/);
  assert.match(output, /error: unknown attribute: bogus/);
  assert.match(output, /undid: rect#r created/);
  assert.doesNotMatch(output, /└── rect#r/);
});

test('group move undo restores descendants and init blocks old history', async () => {
  const output = await run([
    'init', 'create g group', 'create rect r 1 2 3 4 in group',
    'move group 5 6', 'show r', 'undo', 'show r', 'init', 'undo',
  ]);
  assert.match(output, /x=6 y=8 width=3 height=4/);
  assert.match(output, /x=1 y=2 width=3 height=4/);
  assert.match(output, /error: undo not allowed after io command/);
});
