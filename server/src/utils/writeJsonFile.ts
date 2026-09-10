import { mkdir, writeFile, rename, unlink } from 'fs/promises';
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
