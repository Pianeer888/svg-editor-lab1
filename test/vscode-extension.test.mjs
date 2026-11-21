import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SvgOutlineParser } = require('../vscode-extension/dist/SvgOutlineParser.js');

class Position {
  constructor(line, character) { this.line = line; this.character = character; }
}
class Range {
  constructor(start, end) { this.start = start; this.end = end; }
}
class DocumentSymbol {
  constructor(name, detail, kind, range, selectionRange) {
    Object.assign(this, { name, detail, kind, range, selectionRange, children: [] });
  }
}
class FileDecoration {
  constructor(badge, tooltip) { Object.assign(this, { badge, tooltip }); }
}
const vscode = {
  Range, DocumentSymbol, FileDecoration,
  SymbolKind: { Namespace: 3, Object: 18 },
  FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
  workspace: { fs: { stat: async () => ({ type: 1 }) } },
};
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'vscode') return vscode;
  return originalLoad.call(this, name, parent, isMain);
};
const { SvgDocumentSymbolProvider } = require('../vscode-extension/dist/SvgDocumentSymbolProvider.js');
const { SvgFileDecorationProvider } = require('../vscode-extension/dist/SvgFileDecorationProvider.js');
Module._load = originalLoad;

function document(text) {
  return {
    getText: () => text,
    positionAt(offset) {
      const before = text.slice(0, offset);
      const lines = before.split('\n');
      return new Position(lines.length - 1, lines.at(-1).length);
    },
  };
}

test('native Outline symbols preserve SVG nesting, ids, and source positions', () => {
  const text = '<svg id="root">\n  <g id="flow">\n    <rect id="start"/>\n    <text>开始</text>\n  </g>\n</svg>';
  const symbols = new SvgDocumentSymbolProvider().provideDocumentSymbols(document(text));
  assert.deepEqual(symbols.map(x => x.name), ['svg#root']);
  assert.deepEqual(symbols[0].children.map(x => x.name), ['g#flow']);
  assert.deepEqual(symbols[0].children[0].children.map(x => x.name), ['rect#start', 'text']);
  assert.deepEqual(symbols[0].children[0].children[0].selectionRange.start, new Position(2, 4));
  assert.deepEqual(symbols[0].children[0].children[0].range.end, new Position(2, 22));
});

test('edited text produces updated symbols; incomplete XML clears them without throwing', () => {
  const provider = new SvgDocumentSymbolProvider();
  assert.equal(provider.provideDocumentSymbols(document('<svg><g id="before"/></svg>'))[0].children[0].name, 'g#before');
  assert.equal(provider.provideDocumentSymbols(document('<svg><g id="after"/></svg>'))[0].children[0].name, 'g#after');
  assert.deepEqual(provider.provideDocumentSymbols(document('<svg><g id="editing"')), []);
  assert.deepEqual(provider.provideDocumentSymbols(document('<html/>')), []);
});

test('file decoration marks SVG files only and leaves the resource untouched', async () => {
  const visited = [];
  const provider = new SvgFileDecorationProvider({ stat: async uri => {
    visited.push(uri.path);
    return { type: uri.path.includes('directory') ? 2 : 1 };
  } });
  const svg = { scheme: 'file', path: '/work/example.svg' };
  assert.equal((await provider.provideFileDecoration(svg)).badge, '[]');
  assert.deepEqual(svg, { scheme: 'file', path: '/work/example.svg' });
  assert.equal(await provider.provideFileDecoration({ scheme: 'file', path: '/work/readme.txt' }), undefined);
  assert.equal(await provider.provideFileDecoration({ scheme: 'file', path: '/work/directory.svg' }), undefined);
  assert.equal(await provider.provideFileDecoration({ scheme: 'untitled', path: '/work/example.svg' }), undefined);
  assert.deepEqual(visited, ['/work/example.svg', '/work/directory.svg']);
  const failing = new SvgFileDecorationProvider({ stat: async () => { throw new Error('missing'); } });
  assert.equal(await failing.provideFileDecoration(svg), undefined);
});

test('parser treats XML entities and namespace prefixes as XML, not string fragments', () => {
  const parsed = new SvgOutlineParser().parse('<svg xmlns="http://www.w3.org/2000/svg"><g id="a&amp;b"><rect/></g></svg>');
  assert.equal(parsed[0].children[0].name, 'g#a&b');
  assert.deepEqual(new SvgOutlineParser().parse('<svg><g><rect></g></svg>'), []);
});
