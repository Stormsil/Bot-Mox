import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  computeBotStatus,
  computeBotStatusAt,
  computeLicenseStatus,
  computeProxyStatus,
  computeSubscriptionStatus,
} from '../../apps/frontend/src/entities/bot/lib/statuses.ts';
import {
  calculateCategoryBreakdown,
  calculateFinanceSummary,
  filterOperations,
  getGoldPriceHistoryFromOperations,
  prepareTimeSeriesData,
} from '../../apps/frontend/src/entities/finance/lib/analyticsCalculations.ts';
import {
  DEFAULT_DELETE_VM_FILTERS,
  evaluateDeleteBot,
  normalizeDeleteVmFilters,
} from '../../apps/frontend/src/features/vm-management/lib/deleteVmRules.ts';
import {
  buildDeleteVmCandidatesRaw,
  collectSelectableDeleteVmIds,
  filterDeleteVmCandidates,
} from '../../apps/frontend/src/features/vm-management/lib/deleteVmWorkflowCandidates.ts';
import {
  buildBotRows,
  buildResourcesByBotMaps,
} from '../../apps/frontend/src/pages/project/selectors.ts';
import {
  generateDaySchedule,
  generateSchedule,
  validateGenerationParams,
} from '../../apps/frontend/src/shared/lib/utils/schedule/generation.ts';
import {
  extractVmNumber,
  patchConfig,
} from '../../apps/frontend/src/shared/lib/utils/vm/patcher.ts';

const FIXED_NOW = Date.parse('2026-01-15T12:00:00.000Z');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), '.sisyphus/evidence');

const SOURCE_FILES = [
  path.resolve(process.cwd(), 'apps/frontend/src/entities/bot/lib/statuses.ts'),
  path.resolve(process.cwd(), 'apps/frontend/src/entities/finance/lib/analyticsCalculations.ts'),
  path.resolve(process.cwd(), 'apps/frontend/src/features/vm-management/lib/deleteVmRules.ts'),
  path.resolve(process.cwd(), 'apps/frontend/src/shared/lib/utils/schedule/generation.ts'),
  path.resolve(process.cwd(), 'apps/frontend/src/shared/lib/utils/vm/patcher.ts'),
];

const args = process.argv.slice(2);
const outDirArgIndex = args.indexOf('--out-dir');
const outDir =
  outDirArgIndex >= 0 ? path.resolve(process.cwd(), args[outDirArgIndex + 1]) : DEFAULT_OUT_DIR;
const simulateMissingSource = args.includes('--simulate-missing-source');

const lcg = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const withDeterminism = async (run) => {
  const OriginalDate = Date;
  const originalRandom = Math.random;

  class FixedDate extends OriginalDate {
    constructor(...value) {
      if (value.length === 0) {
        super(FIXED_NOW);
      } else {
        super(...value);
      }
    }

    static now() {
      return FIXED_NOW;
    }
  }

  globalThis.Date = FixedDate;
  Math.random = lcg(1337);

  try {
    return await run();
  } finally {
    globalThis.Date = OriginalDate;
    Math.random = originalRandom;
  }
};

const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const ensureSources = async () => {
  const checkTargets = simulateMissingSource
    ? [...SOURCE_FILES, path.resolve(process.cwd(), 'apps/frontend/src/DOES_NOT_EXIST.ts')]
    : SOURCE_FILES;

  for (const filePath of checkTargets) {
    try {
      await access(filePath);
    } catch {
      throw new Error(`missing-source: ${filePath}`);
    }
  }
};

