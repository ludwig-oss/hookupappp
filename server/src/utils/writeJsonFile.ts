import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises';
import { dirname } from 'path';

/**
 * Write JSON safely. On Windows, rename-over-existing often throws EPERM
 * when antivirus or another reader holds the file — fall back to direct write.
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const body = JSON.stringify(data, null, 2);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, body);
    try {
      await rename(tmp, filePath);
      return;
    } catch (renameErr: unknown) {
      const code = (renameErr as NodeJS.ErrnoException)?.code;
      if (code === 'EPERM' || code === 'EEXIST' || code === 'EACCES') {
        await writeFile(filePath, body);
        return;
      }
      throw renameErr;
    }
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** null means the file exists but could not be parsed — callers must not replace it. */
export async function readJsonArray(filePath: string): Promise<unknown[] | null> {
  try {
    const data = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return [];
    return null;
  }
}

/**
 * Save rows without dropping ones already on disk.
 * A session update that only has part of the list cannot erase other accounts.
 */
export async function writeMergedRows(
  filePath: string,
  incoming: unknown[],
  idOf: (row: unknown) => string | null
): Promise<void> {
  const existing = await readJsonArray(filePath);
  if (existing === null) {
    throw new Error(`Refusing to rewrite ${filePath} because the saved rows could not be read`);
  }
  const byId = new Map<string, unknown>();
  for (const row of existing) {
    const id = idOf(row);
    if (id) byId.set(id, row);
  }
  for (const row of incoming) {
    const id = idOf(row);
    if (!id) continue;
    const prev = byId.get(id);
    if (prev && typeof prev === 'object' && typeof row === 'object' && row) {
      const prevRec = prev as Record<string, unknown>;
      const nextRec = row as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...prevRec, ...nextRec };
      for (const key of ['email', 'password', 'username']) {
        const nextVal = merged[key];
        if ((nextVal == null || nextVal === '') && prevRec[key]) merged[key] = prevRec[key];
      }
      byId.set(id, merged);
    } else {
      byId.set(id, row);
    }
  }
  await writeJsonFile(filePath, [...byId.values()]);
}
