import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';

export class AddToCommand implements EditCommand {
  readonly description: string;
  private original?: { shape: Shape; parentId?: string; index: number };

  constructor(private readonly document: SvgDocument, private readonly groupId: string, private readonly id: string) {
    this.description = `${id} added to g#${groupId}`;
  }

  execute(): void {
    const target = this.document.find(this.groupId);
    if (!target) throw new Error(`no such container: ${this.groupId}`);
    if (!(target instanceof Group)) throw new Error(`not a container: ${this.groupId}`);
    const original = this.document.location(this.id);
    for (let parent: Group | null = target; parent !== null; parent = parent.parent) {
      if (parent === original.shape) throw new Error('cannot add a container into its own descendant');
    }
    this.original = original;
    this.document.changeStructureAtomically(() => {
      this.document.remove(this.id);
      this.document.add(original.shape, this.groupId);
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
