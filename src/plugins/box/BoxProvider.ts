import type { ShapeProvider, SvgShapeInput, SvgShapeOutput } from '../../extensions/ShapeProvider.js';
import { Rect } from '../../model/Rect.js';
import type { Shape } from '../../model/Shape.js';
import { Text } from '../../model/Text.js';
import { Box } from './Box.js';

const groupStyles = ['fill', 'stroke', 'stroke-width'] as const;
const allowedAttributes = new Set(['id', 'data-kind', ...groupStyles]);

export class BoxProvider implements ShapeProvider {
  readonly type = 'box';

  create(id: string, args: readonly string[]): Box {
    if (args.length !== 5) throw new Error('usage: create box <id> <x> <y> <w> <h> "<label>"');
    const [x, y, width, height] = args.slice(0, 4).map(value => {
      const number = Number(value);
      if (!value.trim() || !Number.isFinite(number)) throw new Error(`invalid number: ${value}`);
      return number;
    }) as [number, number, number, number];
    const frame = new Rect(`${id}-rect`, x, y, width, height);
    frame.set('fill', '#4a90d9');
    const label = new Text(`${id}-label`, x + 20, y + height / 2 + 5, args[4]!);
    return new Box(id, frame, label, [frame, label]);
  }

  matchSvg(input: SvgShapeInput): 'exact' | false {
    return input.element === 'g' && input.attributes['data-kind'] === 'box' && 'exact';
  }

  fromSvg(input: SvgShapeInput, children: readonly Shape[]): Box {
    for (const name of Object.keys(input.attributes)) {
      if (!allowedAttributes.has(name)) throw new Error(`unsupported SVG attribute: ${name}`);
    }
    if (input.content.trim()) throw new Error('unexpected text in <g>');
    const frame = children.find(child => child.id === `${input.id}-rect`);
    const label = children.find(child => child.id === `${input.id}-label`);
    if (!(frame instanceof Rect) || !(label instanceof Text)) {
      throw new Error(`invalid box ${input.id}: required rect or text is missing or has the wrong type`);
    }
    const box = new Box(input.id, frame, label, children);
    for (const name of groupStyles) {
      const value = input.attributes[name];
      if (value !== undefined) box.set(name, value);
    }
    return box;
  }

  supports(shape: Shape): shape is Box { return shape instanceof Box; }

  toSvg(shape: Shape): SvgShapeOutput {
    return {
      element: 'g',
      attributes: {
        id: shape.id,
        'data-kind': 'box',
        ...(shape.fill === undefined ? {} : { fill: shape.fill }),
        ...(shape.stroke === undefined ? {} : { stroke: shape.stroke }),
        ...(shape.strokeWidth === undefined ? {} : { 'stroke-width': shape.strokeWidth }),
      },
    };
  }
}
