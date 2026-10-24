import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { Tokenizer } from './Tokenizer.js';
import { SvgDocument } from '../model/SvgDocument.js';
import { ShapeFactory } from '../model/ShapeFactory.js';
import { Group } from '../model/Group.js';
import type { Shape } from '../model/Shape.js';
import { CommandHistory } from '../application/CommandHistory.js';
import { CreateCommand } from '../application/CreateCommand.js';
import { DeleteCommand } from '../application/DeleteCommand.js';
import { ShapeEditCommand } from '../application/ShapeEditCommand.js';

export class Cli {
  private document: SvgDocument | null = null;
  private readonly history = new CommandHistory();

  constructor(private readonly input: Readable, private readonly output: Writable) {}

  async run(): Promise<void> {
    const lines = createInterface({ input: this.input, output: this.output });
    let closed = false;
    lines.on('close', () => { closed = true; });
    this.output.write("svg-editor 0.1 — type 'help' for commands\n");
    lines.setPrompt('svg> ');
    lines.prompt();
    for await (const line of lines) {
      if (line.trim() !== '' && !line.trimStart().startsWith('#')) {
        try { this.execute(Tokenizer.parse(line)); }
        catch (error) { this.output.write(`error: ${error instanceof Error ? error.message : String(error)}\n`); }
      }
      if (!closed) lines.prompt();
    }
  }

  private execute(tokens: string[]): void {
    const [command, ...args] = tokens;
    switch (command) {
      case 'help':
        this.expectCount(args, 0, 0, 'help');
        this.output.write('init [w] [h]\ncreate <type> <id> [params…] [in <containerId>]\ndelete <id>\nmove <id> <dx> <dy>\nscale <id> <factor>\nset <id> <attr> <value>\nundo | redo\ntree [id]\nshow <id>\nOther commands will be added in later commits.\n');
        return;
      case 'init': this.init(args); return;
      case 'create': this.create(args); return;
      case 'tree': this.tree(args); return;
      case 'show': this.show(args); return;
      case 'delete': this.delete(args); return;
      case 'move': this.move(args); return;
      case 'scale': this.scale(args); return;
      case 'set': this.set(args); return;
      case 'undo':
        this.expectCount(args, 0, 0, 'undo');
        this.requireDocument();
        this.output.write(`undid: ${this.history.undo()}\n`); return;
      case 'redo':
        this.expectCount(args, 0, 0, 'redo');
        this.requireDocument();
        this.output.write(`redid: ${this.history.redo()}\n`); return;
      default: throw new Error(`unknown command: ${command}`);
    }
  }

  private init(args: string[]): void {
    this.expectCount(args, 0, 2, 'init [w] [h]');
    if (args.length === 1) throw new Error('usage: init [w] [h]');
    const width = args.length === 0 ? 800 : this.number(args[0]!);
    const height = args.length === 0 ? 600 : this.number(args[1]!);
    this.document = new SvgDocument(width, height);
    this.history.blockAfterIo();
    this.output.write(`canvas ${width}x${height} created\n`);
  }

