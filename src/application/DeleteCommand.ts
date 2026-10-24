import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import type { Shape } from '../model/Shape.js';

export class DeleteCommand implements EditCommand {
  readonly description: string;
  private removed?: { shape: Shape; parentId?: string; index: number };
  constructor(private readonly document: SvgDocument, private readonly id: string) {
    const shape = document.find(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    this.description = `${shape.type}#${id} deleted`;
  }
  execute(): void { this.removed = this.document.remove(this.id); }
  undo(): void {
    if (!this.removed) throw new Error('command was not executed');
    this.document.insert(this.removed.shape, this.removed.parentId, this.removed.index);
  }
}
