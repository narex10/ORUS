import 'dotenv/config';
import './config/env';
import app from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  try {
    await prisma.$connect();
    console.log('✅  Database connected');

    app.listen(env.PORT, () => {
      console.log(`🚀  ORUS Backend running on http://localhost:${env.PORT}`);
      console.log(`🌍  Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('❌  Failed to start server:', err);
    process.exit(1);
  }
}

main();
