import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

/** Reads one command per line. Command parsing will be added in the next iteration. */
export class Cli {
  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
  ) {}

  async run(): Promise<void> {
    const lines = createInterface({ input: this.input, output: this.output });
    this.output.write('svg-editor 0.1 — CLI scaffold\n');
    lines.setPrompt('svg> ');
    lines.prompt();

    for await (const line of lines) {
      const command = line.trim();
      if (command !== '' && !command.startsWith('#')) {
        this.output.write('error: commands are not implemented yet\n');
      }
      lines.prompt();
    }
  }
}
