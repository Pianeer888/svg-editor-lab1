import { Cli } from './cli/Cli.js';
import { SvgFileStore } from './infrastructure/SvgFileStore.js';
import { createDefaultExtensions } from './composition/DefaultExtensions.js';
import { PluginLoader, type PluginLoadResult } from './composition/PluginLoader.js';
import { createStatsPlugin } from './plugins/stats/index.js';
import { createDirPlugin } from './plugins/dir/index.js';
import createBoxPlugin from './plugins/box/index.js';
import createBoxTypeLabelPlugin from './plugins/box-type-label/index.js';
import createModifiedStarPlugin from './plugins/modified-star/index.js';
import { ModifiedStar } from './plugins/modified-star/ModifiedStar.js';
import { SavePointStore } from './plugins/modified-star/SavePointStore.js';

async function main(): Promise<void> {
  const extensions = createDefaultExtensions();
  const store = new SavePointStore(new SvgFileStore(extensions), document => {
    for (const decorator of extensions.treeDecorators()) {
      if (decorator instanceof ModifiedStar) decorator.markClean(document);
    }
  });
  const cli = new Cli(process.stdin, process.stdout, store, extensions);
  const loader = new PluginLoader(extensions);
  let results: PluginLoadResult[];
  if (process.argv.length === 2) {
    results = loader.loadCode([
      createStatsPlugin(), createDirPlugin(), createBoxPlugin(), createBoxTypeLabelPlugin(), createModifiedStarPlugin(),
    ]);
  }
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
