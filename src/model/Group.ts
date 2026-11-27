import { Shape } from './Shape.js';

export class Group extends Shape {
  readonly #childShapes: Shape[] = [];

  constructor(id: string) { super(id, 'g'); }
  get children(): readonly Shape[] { return [...this.#childShapes]; }

  /** The document validates identity and ancestry before calling this method. */
  append(child: Shape): void {
    this.insert(child, this.#childShapes.length);
  }

  insert(child: Shape, index: number): void {
    if (child.parent !== null) throw new Error(`shape already has a parent: ${child.id}`);
    if (!Number.isInteger(index) || index < 0 || index > this.#childShapes.length) throw new Error('invalid child position');
    if (child === this || (child instanceof Group && child.contains(this))) {
      throw new Error('cannot add a container into its own descendant');
    }
    this.#childShapes.splice(index, 0, child);
    Group.setParentOf(child, this);
  }

  /** Removes a child when the container's structural rules permit it. */
  remove(child: Shape): number {
    const index = this.#childShapes.indexOf(child);
    if (index < 0) throw new Error(`no such child: ${child.id}`);
    this.assertChildRemovalAllowed(child);
    this.#childShapes.splice(index, 1);
    Group.setParentOf(child, null);
    return index;
  }

  /** Restore captured membership after a failed edit, including links to newly created groups. */
  static withChildRollback(roots: readonly Shape[], edit: () => void): void {
    if (roots.some(shape => shape.parent !== null)) throw new Error('rollback requires root shapes');
    const original = new Set<Shape>();
    const snapshots = new Map<Group, Shape[]>();
    const capture = (shape: Shape): void => {
      original.add(shape);
      if (shape instanceof Group) {
        snapshots.set(shape, [...shape.#childShapes]);
        shape.#childShapes.forEach(capture);
      }
    };
    roots.forEach(capture);
    try { edit(); }
    catch (error) {
      for (const shape of original) {
        const parent = shape.parent;
        if (parent && !snapshots.has(parent)) {
          const index = parent.#childShapes.indexOf(shape);
          if (index >= 0) parent.#childShapes.splice(index, 1);
          Group.setParentOf(shape, null);
        }
      }
      for (const group of snapshots.keys()) {
        for (const child of group.#childShapes) Group.setParentOf(child, null);
        group.#childShapes.length = 0;
      }
      for (const [group, children] of snapshots) {
        for (const child of children) {
          group.#childShapes.push(child);
          Group.setParentOf(child, group);
        }
      }
      throw error;
    }
  }

  protected assertChildRemovalAllowed(_child: Shape): void {}

  private contains(target: Shape): boolean {
    for (const child of this.#childShapes) {
      if (child === target || (child instanceof Group && child.contains(target))) return true;
    }
    return false;
  }

  move(dx: number, dy: number): void {
    Shape.validOffset(dx, dy);
    for (const child of this.#childShapes) child.move(dx, dy);
  }

  scale(factor: number): void {
    Shape.positiveFactor(factor);
    for (const child of this.#childShapes) child.scale(factor);
  }

  geometry(): Readonly<Record<string, never>> { return {}; }
  protected setSpecific(attribute: string, _value: string): void { this.unknownAttribute(attribute); }
}
