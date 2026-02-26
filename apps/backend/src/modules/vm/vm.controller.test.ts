export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { VmController } = require('./vm.controller.ts');
const { VmService } = require('./vm.service.ts');

function buildRequest(tenantId: string) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: `${tenantId}@example.local`,
      roles: ['admin'],
      tenantId,
      raw: {},
    },
  };
}

function createController() {
  const records = new Map<string, Record<string, unknown>>();
  const repositoryStub = {
    upsert: async (input: unknown) => {
      const typed = input as {
        tenantId: string;
        vmUuid: string;
        userId: string;
        vmName: string;
        projectId: string;
        status: string;
        metadata: Record<string, unknown>;
        createdAtMs: number;
        updatedAtMs: number;
      };
      const key = `${typed.tenantId}:${typed.vmUuid}`;
      const next = {
        tenant_id: typed.tenantId,
        vm_uuid: typed.vmUuid,
        user_id: typed.userId,
        vm_name: typed.vmName,
        project_id: typed.projectId,
        status: typed.status,
        metadata: typed.metadata,
        created_at_ms: typed.createdAtMs,
        updated_at_ms: typed.updatedAtMs,
      };
      records.set(key, next);
      return next;
    },
    findById: async (tenantId: unknown, vmUuid: unknown) =>
      records.get(`${String(tenantId)}:${String(vmUuid)}`) ?? null,
  };
  const vmHardwareStub = {
    generateFingerprint: () => ({
      mac: '00:1B:21:AA:BB:CC',
      ssdSerial: '12345678',
      smbiosArgs:
        "args: -cpu 'host' -smbios 'type=0,vendor=AMI,version=2.17,date=10/11/2023' -smbios 'type=1,version=1.0,product=ROG STRIX B560-F GAMING WIFI,manufacturer=ASUSTeK COMPUTER INC.,uuid=11111111-2222-3333-4444-555555555555,serial=A1B2C3D4E5F6G7H8,family=Default string' -smbios 'type=2,asset=Not Specified,version=1.0,product=ROG STRIX B560-F GAMING WIFI,location=Motherboard,manufacturer=ASUSTeK COMPUTER INC.,serial=A1B2C3D4E5F6G7H8' -smbios 'type=3,asset=Not Specified,version=Default string,sku=Default string,manufacturer=ASUSTeK COMPUTER INC.,serial=A1B2C3D4E5F6G7H8' -smbios 'type=4,asset=Not Specified,version=Intel(R) Core(TM) i5-11400F CPU @ 2.60GHz,part=To Be Filled By O.E.M.,manufacturer=Intel,serial=Not Specified,sock_pfx=SOCKET 0' -smbios 'type=11,value=Default string' -smbios 'type=17,loc_pfx=DIMM 0,bank=Bank 0,manufacturer=Crucial Technology,serial=1234567890,asset=987654321,part=CT16G4DFD8266.C16FBD,speed=3200' -smbios 'type=17,loc_pfx=DIMM 0,bank=Bank 1,manufacturer=Crucial Technology,serial=1234567891,asset=987654322,part=CT16G4DFD8266.C16FBD,speed=3200' -vnc '0.0.0.0:00'",
      meta: {
        brand: 'ASUS',
        product: 'ROG STRIX B560-F GAMING WIFI',
        cpu: 'Intel(R) Core(TM) i5-11400F CPU @ 2.60GHz',
      },
    }),
  };
  const controller = new VmController(new VmService(repositoryStub), vmHardwareStub);
  return {
    controller,
    vmHardwareStub,
    restore: () => {},
  };
}

