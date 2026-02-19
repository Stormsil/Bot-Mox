export function generateListItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
