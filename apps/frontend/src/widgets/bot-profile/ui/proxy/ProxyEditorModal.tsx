import type { FormProps, ModalProps } from 'antd';

import dayjs, { type Dayjs } from 'dayjs';
import type React from 'react';
import type { IPQSResponse } from '../../../../entities/resources/model/types';
import type { ParsedProxy } from '../../../../shared/lib/utils/proxyUtils';
import {
  AppModal,
  AppDatePicker as DatePicker,
  AppFlex as Flex,
  AppForm as Form,
  AppInput as Input,
  AppSpin as Spin,
  AppTypography as Typography,
} from '../../../../shared/ui';
import { ProxyIpqsResults } from './ProxyIpqsResults';
import { ProxyParsedAlert } from './ProxyParsedAlert';
import styles from './proxy.module.css';

const { TextArea } = Input;
const { Text } = Typography;

interface ProxyEditorModalProps {
  modalProps: ModalProps;
  formProps: FormProps;
  editing: boolean;
  parsedProxy: ParsedProxy | null;
  proxyInput: string;
  parseError: string;
  showPassword: boolean;
  checkingIPQS: boolean;
  ipqsData: IPQSResponse | null;
  onProxyInputChange: (value: string) => void;
  onTogglePassword: () => void;
}

function toDayjsValue(value: unknown): Dayjs | null {
  if (dayjs.isDayjs(value)) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : null;
  }
  return null;
}

export const ProxyEditorModal: React.FC<ProxyEditorModalProps> = ({
  modalProps,
  formProps,
  editing,
  parsedProxy,
  proxyInput,
  parseError,
  showPassword,
  checkingIPQS,
  ipqsData,
  onProxyInputChange,
  onTogglePassword,
}) => {
  return (
    <AppModal
      {...modalProps}
      title={editing ? 'Edit Proxy' : 'Add Proxy'}
      okText={editing ? 'Update' : 'Add'}
      width={600}
      okButtonProps={{
        ...(modalProps.okButtonProps ?? {}),
        disabled: !parsedProxy || Boolean(modalProps.okButtonProps?.disabled),
      }}
    >
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Proxy String"
          required
          validateStatus={parseError ? 'error' : parsedProxy ? 'success' : ''}
          help={
            parseError ||
            (parsedProxy ? 'Valid proxy format detected' : 'Format: ip:port:login:password')
          }
        >
          <TextArea
            placeholder="Enter proxy string (ip:port:login:password)"
            value={proxyInput}
            onChange={(event) => onProxyInputChange(event.target.value)}
            rows={2}
            style={{ fontFamily: 'monospace' }}
            variant="filled"
          />
        </Form.Item>

        {checkingIPQS && (
          <Flex align="center" gap={8} className={styles['ipqs-loading-box']}>
            <Spin size="small" />
            <Text type="secondary">Checking IP quality...</Text>
          </Flex>
        )}

        {parsedProxy && (
          <ProxyParsedAlert
            parsedProxy={parsedProxy}
            showPassword={showPassword}
            onTogglePassword={onTogglePassword}
          />
        )}

        <ProxyIpqsResults ipqsData={ipqsData} />

        <Form.Item
          name="expires_at"
          label="Expiration Date"
          rules={[{ required: true, message: 'Please select expiration date' }]}
          getValueProps={(value) => ({ value: toDayjsValue(value) })}
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" variant="filled" />
        </Form.Item>
      </Form>
    </AppModal>
  );
};
