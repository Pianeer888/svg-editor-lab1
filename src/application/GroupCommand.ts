import type { EditCommand } from './EditCommand.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';

type Location = { shape: Shape; parentId?: string; index: number };

/** Collect existing subtrees in document order into one new container. */
export class GroupCommand implements EditCommand {
  readonly description: string;
  private readonly group: Group;
  private locations: Location[] = [];

  constructor(private readonly document: SvgDocument, id: string, private readonly ids: readonly string[]) {
    this.group = new Group(id);
    this.description = `g#${id} created with ${ids.length} children`;
  }

  execute(): void {
    if (this.ids.length < 2) throw new Error('usage: group <newGid> <id1> <id2>…');
    if (this.document.find(this.group.id)) throw new Error(`id already exists: ${this.group.id}`);
    const selected = new Set(this.ids);
    if (selected.size !== this.ids.length) throw new Error('duplicate shape in group');
    this.locations = this.ids.map(id => this.document.location(id));
    for (const { shape } of this.locations) {
      for (let parent = shape.parent; parent !== null; parent = parent.parent) {
        if (selected.has(parent.id)) throw new Error(`cannot group a container into its own descendant: ${parent.id}`);
      }
    }
    const ordered = [...this.document.walk()].filter(shape => selected.has(shape.id));
    const anchor = this.document.location(ordered[0]!.id);
    for (const shape of ordered) this.document.remove(shape.id);
    this.document.insert(this.group, anchor.parentId, anchor.index);
    for (const shape of ordered) this.document.add(shape, this.group.id);
  }

  undo(): void {
    for (const child of [...this.group.children]) this.document.remove(child.id);
    this.document.remove(this.group.id);
    for (const { shape, parentId, index } of [...this.locations].sort((a, b) => a.index - b.index)) {
      this.document.insert(shape, parentId, index);
    }
  }
}
