import './load-env'
import { defineConfig } from 'prisma/config'

// Prisma CLI (migrate, studio, seed) uses the DIRECT (unpooled) Neon URL.
// The app runtime uses the pooled DATABASE_URL through the Neon adapter (src/index.ts).
// DIRECT_URL may be absent during `prisma generate` on Vercel; generate does not connect.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
})