test('VmController resolves VM records only inside the requesting tenant', async () => {
  const { controller, restore } = createController();
  const auth = 'Bearer test-token';

  try {
    await controller.register(
      auth,
      {
        vm_uuid: 'VM-UUID-001',
        user_id: 'user-a',
        vm_name: 'tenant-a-vm',
      },
      buildRequest('tenant-a'),
    );

    await controller.register(
      auth,
      {
        vm_uuid: 'VM-UUID-001',
        user_id: 'user-b',
        vm_name: 'tenant-b-vm',
      },
      buildRequest('tenant-b'),
    );

    const tenantARecord = await controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-a'));
    const tenantBRecord = await controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-b'));

    assert.equal(
      (tenantARecord.data as { tenant_id: string; vm_name: string }).tenant_id,
      'tenant-a',
    );
    assert.equal(
      (tenantARecord.data as { tenant_id: string; vm_name: string }).vm_name,
      'tenant-a-vm',
    );
    assert.equal(
      (tenantBRecord.data as { tenant_id: string; vm_name: string }).tenant_id,
      'tenant-b',
    );
    assert.equal(
      (tenantBRecord.data as { tenant_id: string; vm_name: string }).vm_name,
      'tenant-b-vm',
    );

    await assert.rejects(
      () => controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-c')),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'VM_UUID_NOT_FOUND',
          message: 'VM UUID not found',
        });
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('VmController returns deterministic code for missing bearer token', async () => {
  const { controller, restore } = createController();
  try {
    await assert.rejects(
      () => controller.resolve(undefined, 'VM-UUID-001', buildRequest('tenant-a')),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'MISSING_BEARER_TOKEN',
          message: 'Missing bearer token',
        });
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('VmController register ignores body user_id and uses authenticated identity userId', async () => {
  const { controller, restore } = createController();
  const auth = 'Bearer test-token';
  try {
    const created = await controller.register(
      auth,
      {
        vm_uuid: 'VM-UUID-SECURE-001',
        user_id: 'spoofed-user-id',
        vm_name: 'vm-secure',
      },
      buildRequest('tenant-a'),
    );

    assert.equal((created.data as { user_id: string }).user_id, 'user-1');
  } finally {
    restore();
  }
});

test('VmController hardware fingerprint returns success envelope with generated payload', () => {
  const { controller, restore } = createController();
  const auth = 'Bearer test-token';
  try {
    const result = controller.getHardwareFingerprint(auth, {});
    assert.equal(result.success, true);
    assert.equal(typeof result.data, 'object');
    assert.ok(result.data !== null);
    assert.equal((result.data as { mac: string }).mac, '00:1B:21:AA:BB:CC');
    assert.equal((result.data as { ssdSerial: string }).ssdSerial, '12345678');
    assert.equal(typeof (result.data as { smbiosArgs: string }).smbiosArgs, 'string');
    assert.equal((result.data as { meta: { brand: string } }).meta.brand, 'ASUS');
  } finally {
    restore();
  }
});

test('VmController hardware fingerprint requires bearer token', () => {
  const { controller, restore } = createController();
  try {
    assert.throws(
      () => controller.getHardwareFingerprint(undefined, {}),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        const response = (error as { getResponse: () => unknown }).getResponse() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'MISSING_BEARER_TOKEN');
        assert.equal(response.message, 'Missing bearer token');
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('VmController hardware fingerprint rejects invalid generated payload shape', () => {
  const { controller, vmHardwareStub, restore } = createController();
  const auth = 'Bearer test-token';
  (vmHardwareStub as { generateFingerprint: () => unknown }).generateFingerprint = () => ({
    mac: '',
    ssdSerial: '12345678',
    smbiosArgs: 'args: -cpu host',
    meta: {
      product: 'ROG STRIX B560-F GAMING WIFI',
      cpu: 'Intel(R) Core(TM) i5-11400F CPU @ 2.60GHz',
    },
  });

  try {
    assert.throws(
      () => controller.getHardwareFingerprint(auth, {}),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        const response = (error as { getResponse: () => unknown }).getResponse() as {
          code?: string;
          message?: string;
          details?: unknown;
        };
        assert.equal(response.code, 'VM_HARDWARE_FINGERPRINT_INVALID_RESPONSE');
        assert.equal(response.message, 'Invalid VM hardware fingerprint response payload');
        assert.equal(typeof response.details, 'object');
        assert.ok(response.details !== null);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('VmController hardware fingerprint rejects unsupported query params', () => {
  const { controller, restore } = createController();
  const auth = 'Bearer test-token';
  try {
    assert.throws(
      () => controller.getHardwareFingerprint(auth, { unexpected: 'value' }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        const response = (error as { getResponse: () => unknown }).getResponse() as {
          code?: string;
          message?: string;
          details?: unknown;
        };
        assert.equal(response.code, 'VM_HARDWARE_FINGERPRINT_INVALID_QUERY');
        assert.equal(response.message, 'Invalid VM hardware fingerprint query');
        assert.equal(typeof response.details, 'object');
        assert.ok(response.details !== null);
        return true;
      },
    );
  } finally {
    restore();
  }
});
