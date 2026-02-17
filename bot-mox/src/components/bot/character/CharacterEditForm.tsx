import React from 'react';
import {
  CheckCircleOutlined,
  CrownOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  SaveOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Col, Form, Input, Row, Select, Tooltip, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { CharacterFormData, ReferenceData } from './types';
import styles from './character.module.css';

const { Option } = Select;
const { Text } = Typography;

interface CharacterEditFormProps {
  form: FormInstance<CharacterFormData>;
  formData: CharacterFormData;
  referenceData: ReferenceData;
  refDataLoading: boolean;
  filteredRaces: Array<ReferenceData['races'][string]>;
  availableClasses: Array<ReferenceData['classes'][string]>;
  hasChanges: boolean;
  saving: boolean;
  nameGenerating: boolean;
  nameLocked: boolean;
  pendingNameLock: boolean;
  isCharacterComplete: boolean;
  onValuesChange: (changedValues: Partial<CharacterFormData>, allValues: CharacterFormData) => void;
  onSave: (values: CharacterFormData) => Promise<void>;
  onCancel: () => void;
  onGenerateName: () => Promise<void>;
  onUnlockName: () => Promise<void>;
}

export const CharacterEditForm: React.FC<CharacterEditFormProps> = ({
  form,
  formData,
  referenceData,
  refDataLoading,
  filteredRaces,
  availableClasses,
  hasChanges,
  saving,
  nameGenerating,
  nameLocked,
  pendingNameLock,
  isCharacterComplete,
  onValuesChange,
  onSave,
  onCancel,
  onGenerateName,
  onUnlockName,
}) => {
  const workflowText = nameLocked ? 'Character name is locked' : 'Ready to configure';

  return (
    <>
    {!isCharacterComplete && (
      <Alert
        className={styles['config-incomplete-alert']}
        message={<span className={styles['alert-title']}>Incomplete Character Data</span>}
        description={<span className={styles['alert-description']}>Some fields are empty. Fill all character fields before saving.</span>}
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{
          marginBottom: 12,
          borderColor: 'var(--boxmox-color-brand-warning)',
          background: 'color-mix(in srgb, var(--boxmox-color-brand-warning) 10%, var(--boxmox-color-surface-muted))',
        }}
      />
    )}
    <Alert
      className={styles['character-workflow-alert']}
      type={nameLocked ? 'info' : 'success'}
      showIcon
      icon={
        nameLocked
          ? <LockOutlined style={{ fontSize: 14, color: 'var(--boxmox-color-text-secondary)' }} />
          : <CheckCircleOutlined style={{ fontSize: 14, color: 'var(--boxmox-color-brand-primary)' }} />
      }
      message={
        <span className={styles['character-workflow-message']}>
          <span className={styles['character-workflow-text']}>{workflowText}</span>
          <Tooltip
            title={
              nameLocked
                ? 'Unlock -> edit/generate name -> Save to lock again.'
                : 'Set name and character fields -> Save to lock name.'
            }
          >
            <QuestionCircleOutlined className={styles['character-workflow-help-icon']} />
          </Tooltip>
        </span>
      }
      style={{
        marginBottom: 16,
        padding: '6px 10px',
        borderLeft: `3px solid var(--boxmox-color-brand-primary)`,
      }}
    />

    <Form
      form={form}
      layout="vertical"
      onFinish={onSave}
      onValuesChange={onValuesChange}
      initialValues={formData}
      className={styles['character-form']}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="name"
            label={
              <span className={styles['field-label']}>
                <UserOutlined className={styles['field-label-icon']} /> Character Name
              </span>
            }
          >
            <Input
              placeholder="Enter character name"
              maxLength={24}
              disabled={nameLocked}
              addonAfter={
                <div className={styles['character-name-actions']}>
                  <Tooltip title={nameLocked ? 'Generation locked' : 'Generate random name'}>
                    <Button
                      type="text"
                      icon={nameLocked ? <LockOutlined /> : <ThunderboltOutlined />}
                      onClick={() => void onGenerateName()}
                      loading={nameGenerating}
                      disabled={nameLocked}
                      className={styles['character-generate-btn']}
                      style={{ color: 'var(--boxmox-color-brand-primary)' }}
                    >
                      {nameLocked ? 'Locked' : 'Generate'}
                    </Button>
                  </Tooltip>
                  {(nameLocked || pendingNameLock) && (
                    <Tooltip title="Unlock name generator">
                      <Button
                        type="text"
                        icon={<UnlockOutlined />}
                        onClick={() => void onUnlockName()}
                        className={styles['character-unlock-btn']}
                        style={{ color: 'var(--boxmox-color-brand-warning)' }}
                      >
                        Unlock
                      </Button>
                    </Tooltip>
                  )}
                </div>
              }
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label={
              <span className={styles['field-label']}>
                <TrophyOutlined className={styles['field-label-icon']} /> Level
              </span>
            }
          >
            <div className={styles['level-display']}>
              <span className={styles['level-badge']}>{formData.level}</span>
              <span className={styles['level-hint']}>Auto-updated from game</span>
            </div>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="server"
            label={
              <span className={styles['field-label']}>
                <DatabaseOutlined className={styles['field-label-icon']} /> Server
              </span>
            }
          >
            <Select placeholder="Select server" loading={refDataLoading} showSearch optionFilterProp="children">
              {Object.values(referenceData.servers).map((server) => (
                <Option key={server.id} value={server.id}>
                  {server.name} ({server.region})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="faction"
            label={
              <span className={styles['field-label']}>
                <FlagOutlined className={styles['field-label-icon']} /> Faction
              </span>
            }
          >
            <Select placeholder="Select faction" loading={refDataLoading}>
              {Object.values(referenceData.factions).map((faction) => (
                <Option key={faction.id} value={faction.id}>
                  {faction.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="race"
            label={
              <span className={styles['field-label']}>
                <TeamOutlined className={styles['field-label-icon']} /> Race
              </span>
            }
          >
            <Select
              placeholder={formData.faction ? 'Select race' : 'Select faction first'}
              disabled={!formData.faction || filteredRaces.length === 0}
              loading={refDataLoading}
            >
              {filteredRaces.map((race) => (
                <Option key={race.id} value={race.id}>
                  {race.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            name="class"
            label={
              <span className={styles['field-label']}>
                <CrownOutlined className={styles['field-label-icon']} /> Class
              </span>
            }
          >
            <Select
              placeholder={formData.race ? 'Select class' : 'Select race first'}
              disabled={!formData.race || availableClasses.length === 0}
              loading={refDataLoading}
            >
              {availableClasses.map((classItem) => (
                <Option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item className={styles['form-actions']}>
        <div className={styles['form-actions-row']}>
          <div className={styles['form-actions-buttons']}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={!hasChanges}>
              Save
            </Button>
            <Button onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
          {hasChanges && (
            <Text type="warning" className={styles['unsaved-changes-text']}>
              Unsaved changes
            </Text>
          )}
        </div>
      </Form.Item>
    </Form>
  </>
  );
};
