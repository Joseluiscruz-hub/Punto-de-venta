import { buildApp } from './app.js';
import { config } from './config.js';
import { database } from './database.js';
import { seedDatabase } from './seed.js';

async function start() {
  await database.connect();
  await database.migrate();
  await seedDatabase();
  const app = await buildApp();

  const close = async () => {
    await app.close();
    await database.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  await app.listen({ host: config.API_HOST, port: config.API_PORT });
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
