export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { VmHardwareService } = require('./vm-hardware.service.ts');

function assertSmbiosShape(smbiosArgs: string): void {
  assert.match(smbiosArgs, /^args: -cpu '/);
  assert.match(smbiosArgs, /-smbios 'type=0,/);
  assert.match(smbiosArgs, /-smbios 'type=1,/);
  assert.match(smbiosArgs, /-smbios 'type=2,/);
  assert.match(smbiosArgs, /-smbios 'type=3,/);
  assert.match(smbiosArgs, /-smbios 'type=4,/);
  assert.match(smbiosArgs, /-smbios 'type=11,/);
  assert.match(smbiosArgs, /-smbios 'type=17,bank=Bank 0,/);
  assert.match(smbiosArgs, /-smbios 'type=17,bank=Bank 1,/);
  assert.match(smbiosArgs, /-vnc '0\.0\.0\.0:00'$/);
}

test('VmHardwareService generates fingerprint payload with required fields', () => {
  const service = new VmHardwareService();
  const payload = service.generateFingerprint();

  assert.match(payload.mac, /^00:1B:21:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/);
  assert.match(payload.ssdSerial, /^[0-9]{8}$/);
  assert.equal(typeof payload.smbiosArgs, 'string');
  assert.ok(payload.smbiosArgs.length > 0);
  assertSmbiosShape(payload.smbiosArgs);

  assert.equal(typeof payload.meta, 'object');
  assert.ok(payload.meta !== null);
  assert.equal(typeof payload.meta.brand, 'string');
  assert.equal(typeof payload.meta.product, 'string');
  assert.equal(typeof payload.meta.cpu, 'string');
  assert.ok(payload.meta.brand.length > 0);
  assert.ok(payload.meta.product.length > 0);
  assert.ok(payload.meta.cpu.length > 0);
});
