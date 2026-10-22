import { Cli } from './cli/Cli.js';

const cli = new Cli(process.stdin, process.stdout);

cli.run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
});
