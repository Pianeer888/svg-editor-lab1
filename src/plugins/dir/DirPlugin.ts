import type { ExtensionRegistrar, Plugin, PluginManifest } from '../../extensions/Plugin.js';
import type { DirectoryAccess } from './DirectoryAccess.js';
import { DirCommand } from './DirCommand.js';

export class DirPlugin implements Plugin {
  readonly manifest: PluginManifest = {
    id: 'dir', apiVersion: 1, contributes: { commands: ['dir'] },
  };

  constructor(private readonly directories: DirectoryAccess) {}

  activate(registrar: ExtensionRegistrar): void {
    registrar.registerCommand(new DirCommand(this.directories));
  }
}
