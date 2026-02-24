type PrismaLikeError = {
  code?: unknown;
  message?: unknown;
};

function asMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error ?? '');
  }
  return String((error as PrismaLikeError).message ?? '');
}

export function isPrismaMissingStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = String((error as PrismaLikeError).code ?? '').trim();
  if (code === 'P2021' || code === 'P2022') {
    return true;
  }

  const message = asMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  if (message.includes('does not exist') || message.includes('no such table')) {
    return true;
  }

  if (
    message.includes("cannot read properties of undefined") &&
    (message.includes('findmany') ||
      message.includes('findfirst') ||
      message.includes('findunique') ||
      message.includes('count'))
  ) {
    return true;
  }

  return false;
}

export async function softFailMissingStorageRead<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isPrismaMissingStorageError(error)) {
      return fallback;
    }
    throw error;
  }
}

export async function softFailMissingStorage<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isPrismaMissingStorageError(error)) {
      return fallback;
    }
    throw error;
  }
}
