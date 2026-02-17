import React from 'react';
import { Button, Col, Form, Input, Row, Select } from 'antd';
import { ExclamationCircleOutlined, LockOutlined, SaveOutlined, ThunderboltOutlined, UnlockOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { PersonFormValues } from './types';
import styles from './person.module.css';

interface PersonFormFieldsProps {
  form: FormInstance<PersonFormValues>;
  selectedCountry: string;
  availableCountries: string[];
  manualEditLocked: boolean;
  generationLocked: boolean;
  pendingLock: boolean;
  saving: boolean;
  onSelectedCountryChange: (country: string) => void;
  onGenerateData: () => void;
  onUnlockGeneration: () => void;
}

interface FieldLabelProps {
  form: FormInstance<PersonFormValues>;
  field: keyof PersonFormValues;
  label: string;
}

const FieldLabel: React.FC<FieldLabelProps> = ({ form, field, label }) => (
  <span className={styles['field-label']}>
    {label}
    {!form.getFieldValue(field) && <ExclamationCircleOutlined className={styles['field-warning-icon']} />}
  </span>
);

export const PersonFormFields: React.FC<PersonFormFieldsProps> = ({
  form,
  selectedCountry,
  availableCountries,
  manualEditLocked,
  generationLocked,
  pendingLock,
  saving,
  onSelectedCountryChange,
  onGenerateData,
  onUnlockGeneration,
}) => (
  <>
    <Row gutter={16}>
      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="first_name" label="First Name" />} name="first_name">
          <Input placeholder="Enter first name" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="last_name" label="Last Name" />} name="last_name">
          <Input placeholder="Enter last name" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="birth_date" label="Birth Date" />} name="birth_date">
          <Input placeholder="DD-MM-YYYY" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="country" label="Country" />} name="country">
          <Select
            placeholder="Select country"
            onChange={onSelectedCountryChange}
            options={availableCountries.map((country) => ({ value: country, label: country }))}
            disabled={manualEditLocked}
          />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="city" label="City" />} name="city">
          <Input placeholder="Enter city" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>

      <Col xs={24} sm={12} md={8}>
        <Form.Item label={<FieldLabel form={form} field="zip" label="ZIP Code" />} name="zip">
          <Input placeholder="Enter ZIP code" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col xs={24} md={16}>
        <Form.Item label={<FieldLabel form={form} field="address" label="Address" />} name="address">
          <Input placeholder="Enter full address (street, house number)" autoComplete="off" disabled={manualEditLocked} />
        </Form.Item>
      </Col>
    </Row>

    <div className={styles['person-form-actions']}>
      <div className={styles['generate-section']}>
        <span className={styles['generate-label']}>Generate random data for:</span>
        <Select
          value={selectedCountry}
          onChange={onSelectedCountryChange}
          className={styles['country-select']}
          style={{ width: 120 }}
          options={availableCountries.map((country) => ({ value: country, label: country }))}
          disabled={manualEditLocked}
        />
        <Button
          type="default"
          icon={generationLocked ? <LockOutlined /> : <ThunderboltOutlined />}
          onClick={onGenerateData}
          className={styles['generate-btn']}
          disabled={generationLocked}
        >
          {generationLocked ? 'Locked' : 'Generate Data'}
        </Button>
        {(generationLocked || pendingLock) && (
          <Button
            type="default"
            icon={<UnlockOutlined />}
            onClick={onUnlockGeneration}
            className={styles['unlock-btn']}
          >
            Unlock
          </Button>
        )}
      </div>

      <Button
        type="primary"
        htmlType="submit"
        icon={<SaveOutlined />}
        loading={saving}
        className={styles['save-btn']}
        disabled={manualEditLocked}
      >
        Save Changes
      </Button>
    </div>
  </>
);
