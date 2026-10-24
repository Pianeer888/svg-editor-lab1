import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cli } from '../dist/cli/Cli.js';
import { SvgFileStore } from '../dist/infrastructure/SvgFileStore.js';

async function run(lines) {
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Cli(Readable.from([lines.join('\n') + '\n']), sink, new SvgFileStore()).run();
  return output;
}

test('CLI saves a nested SVG, reads it back, and applies the IO undo barrier', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-lab-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'diagram one.svg');
  const output = await run([
    'init 400 200', 'create g scene', 'create rect box 10 20 30 40 red in scene',
    'create text label 12 35 "A & B" in scene', 'canvas',
    `save "${path}"`, 'undo', `read "${path}"`, 'tree', 'canvas',
  ]);
  assert.match(output, /canvas 400x200/);
  assert.match(output, /saved to .*diagram one\.svg \(3 elements\)/);
  assert.match(output, /error: undo not allowed after io command/);
  assert.match(output, /read .*diagram one\.svg \(3 elements\)/);
  assert.match(output, /svg \(400x200\)[\s\S]*g#scene[\s\S]*rect#box[\s\S]*text#label/);
  const xml = readFileSync(path, 'utf8');
  assert.match(xml, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="400" height="200"/);
  assert.match(xml, /A &amp; B/);
});

test('failed read, save, and canvas commands preserve document and undo history', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-lab-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const malformed = join(directory, 'malformed.svg');
  writeFileSync(malformed, '<svg><rect></svg>');
  const output = await run([
    'init', 'create rect r 1 2 3 4',
    `read "${join(directory, 'missing.svg')}"`,
    `read "${malformed}"`,
    'canvas 0 200', `save "${join(directory, 'missing', 'bad.svg')}"`,
    'tree', 'undo', 'tree',
  ]);
  assert.match(output, /error: cannot read file: .*missing\.svg/);
  assert.doesNotMatch(output, /read .*malformed\.svg \(/);
  assert.match(output, /error: canvas dimensions must be positive/);
  assert.match(output, /error: cannot write file: .*bad\.svg/);
  assert.match(output, /svg \(800x600\)[\s\S]*rect#r/);
  assert.match(output, /undid: rect#r created/);
  assert.ok(output.endsWith('svg (800x600)\n'));
});

test('canvas query keeps history but successful resize blocks earlier edits', async () => {
  const output = await run([
    'init', 'create rect r 1 2 3 4', 'canvas', 'undo', 'tree',
    'create circle c 1 1 2', 'canvas 320 240', 'undo', 'tree',
    'create rect x 0 0 1 1', 'undo', 'tree',
  ]);
  assert.match(output, /undid: rect#r created/);
  assert.match(output, /canvas 320x240/);
  assert.match(output, /error: undo not allowed after io command/);
  assert.match(output, /svg \(320x240\)[\s\S]*circle#c/);
  assert.match(output, /undid: rect#x created/);
  assert.ok(output.endsWith('svg (320x240)\n└── circle#c  cx=1 cy=1 r=2\n'));
});

test('read assigns missing ids and no-argument save writes back to the source path', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-lab-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'external.svg');
  writeFileSync(path, '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect x="1" y="2" width="3" height="4"/></svg>');
  const output = await run([
    `read "${path}"`, 'tree', 'move rect1 2 0', 'save', 'undo',
    `read "${path}"`, 'show rect1',
  ]);
  assert.match(output, /warning: assigned id rect1 to unnamed <rect>/);
  assert.match(output, /saved to .*external\.svg \(1 elements\)/);
  assert.match(output, /error: undo not allowed after io command/);
  assert.match(output, /x=3 y=2 width=3 height=4/);
  assert.match(readFileSync(path, 'utf8'), /<rect id="rect1" x="3" y="2" width="3" height="4"\/>/);
});
