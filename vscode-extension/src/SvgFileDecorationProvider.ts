import * as vscode from 'vscode';

/** Adds Explorer metadata for SVG files without changing the resource. */
export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  constructor(private readonly fileSystem: Pick<typeof vscode.workspace.fs, 'stat'> = vscode.workspace.fs) {}

  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file' || !uri.path.endsWith('.svg')) return undefined;
    try {
      const { type } = await this.fileSystem.stat(uri);
      if ((type & vscode.FileType.File) === 0) return undefined;
      return new vscode.FileDecoration('[]', 'SVG file');
    } catch {
      return undefined;
    }
  }
}
