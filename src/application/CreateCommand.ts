import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { Shape } from '../model/Shape.js';

export class CreateCommand implements EditCommand {
  readonly description: string;
  constructor(private readonly document: SvgDocument, private readonly shape: Shape, private readonly parentId?: string) {
    this.description = `${shape.type}#${shape.id} created`;
  }
  execute(): void { this.document.add(this.shape, this.parentId); }
  undo(): void { this.document.remove(this.shape.id); }
}
