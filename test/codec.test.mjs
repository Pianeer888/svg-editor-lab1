import assert from 'node:assert/strict';
import test from 'node:test';
import { SvgCodec } from '../dist/infrastructure/SvgCodec.js';
import { SvgDocument } from '../dist/model/SvgDocument.js';
import { Group } from '../dist/model/Group.js';
import { Rect } from '../dist/model/Rect.js';
import { Circle } from '../dist/model/Circle.js';
import { Ellipse } from '../dist/model/Ellipse.js';
import { Line } from '../dist/model/Line.js';
import { Text } from '../dist/model/Text.js';

test('SVG round trip preserves canvas, tree order, all six shapes, styles, and escaped text', () => {
  const original = new SvgDocument(400, 200);
  original.add(new Group('flow'));
  const rect = new Rect('start', 30, 70, 120, 60);
  rect.set('fill', '#4a90d9');
  rect.set('stroke-width', '2');
  original.add(rect, 'flow');
  original.add(new Circle('circle', 10, 20, 5), 'flow');
  original.add(new Ellipse('ellipse', 20, 30, 5, 7), 'flow');
  const line = new Line('edge', 150, 100, 250, 100);
  line.set('stroke', 'black');
  original.add(line, 'flow');
  original.add(new Text('label', 35, 95, 'A & <B> "C"'), 'flow');
  const xml = SvgCodec.serialize(original);
  assert.match(xml, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="400" height="200" viewBox="0 0 400 200">/);
  assert.match(xml, /A &amp; &lt;B&gt; &quot;C&quot;/);
  const { document, warnings } = SvgCodec.parse(xml);
  assert.deepEqual(warnings, []);
  assert.equal(document.width, 400);
  assert.equal(document.height, 200);
  assert.deepEqual([...document.walk()].map(shape => shape.id), [...original.walk()].map(shape => shape.id));
  for (const before of original.walk()) {
    const after = document.find(before.id);
    assert.deepEqual(after.geometry(), before.geometry());
    assert.equal(after.fill, before.fill);
    assert.equal(after.stroke, before.stroke);
    assert.equal(after.strokeWidth, before.strokeWidth);
  }
});

test('missing ids are assigned without colliding with explicit ids later in the SVG', () => {
  const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">' +
    '<rect x="0" y="0" width="20" height="10"/>' +
    '<rect id="rect1" x="30" y="0" width="20" height="10"/>' +
    '<g><text x="1" y="2">A &amp; B</text></g></svg>';
  const { document, warnings } = SvgCodec.parse(xml);
  assert.deepEqual([...document.walk()].map(shape => shape.id), ['rect2', 'rect1', 'g1', 'text1']);
  assert.deepEqual(warnings, [
    'warning: assigned id rect2 to unnamed <rect>',
    'warning: assigned id g1 to unnamed <g>',
    'warning: assigned id text1 to unnamed <text>',
  ]);
  assert.equal(document.find('text1').geometry().text, 'A & B');
});

test('unsupported or malformed SVG is rejected instead of silently losing content', () => {
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${body}</svg>`;
  assert.throws(() => SvgCodec.parse(svg('<path id="p" d="M0 0"/>')), /unsupported SVG element/);
  assert.throws(() => SvgCodec.parse(svg('<rect id="r" x="0" y="0" width="1" height="1" transform="translate(1,1)"/>')), /unsupported SVG attribute/);
  assert.throws(() => SvgCodec.parse(svg('<rect id="r" x="0" y="0" width="1" height="1"/><circle id="r" cx="1" cy="1" r="1"/>')), /id already exists/);
  assert.throws(() => SvgCodec.parse(svg('<g id="g"><rect id="r" x="0" y="0" width="1" height="1"></g>')), /mismatched|unclosed|close tag/i);
  assert.throws(() => SvgCodec.parse('<!DOCTYPE svg [<!ENTITY x "unsafe">]>' + svg('')), /DOCTYPE is not supported/);
  assert.throws(() => SvgCodec.parse('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="1 0 10 10"/>'), /unsupported SVG viewBox/);
});
