import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { Cli } from '../dist/cli/Cli.js';
import { createDefaultExtensions } from '../dist/extensions/DefaultExtensions.js';
import { SvgCodec } from '../dist/infrastructure/SvgCodec.js';
import { SvgFileStore } from '../dist/infrastructure/SvgFileStore.js';
import { Shape } from '../dist/model/Shape.js';
import { SvgDocument } from '../dist/model/SvgDocument.js';

async function run(lines, configure = () => {}) {
  const extensions = createDefaultExtensions();
  configure(extensions);
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  await new Cli(Readable.from([lines.join('\n') + '\n']), sink, new SvgFileStore(extensions), extensions).run();
  return output;
}

test('registered commands use the public command context and contribute help', async () => {
  const output = await run(['init', 'create rect r 0 0 1 1', 'count', 'help'], extensions => {
    extensions.registerCommand({
      name: 'count', usage: 'count', help: 'count document elements',
      execute(context, args) {
        assert.deepEqual(args, []);
        context.write(`count: ${[...context.requireDocument().walk()].length}\n`);
      },
    });
  });
  assert.match(output, /count: 1/);
  assert.match(output, /count document elements/);
});

test('tree decorators compose and an attribute handler remains one undo unit', async () => {
  const output = await run([
    'init', 'create rect r 0 0 1 1', 'set r accent blue', 'tree', 'undo', 'tree',
  ], extensions => {
    extensions.registerAttributeHandler({
      name: 'accent',
      supports: (shape, attribute) => shape.type === 'rect' && attribute === 'accent',
      set: (shape, _attribute, value) => shape.set('fill', value),
    });
    extensions.registerTreeDecorator({
      decorate: shape => shape.fill === 'blue' ? '[accent]' : '',
    });
  });
  assert.match(output, /rect#r  x=0 y=0 w=1 h=1 fill=blue \[accent\]/);
  assert.match(output, /undid: rect#r updated: accent="blue"/);
  assert.match(output, /rect#r  x=0 y=0 w=1 h=1\n/);
});

test('conflicting attribute handlers reject the edit before history changes', async () => {
  const output = await run(['init', 'create rect r 0 0 1 1', 'set r custom x', 'undo', 'tree'], extensions => {
    for (const name of ['first', 'second']) extensions.registerAttributeHandler({
      name, supports: (_shape, attribute) => attribute === 'custom', set: () => {},
    });
  });
  assert.match(output, /error: conflicting attribute handlers: first, second/);
  assert.match(output, /undid: rect#r created/);
  assert.ok(output.endsWith('svg (800x600)\n'));
});

test('a failing attribute handler restores state and does not enter history', async () => {
  const output = await run(['init', 'create rect r 0 0 1 1', 'set r risky red', 'show r', 'undo', 'tree'], extensions => {
    extensions.registerAttributeHandler({
      name: 'risky', supports: (_shape, attribute) => attribute === 'risky',
      set(shape) { shape.set('fill', 'red'); throw new Error('handler failed'); },
    });
  });
  assert.match(output, /error: handler failed/);
  assert.doesNotMatch(output, /fill=red/);
  assert.match(output, /undid: rect#r created/);
  assert.ok(output.endsWith('svg (800x600)\n'));
});

test('a registered shape provider owns creation and SVG conversion', () => {
  class Point extends Shape {
    constructor(id, x, y) { super(id, 'point'); this.x = x; this.y = y; }
    move(dx, dy) { this.x += dx; this.y += dy; }
    scale(factor) { this.x *= factor; this.y *= factor; }
    geometry() { return { x: this.x, y: this.y }; }
    setSpecific(attribute, value) {
      if (attribute === 'x') this.x = Number(value);
      else if (attribute === 'y') this.y = Number(value);
      else throw new Error(`unknown attribute: ${attribute}`);
    }
  }
  const extensions = createDefaultExtensions();
  extensions.registerShape({
    type: 'point',
    create: (id, args) => new Point(id, Number(args[0]), Number(args[1])),
    matchSvg: input => input.element === 'point' ? 'exact' : false,
    fromSvg: input => new Point(input.id, Number(input.attributes.x), Number(input.attributes.y)),
    supports: shape => shape.type === 'point',
    toSvg: shape => ({ element: 'point', attributes: { id: shape.id, ...shape.geometry() } }),
  });
  const shape = extensions.createShape('point', 'p', ['3', '4']);
  assert.deepEqual(shape.geometry(), { x: 3, y: 4 });
  const document = new SvgDocument(10, 10);
  document.add(shape);
  const xml = SvgCodec.serialize(document, extensions);
  assert.match(xml, /<point id="p" x="3" y="4"\/>/);
  const parsed = SvgCodec.parse(xml, extensions).document.find('p');
  assert.deepEqual(parsed.geometry(), { x: 3, y: 4 });
});

test('marked groups fall back to ordinary groups when no optional provider is loaded', () => {
  const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
    '<g id="b" data-kind="box"><rect id="r" x="0" y="0" width="1" height="1"/></g></svg>';
  const { document } = SvgCodec.parse(xml);
  assert.deepEqual([...document.walk()].map(shape => `${shape.type}#${shape.id}`), ['g#b', 'rect#r']);
});

test('default extensions preserve the Phase 1 transcript byte for byte', async () => {
  const input = readFileSync(new URL('../doc/transcript/cli-1.txt', import.meta.url), 'utf8');
  const expected = readFileSync(new URL('../doc/transcript/cli-1.final.out', import.meta.url), 'utf8');
  const imported = readFileSync(new URL('../doc/transcript/other.svg', import.meta.url), 'utf8');
  const store = {
    load(path) { assert.equal(path, 'other.svg'); return SvgCodec.parse(imported); },
    save(path) { assert.equal(path, 'demo.svg'); },
  };
  const extensions = createDefaultExtensions();
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  async function* pacedInput() {
    for (const line of input.trimEnd().split('\n')) {
      yield `${line}\n`;
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  await new Cli(Readable.from(pacedInput()), sink, store, extensions).run();
  assert.equal(output, expected);
});
