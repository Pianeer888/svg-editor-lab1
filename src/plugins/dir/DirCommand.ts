import type { Command, CommandContext } from '../../extensions/Command.js';
import type { DirectoryAccess, DirectoryEntry } from './DirectoryAccess.js';

const order: Readonly<Record<DirectoryEntry['kind'], number>> = { directory: 0, file: 1, other: 2 };
const labels: Readonly<Record<DirectoryEntry['kind'], string>> = {
  directory: '[DIR]', file: '[FILE]', other: '[OTHER]',
};

export class DirCommand implements Command {
  readonly name = 'dir';
  readonly usage = 'dir';
  readonly help = 'dir';

  constructor(private readonly directories: DirectoryAccess) {}

  execute(context: CommandContext, args: string[]): void {
    if (args.length !== 0) throw new Error(`usage: ${this.usage}`);
    const path = this.directories.currentDirectory();
    let entries: readonly DirectoryEntry[];
    try { entries = this.directories.read(path); }
    catch { throw new Error(`cannot read directory: ${path}`); }
    if (entries.length === 0) {
      context.write('(empty directory)\n');
      return;
    }
    const sorted = [...entries].sort((left, right) =>
      order[left.kind] - order[right.kind] || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of sorted) context.write(`${labels[entry.kind]}  ${entry.name}\n`);
  }
}
