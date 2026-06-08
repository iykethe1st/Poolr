import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // DATABASE_URL is injected via dotenv-cli in db:migrate / db:seed scripts.
  // Omit datasource when not set so `prisma generate` works without a running DB.
  ...(process.env.DATABASE_URL
    ? { datasource: { url: process.env.DATABASE_URL } }
    : {}),
});
