import { Shape } from './Shape.js';
import { Rect } from './Rect.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Line } from './Line.js';
import { Text } from './Text.js';
import { Group } from './Group.js';

/** The one type-name dispatch point. A later phase can replace this with registration. */
export class ShapeFactory {
  static create(type: string, id: string, args: string[]): Shape {
    const layouts: Record<string, [number, number]> = {
      rect: [4, 5], circle: [3, 4], ellipse: [4, 5], line: [4, 5], text: [3, 3], g: [0, 0],
    };
    const layout = layouts[type];
    if (!layout) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    if (args.length < layout[0] || args.length > layout[1]) throw new Error(`usage: create ${type} <id> <params…>`);
    const numericCount = type === 'text' ? 2 : type === 'g' ? 0 : layout[0];
    const numbers = args.slice(0, numericCount).map((arg) => {
      if (arg.trim() === '' || !Number.isFinite(Number(arg))) throw new Error(`invalid number: ${arg}`);
      return Number(arg);
    });
    let shape: Shape;
    switch (type) {
      case 'rect': shape = new Rect(id, numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!); break;
      case 'circle': shape = new Circle(id, numbers[0]!, numbers[1]!, numbers[2]!); break;
      case 'ellipse': shape = new Ellipse(id, numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!); break;
      case 'line': shape = new Line(id, numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!); break;
      case 'text': shape = new Text(id, numbers[0]!, numbers[1]!, args[2]!); break;
      case 'g': shape = new Group(id); break;
      default: throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    const color = args[numericCount];
    if (color !== undefined && type !== 'text' && type !== 'g') shape.set(type === 'line' ? 'stroke' : 'fill', color);
    return shape;
  }
}
