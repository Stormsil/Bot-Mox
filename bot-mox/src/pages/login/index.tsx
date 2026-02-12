import React from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';
import './LoginPage.css';

interface LoginFormValues {
  email: string;
  password: string;
}

export const LoginPage: React.FC = () => {
  const { mutate: login, isPending } = useLogin<LoginFormValues>();

  const handleFinish = (values: LoginFormValues) => {
    login(values, {
      onError: (error: unknown) => {
        const text = error instanceof Error ? error.message : 'Login failed';
        message.error(text);
      },
    });
  };

  return (
    <div className="login-page">
      <Card className="login-card" title={<Typography.Title level={4}>Bot-Mox Login</Typography.Title>}>
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
