import { runSeed } from './seed.js';

runSeed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
