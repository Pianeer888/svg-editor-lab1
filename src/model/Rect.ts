import { Shape } from './Shape.js';

export class Rect extends Shape {
  constructor(id: string, private x: number, private y: number, private width: number, private height: number) {
    super(id, 'rect');
    if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) throw new Error('invalid rectangle geometry');
  }
  move(dx: number, dy: number): void { Shape.validOffset(dx, dy); this.x += dx; this.y += dy; }
  scale(factor: number): void { Shape.positiveFactor(factor); this.x *= factor; this.y *= factor; this.width *= factor; this.height *= factor; }
  geometry(): Readonly<Record<string, number>> { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
  protected setSpecific(attribute: string, value: string): void {
    switch (attribute) {
      case 'x': this.x = Shape.finite(value, attribute); return;
      case 'y': this.y = Shape.finite(value, attribute); return;
      case 'width': this.width = Shape.nonNegative(value, attribute); return;
      case 'height': this.height = Shape.nonNegative(value, attribute); return;
      default: this.unknownAttribute(attribute);
    }
  }
}
