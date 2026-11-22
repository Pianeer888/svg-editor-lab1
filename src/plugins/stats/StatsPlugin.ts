import type { ExtensionRegistrar, Plugin, PluginManifest } from '../../extensions/Plugin.js';
import { StatsCommand } from './StatsCommand.js';

export class StatsPlugin implements Plugin {
  readonly manifest: PluginManifest = {
    id: 'stats', apiVersion: 1, contributes: { commands: ['stats'] },
  };

  activate(registrar: ExtensionRegistrar): void {
    registrar.registerCommand(new StatsCommand());
  }
}
