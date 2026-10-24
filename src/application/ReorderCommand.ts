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
    this.original = this.document.location(this.id);
    this.document.remove(this.id);
    this.document.insert(this.original.shape, this.original.parentId, this.direction === 'back' ? 0 : undefined);
  }

  undo(): void {
    if (!this.original) throw new Error('command was not executed');
    this.document.remove(this.id);
    this.document.insert(this.original.shape, this.original.parentId, this.original.index);
  }
}
