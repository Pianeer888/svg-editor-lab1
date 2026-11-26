import { Cli } from './cli/Cli.js';
import { SvgFileStore } from './infrastructure/SvgFileStore.js';
import { createDefaultExtensions } from './extensions/DefaultExtensions.js';
import { PluginLoader, type PluginLoadResult } from './composition/PluginLoader.js';
import { createStatsPlugin } from './plugins/stats/index.js';
import { createDirPlugin } from './plugins/dir/index.js';
import createBoxPlugin from './plugins/box/index.js';

async function main(): Promise<void> {
  const extensions = createDefaultExtensions();
  const cli = new Cli(process.stdin, process.stdout, new SvgFileStore(extensions), extensions);
  const loader = new PluginLoader(extensions);
  let results: PluginLoadResult[];
  if (process.argv.length === 2) results = loader.loadCode([createStatsPlugin(), createDirPlugin(), createBoxPlugin()]);
  else if (process.argv.length === 4 && process.argv[2] === '--config') results = await loader.loadConfig(process.argv[3]!);
  else throw new Error('usage: svg-editor [--config <plugins.config.json>]');
  for (const result of results) {
    if (result.status === 'failed') process.stderr.write(`error: ${result.error}\n`);
  }
  await cli.run();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
