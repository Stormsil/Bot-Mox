export function generateSsdSerial(): string {
  const num = Math.floor(10000000 + Math.random() * 90000000);
  return num.toString();
}
