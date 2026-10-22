import assert from 'node:assert/strict';
import test from 'node:test';
import { SvgDocument } from '../dist/model/SvgDocument.js';
import { Group } from '../dist/model/Group.js';
import { Rect } from '../dist/model/Rect.js';
import { Circle } from '../dist/model/Circle.js';
import { Ellipse } from '../dist/model/Ellipse.js';
import { Line } from '../dist/model/Line.js';
import { Text } from '../dist/model/Text.js';

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
