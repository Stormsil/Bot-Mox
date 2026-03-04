import { randomInt } from 'node:crypto';

export function generateSsdSerial(): string {
  const num = randomInt(10000000, 100000000);
  return num.toString();
}
