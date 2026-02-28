import type React from 'react';
import { VMListContainer } from './VMListContainer';

export type { VMListContainerProps } from './VMListContainer';
export { VMListView } from './VMListView';

export const VMList: React.FC = () => <VMListContainer />;
