import type { EditCommand } from './EditCommand.js';

export class CommandHistory {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private ioBarrier = false;

  execute(command: EditCommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.ioBarrier = false;
  }

  undo(): string {
    if (this.ioBarrier) throw new Error('undo not allowed after io command');
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return command.description;
  }

  redo(): string {
    if (this.ioBarrier) throw new Error('undo not allowed after io command');
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    return command.description;
  }

  blockAfterIo(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.ioBarrier = true;
  }
}
