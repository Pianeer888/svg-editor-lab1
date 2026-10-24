import assert from 'node:assert/strict';
import test from 'node:test';
import { SvgDocument } from '../dist/model/SvgDocument.js';
import { Group } from '../dist/model/Group.js';
import { Rect } from '../dist/model/Rect.js';
import { Circle } from '../dist/model/Circle.js';
import { Ellipse } from '../dist/model/Ellipse.js';
import { Line } from '../dist/model/Line.js';
import { Text } from '../dist/model/Text.js';
import { GroupCommand } from '../dist/application/GroupCommand.js';
import { UngroupCommand } from '../dist/application/UngroupCommand.js';
import { AddToCommand } from '../dist/application/AddToCommand.js';
import { ReorderCommand } from '../dist/application/ReorderCommand.js';
import { CommandHistory } from '../dist/application/CommandHistory.js';

test('the six built-in shapes share geometry operations', () => {
  const shapes = [
    new Rect('r', 1, 2, 3, 4), new Circle('c', 1, 2, 3),
    new Ellipse('e', 1, 2, 3, 4), new Line('l', 1, 2, 3, 4),
    new Text('t', 1, 2, 'hello'), new Group('g'),
  ];
  for (const shape of shapes) {
    shape.move(2, 3);
    shape.scale(2);
  }
  assert.deepEqual(shapes[0].geometry(), { x: 6, y: 10, width: 6, height: 8 });
  assert.deepEqual(shapes[1].geometry(), { cx: 6, cy: 10, r: 6 });
  assert.deepEqual(shapes[2].geometry(), { cx: 6, cy: 10, rx: 6, ry: 8 });
  assert.deepEqual(shapes[3].geometry(), { x1: 6, y1: 10, x2: 10, y2: 14 });
  assert.deepEqual(shapes[4].geometry(), { x: 6, y: 10, text: 'hello' });
});

test('a group transforms descendants and the document can find nested ids', () => {
  const doc = new SvgDocument();
  const group = new Group('outer');
  doc.add(group);
  doc.add(new Rect('r', 1, 2, 3, 4), 'outer');
  group.move(2, 3);
  group.scale(2);
  assert.deepEqual(doc.find('r').geometry(), { x: 6, y: 10, width: 6, height: 8 });
  assert.equal(doc.find('r').parent, group);
});

test('duplicate ids and invalid attachment leave the document unchanged', () => {
  const doc = new SvgDocument();
  doc.add(new Rect('r', 0, 0, 1, 1));
  assert.throws(() => doc.add(new Circle('r', 0, 0, 1)), /id already exists/);
  assert.throws(() => doc.add(new Group('g'), 'missing'), /no such container/);
  assert.throws(() => doc.add(new Circle('c', 0, 0, 1), 'r'), /not a container/);
  assert.deepEqual([...doc.walk()].map(shape => shape.id), ['r']);
});

test('a group cannot contain itself or an ancestor', () => {
  const parent = new Group('parent');
  const child = new Group('child');
  parent.append(child);
  assert.throws(() => parent.append(parent), /own descendant/);
  assert.throws(() => child.append(parent), /own descendant/);
});

test('group preserves document order and undo restores original parents and positions', () => {
  const doc = new SvgDocument();
  doc.add(new Group('left'));
  doc.add(new Group('right'));
  doc.add(new Rect('a', 0, 0, 1, 1), 'left');
  doc.add(new Rect('b', 0, 0, 1, 1), 'left');
  doc.add(new Rect('c', 0, 0, 1, 1), 'right');
  const history = new CommandHistory();
  history.execute(new GroupCommand(doc, 'picked', ['c', 'a']));
  assert.deepEqual(doc.find('picked').children.map(shape => shape.id), ['a', 'c']);
  assert.deepEqual(doc.find('left').children.map(shape => shape.id), ['picked', 'b']);
  history.undo();
  assert.equal(doc.find('picked'), undefined);
  assert.deepEqual(doc.find('left').children.map(shape => shape.id), ['a', 'b']);
  assert.deepEqual(doc.find('right').children.map(shape => shape.id), ['c']);
  history.redo();
  assert.deepEqual(doc.find('picked').children.map(shape => shape.id), ['a', 'c']);
});

test('ungroup promotes children in place, and undo restores the nested container', () => {
  const doc = new SvgDocument();
  doc.add(new Group('outer'));
  doc.add(new Rect('before', 0, 0, 1, 1), 'outer');
  doc.add(new Group('inner'), 'outer');
  doc.add(new Circle('c', 1, 1, 1), 'inner');
  doc.add(new Rect('r', 1, 1, 2, 2), 'inner');
  doc.add(new Rect('after', 0, 0, 1, 1), 'outer');
  const history = new CommandHistory();
  history.execute(new UngroupCommand(doc, 'inner'));
  assert.deepEqual(doc.find('outer').children.map(shape => shape.id), ['before', 'c', 'r', 'after']);
  history.undo();
  assert.deepEqual(doc.find('outer').children.map(shape => shape.id), ['before', 'inner', 'after']);
  assert.deepEqual(doc.find('inner').children.map(shape => shape.id), ['c', 'r']);
  history.redo();
  assert.deepEqual(doc.find('outer').children.map(shape => shape.id), ['before', 'c', 'r', 'after']);
});

test('addto and z-order undo exactly; invalid structure edits do not enter history', () => {
  const doc = new SvgDocument();
  doc.add(new Group('outer'));
  doc.add(new Group('inner'), 'outer');
  doc.add(new Rect('a', 0, 0, 1, 1));
  doc.add(new Rect('b', 0, 0, 1, 1));
  doc.add(new Rect('c', 0, 0, 1, 1));
  const history = new CommandHistory();
  assert.throws(() => history.execute(new AddToCommand(doc, 'inner', 'outer')), /own descendant/);
  assert.throws(() => history.execute(new GroupCommand(doc, 'bad', ['inner', 'outer'])), /own descendant/);
  assert.throws(() => history.execute(new UngroupCommand(doc, 'outer')), /top-level/);
  assert.deepEqual(doc.children.map(shape => shape.id), ['outer', 'a', 'b', 'c']);
  history.execute(new ReorderCommand(doc, 'a', 'front'));
  assert.deepEqual(doc.children.map(shape => shape.id), ['outer', 'b', 'c', 'a']);
  history.undo();
  assert.deepEqual(doc.children.map(shape => shape.id), ['outer', 'a', 'b', 'c']);
  history.execute(new ReorderCommand(doc, 'c', 'back'));
  assert.deepEqual(doc.children.map(shape => shape.id), ['c', 'outer', 'a', 'b']);
  history.undo();
  assert.deepEqual(doc.children.map(shape => shape.id), ['outer', 'a', 'b', 'c']);
  history.execute(new AddToCommand(doc, 'inner', 'b'));
  assert.deepEqual(doc.find('inner').children.map(shape => shape.id), ['b']);
  history.undo();
  assert.deepEqual(doc.children.map(shape => shape.id), ['outer', 'a', 'b', 'c']);
  assert.deepEqual(doc.find('inner').children.map(shape => shape.id), []);
});
