import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import type { Shape } from '../model/Shape.js';

export class ReorderCommand implements EditCommand {
  readonly description: string;
  private original?: { shape: Shape; parentId?: string; index: number };

  constructor(private readonly document: SvgDocument, private readonly id: string, private readonly direction: 'front' | 'back') {
    this.description = `${id} moved to ${direction}`;
  }

  execute(): void {
    const original = this.document.location(this.id);
    this.original = original;
    this.document.changeStructureAtomically(() => {
      this.document.remove(this.id);
      this.document.insert(original.shape, original.parentId, this.direction === 'back' ? 0 : undefined);
    });
  }

  undo(): void {
    if (!this.original) throw new Error('command was not executed');
    const original = this.original;
    this.document.changeStructureAtomically(() => {
      this.document.remove(this.id);
      this.document.insert(original.shape, original.parentId, original.index);
    });
  }
}
