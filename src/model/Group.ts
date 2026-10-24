import { Shape } from './Shape.js';

export class Group extends Shape {
  private readonly childShapes: Shape[] = [];

  constructor(id: string) { super(id, 'g'); }
  get children(): readonly Shape[] { return this.childShapes; }

  /** The document validates identity and ancestry before calling this method. */
  append(child: Shape): void {
    this.insert(child, this.childShapes.length);
  }

  insert(child: Shape, index: number): void {
    if (child.parent !== null) throw new Error(`shape already has a parent: ${child.id}`);
    if (!Number.isInteger(index) || index < 0 || index > this.childShapes.length) throw new Error('invalid child position');
    if (child === this || (child instanceof Group && child.contains(this))) {
      throw new Error('cannot add a container into its own descendant');
    }
    this.childShapes.splice(index, 0, child);
    child.setParent(this);
  }

  remove(child: Shape): number {
    const index = this.childShapes.indexOf(child);
    if (index < 0) throw new Error(`no such child: ${child.id}`);
    this.childShapes.splice(index, 1);
    child.setParent(null);
    return index;
  }

  private contains(target: Shape): boolean {
    for (const child of this.childShapes) {
      if (child === target || (child instanceof Group && child.contains(target))) return true;
    }
    return false;
  }

  move(dx: number, dy: number): void {
    Shape.validOffset(dx, dy);
    for (const child of this.childShapes) child.move(dx, dy);
  }

  scale(factor: number): void {
    Shape.positiveFactor(factor);
    for (const child of this.childShapes) child.scale(factor);
  }

  geometry(): Readonly<Record<string, never>> { return {}; }
  protected setSpecific(attribute: string, _value: string): void { this.unknownAttribute(attribute); }
}
