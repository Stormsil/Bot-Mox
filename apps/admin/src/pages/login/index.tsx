import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';
import { Button, Card, Form, Input, message, Space, Typography } from 'antd';
import type React from 'react';
import styles from './LoginPage.module.css';

interface LoginFormValues {
  email: string;
  password: string;
  mode?: 'signin' | 'signup';
}

export const LoginPage: React.FC = () => {
  const { mutate: login, isPending } = useLogin<LoginFormValues>();

  const handleFinish = (values: LoginFormValues) => {
    login(
      { ...values, mode: 'signin' },
      {
        onError: (error: unknown) => {
          const text = error instanceof Error ? error.message : 'Login failed';
          message.error(text);
        },
      },
    );
  };

  return (
    <div className={styles.root}>
      <Card
        className={styles.card}
        title={
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Bot-Mox Admin Login
            </Typography.Title>
            <Typography.Text type="secondary">Sign in with your admin account.</Typography.Text>
          </Space>
        }
      >
        <Form<LoginFormValues>
          layout="vertical"
          requiredMark={false}
          onFinish={handleFinish}
          initialValues={{ email: '', password: '' }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Email is required' }]}
          >
            <Input prefix={<MailOutlined />} autoComplete="username" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={isPending} block>
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
};
