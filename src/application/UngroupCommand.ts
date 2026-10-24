import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';

export class UngroupCommand implements EditCommand {
  readonly description: string;
  private group?: Group;
  private parentId?: string;
  private index = 0;
  private children: Shape[] = [];

  constructor(private readonly document: SvgDocument, private readonly id: string) {
    this.description = `g#${id} ungrouped`;
  }

  execute(): void {
    const { shape, parentId, index } = this.document.location(this.id);
    if (!(shape instanceof Group)) throw new Error(`not a container: ${this.id}`);
    if (parentId === undefined) throw new Error(`cannot ungroup top-level container: ${this.id}`);
    this.group = shape;
    this.parentId = parentId;
    this.index = index;
    this.children = [...shape.children];
    this.document.changeStructureAtomically(() => {
      for (const child of this.children) this.document.remove(child.id);
      this.document.remove(this.id);
      this.children.forEach((child, offset) => this.document.insert(child, parentId, index + offset));
    });
  }

  undo(): void {
    if (!this.group || this.parentId === undefined) throw new Error('command was not executed');
    const group = this.group;
    const parentId = this.parentId;
    this.document.changeStructureAtomically(() => {
      for (const child of this.children) this.document.remove(child.id);
      this.document.insert(group, parentId, this.index);
      for (const child of this.children) this.document.add(child, this.id);
    });
  }
}
