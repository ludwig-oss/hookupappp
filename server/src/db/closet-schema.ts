import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));

/** Load closet-schema.sql from src or dist so startup and `psql -f` stay in sync. */
export function loadClosetSchemaSql(): string {
  const candidates = [
    join(here, 'closet-schema.sql'),
    join(process.cwd(), 'src/db/closet-schema.sql'),
    join(process.cwd(), 'server/src/db/closet-schema.sql'),
    join(process.cwd(), 'dist/db/closet-schema.sql'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
  }
  throw new Error('closet-schema.sql not found — copy server/src/db/closet-schema.sql next to the compiled db module');
}