const buildStatusesFixture = () => {
  const warningDays = 7;
  const botInputs = [
    { id: 'bot-banned', status: 'banned', last_seen: FIXED_NOW - 60_000 },
    { id: 'bot-offline', status: 'farming', last_seen: FIXED_NOW - 25 * 60 * 1000 },
    { id: 'bot-prepare', status: 'prepare', last_seen: FIXED_NOW - 2 * 60 * 1000 },
    { id: 'bot-active', status: 'farming', last_seen: FIXED_NOW - 2 * 60 * 1000 },
  ];

  const botStatusesAt = botInputs.map((bot) => ({
    id: bot.id,
    status: computeBotStatusAt(bot, FIXED_NOW),
  }));

  const botStatusesNow = botInputs.map((bot) => ({
    id: bot.id,
    status: computeBotStatus(bot),
  }));

  const proxyInputs = [
    undefined,
    { status: 'banned', expires_at: FIXED_NOW + 20 * 24 * 60 * 60 * 1000 },
    { status: 'active', expires_at: FIXED_NOW - 5 * 24 * 60 * 60 * 1000 },
    { status: 'active', expires_at: FIXED_NOW + 3 * 24 * 60 * 60 * 1000 },
    { status: 'active', expires_at: FIXED_NOW + 40 * 24 * 60 * 60 * 1000 },
  ];

  const proxyStatuses = proxyInputs.map((proxy, index) => ({
    caseId: `proxy-${index}`,
    output: computeProxyStatus(proxy),
  }));

  const subscriptionInputs = [
    [],
    [{ expires_at: FIXED_NOW - 2 * 24 * 60 * 60 * 1000 }],
    [{ expires_at: FIXED_NOW + 2 * 24 * 60 * 60 * 1000 }],
    [{ expires_at: FIXED_NOW + 20 * 24 * 60 * 60 * 1000 }],
  ];
  const subscriptionStatuses = subscriptionInputs.map((subs, index) => ({
    caseId: `subs-${index}`,
    output: computeSubscriptionStatus(subs, warningDays),
  }));

  const licenseInputs = [
    [],
    [{ expires_at: FIXED_NOW - 1 * 24 * 60 * 60 * 1000 }],
    [{ expires_at: FIXED_NOW + 4 * 24 * 60 * 60 * 1000 }],
    [{ expires_at: FIXED_NOW + 30 * 24 * 60 * 60 * 1000 }],
  ];
  const licenseStatuses = licenseInputs.map((licenses, index) => ({
    caseId: `license-${index}`,
    output: computeLicenseStatus(licenses, warningDays),
  }));

  return {
    fixedNow: FIXED_NOW,
    warningDays,
    botStatusesAt,
    botStatusesNow,
    proxyStatuses,
    subscriptionStatuses,
    licenseStatuses,
  };
};

const buildFinanceFixture = () => {
  const day = 24 * 60 * 60 * 1000;
  const operations = [
    {
      id: 'op-1',
      type: 'income',
      category: 'sale',
      amount: 120,
      date: FIXED_NOW - 14 * day,
      gold_amount: 300,
      gold_price_at_time: 0.4,
      project_id: 'wow_tbc',
    },
    {
      id: 'op-2',
      type: 'expense',
      category: 'proxy',
      amount: 35,
      date: FIXED_NOW - 13 * day,
      project_id: 'wow_tbc',
    },
    {
      id: 'op-3',
      type: 'income',
      category: 'sale',
      amount: 150,
      date: FIXED_NOW - 8 * day,
      gold_amount: 320,
      gold_price_at_time: 0.47,
      project_id: 'wow_midnight',
    },
    {
      id: 'op-4',
      type: 'expense',
      category: 'subscription',
      amount: 40,
      date: FIXED_NOW - 7 * day,
      project_id: 'wow_midnight',
    },
    {
      id: 'op-5',
      type: 'income',
      category: 'service',
      amount: 90,
      date: FIXED_NOW - 3 * day,
      project_id: 'wow_tbc',
    },
    {
      id: 'op-6',
      type: 'expense',
      category: 'other',
      amount: 10,
      date: FIXED_NOW - 1 * day,
      project_id: 'wow_tbc',
    },
  ];

  const filtered = filterOperations(operations, {
    project_id: 'wow_tbc',
    type: 'all',
    category: 'all',
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
  });
  const summary = calculateFinanceSummary(filtered);
  const incomeBreakdown = calculateCategoryBreakdown(filtered, 'income');
  const expenseBreakdown = calculateCategoryBreakdown(filtered, 'expense');
  const timeSeries = prepareTimeSeriesData(filtered, FIXED_NOW - 15 * day, FIXED_NOW);
  const goldPriceHistory = getGoldPriceHistoryFromOperations(filtered);

  return {
    fixedNow: FIXED_NOW,
    operations,
    filtered,
    summary,
    incomeBreakdown,
    expenseBreakdown,
    timeSeries,
    goldPriceHistory,
  };
};

