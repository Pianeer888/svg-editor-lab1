import { Shape } from './Shape.js';

export class Line extends Shape {
  constructor(id: string, private x1: number, private y1: number, private x2: number, private y2: number) {
    super(id, 'line');
    if (![x1, y1, x2, y2].every(Number.isFinite)) throw new Error('invalid line geometry');
  }
  move(dx: number, dy: number): void { Shape.validOffset(dx, dy); this.x1 += dx; this.y1 += dy; this.x2 += dx; this.y2 += dy; }
  scale(factor: number): void { Shape.positiveFactor(factor); this.x1 *= factor; this.y1 *= factor; this.x2 *= factor; this.y2 *= factor; }
  geometry(): Readonly<Record<string, number>> { return { x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 }; }
  override summary(): string { return `(${this.x1},${this.y1}) -> (${this.x2},${this.y2})`; }
  protected setSpecific(attribute: string, value: string): void {
    switch (attribute) {
      case 'x1': this.x1 = Shape.finite(value, attribute); return;
      case 'y1': this.y1 = Shape.finite(value, attribute); return;
      case 'x2': this.x2 = Shape.finite(value, attribute); return;
      case 'y2': this.y2 = Shape.finite(value, attribute); return;
      default: this.unknownAttribute(attribute);
    }
  }
}
