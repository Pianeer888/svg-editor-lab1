import type { EditCommand } from './EditCommand.js';
import { Shape, type ShapeState } from '../model/Shape.js';
import { Group } from '../model/Group.js';

/** Reversible edit of one shape or a whole subtree. The model owns the actual behavior. */
export class ShapeEditCommand implements EditCommand {
  private before: Array<{ shape: Shape; state: ShapeState }> = [];
  constructor(readonly description: string, private readonly target: Shape, private readonly action: () => void) {}

  execute(): void {
    this.before = [...this.walk(this.target)].map(shape => ({ shape, state: shape.captureState() }));
    try { this.action(); }
    catch (error) { this.restore(); throw error; }
  }
  undo(): void { this.restore(); }

  private restore(): void { for (const { shape, state } of this.before) shape.restoreState(state); }
  private *walk(shape: Shape): IterableIterator<Shape> {
    yield shape;
    if (shape instanceof Group) for (const child of shape.children) yield* this.walk(child);
  }
}
