import { Form, Input, InputNumber, Typography } from 'antd';
import type React from 'react';
import type { UnattendProfileConfig } from '../../../../entities/vm/model/unattend';

const { Text } = Typography;

interface CustomScriptSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(
    section: K,
    patch: Partial<UnattendProfileConfig[K]>,
  ) => void;
}

export const CustomScriptSection: React.FC<CustomScriptSectionProps> = ({
  config,
  updateConfig,
}) => {
  const executable = config.customScript?.executable || 'START.exe';
  const delaySeconds = config.customScript?.delaySeconds ?? 20;

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="Executable filename">
        <Input
          value={executable}
          onChange={(e) => updateConfig('customScript', { executable: e.target.value })}
          placeholder="START.exe"
        />
      </Form.Item>

      <Form.Item label="Delay before execution (seconds)">
        <InputNumber
          value={delaySeconds}
          onChange={(v) => updateConfig('customScript', { delaySeconds: v ?? 20 })}
          min={0}
          max={600}
          style={{ width: 120 }}
        />
      </Form.Item>

      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
        Generated command preview:
      </Text>
      <code
        style={{
          display: 'block',
          marginTop: 4,
          padding: 8,
          background: 'var(--ant-color-fill-tertiary)',
          borderRadius: 4,
          fontSize: 12,
          wordBreak: 'break-all',
        }}
      >
        cmd /c "timeout /t {delaySeconds} /nobreak & start "SETUP_LOG" powershell.exe -NoExit
        -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File C:\WindowsSetup\{executable}"
      </code>
    </Form>
  );
};
