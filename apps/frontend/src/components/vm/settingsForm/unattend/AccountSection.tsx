import { unattendProfileConfigSchema } from '@botmox/api-contract';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, InputNumber, Radio, Select, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import type { UnattendProfileConfig } from '../../../../entities/vm/model/unattend';
import { RHFFormItem } from '../../../../shared/ui/form';

const { Text } = Typography;

interface AccountSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(
    section: K,
    patch: Partial<UnattendProfileConfig[K]>,
  ) => void;
}

const accountSectionSchema = unattendProfileConfigSchema
  .pick({ user: true, computerName: true })
  .superRefine((values, ctx) => {
    if (values.user.nameMode === 'custom' && !values.user.customName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['user', 'customName'],
        message: 'Custom username is required',
      });
    }

    if (values.computerName.mode === 'custom' && !values.computerName.customName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['computerName', 'customName'],
        message: 'Custom computer name is required',
      });
    }
  });

type AccountSectionFormValues = z.input<typeof accountSectionSchema>;

export const AccountSection: React.FC<AccountSectionProps> = ({ config, updateConfig }) => {
  const values = useMemo<AccountSectionFormValues>(
    () => ({
      user: {
        ...config.user,
        customNameSuffix: config.user.customNameSuffix || 'none',
      },
      computerName: { ...config.computerName },
    }),
    [config.user, config.computerName],
  );

  const { control } = useForm<AccountSectionFormValues>({
    resolver: zodResolver(accountSectionSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    values,
  });

  const userNameMode = useWatch({ control, name: 'user.nameMode' }) ?? config.user.nameMode;
  const computerNameMode =
    useWatch({ control, name: 'computerName.mode' }) ?? config.computerName.mode;

  return (
    <Form layout="vertical" size="small">
      <RHFFormItem<AccountSectionFormValues, 'user.nameMode'>
        control={control}
        name="user.nameMode"
        label="Username mode"
      >
        {({ field }) => (
          <Radio.Group
            value={field.value}
            onChange={(e) => {
              const nextValue = e.target.value;
              field.onChange(nextValue);
              updateConfig('user', { nameMode: nextValue });
            }}
          >
            <Radio value="random">Random (Adjective+Noun+Number)</Radio>
            <Radio value="fixed">Fixed (User)</Radio>
            <Radio value="custom">Custom pattern</Radio>
          </Radio.Group>
        )}
      </RHFFormItem>

      {userNameMode === 'custom' && (
        <>
          <RHFFormItem<AccountSectionFormValues, 'user.customName'>
            control={control}
            name="user.customName"
            label="Custom username"
          >
            {({ field }) => (
              <Input
                value={field.value || ''}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  field.onChange(nextValue);
                  updateConfig('user', { customName: nextValue });
                }}
              />
            )}
          </RHFFormItem>

          <RHFFormItem<AccountSectionFormValues, 'user.customNameSuffix'>
            control={control}
            name="user.customNameSuffix"
            label="Name suffix"
          >
            {({ field }) => (
              <Select
                value={field.value || 'none'}
                onChange={(value) => {
                  field.onChange(value);
                  updateConfig('user', { customNameSuffix: value });
                }}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'random_digits', label: 'Random digits (2-4)' },
                  { value: 'sequential', label: 'Sequential (caller provides index)' },
                ]}
                style={{ width: 260 }}
              />
            )}
          </RHFFormItem>
        </>
      )}

      <RHFFormItem<AccountSectionFormValues, 'user.displayName'>
        control={control}
        name="user.displayName"
        label="Display name (optional)"
      >
        {({ field }) => (
          <Input
            value={field.value || ''}
            onChange={(e) => {
              const nextValue = e.target.value;
              field.onChange(nextValue);
              updateConfig('user', { displayName: nextValue });
            }}
            placeholder="Defaults to generated username"
          />
        )}
      </RHFFormItem>

      <RHFFormItem<AccountSectionFormValues, 'user.password'>
        control={control}
        name="user.password"
        label="Password"
      >
        {({ field }) => (
          <Input.Password
            value={field.value}
            onChange={(e) => {
              const nextValue = e.target.value;
              field.onChange(nextValue);
              updateConfig('user', { password: nextValue });
            }}
          />
        )}
      </RHFFormItem>

      <RHFFormItem<AccountSectionFormValues, 'user.group'>
        control={control}
        name="user.group"
        label="Group"
      >
        {({ field }) => (
          <Radio.Group
            value={field.value}
            onChange={(e) => {
              const nextValue = e.target.value;
              field.onChange(nextValue);
              updateConfig('user', { group: nextValue });
            }}
          >
            <Radio value="Administrators">Administrators</Radio>
            <Radio value="Users">Users</Radio>
          </Radio.Group>
        )}
      </RHFFormItem>

      <RHFFormItem<AccountSectionFormValues, 'user.autoLogonCount'>
        control={control}
        name="user.autoLogonCount"
        label="Auto-logon count"
      >
        {({ field }) => (
          <div>
            <InputNumber
              value={field.value}
              onChange={(value) => {
                const nextValue = value ?? 9_999_999;
                field.onChange(nextValue);
                updateConfig('user', { autoLogonCount: nextValue });
              }}
              min={0}
              max={99_999_999}
              style={{ width: 200 }}
            />
            <Text type="secondary" style={{ marginLeft: 8 }}>
              Set high (9999999) for permanent auto-login
            </Text>
          </div>
        )}
      </RHFFormItem>

      <RHFFormItem<AccountSectionFormValues, 'computerName.mode'>
        control={control}
        name="computerName.mode"
        label="Computer name mode"
      >
        {({ field }) => (
          <Radio.Group
            value={field.value}
            onChange={(e) => {
              const nextValue = e.target.value;
              field.onChange(nextValue);
              updateConfig('computerName', { mode: nextValue });
            }}
          >
            <Radio value="random">Random (DESKTOP-XXXXXXX)</Radio>
            <Radio value="fixed">Fixed (WIN-PC)</Radio>
            <Radio value="custom">Custom</Radio>
          </Radio.Group>
        )}
      </RHFFormItem>

      {computerNameMode === 'custom' && (
        <RHFFormItem<AccountSectionFormValues, 'computerName.customName'>
          control={control}
          name="computerName.customName"
          label="Custom name (max 15 chars)"
        >
          {({ field }) => (
            <Input
              maxLength={15}
              value={field.value || ''}
              onChange={(e) => {
                const nextValue = e.target.value;
                field.onChange(nextValue);
                updateConfig('computerName', { customName: nextValue });
              }}
            />
          )}
        </RHFFormItem>
      )}
    </Form>
  );
};
