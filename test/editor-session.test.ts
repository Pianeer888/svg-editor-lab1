import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateCommand } from '../dist/application/CreateCommand.js';
import { EditorSession } from '../dist/application/EditorSession.js';
import { Rect } from '../dist/model/Rect.js';
import { SvgDocument } from '../dist/model/SvgDocument.js';

test('failed I/O and resize preserve the open document, its path, and both history stacks', () => {
  const original = new SvgDocument(100, 120);
  const saves: string[] = [];
  const session = new EditorSession({
    load(path) {
      if (path === 'broken.svg') throw new Error('broken SVG');
      return { document: original, warnings: [] };
    },
    save(path, document) {
      if (path === 'denied.svg') throw new Error('write denied');
      assert.equal(document, original);
      saves.push(path);
    },
  });
  session.read('original.svg');
  for (const id of ['first', 'second']) {
    session.execute(new CreateCommand(original, new Rect(id, 0, 0, 1, 1)));
  }
  session.undo();

  assert.throws(() => session.read('broken.svg'), /broken SVG/);
  assert.throws(() => session.save('denied.svg'), /write denied/);
  assert.throws(() => session.resize(0, 100), /canvas dimensions must be positive/);
  assert.equal(session.requireDocument(), original);
  assert.deepEqual([original.width, original.height], [100, 120]);
  assert.match(session.redo(), /second/);
  assert.ok(original.find('second'));
  assert.match(session.undo(), /second/);
  assert.match(session.undo(), /first/);
  assert.deepEqual(original.children, []);
  assert.equal(session.save().path, 'original.svg');
  assert.deepEqual(saves, ['original.svg']);
});

test('successful I/O and resize apply the history barrier and init resets the save path', () => {
  const loaded = new SvgDocument();
  const session = new EditorSession({
    load() { return { document: loaded, warnings: ['sample warning'] }; },
    save() {},
  });
  assert.throws(() => session.requireDocument(), /no document/);
  assert.throws(() => session.undo(), /no document/);
  const first = session.initialize(20, 30);
  assert.throws(() => session.save(), /no file path/);
  session.execute(new CreateCommand(first, new Rect('r', 0, 0, 1, 1)));
  assert.equal(session.save('new.svg').path, 'new.svg');
  assert.throws(() => session.undo(), /undo not allowed after io command/);

  session.execute(new CreateCommand(first, new Rect('s', 0, 0, 1, 1)));
  assert.deepEqual(session.read('incoming.svg').warnings, ['sample warning']);
  assert.equal(session.requireDocument(), loaded);
  assert.throws(() => session.undo(), /undo not allowed after io command/);
  session.execute(new CreateCommand(loaded, new Rect('t', 0, 0, 1, 1)));
  session.undo();
  session.resize(30, 40);
  assert.throws(() => session.redo(), /undo not allowed after io command/);
  assert.deepEqual([loaded.width, loaded.height], [30, 40]);

  const fresh = session.initialize();
  assert.deepEqual([fresh.width, fresh.height], [800, 600]);
  assert.throws(() => session.save(), /no file path/);
});
