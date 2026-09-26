import { config } from 'dotenv'

// Loads packages/db/.env by default (Neon dev branch).
// DB_ENV_FILE=.env.production targets the Neon main (production) branch, e.g. for the first seed.
config({ path: process.env.DB_ENV_FILE ?? '.env', quiet: true })
