import type { EditCommand } from '../application/EditCommand.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export interface CommandContext {
  requireDocument(): SvgDocument;
  write(message: string): void;
  executeEdit(command: EditCommand): void;
}

export interface Command {
  readonly name: string;
  readonly usage: string;
  readonly help: string;
  execute(context: CommandContext, args: string[]): void;
}
