import { Circle } from '../model/Circle.js';
import { Ellipse } from '../model/Ellipse.js';
import { Group } from '../model/Group.js';
import { Line } from '../model/Line.js';
import { Rect } from '../model/Rect.js';
import { Shape } from '../model/Shape.js';
import { Text } from '../model/Text.js';
import type { ShapeProvider, SvgShapeInput, SvgShapeOutput } from '../extensions/ShapeProvider.js';

type ShapeConstructor = (id: string, numbers: readonly number[], args: readonly string[]) => Shape;

export class BuiltInShapeProvider implements ShapeProvider {
  constructor(
    readonly type: string,
    private readonly geometry: readonly string[],
    private readonly minimumArgs: number,
    private readonly maximumArgs: number,
    private readonly construct: ShapeConstructor,
  ) {}

  create(id: string, args: readonly string[]): Shape {
    if (args.length < this.minimumArgs || args.length > this.maximumArgs) {
      throw new Error(`usage: create ${this.type} <id> <params…>`);
    }
    const numericCount = this.type === 'text' ? 2 : this.type === 'g' ? 0 : this.minimumArgs;
    const numbers = args.slice(0, numericCount).map(value => {
      if (value.trim() === '' || !Number.isFinite(Number(value))) throw new Error(`invalid number: ${value}`);
      return Number(value);
    });
    const shape = this.construct(id, numbers, args);
    const color = args[numericCount];
    if (color !== undefined && this.type !== 'text' && this.type !== 'g') {
      shape.set(this.type === 'line' ? 'stroke' : 'fill', color);
    }
    return shape;
  }

  matchSvg(input: SvgShapeInput): 'exact' | 'fallback' | false {
    if (input.element !== this.type) return false;
    return this.type === 'g' && input.attributes['data-kind'] !== undefined ? 'fallback' : 'exact';
  }

  fromSvg(input: SvgShapeInput, children: readonly Shape[]): Shape {
    const allowed = new Set(['id', 'fill', 'stroke', 'stroke-width', ...this.geometry]);
    if (this.type === 'g') allowed.add('data-kind');
    for (const name of Object.keys(input.attributes)) {
      if (!allowed.has(name)) throw new Error(`unsupported SVG attribute: ${name}`);
    }
    const args = this.geometry.map(name => {
      const value = input.attributes[name];
      if (value === undefined) throw new Error(`missing SVG attribute: ${name}`);
      return value;
    });
    if (this.type === 'text') args.push(input.content);
    else if (input.content.trim()) throw new Error(`unexpected text in <${this.type}>`);
    const shape = this.create(input.id, args);
    for (const name of ['fill', 'stroke', 'stroke-width']) {
      const value = input.attributes[name];
      if (value !== undefined) shape.set(name, value);
    }
    if (shape instanceof Group) {
      for (const child of children) shape.append(child);
    } else if (children.length > 0) throw new Error(`unsupported nested content in <${this.type}>`);
    return shape;
  }

  supports(shape: Shape): boolean { return shape.type === this.type; }

  toSvg(shape: Shape): SvgShapeOutput {
    const attributes: Record<string, string | number> = { id: shape.id };
    for (const [name, value] of Object.entries(shape.geometry())) {
      if (name !== 'text') attributes[name] = value;
    }
    if (shape.fill !== undefined) attributes.fill = shape.fill;
    if (shape.stroke !== undefined) attributes.stroke = shape.stroke;
    if (shape.strokeWidth !== undefined) attributes['stroke-width'] = shape.strokeWidth;
    const content = shape.type === 'text' ? String(shape.geometry().text) : undefined;
    return { element: this.type, attributes, ...(content === undefined ? {} : { content }) };
  }
}

export function registerBuiltInShapes(register: (provider: ShapeProvider) => void): void {
  const providers = [
    new BuiltInShapeProvider('rect', ['x', 'y', 'width', 'height'], 4, 5,
      (id, n) => new Rect(id, n[0]!, n[1]!, n[2]!, n[3]!)),
    new BuiltInShapeProvider('circle', ['cx', 'cy', 'r'], 3, 4,
      (id, n) => new Circle(id, n[0]!, n[1]!, n[2]!)),
    new BuiltInShapeProvider('ellipse', ['cx', 'cy', 'rx', 'ry'], 4, 5,
      (id, n) => new Ellipse(id, n[0]!, n[1]!, n[2]!, n[3]!)),
    new BuiltInShapeProvider('line', ['x1', 'y1', 'x2', 'y2'], 4, 5,
      (id, n) => new Line(id, n[0]!, n[1]!, n[2]!, n[3]!)),
    new BuiltInShapeProvider('text', ['x', 'y'], 3, 3,
      (id, n, args) => new Text(id, n[0]!, n[1]!, args[2]!)),
    new BuiltInShapeProvider('g', [], 0, 0, id => new Group(id)),
  ];
  for (const provider of providers) register(provider);
}
