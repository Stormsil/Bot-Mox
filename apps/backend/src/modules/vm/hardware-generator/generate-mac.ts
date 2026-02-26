function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function toHex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

export function generateMac(): string {
  return `00:1B:21:${toHex(randomByte())}:${toHex(randomByte())}:${toHex(randomByte())}`;
}
