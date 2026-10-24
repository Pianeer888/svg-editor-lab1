export interface EditCommand {
  readonly description: string;
  execute(): void;
  undo(): void;
}