const buildVmDeleteFixture = () => {
  const filters = normalizeDeleteVmFilters({
    policy: {
      allowBanned: true,
      allowPrepareNoResources: true,
      allowOrphan: true,
    },
    view: {
      showAllowed: true,
      showLocked: true,
      showRunning: true,
      showStopped: true,
    },
  });

  const strictFilters = normalizeDeleteVmFilters({
    policy: {
      allowBanned: false,
      allowPrepareNoResources: false,
      allowOrphan: false,
    },
  });

  const bots = {
    b1: {
      id: 'b1',
      vmName: 'WoW101',
      status: 'banned',
      accountEmail: 'b1@example.com',
      accountPassword: 'secret',
    },
    b2: {
      id: 'b2',
      vmName: 'WoW102',
      status: 'prepare',
      accountEmail: '',
      accountPassword: '',
    },
    b3: {
      id: 'b3',
      vmName: 'WoW103',
      status: 'farming',
      accountEmail: 'b3@example.com',
      accountPassword: 'secret',
    },
  };

  const directEvaluations = [
    evaluateDeleteBot(
      bots.b1,
      { hasProxy: true, hasSubscription: false, hasLicense: false },
      filters.policy,
    ),
    evaluateDeleteBot(
      bots.b2,
      { hasProxy: false, hasSubscription: false, hasLicense: false },
      filters.policy,
    ),
    evaluateDeleteBot(
      bots.b3,
      { hasProxy: true, hasSubscription: true, hasLicense: true },
      strictFilters.policy,
    ),
  ];

  const candidates = buildDeleteVmCandidatesRaw({
    deleteVmBots: bots,
    deleteVmProxies: [{ botId: 'b1' }, { botId: 'b3' }],
    deleteVmSubscriptions: [{ botId: 'b3' }],
    deleteVmLicenses: [{ botIds: ['b3'] }],
    proxmoxVms: [
      { vmid: 101, name: 'WoW101', status: 'stopped', template: false },
      { vmid: 102, name: 'WoW102', status: 'stopped', template: false },
      { vmid: 103, name: 'WoW103', status: 'running', template: false },
      { vmid: 104, name: 'WoW104', status: 'stopped', template: false },
      { vmid: 999, name: 'template-vm', status: 'stopped', template: true },
    ],
    templateVmId: 999,
    policy: filters.policy,
  });

  const filteredCandidates = filterDeleteVmCandidates(candidates, filters.view);
  const selectable = [...collectSelectableDeleteVmIds(filteredCandidates, new Set([102]))];

  return {
    defaultFilters: DEFAULT_DELETE_VM_FILTERS,
    normalizedFilters: filters,
    strictFilters,
    directEvaluations,
    candidates,
    filteredCandidates,
    selectable,
  };
};

const buildScheduleFixture = () => {
  const params = {
    startTime: '06:30',
    endTime: '13:30',
    useSecondWindow: true,
    startTime2: '17:00',
    endTime2: '22:00',
    targetActiveMinutes: 300,
    minSessionMinutes: 45,
    minBreakMinutes: 15,
    randomOffsetMinutes: 10,
    profile: 'farming',
  };

  const validation = validateGenerationParams(params);
  const daySchedule = generateDaySchedule(params, 2);
  const weekSchedule = generateSchedule(params);

  return {
    params,
    validation,
    daySchedule,
    weekSchedule,
  };
};

const buildVmPatcherFixture = () => {
  const config = [
    'name: WoW8',
    'net0: e1000=AA:AA:AA:AA:AA:AA,bridge=vmbr1,firewall=1',
    'sata0: local-lvm:vm-100-disk-0,serial=OLD-SERIAL',
    "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    'balloon: 0',
  ].join('\n');

  const hardware = {
    mac: '00:16:3E:8A:22:01',
    ssdSerial: 'SN-NEW-0001',
    smbiosArgs: "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
  };

  const vmNumber = extractVmNumber('WoW8');
  const patched = patchConfig(config, 'WoW8', hardware, 108);

  return {
    vmNumber,
    config,
    hardware,
    patched,
  };
};

