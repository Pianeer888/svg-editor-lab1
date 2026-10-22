import { Shape } from './Shape.js';

export class Ellipse extends Shape {
  constructor(id: string, private cx: number, private cy: number, private rx: number, private ry: number) {
    super(id, 'ellipse');
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) throw new Error('invalid ellipse geometry');
  }
  move(dx: number, dy: number): void { Shape.validOffset(dx, dy); this.cx += dx; this.cy += dy; }
  scale(factor: number): void { Shape.positiveFactor(factor); this.cx *= factor; this.cy *= factor; this.rx *= factor; this.ry *= factor; }
  geometry(): Readonly<Record<string, number>> { return { cx: this.cx, cy: this.cy, rx: this.rx, ry: this.ry }; }
  protected setSpecific(attribute: string, value: string): void {
    switch (attribute) {
      case 'cx': this.cx = Shape.finite(value, attribute); return;
      case 'cy': this.cy = Shape.finite(value, attribute); return;
      case 'rx': this.rx = Shape.nonNegative(value, attribute); return;
      case 'ry': this.ry = Shape.nonNegative(value, attribute); return;
      default: this.unknownAttribute(attribute);
    }
  }
}
