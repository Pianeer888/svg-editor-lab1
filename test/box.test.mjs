import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cli } from '../dist/cli/Cli.js';
import { PluginLoader } from '../dist/composition/PluginLoader.js';
import { createDefaultExtensions } from '../dist/extensions/DefaultExtensions.js';
import { SvgCodec } from '../dist/infrastructure/SvgCodec.js';
import createBoxPlugin from '../dist/plugins/box/index.js';

function registry() {
  const extensions = createDefaultExtensions();
  const [result] = new PluginLoader(extensions).loadCode([createBoxPlugin()]);
  assert.equal(result.status, 'loaded', result.error);
  return extensions;
}

async function run(input, store = {}) {
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, done) { output += chunk; done(); } });
  await new Cli(Readable.from([input]), sink, store, registry()).run();
  return output;
}

test('box nests and moves as a composite, with fill and label as separate undo units', async () => {
  const output = await run(`init
create box outer 120 100 160 60 "开始"
create box inner 520 100 160 60 "处理数据" in outer
move outer 0 100
show inner-rect
undo
set inner fill #f5a623
set inner label "处理数据 v2"
undo
show inner-label
undo
show inner-rect
redo
show inner-rect
redo
show inner-label
`);
  assert.match(output, /box#inner created in g#outer/);
  assert.match(output, /x=520 y=200 width=160 height=60/);
  assert.match(output, /undid: box#inner updated: label=.*\ntext#inner-label[^\n]*\n  x=540 y=135 text="处理数据"/);
  assert.match(output, /undid: box#inner updated: fill=.*\nrect#inner-rect[^\n]*\n  x=520 y=100[^\n]*\n  fill=#4a90d9/);
  assert.match(output, /redid: box#inner updated: fill=.*\nrect#inner-rect[^\n]*\n  x=520 y=100[^\n]*\n  fill=#f5a623/);
  assert.match(output, /redid: box#inner updated: label=.*\ntext#inner-label[^\n]*\n  x=540 y=135 text="处理数据 v2"/);
});

test('required children resist structural edits and derived id conflicts are atomic', async () => {
  const output = await run(`init
create g parent
create box b 0 0 10 10 label in parent
create rect c-rect 0 0 1 1
create box c 0 0 10 10 label
delete b-rect
addto parent b-label
group invalid c-rect b-label
ungroup b
undo
tree
`);
  assert.match(output, /error: id already exists: c-rect/);
  assert.equal((output.match(/error: cannot remove required child from box b:/g) ?? []).length, 4);
  assert.match(output, /undid: rect#c-rect created/);
  assert.match(output, /box#b[\s\S]+rect#b-rect[\s\S]+text#b-label/);
  assert.doesNotMatch(output, /(?:box#c|text#c-label|g#invalid)/);
});

test('marked boxes round trip or fall back to ordinary groups without the plugin', () => {
  const extensions = registry();
  const svg = '<svg width="100" height="100"><g id="b" data-kind="box" stroke="red">' +
    '<text id="b-label" x="20" y="15">A &amp; B</text>' +
    '<rect id="b-rect" x="0" y="0" width="10" height="20"/></g></svg>';
  const document = SvgCodec.parse(svg, extensions).document;
  assert.equal(document.find('b').type, 'box');
  const encoded = SvgCodec.serialize(document, extensions);
  assert.match(encoded, /<g id="b" data-kind="box" stroke="red">/);
  assert.equal(SvgCodec.serialize(SvgCodec.parse(encoded, extensions).document, extensions), encoded);
  const fallback = SvgCodec.parse(encoded).document;
  assert.deepEqual([...fallback.walk()].map(shape => shape.type), ['g', 'text', 'rect']);
});

test('a marked box with invalid children does not replace the current document or history', async () => {
  const extensions = registry();
  const bad = '<svg width="100" height="100"><g id="bad" data-kind="box">' +
    '<circle id="bad-rect" cx="1" cy="1" r="1"/></g></svg>';
  const output = await run('init\ncreate rect r 0 0 1 1\nread bad.svg\nundo\ntree\n', {
    load() { return SvgCodec.parse(bad, extensions); },
  });
  assert.match(output, /error: invalid box bad/);
  assert.match(output, /undid: rect#r created/);
});

test('the configuration entry point runs the Version B session and saves both boxes', t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-box-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const main = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  const input = readFileSync(new URL('../doc/transcript/cli-box.txt', import.meta.url), 'utf8');
  const config = fileURLToPath(new URL('../plugins.config.json', import.meta.url));
  const result = spawnSync(process.execPath, [main, '--config', config], { cwd: directory, input, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /error:/);
  assert.match(result.stdout, /saved to flowchart-box\.svg \(8 elements\)/);
  const saved = readFileSync(join(directory, 'flowchart-box.svg'), 'utf8');
  const { document } = SvgCodec.parse(saved, registry());
  assert.deepEqual(document.find('flowchart').children.map(shape => shape.type), ['box', 'box', 'line']);
  assert.equal(document.find('n2-rect').fill, '#f5a623');
  assert.equal(document.find('n2-label').geometry().text, '处理数据');
});
