import { Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import type { CSSProperties, ReactNode } from 'react';
import type { SemanticStatusIntent } from '../lib/statusSemantic';
import { getSemanticIntentColorToken } from '../lib/statusSemantic';
import { AppTag } from './AppTag/AppTag';
import { TableActionGroup } from './TableActionButton';

const { Text } = Typography;

type StatusTagIntent = SemanticStatusIntent;

export interface StatusTagRendererConfig<TRecord, TValue> {
  getIntent: (value: TValue, record: TRecord) => StatusTagIntent;
  getLabel: (value: TValue, record: TRecord) => string;
  bordered?: boolean;
  className?: string;
  style?: CSSProperties;
  uppercase?: boolean;
}

export function resolveStatusIntentFromColor(color: string): StatusTagIntent {
  const normalized = color.trim().toLowerCase();
  if (normalized === 'success' || normalized === 'green') return 'success';
  if (normalized === 'warning' || normalized === 'orange' || normalized === 'gold') {
    return 'warning';
  }
  if (normalized === 'error' || normalized === 'red') return 'error';
  if (normalized === 'info' || normalized === 'blue' || normalized === 'processing') return 'info';
  return 'default';
}

export function createStatusTagRenderer<TRecord, TValue>(
  config: StatusTagRendererConfig<TRecord, TValue>,
) {
  return (value: TValue, record: TRecord) => {
    const label = config.getLabel(value, record);
    return (
      <AppTag
        bordered={config.bordered ?? false}
        intent={config.getIntent(value, record)}
        className={config.className}
        style={config.style}
      >
        {config.uppercase === false ? label : label.toUpperCase()}
      </AppTag>
    );
  };
}

export interface StatusWithSecondaryRendererConfig<TRecord, TValue> {
  getIntent: (value: TValue, record: TRecord) => StatusTagIntent;
  getLabel: (value: TValue, record: TRecord) => string;
  getSecondaryText: (value: TValue, record: TRecord) => string;
  onClick: (record: TRecord) => void;
  buttonClassName: string;
  secondaryClassName?: string;
  tagClassName?: string;
}

export function createStatusWithSecondaryRenderer<TRecord, TValue>(
  config: StatusWithSecondaryRendererConfig<TRecord, TValue>,
) {
  return (value: TValue, record: TRecord) => (
    <button type="button" className={config.buttonClassName} onClick={() => config.onClick(record)}>
      <Flex vertical gap={2}>
        <AppTag intent={config.getIntent(value, record)} className={config.tagClassName}>
          {config.getLabel(value, record)}
        </AppTag>
        <Text type="secondary" className={config.secondaryClassName}>
          {config.getSecondaryText(value, record)}
        </Text>
      </Flex>
    </button>
  );
}

export interface DateTextRendererConfig<TRecord, TValue extends dayjs.ConfigType> {
  getDateValue?: (value: TValue, record: TRecord) => dayjs.ConfigType;
  getIntent?: (value: TValue, record: TRecord) => SemanticStatusIntent | undefined;
  fontSize?: number | string;
  lineHeight?: number | string;
  format?: string;
}

export function createDateTextRenderer<TRecord, TValue extends dayjs.ConfigType>(
  config: DateTextRendererConfig<TRecord, TValue> = {},
) {
  return (value: TValue, record: TRecord) => {
    const formattedDate = dayjs(
      config.getDateValue ? config.getDateValue(value, record) : value,
    ).format(config.format ?? 'DD.MM.YYYY');
    const intent = config.getIntent?.(value, record);

    return (
      <Text
        style={{
          color: intent ? getSemanticIntentColorToken(intent) : undefined,
          fontSize: config.fontSize,
          lineHeight: config.lineHeight,
        }}
      >
        {formattedDate}
      </Text>
    );
  };
}

export interface ActionsRendererConfig<TRecord> {
  renderActions: (record: TRecord) => ReactNode;
  grouped?: boolean;
  wrapperClassName?: string;
  renderContainer?: (children: ReactNode, record: TRecord) => ReactNode;
}

export function createActionsRenderer<TRecord>(config: ActionsRendererConfig<TRecord>) {
  return (_value: unknown, record: TRecord) => {
    const actions = config.renderActions(record);
    const content = config.grouped ? <TableActionGroup>{actions}</TableActionGroup> : actions;
    const wrapped = config.renderContainer ? config.renderContainer(content, record) : content;

    if (!config.wrapperClassName) {
      return wrapped;
    }

    return <div className={config.wrapperClassName}>{wrapped}</div>;
  };
}
