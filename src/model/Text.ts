import { Shape } from './Shape.js';

export class Text extends Shape {
  constructor(id: string, private x: number, private y: number, private content: string) {
    super(id, 'text');
    if (![x, y].every(Number.isFinite)) throw new Error('invalid text geometry');
  }
  move(dx: number, dy: number): void { Shape.validOffset(dx, dy); this.x += dx; this.y += dy; }
  scale(factor: number): void { Shape.positiveFactor(factor); this.x *= factor; this.y *= factor; }
  geometry(): Readonly<Record<string, number | string>> { return { x: this.x, y: this.y, text: this.content }; }
  override summary(): string { return `(${this.x},${this.y}) "${this.content}"`; }
  protected setSpecific(attribute: string, value: string): void {
    switch (attribute) {
      case 'x': this.x = Shape.finite(value, attribute); return;
      case 'y': this.y = Shape.finite(value, attribute); return;
      case 'text': this.content = value; return;
      default: this.unknownAttribute(attribute);
    }
  }
}
