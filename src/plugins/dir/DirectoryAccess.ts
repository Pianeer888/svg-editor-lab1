export type DirectoryEntry = {
  readonly name: string;
  readonly kind: 'directory' | 'file' | 'other';
};

export interface DirectoryAccess {
  currentDirectory(): string;
  read(path: string): readonly DirectoryEntry[];
}
