import React from 'react';
import {
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
import { Alert, Button, Col, Form, Input, Row, Select, Space, Tooltip, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { CharacterFormData, ReferenceData } from './types';

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
}) => (
  <>
    {!isCharacterComplete && (
      <Alert
        className="config-incomplete-alert"
        message="Incomplete Character Data"
        description="Some fields are empty. Fill all character fields before saving."
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{ marginBottom: '12px' }}
      />
    )}
    <Alert
      className="character-workflow-alert"
      type={nameLocked ? 'info' : 'success'}
      showIcon
      message={
        <span className="character-workflow-message">
          {nameLocked ? 'Character name is locked' : 'Ready to configure'}
          <Tooltip
            title={
              nameLocked
                ? 'Unlock -> edit/generate name -> Save to lock again.'
                : 'Set name and character fields -> Save to lock name.'
            }
          >
            <QuestionCircleOutlined className="character-workflow-help-icon" />
          </Tooltip>
        </span>
      }
      style={{ marginBottom: '16px' }}
    />

    <Form
      form={form}
      layout="vertical"
      onFinish={onSave}
      onValuesChange={onValuesChange}
      initialValues={formData}
      className="character-form"
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="name"
            label={
              <span className="field-label">
                <UserOutlined /> Character Name
              </span>
            }
          >
            <Input
              placeholder="Enter character name"
              maxLength={24}
              disabled={nameLocked}
              addonAfter={
                <Space size={4} className="character-name-actions">
                  <Tooltip title={nameLocked ? 'Generation locked' : 'Generate random name'}>
                    <Button
                      type="text"
                      icon={nameLocked ? <LockOutlined /> : <ThunderboltOutlined />}
                      onClick={() => void onGenerateName()}
                      loading={nameGenerating}
                      disabled={nameLocked}
                      className="character-generate-btn"
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
                        className="character-unlock-btn"
                      >
                        Unlock
                      </Button>
                    </Tooltip>
                  )}
                </Space>
              }
            />
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item
            label={
              <span className="field-label">
                <TrophyOutlined /> Level
              </span>
            }
          >
            <div className="level-display">
              <span className="level-badge">{formData.level}</span>
              <span className="level-hint">Auto-updated from game</span>
            </div>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="server"
            label={
              <span className="field-label">
                <DatabaseOutlined /> Server
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

        <Col span={12}>
          <Form.Item
            name="faction"
            label={
              <span className="field-label">
                <FlagOutlined /> Faction
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
        <Col span={12}>
          <Form.Item
            name="race"
            label={
              <span className="field-label">
                <TeamOutlined /> Race
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

        <Col span={12}>
          <Form.Item
            name="class"
            label={
              <span className="field-label">
                <CrownOutlined /> Class
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

      <Form.Item className="form-actions">
        <Space>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={!hasChanges}>
            Save
          </Button>
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </Space>
        {hasChanges && (
          <Text type="warning" className="unsaved-changes-text">
            Unsaved changes
          </Text>
        )}
      </Form.Item>
    </Form>
  </>
);
