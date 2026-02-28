import type { Dayjs } from 'dayjs';
import type {
  IPQSResponse,
  Proxy as ProxyResource,
} from '../../../../entities/resources/model/types';
import type { ParsedProxy } from '../../../../shared/lib/utils/proxyUtils';
import type { Bot } from '../../../../shared/types';

export interface BotProxyProps {
  bot: Bot;
}

export interface ProxyInfo extends ProxyResource {
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
