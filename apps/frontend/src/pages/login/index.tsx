import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';
import { message } from 'antd';
import type React from 'react';
import { useState } from 'react';
import {
  AppAlert as Alert,
  AppButton as Button,
  AppCard as Card,
  AppForm as Form,
  AppInput as Input,
  AppSegmented as Segmented,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../shared/ui';
import styles from './LoginPage.module.css';

interface LoginFormValues {
  email: string;
  password: string;
  confirm_password?: string;
  mode?: 'signin' | 'signup';
}

const passwordRules = [
  { min: 8, message: 'Minimum 8 characters' },
  { pattern: /[a-z]/, message: 'At least one lowercase letter' },
  { pattern: /[A-Z]/, message: 'At least one uppercase letter' },
  { pattern: /[0-9]/, message: 'At least one digit' },
];

function isValidAuthEmail(value: string): boolean {
  const email = String(value || '').trim();
  if (!email) return false;
  // Allow local prod-like account format (admin@localhost) and normal domains.
  return /^[^\s@]+@localhost$/i.test(email) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseAuthErrorMessage(error: unknown, mode: 'signin' | 'signup'): string {
  const fallback = mode === 'signup' ? 'Unable to create account' : 'Invalid email or password';
  const raw = error instanceof Error ? error.message : '';
  const normalized = String(raw || '')
    .trim()
    .toUpperCase();

  if (!normalized) return fallback;
  if (normalized.includes('AUTH_SIGNUP_INVALID_BODY')) {
    return 'Registration data is invalid. Check email and password requirements.';
  }
  if (normalized.includes('AUTH_SIGNIN_INVALID_BODY')) {
    return 'Sign-in data is invalid. Check email and password.';
  }
  if (normalized.includes('AUTH_RATE_LIMITED')) {
    return 'Too many attempts. Please wait and try again.';
  }
  if (normalized.includes('EMAIL_ALREADY_EXISTS') || normalized.includes('USER_ALREADY_EXISTS')) {
    return 'Account with this email already exists.';
  }
  if (normalized.includes('INVALID_CREDENTIALS')) {
    return 'Invalid email or password.';
  }
  return raw || fallback;
}

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [form] = Form.useForm<LoginFormValues>();
  const { mutate: login, isPending } = useLogin<LoginFormValues>();

  const handleFinish = (values: LoginFormValues) => {
    const payload: LoginFormValues = {
      email: values.email,
      password: values.password,
      mode,
    };
    login(payload, {
      onSuccess: () => {
        if (mode === 'signup') {
          message.success('Account created. Trial is active for 24 hours.');
        }
      },
      onError: (error: unknown) => {
        const text = parseAuthErrorMessage(error, mode);
        message.error(text);
      },
    });
  };

  return (
    <div className={styles.root}>
      <Card
        className={styles.card}
        title={
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Bot-Mox Access
            </Typography.Title>
            <Segmented
              block
              value={mode}
              onChange={(value) => {
                setMode(value as 'signin' | 'signup');
                form.setFieldValue('confirm_password', '');
              }}
              options={[
                { label: 'Sign in', value: 'signin' },
                { label: 'Create account', value: 'signup' },
              ]}
            />
          </Space>
        }
      >
        <Form<LoginFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleFinish}
          initialValues={{ email: '', password: '', confirm_password: '' }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              {
                validator: (_, value: string) =>
                  !value || isValidAuthEmail(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Enter a valid email')),
              },
            ]}
          >
            <Input prefix={<MailOutlined />} autoComplete="username" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: 'Password is required' },
              ...(mode === 'signup' ? passwordRules : []),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </Form.Item>

          {mode === 'signup' ? (
            <Form.Item
              label="Confirm password"
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>
          ) : null}

          {mode === 'signup' ? (
            <Alert
              className={styles.policy}
              type="info"
              showIcon
              message="Trial policy"
              description="One account gets one-time 24h trial. After that, write actions require premium access."
            />
          ) : null}

          <Button type="primary" htmlType="submit" loading={isPending} block>
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>

          {mode === 'signup' ? (
            <Typography.Paragraph className={styles.hint}>
              Password must include uppercase, lowercase, and digit.
            </Typography.Paragraph>
          ) : null}

          {mode === 'signin' ? (
            <Typography.Paragraph className={styles.hint}>
              Sign in with your Bot-Mox account to continue.
            </Typography.Paragraph>
          ) : null}
        </Form>
      </Card>
    </div>
  );
};
