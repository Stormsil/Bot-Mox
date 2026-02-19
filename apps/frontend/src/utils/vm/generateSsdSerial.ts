// SSD/HDD Serial Number Generator
// Equivalent of randomserialssd.exe

/**
 * Generate a random SSD serial number.
 * Matches the format of randomserialssd.exe: 8-digit numeric string.
 */
export function generateSsdSerial(): string {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return num.toString();
}
