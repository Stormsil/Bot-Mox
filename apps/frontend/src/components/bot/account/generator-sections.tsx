import {
  CheckOutlined,
  DeleteOutlined,
  DownOutlined,
  RightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
} from 'antd';
import type { PasswordOptions } from '../../../utils/accountGenerators';
import { TableActionButton } from '../../ui/TableActionButton';
import styles from './account.module.css';
import { ActionButtonsSection } from './action-buttons-section';
import type { AccountGeneratorTemplate } from './types';

const { Option } = Select;

interface PasswordGeneratorOptionsCardProps {
  accountLocked: boolean;
  passwordOptions: PasswordOptions;
  setPasswordOptions: (updater: (prev: PasswordOptions) => PasswordOptions) => void;
}

export function PasswordGeneratorOptionsCard({
  accountLocked,
  passwordOptions,
  setPasswordOptions,
}: PasswordGeneratorOptionsCardProps) {
  return (
    <Card
      title={
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
          Password Generator Options
        </span>
      }
      size="small"
      className={styles['generator-options-card']}
      style={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
      }}
      headStyle={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
        minHeight: 40,
      }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <Row gutter={16} align="middle">
        <Col>
          <Form.Item label="Length" style={{ marginBottom: 0 }}>
            <InputNumber
              min={8}
              max={32}
              value={passwordOptions.length}
              disabled={accountLocked}
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
            disabled={accountLocked}
            className={styles['generator-option-checkbox']}
            onChange={(event) =>
              setPasswordOptions((prev) => ({
                ...prev,
                uppercase: event.target.checked,
              }))
            }
          >
            A-Z
          </Checkbox>
        </Col>
        <Col>
          <Checkbox
            checked={passwordOptions.lowercase}
            disabled={accountLocked}
            className={styles['generator-option-checkbox']}
            onChange={(event) =>
              setPasswordOptions((prev) => ({
                ...prev,
                lowercase: event.target.checked,
              }))
            }
          >
            a-z
          </Checkbox>
        </Col>
        <Col>
          <Checkbox
            checked={passwordOptions.numbers}
            disabled={accountLocked}
            className={styles['generator-option-checkbox']}
            onChange={(event) =>
              setPasswordOptions((prev) => ({
                ...prev,
                numbers: event.target.checked,
              }))
            }
          >
            0-9
          </Checkbox>
        </Col>
        <Col>
          <Checkbox
            checked={passwordOptions.symbols}
            disabled={accountLocked}
            className={styles['generator-option-checkbox']}
            onChange={(event) =>
              setPasswordOptions((prev) => ({
                ...prev,
                symbols: event.target.checked,
              }))
            }
          >
            !@#$%
          </Checkbox>
        </Col>
      </Row>
    </Card>
  );
}

interface GeneratorPresetsCardProps {
  presetsCollapsed: boolean;
  setPresetsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  selectedTemplateId: string;
  templates: AccountGeneratorTemplate[];
  defaultTemplateId: string | null;
  templateName: string;
  setTemplateName: (value: string) => void;
  handleTemplateSelect: (value: string) => void;
  handleSetDefaultTemplate: () => void;
  handleDeleteTemplate: () => void;
  handleSaveTemplate: () => void;
}

export function GeneratorPresetsCard({
  presetsCollapsed,
  setPresetsCollapsed,
  selectedTemplateId,
  templates,
  defaultTemplateId,
  templateName,
  setTemplateName,
  handleTemplateSelect,
  handleSetDefaultTemplate,
  handleDeleteTemplate,
  handleSaveTemplate,
}: GeneratorPresetsCardProps) {
  return (
    <Card
      title={<span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>Generator Presets</span>}
      size="small"
      className={styles['generator-presets-card']}
      style={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
      }}
      headStyle={{
        background: 'var(--boxmox-color-surface-muted)',
        borderColor: 'var(--boxmox-color-border-default)',
        minHeight: 40,
      }}
      bodyStyle={{ padding: '12px 16px' }}
      extra={
        <Button
          type="text"
          size="small"
          style={{ color: 'var(--boxmox-color-text-secondary)', paddingInline: 4 }}
          icon={presetsCollapsed ? <RightOutlined /> : <DownOutlined />}
          onClick={() => setPresetsCollapsed((prev) => !prev)}
        >
          {presetsCollapsed ? 'Show' : 'Hide'}
        </Button>
      }
    >
      {!presetsCollapsed && (
        <>
          <div className={styles['generator-presets-row']}>
            <Select
              value={selectedTemplateId}
              onChange={handleTemplateSelect}
              className={styles['generator-template-select']}
            >
              <Option value="last">Last Used</Option>
              {templates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                  {template.id === defaultTemplateId ? ' (Default)' : ''}
                </Option>
              ))}
            </Select>
            <Button
              type="default"
              icon={<CheckOutlined />}
              onClick={handleSetDefaultTemplate}
              disabled={selectedTemplateId === 'last'}
            >
              Set Default
            </Button>
            <TableActionButton
              buttonType="default"
              buttonSize="middle"
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteTemplate}
              disabled={selectedTemplateId === 'last'}
            >
              Delete
            </TableActionButton>
          </div>
          <div className={styles['generator-presets-row']}>
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className={styles['generator-template-name']}
            />
            <Button type="default" icon={<SaveOutlined />} onClick={handleSaveTemplate}>
              Save Template
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

interface RegistrationDateSectionProps {
  accountLocked: boolean;
  registrationDateWarning: React.ReactNode;
  setCurrentDateTime: () => void;
}

export function RegistrationDateSection({
  accountLocked,
  registrationDateWarning,
  setCurrentDateTime,
}: RegistrationDateSectionProps) {
  return (
    <Form.Item
      label={
        <span className={styles['field-label']}>
          Registration Date
          {registrationDateWarning}
        </span>
      }
    >
      <Row gutter={16} align="middle">
        <Col xs={24} md={16}>
          <Form.Item name="registration_date" style={{ marginBottom: 0 }}>
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="Select registration date"
              disabled={accountLocked}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Button
            onClick={setCurrentDateTime}
            type="default"
            style={{ width: '100%' }}
            disabled={accountLocked}
          >
            Set Current Date/Time
          </Button>
        </Col>
      </Row>
    </Form.Item>
  );
}

export { ActionButtonsSection };
