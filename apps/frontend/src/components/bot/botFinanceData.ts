export interface TransactionRecord {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  currency: string;
}

export const mockTransactions: TransactionRecord[] = [
  {
    id: '1',
    date: '2024-01-28',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Shadowmoon Valley',
    amount: 1250,
    currency: 'gold',
  },
  {
    id: '2',
    date: '2024-01-28',
    type: 'expense',
    category: 'Proxy',
    description: 'Proxy renewal',
    amount: 5,
    currency: 'USD',
  },
  {
    id: '3',
    date: '2024-01-27',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Nagrand',
    amount: 980,
    currency: 'gold',
  },
  {
    id: '4',
    date: '2024-01-27',
    type: 'expense',
    category: 'Subscription',
    description: 'Bot subscription',
    amount: 25,
    currency: 'USD',
  },
  {
    id: '5',
    date: '2024-01-26',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Netherstorm',
    amount: 1450,
    currency: 'gold',
  },
  {
    id: '6',
    date: '2024-01-26',
    type: 'expense',
    category: 'Session',
    description: 'Game time',
    amount: 2,
    currency: 'USD',
  },
  {
    id: '7',
    date: '2024-01-25',
    type: 'income',
    category: 'Farming',
    description: 'Gold farmed - Terokkar',
    amount: 1100,
    currency: 'gold',
  },
  {
    id: '8',
    date: '2024-01-25',
    type: 'expense',
    category: 'Proxy',
    description: 'Proxy renewal',
    amount: 5,
    currency: 'USD',
  },
];
