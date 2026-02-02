import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  message,
  Alert,
  Spin,
  Row,
  Col,
  Tooltip,
  Badge,
  Modal,
  Checkbox,
  InputNumber,
  Select,
  DatePicker,
} from 'antd';
import {
  SaveOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { ref, onValue, off, update } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { AccountData } from '../../types';
import {
  generatePassword,
  generateEmail,
  isPersonDataComplete,
  popularEmailDomains,
  saveBackup,
  loadBackup,
  hasBackup as checkHasBackup,
  type PasswordOptions,
} from '../../utils/accountGenerators';
import './BotAccount.css';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

// Extended Bot interface with account and person fields
interface BotWithAccount {
  id: string;
  name: string;
  account?: {
    email?: string;
    password?: string;
    bnet_created_at?: number;
    mail_created_at?: number;
  };
  person?: {
    first_name?: string;
    last_name?: string;
    birth_date?: string;
  };
}

interface BotAccountProps {
  bot: BotWithAccount;
}

// Check if account data is complete
const isAccountDataComplete = (account?: BotWithAccount['account']): boolean => {
  if (!account) return false;
  return !!(
    account.email?.trim() &&
    account.password?.trim()
  );
};

export const BotAccount: React.FC<BotAccountProps> = ({ bot }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasBackup, setHasBackup] = useState(false);
  const [formValues, setFormValues] = useState({
    email: '',
    password: '',
    registration_date: null as dayjs.Dayjs | null,
  });

  // Password generator options
  const [passwordOptions, setPasswordOptions] = useState<PasswordOptions>({
    length: 12,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });

  // Email domain selector
  const [selectedDomain, setSelectedDomain] = useState<string>('gmail.com');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<{
    type: 'password' | 'email' | 'both';
  } | null>(null);

  // Load account data from Firebase
  useEffect(() => {
    if (!bot?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const accountRef = ref(database, `bots/${bot.id}/account`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      console.log('BotAccount - Firebase data:', data);

      if (data) {
        const email = data.email || '';
        const password = data.password || '';
        const registrationDate = data.bnet_created_at || data.mail_created_at || 0;

        const newValues = {
          email,
          password,
          registration_date: registrationDate ? dayjs(registrationDate) : null,
        };

        setFormValues({
          email,
          password,
          registration_date: registrationDate ? dayjs(registrationDate) : null,
        });

        form.setFieldsValue(newValues);
      } else {
        // No account data in Firebase - reset form
        setFormValues({ email: '', password: '', registration_date: null });
        form.resetFields();
      }

      // Check for backup
      setHasBackup(checkHasBackup(bot.id));
      setLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Error loading account data:', err);
      message.error('Failed to load account data');
      setLoading(false);
    };

    onValue(accountRef, handleValue, handleError);

    return () => {
      off(accountRef, 'value', handleValue);
    };
  }, [bot?.id, form]);

  // Track form value changes
  const handleValuesChange = (changedValues: any, allValues: any) => {
    setFormValues({
      email: allValues.email || '',
      password: allValues.password || '',
      registration_date: allValues.registration_date || null,
    });
  };

  // Save account data to Firebase
  const handleSave = async (values: any) => {
    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    setSaving(true);
    try {
      const accountRef = ref(database, `bots/${bot.id}/account`);
      const accountData = {
        email: values.email || '',
        password: values.password || '',
        bnet_created_at: values.registration_date
          ? values.registration_date.valueOf()
          : 0,
      };

      console.log('Saving account data:', accountData);
      await update(accountRef, accountData);

      message.success('Account data saved successfully');
    } catch (error) {
      console.error('Error saving account data:', error);
      message.error(
        'Failed to save account data: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setSaving(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} copied to clipboard`);
  };

  // Request generation with confirmation
  const requestGeneration = (type: 'password' | 'email' | 'both') => {
    // Save current values to backup before generating
    const currentValues = form.getFieldsValue();
    if (bot?.id) {
      saveBackup(bot.id, {
        email: currentValues.email || '',
        password: currentValues.password || '',
        registration_date: currentValues.registration_date
          ? currentValues.registration_date.valueOf()
          : 0,
      });
      setHasBackup(true);
    }

    setPendingGeneration({ type });
    setShowGenerateModal(true);
  };

  // Confirm generation
  const confirmGeneration = () => {
    if (!pendingGeneration) return;

    const { type } = pendingGeneration;

    if (type === 'password' || type === 'both') {
      const newPassword = generatePassword(passwordOptions);
      form.setFieldValue('password', newPassword);
      setFormValues(prev => ({ ...prev, password: newPassword }));
    }

    if (type === 'email' || type === 'both') {
      if (!isPersonDataComplete(bot.person)) {
        message.error(
          'Person data must be filled first (First Name, Last Name, Birth Date)'
        );
        setShowGenerateModal(false);
        setPendingGeneration(null);
        return;
      }

      const domain = useCustomDomain ? customDomain : selectedDomain;
      if (!domain) {
        message.error('Please select or enter a domain');
        return;
      }

      const newEmail = generateEmail({
        firstName: bot.person!.first_name!,
        lastName: bot.person!.last_name!,
        birthDate: bot.person!.birth_date!,
        domain,
      });
      form.setFieldValue('email', newEmail);
      setFormValues(prev => ({ ...prev, email: newEmail }));
    }

    message.success('Generated successfully');
    setShowGenerateModal(false);
    setPendingGeneration(null);
  };

  // Restore from backup
  const handleRestore = () => {
    if (!bot?.id) return;

    const backup = loadBackup(bot.id);
    if (backup) {
      const restoredValues = {
        email: backup.email,
        password: backup.password,
        registration_date: backup.registration_date
          ? dayjs(backup.registration_date)
          : null,
      };
      form.setFieldsValue(restoredValues);
      setFormValues(restoredValues);
      message.success('Previous values restored from backup');
    } else {
      message.warning('No backup found');
    }
  };

  // Set current date/time
  const setCurrentDateTime = () => {
    const now = dayjs();
    form.setFieldValue('registration_date', now);
    setFormValues(prev => ({ ...prev, registration_date: now }));
  };

  // Check if account data is complete (from form values, not just bot.account)
  const hasIncompleteData = !(
    formValues.email?.trim() &&
    formValues.password?.trim()
  );

  // Get field warning icon
  const getFieldWarning = (fieldName: 'email' | 'password' | 'registration_date') => {
    let isEmpty = false;
    if (fieldName === 'email') {
      isEmpty = !formValues.email?.trim();
    } else if (fieldName === 'password') {
      isEmpty = !formValues.password?.trim();
    } else if (fieldName === 'registration_date') {
      isEmpty = !formValues.registration_date;
    }
    return isEmpty ? <ExclamationCircleOutlined className="field-warning-icon" /> : null;
  };

  if (!bot) {
    return (
      <div className="bot-account">
        <Alert
          message="Error"
          description="Bot data is not available"
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bot-account">
        <Card title="Account Information" className="account-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <p style={{ marginTop: '16px', color: 'var(--proxmox-text-secondary)' }}>
              Loading account data...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-account">
      <Card
        title={
          <div className="account-card-header">
            <span>Account Information</span>
            {hasIncompleteData && (
              <Tooltip title="Some fields are empty. Please fill in all account data.">
                <Badge dot color="orange" className="incomplete-badge">
                  <ExclamationCircleOutlined className="warning-icon" />
                </Badge>
              </Tooltip>
            )}
          </div>
        }
        className="account-card"
      >
        {hasIncompleteData && (
          <Alert
            message="Incomplete Account Data"
            description="Some fields are empty. Please fill in all account data or use the Generate buttons."
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onValuesChange={handleValuesChange}
          className="account-form"
          autoComplete="off"
        >
          {/* Email Field */}
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                label={
                  <span className="field-label">
                    Email
                    {getFieldWarning('email')}
                  </span>
                }
                name="email"
              >
                <Input
                  placeholder="Enter email address"
                  autoComplete="off"
                  suffix={
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() =>
                        copyToClipboard(formValues.email || '', 'Email')
                      }
                    />
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Email Domain">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {!useCustomDomain ? (
                    <Select
                      value={selectedDomain}
                      onChange={setSelectedDomain}
                      style={{ width: '100%' }}
                    >
                      {popularEmailDomains.map((domain) => (
                        <Option key={domain} value={domain}>
                          {domain}
                        </Option>
                      ))}
                      <Option value="custom">Custom...</Option>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter custom domain"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          onClick={() => setUseCustomDomain(false)}
                        >
                          Back
                        </Button>
                      }
                    />
                  )}
                  {selectedDomain === 'custom' && !useCustomDomain && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setUseCustomDomain(true)}
                    >
                      Enter custom domain
                    </Button>
                  )}
                </Space>
              </Form.Item>
            </Col>
          </Row>

          {/* Password Field */}
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                label={
                  <span className="field-label">
                    Password
                    {getFieldWarning('password')}
                  </span>
                }
                name="password"
              >
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  autoComplete="off"
                  suffix={
                    <Space>
                      <Button
                        type="text"
                        size="small"
                        icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setShowPassword(!showPassword)}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copyToClipboard(formValues.password || '', 'Password')
                        }
                      />
                    </Space>
                  }
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Password Generator Options */}
          <Card
            title="Password Generator Options"
            size="small"
            className="generator-options-card"
          >
            <Row gutter={16} align="middle">
              <Col>
                <Form.Item label="Length" style={{ marginBottom: 0 }}>
                  <InputNumber
                    min={8}
                    max={32}
                    value={passwordOptions.length}
                    onChange={(value) =>
                      setPasswordOptions((prev) => ({
                        ...prev,
                        length: value || 12,
                      }))
                    }
                  />
                </Form.Item>
              </Col>
              <Col>
                <Checkbox
                  checked={passwordOptions.uppercase}
                  onChange={(e) =>
                    setPasswordOptions((prev) => ({
                      ...prev,
                      uppercase: e.target.checked,
                    }))
                  }
                >
                  A-Z
                </Checkbox>
              </Col>
              <Col>
                <Checkbox
                  checked={passwordOptions.lowercase}
                  onChange={(e) =>
                    setPasswordOptions((prev) => ({
                      ...prev,
                      lowercase: e.target.checked,
                    }))
                  }
                >
                  a-z
                </Checkbox>
              </Col>
              <Col>
                <Checkbox
                  checked={passwordOptions.numbers}
                  onChange={(e) =>
                    setPasswordOptions((prev) => ({
                      ...prev,
                      numbers: e.target.checked,
                    }))
                  }
                >
                  0-9
                </Checkbox>
              </Col>
              <Col>
                <Checkbox
                  checked={passwordOptions.symbols}
                  onChange={(e) =>
                    setPasswordOptions((prev) => ({
                      ...prev,
                      symbols: e.target.checked,
                    }))
                  }
                >
                  !@#$%
                </Checkbox>
              </Col>
            </Row>
          </Card>

          {/* Registration Date */}
          <Form.Item
            label={
              <span className="field-label">
                Registration Date
                {getFieldWarning('registration_date')}
              </span>
            }
          >
            <Row gutter={16} align="middle">
              <Col xs={24} md={16}>
                <Form.Item
                  name="registration_date"
                  style={{ marginBottom: 0 }}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder="Select registration date"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Button onClick={setCurrentDateTime} type="default" style={{ width: '100%' }}>
                  Set Current Date/Time
                </Button>
              </Col>
            </Row>
          </Form.Item>

          {/* Action Buttons */}
          <div className="account-form-actions">
            <div className="generate-section">
              <span className="generate-label">Generate:</span>
              <Button
                type="default"
                icon={<ThunderboltOutlined />}
                onClick={() => requestGeneration('password')}
                className="generate-btn"
              >
                Password
              </Button>
              <Button
                type="default"
                icon={<ThunderboltOutlined />}
                onClick={() => requestGeneration('email')}
                className="generate-btn"
                disabled={!isPersonDataComplete(bot.person)}
              >
                Email
              </Button>
              <Button
                type="default"
                icon={<ThunderboltOutlined />}
                onClick={() => requestGeneration('both')}
                className="generate-btn"
                disabled={!isPersonDataComplete(bot.person)}
              >
                Both
              </Button>
              {!isPersonDataComplete(bot.person) && (
                <Tooltip title="Fill Person data first to generate email">
                  <ExclamationCircleOutlined className="field-warning-icon" />
                </Tooltip>
              )}
            </div>

            <div className="action-buttons">
              {hasBackup && (
                <Button
                  type="default"
                  icon={<UndoOutlined />}
                  onClick={handleRestore}
                  className="restore-btn"
                  style={{ marginRight: '8px' }}
                >
                  Restore Previous
                </Button>
              )}
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                className="save-btn"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Form>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        title="Confirm Generation"
        open={showGenerateModal}
        onOk={confirmGeneration}
        onCancel={() => {
          setShowGenerateModal(false);
          setPendingGeneration(null);
        }}
        okText="Generate"
        cancelText="Cancel"
      >
        <Alert
          message="Warning"
          description="Current email and password will be replaced. Previous values have been saved and can be restored."
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        <p>
          You are about to generate:{' '}
          <strong>
            {pendingGeneration?.type === 'both'
              ? 'Password and Email'
              : pendingGeneration?.type === 'password'
              ? 'Password'
              : 'Email'}
          </strong>
        </p>
        {pendingGeneration?.type !== 'password' && !isPersonDataComplete(bot.person) && (
          <Alert
            message="Person data required"
            description="Please fill in Person data (First Name, Last Name, Birth Date) before generating email."
            type="error"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
};
