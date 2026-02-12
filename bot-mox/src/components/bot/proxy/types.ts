import type { Dayjs } from 'dayjs';
import type { Bot, IPQSResponse, Proxy } from '../../../types';
import type { ParsedProxy } from '../../../utils/proxyUtils';

export interface BotProxyProps {
  bot: Bot;
}

export interface ProxyInfo extends Proxy {
  daysRemaining?: number;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export interface ProxyModalFormValues {
  expires_at?: Dayjs;
}

export type ParsedProxyState = ParsedProxy | null;

export interface ProxyModalState {
  open: boolean;
  editing: boolean;
}

export interface ProxyIpqsState {
  checking: boolean;
  data: IPQSResponse | null;
}
