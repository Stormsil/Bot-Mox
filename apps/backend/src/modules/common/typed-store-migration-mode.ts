export type TypedStoreReadPrecedence = 'legacy-first' | 'typed-first';

export interface TypedStoreMigrationMode {
  readPrecedence: TypedStoreReadPrecedence;
  dualWriteEnabled: boolean;
  cutoverBlockedReason?: string;
}

const DEFAULT_READ_PRECEDENCE: TypedStoreReadPrecedence = 'legacy-first';

function parseReadPrecedence(
  value: string | undefined,
  fallback: TypedStoreReadPrecedence,
): TypedStoreReadPrecedence {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'typed-first') {
    return 'typed-first';
  }
  if (normalized === 'legacy-first') {
    return 'legacy-first';
  }
  return fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

function inferDomainName(readPrecedenceOverrideEnvName: string): string {
  return String(readPrecedenceOverrideEnvName || '')
    .trim()
    .toLowerCase()
    .replace(/^botmox_/, '')
    .replace(/_read_precedence$/, '')
    .replace(/_/g, '-');
}

function resolveParityGateState(options: { env: NodeJS.ProcessEnv; domain: string }): {
  allowTypedFirst: boolean;
  reason?: string;
} {
  const gateEnabled = parseBoolean(options.env.BOTMOX_TYPED_STORE_PARITY_GATE, true);
  if (!gateEnabled) {
    return { allowTypedFirst: true };
  }

  const statusFromEnv = String(options.env.BOTMOX_TYPED_STORE_PARITY_STATUS || '')
    .trim()
    .toLowerCase();
  if (statusFromEnv === 'pass') {
    return { allowTypedFirst: true };
  }
  if (statusFromEnv === 'fail') {
    return { allowTypedFirst: false, reason: 'BOTMOX_TYPED_STORE_PARITY_STATUS=fail' };
  }

  const reportPath = String(options.env.BOTMOX_TYPED_STORE_PARITY_REPORT_PATH || '').trim();
  if (!reportPath) {
    return {
      allowTypedFirst: false,
      reason: 'parity gate enabled but BOTMOX_TYPED_STORE_PARITY_REPORT_PATH is not set',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    if (!fs.existsSync(reportPath)) {
      return { allowTypedFirst: false, reason: `parity report not found at ${reportPath}` };
    }

    const raw = fs.readFileSync(reportPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      threshold?: number;
      domains?: Array<{ domain?: string; mismatchCount?: number }>;
    };
    const threshold = Number.isFinite(parsed.threshold) ? Number(parsed.threshold) : 0;
    const domains = Array.isArray(parsed.domains) ? parsed.domains : [];
    const matchedDomain = domains.find(
      (domain) =>
        String(domain?.domain || '')
          .trim()
          .toLowerCase() === options.domain,
    );

    if (!matchedDomain) {
      return {
        allowTypedFirst: false,
        reason: `parity report missing domain result for ${options.domain}`,
      };
    }

    const mismatchCount = Number.isFinite(matchedDomain.mismatchCount)
      ? Number(matchedDomain.mismatchCount)
      : Number.POSITIVE_INFINITY;

    if (mismatchCount > threshold) {
      return {
        allowTypedFirst: false,
        reason: `${options.domain} parity mismatches ${mismatchCount} exceed threshold ${threshold}`,
      };
    }

    return { allowTypedFirst: true };
  } catch (error) {
    return {
      allowTypedFirst: false,
      reason: `failed to read parity report: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function resolveTypedStoreMigrationMode(options: {
  env: NodeJS.ProcessEnv;
  readPrecedenceOverrideEnvName: string;
  dualWriteOverrideEnvName: string;
}): TypedStoreMigrationMode {
  const globalReadPrecedence = parseReadPrecedence(
    options.env.BOTMOX_TYPED_STORE_READ_PRECEDENCE,
    DEFAULT_READ_PRECEDENCE,
  );
  const readPrecedence = parseReadPrecedence(
    options.env[options.readPrecedenceOverrideEnvName],
    globalReadPrecedence,
  );

  const globalDualWriteEnabled = parseBoolean(options.env.BOTMOX_TYPED_STORE_DUAL_WRITE, true);
  const dualWriteEnabled = parseBoolean(
    options.env[options.dualWriteOverrideEnvName],
    globalDualWriteEnabled,
  );

  let effectiveReadPrecedence: TypedStoreReadPrecedence = readPrecedence;
  let cutoverBlockedReason: string | undefined;

  if (readPrecedence === 'typed-first') {
    const domain = inferDomainName(options.readPrecedenceOverrideEnvName);
    const parityGateState = resolveParityGateState({
      env: options.env,
      domain,
    });
    if (!parityGateState.allowTypedFirst) {
      effectiveReadPrecedence = 'legacy-first';
      cutoverBlockedReason = parityGateState.reason || 'typed-first blocked by parity gate';
    }
  }

  return {
    readPrecedence: effectiveReadPrecedence,
    dualWriteEnabled,
    ...(cutoverBlockedReason ? { cutoverBlockedReason } : {}),
  };
}
