import { AsyncLocalStorage } from 'async_hooks';

export type DbContext = {
  mode: 'user' | 'system';
  userId?: string;
};

export const dbContext = new AsyncLocalStorage<DbContext>();

export function runWithUser<T>(userId: string, fn: () => T): T {
  return dbContext.run({ mode: 'user', userId }, fn);
}

export function runWithSystem<T>(fn: () => T): T {
  return dbContext.run({ mode: 'system' }, fn);
}

export function getDbContext(): DbContext | undefined {
  return dbContext.getStore();
}
