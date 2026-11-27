import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { TextDocument, Uri } from 'vscode';

const require = createRequire(import.meta.url);
const { SvgOutlineParser }: typeof import('../vscode-extension/dist/SvgOutlineParser.js') =
  require('../vscode-extension/dist/SvgOutlineParser.js');

class Position {
  readonly line: number;
  readonly character: number;
  constructor(line: number, character: number) { this.line = line; this.character = character; }
}
class Range {
  readonly start: Position;
  readonly end: Position;
  constructor(start: Position, end: Position) { this.start = start; this.end = end; }
}
class DocumentSymbol {
  constructor(name: string, detail: string, kind: number, range: Range, selectionRange: Range) {
    Object.assign(this, { name, detail, kind, range, selectionRange, children: [] });
  }
}
class FileDecoration {
  constructor(badge: string, tooltip: string) { Object.assign(this, { badge, tooltip }); }
}
const vscode = {
  Range, DocumentSymbol, FileDecoration,
  SymbolKind: { Namespace: 3, Object: 18 },
  FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
  workspace: { fs: { stat: async () => ({ type: 1 }) } },
};
const Module: { _load(name: string, parent: unknown, isMain: boolean): unknown } = require('node:module');
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'vscode') return vscode;
  return originalLoad.call(this, name, parent, isMain);
};
const { SvgDocumentSymbolProvider }: typeof import('../vscode-extension/dist/SvgDocumentSymbolProvider.js') =
  require('../vscode-extension/dist/SvgDocumentSymbolProvider.js');
const { SvgFileDecorationProvider }: typeof import('../vscode-extension/dist/SvgFileDecorationProvider.js') =
  require('../vscode-extension/dist/SvgFileDecorationProvider.js');
Module._load = originalLoad;

function document(text: string): TextDocument {
  const stub = {
    getText: () => text,
    positionAt(offset: number) {
      const before = text.slice(0, offset);
      const lines = before.split('\n');
      return new Position(lines.length - 1, lines[lines.length - 1].length);
    },
  };
  // The symbol provider only reads text and translates offsets.
  return stub as Pick<TextDocument, 'getText'> as TextDocument;
}

function resource(scheme: string, path: string): Uri {
  // The file decoration provider only reads these two fields.
  return { scheme, path } as Uri;
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
  const visited: string[] = [];
  const provider = new SvgFileDecorationProvider({ stat: async uri => {
    visited.push(uri.path);
    return { type: uri.path.includes('directory') ? 2 : 1, ctime: 0, mtime: 0, size: 0 };
  } });
  const svg = resource('file', '/work/example.svg');
  assert.equal((await provider.provideFileDecoration(svg))?.badge, '[]');
  assert.deepEqual(svg, { scheme: 'file', path: '/work/example.svg' });
  assert.equal(await provider.provideFileDecoration(resource('file', '/work/readme.txt')), undefined);
  assert.equal(await provider.provideFileDecoration(resource('file', '/work/directory.svg')), undefined);
  assert.equal(await provider.provideFileDecoration(resource('untitled', '/work/example.svg')), undefined);
  assert.deepEqual(visited, ['/work/example.svg', '/work/directory.svg']);
  const failing = new SvgFileDecorationProvider({ stat: async () => { throw new Error('missing'); } });
  assert.equal(await failing.provideFileDecoration(svg), undefined);
});

test('parser treats XML entities and namespace prefixes as XML, not string fragments', () => {
  const parsed = new SvgOutlineParser().parse('<svg xmlns="http://www.w3.org/2000/svg"><g id="a&amp;b"><rect/></g></svg>');
  assert.equal(parsed[0].children[0].name, 'g#a&b');
  assert.deepEqual(new SvgOutlineParser().parse('<svg><g><rect></g></svg>'), []);
});
