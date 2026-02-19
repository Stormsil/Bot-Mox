import React from 'react';
import { DatePicker, Form, Input, Modal, Spin, Typography, theme } from 'antd';
import type { FormInstance } from 'antd';
import { DatePicker, Form, Input, Modal, Spin, Typography } from 'antd';
import type React from 'react';
import type { IPQSResponse } from '../../../types';
import type { ParsedProxy } from '../../../utils/proxyUtils';
import { ProxyIpqsResults } from './ProxyIpqsResults';
import { ProxyParsedAlert } from './ProxyParsedAlert';
import styles from './proxy.module.css';
import type { ProxyModalFormValues } from './types';

const { TextArea } = Input;
const { Text } = Typography;

interface ProxyEditorModalProps {
  open: boolean;
  editing: boolean;
  form: FormInstance<ProxyModalFormValues>;
  parsedProxy: ParsedProxy | null;
  proxyInput: string;
  parseError: string;
  showPassword: boolean;
  checkingIPQS: boolean;
  ipqsData: IPQSResponse | null;
  onCancel: () => void;
  onSubmit: () => void;
  onFinish: (values: ProxyModalFormValues) => Promise<void>;
  onProxyInputChange: (value: string) => void;
  onTogglePassword: () => void;
}

export const ProxyEditorModal: React.FC<ProxyEditorModalProps> = ({
  open,
  editing,
  form,
  parsedProxy,
  proxyInput,
  parseError,
  showPassword,
  checkingIPQS,
  ipqsData,
  onCancel,
  onSubmit,
  onFinish,
  onProxyInputChange,
  onTogglePassword,
}) => {
  const { token } = theme.useToken();

  return (
    <Modal
      title={
        <span className={styles['modal-title']} style={{ color: token.colorText }}>
          {editing ? 'Edit Proxy' : 'Add Proxy'}
        </span>
      }
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
      okText={editing ? 'Update' : 'Add'}
      width={600}
      okButtonProps={{ disabled: !parsedProxy }}
      styles={{
        content: {
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
        },
        header: {
          background: token.colorBgElevated,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        footer: {
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Proxy String"
          required
          validateStatus={parseError ? 'error' : parsedProxy ? 'success' : ''}
          help={parseError || (parsedProxy ? 'Valid proxy format detected' : 'Format: ip:port:login:password')}
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
          <div className={styles['ipqs-loading']}>
            <Spin size="small" />
            <Text type="secondary">Checking IP quality...</Text>
          </div>
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
        >
          <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" variant="filled" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
