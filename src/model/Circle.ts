import { Shape } from './Shape.js';

export class Circle extends Shape {
  constructor(id: string, private cx: number, private cy: number, private r: number) {
    super(id, 'circle');
    if (![cx, cy, r].every(Number.isFinite) || r < 0) throw new Error('invalid circle geometry');
  }
  move(dx: number, dy: number): void { Shape.validOffset(dx, dy); this.cx += dx; this.cy += dy; }
  scale(factor: number): void { Shape.positiveFactor(factor); this.cx *= factor; this.cy *= factor; this.r *= factor; }
  geometry(): Readonly<Record<string, number>> { return { cx: this.cx, cy: this.cy, r: this.r }; }
  protected setSpecific(attribute: string, value: string): void {
    switch (attribute) {
      case 'cx': this.cx = Shape.finite(value, attribute); return;
      case 'cy': this.cy = Shape.finite(value, attribute); return;
      case 'r': this.r = Shape.nonNegative(value, attribute); return;
      default: this.unknownAttribute(attribute);
    }
  }
}
