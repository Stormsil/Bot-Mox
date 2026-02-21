export function formatFraudScore(score: number): string {
  if (score <= 20) return `${score} (Low Risk)`;
  if (score <= 50) return `${score} (Medium Risk)`;
  if (score <= 75) return `${score} (High Risk)`;
  return `${score} (Critical Risk)`;
}

export function getFraudScoreColor(score: number): string {
  if (score <= 20) return '#52c41a';
  if (score <= 50) return '#faad14';
  if (score <= 75) return '#ff7a45';
  return '#ff4d4f';
}

export function getFraudScoreLabel(score: number): string {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  if (score <= 75) return 'High Risk';
  return 'Critical Risk';
}
