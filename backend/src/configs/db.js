import { Pool } from 'pg'

export const db = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    user: process.env.PG_USER || 'vector',
    password: process.env.PG_PASSWORD || 'vectorpwd',
    database: process.env.PG_DB || 'pipelines',
});