import { database } from './database.js';

async function run() {
  await database.connect();
  await database.migrate();
  await database.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
