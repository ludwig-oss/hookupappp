export type PhotoLockDetail = {
  message?: string;
  locked?: boolean;
} | null;

const listeners = new Set<(detail: PhotoLockDetail) => void>();

export function onPhotoLockRequired(listener: (detail: PhotoLockDetail) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitPhotoLockRequired(detail: PhotoLockDetail): void {
  listeners.forEach((listener) => listener(detail));
}
