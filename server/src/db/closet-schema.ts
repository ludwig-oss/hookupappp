import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

export function loadSqlFile(relativeFromDb: string): string {
  const candidates = [
    join(here, relativeFromDb),
    join(process.cwd(), 'src/db', relativeFromDb),
    join(process.cwd(), 'server/src/db', relativeFromDb),
    join(process.cwd(), 'dist/db', relativeFromDb),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error(`${relativeFromDb} not found — copy server/src/db SQL next to the compiled db module`);
}

/** Load closet-schema.sql from src or dist so startup and `psql -f` stay in sync. */
export function loadClosetSchemaSql(): string {
  return loadSqlFile('closet-schema.sql');
}
