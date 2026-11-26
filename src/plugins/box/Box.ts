import { Group } from '../../model/Group.js';
import type { Rect } from '../../model/Rect.js';
import type { Shape } from '../../model/Shape.js';
import type { Text } from '../../model/Text.js';

export class Box extends Group {
  override readonly type = 'box';

  constructor(id: string, private readonly frame: Rect, private readonly label: Text, children: readonly Shape[]) {
    super(id);
    for (const child of children) this.append(child);
  }

  setFrameFill(value: string): void { this.frame.set('fill', value); }
  setLabel(value: string): void { this.label.set('text', value); }

  protected override assertChildRemovalAllowed(child: Shape): void {
    if (child === this.frame || child === this.label) {
      throw new Error(`cannot remove required child from box ${this.id}: ${child.id}`);
    }
  }
}
