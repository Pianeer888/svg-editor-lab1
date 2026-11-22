import { Group } from '../../model/Group.js';
import type { Command, CommandContext } from '../../extensions/Command.js';

export class StatsCommand implements Command {
  readonly name = 'stats';
  readonly usage = 'stats';
  readonly help = 'stats';

  execute(context: CommandContext, args: string[]): void {
    if (args.length !== 0) throw new Error(`usage: ${this.usage}`);
    const counts = new Map<string, number>();
    let total = 0;
    let containers = 0;
    for (const shape of context.requireDocument().walk()) {
      if (shape instanceof Group) containers += 1;
      else {
        counts.set(shape.type, (counts.get(shape.type) ?? 0) + 1);
        total += 1;
      }
    }
    const leaves = [...counts].map(([type, count]) => `${type}: ${count}`);
    const summary = `(total ${total}, containers ${containers})`;
    context.write(`${leaves.length === 0 ? summary : `${leaves.join('  ')}  ${summary}`}\n`);
  }
}
