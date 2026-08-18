import { app } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

async function bootstrap() {
  await connectDatabase();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

bootstrap().catch(error => {
  console.error('Failed to start API', error);
  process.exit(1);
});
