import { Group } from './Group.js';
import { Shape } from './Shape.js';

export class SvgDocument {
  private readonly rootShapes: Shape[] = [];

  constructor(public readonly width: number = 800, public readonly height: number = 600) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('canvas dimensions must be positive');
    }
  }

  get children(): readonly Shape[] { return this.rootShapes; }

  find(id: string): Shape | undefined {
    for (const shape of this.walk()) if (shape.id === id) return shape;
    return undefined;
  }

  add(shape: Shape, parentId?: string): void {
    this.insert(shape, parentId);
  }

  insert(shape: Shape, parentId?: string, index?: number): void {
    const parent = parentId === undefined ? undefined : this.find(parentId);
    if (parentId !== undefined && parent === undefined) throw new Error(`no such container: ${parentId}`);
    if (parent !== undefined && !(parent instanceof Group)) throw new Error(`not a container: ${parentId}`);
    if (shape.parent !== null || this.containsReference(shape)) throw new Error(`shape already attached: ${shape.id}`);

    const incoming = [...SvgDocument.walkFrom(shape)];
    const ids = new Set<string>();
    for (const item of incoming) {
      if (ids.has(item.id) || this.find(item.id)) throw new Error(`id already exists: ${item.id}`);
      ids.add(item.id);
    }
    if (parent !== undefined && incoming.includes(parent)) throw new Error('cannot add a container into its own descendant');

    if (parent instanceof Group) parent.insert(shape, index ?? parent.children.length);
    else {
      const position = index ?? this.rootShapes.length;
      if (!Number.isInteger(position) || position < 0 || position > this.rootShapes.length) throw new Error('invalid child position');
      this.rootShapes.splice(position, 0, shape);
    }
  }

  remove(id: string): { shape: Shape; parentId?: string; index: number } {
    const shape = this.find(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    const parent = shape.parent;
    if (parent) return { shape, parentId: parent.id, index: parent.remove(shape) };
    const index = this.rootShapes.indexOf(shape);
    this.rootShapes.splice(index, 1);
    return { shape, index };
  }

  *walk(): IterableIterator<Shape> {
    for (const shape of this.rootShapes) yield* SvgDocument.walkFrom(shape);
  }

  private containsReference(target: Shape): boolean {
    for (const shape of this.walk()) if (shape === target) return true;
    return false;
  }

  private static *walkFrom(shape: Shape): IterableIterator<Shape> {
    yield shape;
    if (shape instanceof Group) for (const child of shape.children) yield* SvgDocument.walkFrom(child);
  }
}
