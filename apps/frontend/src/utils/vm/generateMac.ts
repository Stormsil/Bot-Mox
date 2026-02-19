// MAC Address Generator
// Equivalent of HEXWARE-Random-IntelMac.exe
// Fixed OUI prefix 00:1B:21 + 3 random octets

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function toHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Generate a random MAC address: 00:1B:21:XX:XX:XX
 */
export function generateMac(): string {
  return `00:1B:21:${toHex(randomByte())}:${toHex(randomByte())}:${toHex(randomByte())}`;
}