const buildPayloadBenchmark = ({ statuses, finance }) => {
  const botsRecord = {
    'bot-banned': {
      id: 'bot-banned',
      name: 'Bot Banned',
      project_id: 'project-a',
      status: 'banned',
      last_seen: FIXED_NOW - 60_000,
      account: { email: 'ban@example.com', password: 'pw' },
      character: { name: 'BannedOne', level: 20, server: 'Alpha', faction: 'Horde' },
      vm: { name: 'WoW101' },
    },
    'bot-prepare': {
      id: 'bot-prepare',
      name: 'Bot Prepare',
      project_id: 'project-a',
      status: 'prepare',
      last_seen: FIXED_NOW - 2 * 60 * 1000,
      account: { email: '', password: '' },
      character: { name: 'PrepareOne', level: 1, server: 'Alpha', faction: 'Alliance' },
      vm: { name: 'WoW102' },
    },
    'bot-offline': {
      id: 'bot-offline',
      name: 'Bot Offline',
      project_id: 'project-a',
      status: 'farming',
      last_seen: FIXED_NOW - 25 * 60 * 1000,
      account: { email: 'off@example.com', password: 'pw' },
      character: { name: 'OfflineOne', level: 30, server: 'Beta', faction: 'Horde' },
      vm: { name: 'WoW103' },
    },
  };

  const proxies = [
    {
      id: 'proxy-1',
      bot_id: 'bot-offline',
      status: 'active',
      expires_at: FIXED_NOW + 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'proxy-2',
      bot_id: 'bot-banned',
      status: 'banned',
      expires_at: FIXED_NOW + 10 * 24 * 60 * 60 * 1000,
    },
  ];
  const subscriptions = [
    { id: 'sub-1', bot_id: 'bot-offline', expires_at: FIXED_NOW + 5 * 24 * 60 * 60 * 1000 },
    { id: 'sub-2', bot_id: 'bot-banned', expires_at: FIXED_NOW - 1 * 24 * 60 * 60 * 1000 },
  ];
  const licenses = [
    { id: 'lic-1', bot_ids: ['bot-offline'], expires_at: FIXED_NOW + 4 * 24 * 60 * 60 * 1000 },
    { id: 'lic-2', bot_ids: ['bot-banned'], expires_at: FIXED_NOW - 2 * 24 * 60 * 60 * 1000 },
  ];

  const resourcesByBot = buildResourcesByBotMaps({ proxies, subscriptions, licenses });
  const botRows = buildBotRows({
    bots: botsRecord,
    projectId: 'project-a',
    warningDays: 7,
    resourcesByBot,
  });

  const dashboardRawPayload = {
    bots: botsRecord,
    proxies,
    subscriptions,
    licenses,
  };

  const dashboardDerivedPayload = {
    botRows,
    statusesSummary: statuses.botStatusesNow,
  };

  const financeRawPayload = {
    operations: finance.operations,
  };
  const financeDerivedPayload = {
    summary: finance.summary,
    incomeBreakdown: finance.incomeBreakdown,
    expenseBreakdown: finance.expenseBreakdown,
    timeSeries: finance.timeSeries,
    goldPriceHistory: finance.goldPriceHistory,
  };

  return {
    fixedNow: FIXED_NOW,
    dashboard: {
      rawBytes: bytes(dashboardRawPayload),
      derivedBytes: bytes(dashboardDerivedPayload),
      deltaBytes: bytes(dashboardDerivedPayload) - bytes(dashboardRawPayload),
      approxDescription:
        'Dashboard approximation uses project selector inputs/outputs from frontend compute path.',
    },
    finance: {
      rawBytes: bytes(financeRawPayload),
      derivedBytes: bytes(financeDerivedPayload),
      deltaBytes: bytes(financeDerivedPayload) - bytes(financeRawPayload),
      approxDescription:
        'Finance approximation compares raw operations payload vs derived summary/breakdown/timeseries payload.',
    },
  };
};

const main = async () => {
  await ensureSources();
  await mkdir(outDir, { recursive: true });

  const result = await withDeterminism(async () => {
    const statuses = buildStatusesFixture();
    const finance = buildFinanceFixture();
    const vmDelete = buildVmDeleteFixture();
    const schedule = buildScheduleFixture();
    const vmPatcher = buildVmPatcherFixture();
    const benchmark = buildPayloadBenchmark({ statuses, finance });

    return {
      statuses,
      finance,
      vmDelete,
      schedule,
      vmPatcher,
      benchmark,
    };
  });

  await Promise.all([
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-fixture-statuses.json'),
      result.statuses,
    ),
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-fixture-finance.json'),
      result.finance,
    ),
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-fixture-vm-delete.json'),
      result.vmDelete,
    ),
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-fixture-schedule.json'),
      result.schedule,
    ),
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-fixture-vm-patcher.json'),
      result.vmPatcher,
    ),
    writeJson(
      path.join(outDir, 'task-1-backend-business-logic-payload-benchmark.json'),
      result.benchmark,
    ),
  ]);

  const summary = {
    status: 'ok',
    outDir,
    generatedFiles: [
      'task-1-backend-business-logic-fixture-statuses.json',
      'task-1-backend-business-logic-fixture-finance.json',
      'task-1-backend-business-logic-fixture-vm-delete.json',
      'task-1-backend-business-logic-fixture-schedule.json',
      'task-1-backend-business-logic-fixture-vm-patcher.json',
      'task-1-backend-business-logic-payload-benchmark.json',
    ],
    benchmark: result.benchmark,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`capture-failed: ${message}\n`);
  process.exitCode = 1;
});