  private create(args: string[]): void {
    const doc = this.requireDocument();
    if (args.length < 2) throw new Error('usage: create <type> <id> [params…] [in <containerId>]');
    const [type, id, ...rest] = args;
    let parentId: string | undefined;
    if (rest.length >= 2 && rest[rest.length - 2] === 'in') { parentId = rest.pop(); rest.pop(); }
    const shape = ShapeFactory.create(type!, id!, rest);
    this.history.execute(new CreateCommand(doc, shape, parentId));
    this.output.write(`${shape.type}#${shape.id} created${parentId === undefined ? '' : ` in g#${parentId}`}\n`);
  }

  private delete(args: string[]): void {
    this.expectCount(args, 1, 1, 'delete <id>');
    const command = new DeleteCommand(this.requireDocument(), args[0]!);
    this.history.execute(command);
    this.output.write(`${command.description}\n`);
  }

  private move(args: string[]): void {
    this.expectCount(args, 3, 3, 'move <id> <dx> <dy>');
    const shape = this.requireShape(this.requireDocument(), args[0]!);
    const dx = this.number(args[1]!); const dy = this.number(args[2]!);
    this.history.execute(new ShapeEditCommand(`${shape.type}#${shape.id} moved by (${dx},${dy})`, shape, () => shape.move(dx, dy)));
    this.output.write(`${shape.type}#${shape.id} moved by (${dx},${dy})\n`);
  }

  private scale(args: string[]): void {
    this.expectCount(args, 2, 2, 'scale <id> <factor>');
    const shape = this.requireShape(this.requireDocument(), args[0]!);
    const factor = this.number(args[1]!);
    this.history.execute(new ShapeEditCommand(`${shape.type}#${shape.id} scaled by ${factor}`, shape, () => shape.scale(factor)));
    this.output.write(`${shape.type}#${shape.id} scaled by ${factor}\n`);
  }

  private set(args: string[]): void {
    this.expectCount(args, 3, 3, 'set <id> <attr> <value>');
    const shape = this.requireShape(this.requireDocument(), args[0]!);
    const attribute = args[1]!; const value = args[2]!;
    this.history.execute(new ShapeEditCommand(`${shape.type}#${shape.id} updated: ${attribute}=${JSON.stringify(value)}`, shape, () => shape.set(attribute, value)));
    this.output.write(`${shape.type}#${shape.id} updated: ${attribute}=${JSON.stringify(value)}\n`);
  }

  private tree(args: string[]): void {
    this.expectCount(args, 0, 1, 'tree [id]');
    const doc = this.requireDocument();
    if (args.length === 1) {
      const root = this.requireShape(doc, args[0]!);
      this.output.write(`${root.type}#${root.id}${this.suffix(root)}\n`);
      if (root instanceof Group) this.printChildren(root.children, '');
      return;
    }
    this.output.write(`svg (${doc.width}x${doc.height})\n`);
    this.printChildren(doc.children, '');
  }

  private printChildren(children: readonly Shape[], prefix: string): void {
    children.forEach((shape, index) => {
      const last = index === children.length - 1;
      this.output.write(`${prefix}${last ? '└── ' : '├── '}${shape.type}#${shape.id}${this.suffix(shape)}\n`);
      if (shape instanceof Group) this.printChildren(shape.children, prefix + (last ? '    ' : '│   '));
    });
  }

  private show(args: string[]): void {
    this.expectCount(args, 1, 1, 'show <id>');
    const doc = this.requireDocument();
    const shape = this.requireShape(doc, args[0]!);
    this.output.write(`${shape.type}#${shape.id}  parent=${shape.parent === null ? 'svg' : `g#${shape.parent.id}`}\n`);
    const geometry = Object.entries(shape.geometry()).map(([key, value]) => `${key}=${typeof value === 'string' ? JSON.stringify(value) : value}`).join(' ');
    if (geometry) this.output.write(`  ${geometry}\n`);
    const style = [shape.fill === undefined ? '' : `fill=${shape.fill}`, shape.stroke === undefined ? '' : `stroke=${shape.stroke}`, shape.strokeWidth === undefined ? '' : `stroke-width=${shape.strokeWidth}`].filter(Boolean).join(' ');
    if (style) this.output.write(`  ${style}\n`);
  }

  private suffix(shape: Shape): string { const value = shape.summary(); return value ? `  ${value}` : ''; }
  private requireDocument(): SvgDocument {
    if (this.document === null) throw new Error("no document. use 'init' or 'read' first");
    return this.document;
  }
  private requireShape(doc: SvgDocument, id: string): Shape {
    const shape = doc.find(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
  private number(value: string): number {
    if (value.trim() === '' || !Number.isFinite(Number(value))) throw new Error(`invalid number: ${value}`);
    return Number(value);
  }
  private expectCount(args: string[], min: number, max: number, syntax: string): void {
    if (args.length < min || args.length > max) throw new Error(`usage: ${syntax}`);
  }
}
