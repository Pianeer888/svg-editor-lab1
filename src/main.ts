import { Cli } from './cli/Cli.js';
import { SvgFileStore } from './infrastructure/SvgFileStore.js';

const cli = new Cli(process.stdin, process.stdout, new SvgFileStore());

cli.run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
