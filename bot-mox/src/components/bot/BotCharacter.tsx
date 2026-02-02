import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
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
} from 'antd';
import {
  SaveOutlined,
  UserOutlined,
  TrophyOutlined,
  DatabaseOutlined,
  FlagOutlined,
  TeamOutlined,
  CrownOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';

// Race icons mapping (WoW icons from wow.zamimg.com)
const RACE_ICONS: Record<string, string> = {
  // Horde
  orc: 'https://wow.zamimg.com/images/wow/icons/race/orc_male.jpg',
  troll: 'https://wow.zamimg.com/images/wow/icons/race/troll_male.jpg',
  tauren: 'https://wow.zamimg.com/images/wow/icons/race/tauren_male.jpg',
  undead: 'https://wow.zamimg.com/images/wow/icons/race/undead_male.jpg',
  blood_elf: 'https://wow.zamimg.com/images/wow/icons/race/bloodelf_male.jpg',
  // Alliance
  human: 'https://wow.zamimg.com/images/wow/icons/race/human_male.jpg',
  dwarf: 'https://wow.zamimg.com/images/wow/icons/race/dwarf_male.jpg',
  gnome: 'https://wow.zamimg.com/images/wow/icons/race/gnome_male.jpg',
  night_elf: 'https://wow.zamimg.com/images/wow/icons/race/nightelf_male.jpg',
  draenei: 'https://wow.zamimg.com/images/wow/icons/race/draenei_male.jpg',
};
import { ref, onValue, off, update } from 'firebase/database';
import { database } from '../../utils/firebase';
import type { Bot, GameServer, GameRace, GameClass, GameFaction, FactionType } from '../../types';
import './BotCharacter.css';

const { Text } = Typography;
const { Option } = Select;

interface BotCharacterProps {
  bot: Bot;
}

interface CharacterFormData {
  name: string;
  level: number;
  server: string;
  faction: FactionType | '';
  race: string;
  class: string;
}

interface ReferenceData {
  servers: Record<string, GameServer>;
  races: Record<string, GameRace>;
  classes: Record<string, GameClass>;
  factions: Record<string, GameFaction>;
}

const DEFAULT_FORM_DATA: CharacterFormData = {
  name: '',
  level: 1,
  server: '',
  faction: '',
  race: '',
  class: '',
};

export const BotCharacter: React.FC<BotCharacterProps> = ({ bot }) => {
  const [form] = Form.useForm<CharacterFormData>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data from Firebase
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    servers: {},
    races: {},
    classes: {},
    factions: {},
  });
  const [refDataLoading, setRefDataLoading] = useState(true);

  // Form values
  const [formData, setFormData] = useState<CharacterFormData>(DEFAULT_FORM_DATA);

  // Load reference data from Firebase
  useEffect(() => {
    if (!bot?.project_id) {
      setRefDataLoading(false);
      return;
    }

    setRefDataLoading(true);
    const refDataPath = `projects/${bot.project_id}/referenceData`;
    const refDataRef = ref(database, refDataPath);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val() || {};
      setReferenceData({
        servers: data.servers || {},
        races: data.races || {},
        classes: data.classes || {},
        factions: data.factions || {},
      });
      setRefDataLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Error loading reference data:', err);
      setError('Failed to load reference data');
      setRefDataLoading(false);
    };

    onValue(refDataRef, handleValue, handleError);

    return () => {
      off(refDataRef, 'value', handleValue);
    };
  }, [bot?.project_id]);

  // Load character data from Firebase
  useEffect(() => {
    if (!bot?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const characterRef = ref(database, `bots/${bot.id}/character`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      console.log('BotCharacter - Firebase data:', data);

      if (data) {
        const newFormData: CharacterFormData = {
          name: data.name || '',
          level: data.level || 1,
          server: data.server || '',
          faction: (data.faction as FactionType) || '',
          race: data.race || '',
          class: data.class || '',
        };
        setFormData(newFormData);
        form.setFieldsValue(newFormData);
      } else {
        // No character data - use bot.character as fallback
        const fallbackData: CharacterFormData = {
          name: bot.character?.name || '',
          level: bot.character?.level || 1,
          server: bot.character?.server || '',
          faction: bot.character?.faction || '',
          race: bot.character?.race || '',
          class: bot.character?.class || '',
        };
        setFormData(fallbackData);
        form.setFieldsValue(fallbackData);
      }

      setLoading(false);
    };

    const handleError = (err: Error) => {
      console.error('Error loading character data:', err);
      setError('Failed to load character data');
      setLoading(false);
    };

    onValue(characterRef, handleValue, handleError);

    return () => {
      off(characterRef, 'value', handleValue);
    };
  }, [bot?.id, bot?.character, form]);

  // Track form changes
  const handleValuesChange = useCallback((changedValues: any, allValues: CharacterFormData) => {
    setFormData(allValues);
    setHasChanges(true);

    // Handle faction change - reset race and class
    if ('faction' in changedValues) {
      form.setFieldsValue({
        race: '',
        class: '',
      });
    }

    // Handle race change - reset class
    if ('race' in changedValues) {
      form.setFieldsValue({
        class: '',
      });
    }
  }, [form]);

  // Get filtered races based on selected faction
  const filteredRaces = useMemo(() => {
    if (!formData.faction) return [];
    return Object.values(referenceData.races).filter(
      (race) => race.faction === formData.faction
    );
  }, [referenceData.races, formData.faction]);

  // Get available classes based on selected race
  const availableClasses = useMemo(() => {
    if (!formData.race) return [];
    const selectedRace = referenceData.races[formData.race];
    if (!selectedRace?.available_classes) return [];

    return selectedRace.available_classes
      .map((classId) => referenceData.classes[classId])
      .filter(Boolean);
  }, [referenceData.races, referenceData.classes, formData.race]);

  // Save character data to Firebase
  const handleSave = async (values: CharacterFormData) => {
    if (!bot?.id) {
      message.error('Bot ID is not available');
      return;
    }

    setSaving(true);
    try {
      const characterRef = ref(database, `bots/${bot.id}/character`);
      // Get current level from existing data (level is read-only, managed by game)
      const currentLevel = formData.level || 1;
      const characterData = {
        name: values.name,
        level: currentLevel,
        server: values.server,
        faction: values.faction,
        race: values.race,
        class: values.class,
        updated_at: Date.now(),
      };

      console.log('Saving character data:', characterData);
      await update(characterRef, characterData);

      message.success('Character data saved successfully');
      setHasChanges(false);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving character data:', error);
      message.error(
        'Failed to save character data: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    form.setFieldsValue(formData);
    setHasChanges(false);
    setIsEditing(false);
  };

  // Start editing
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Check if character data is complete
  const isCharacterComplete = useMemo(() => {
    return !!(
      formData.name?.trim() &&
      formData.server &&
      formData.faction &&
      formData.race &&
      formData.class
    );
  }, [formData]);

  // Get race icon URL
  const raceIconUrl = useMemo(() => {
    if (!formData.race) return null;
    return referenceData.races[formData.race]?.icon || RACE_ICONS[formData.race];
  }, [formData.race, referenceData.races]);

  // Render view mode
  const renderViewMode = () => (
    <div className="character-view-mode">
      <div className="character-header-section">
        <div className="character-avatar-section">
          {raceIconUrl ? (
            <img
              src={raceIconUrl}
              alt={referenceData.races[formData.race]?.name || formData.race}
              className="character-race-avatar"
            />
          ) : (
            <div className="character-avatar">
              <UserOutlined />
            </div>
          )}
          <div className="character-title">
            <Text className="character-name">{formData.name || 'Unnamed Character'}</Text>
            <Text className="character-subtitle">
              Level {formData.level} {formData.race && referenceData.races[formData.race]?.name} {formData.class && referenceData.classes[formData.class]?.name}
            </Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={handleEdit}
          className="edit-button"
        >
          Edit
        </Button>
      </div>

      <div className="character-stats-grid">
        <div className="stat-item">
          <DatabaseOutlined className="stat-icon" />
          <div className="stat-content">
            <Text className="stat-label">Server</Text>
            <Text className="stat-value">
              {formData.server && referenceData.servers[formData.server]?.name}
            </Text>
          </div>
        </div>

        <div className="stat-item">
          <FlagOutlined className="stat-icon" />
          <div className="stat-content">
            <Text className="stat-label">Faction</Text>
            <Text className="stat-value capitalize">
              {formData.faction && referenceData.factions[formData.faction]?.name}
            </Text>
          </div>
        </div>

        <div className="stat-item">
          <TeamOutlined className="stat-icon" />
          <div className="stat-content">
            <Text className="stat-label">Race</Text>
            <Text className="stat-value">
              {formData.race && referenceData.races[formData.race]?.name}
            </Text>
          </div>
        </div>

        <div className="stat-item">
          <CrownOutlined className="stat-icon" />
          <div className="stat-content">
            <Text className="stat-label">Class</Text>
            <Text className="stat-value">
              {formData.class && referenceData.classes[formData.class]?.name}
            </Text>
          </div>
        </div>

        <div className="stat-item">
          <TrophyOutlined className="stat-icon" />
          <div className="stat-content">
            <Text className="stat-label">Level</Text>
            <Text className="stat-value">{formData.level}</Text>
          </div>
        </div>
      </div>
    </div>
  );

  // Render edit mode form
  const renderEditForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSave}
      onValuesChange={handleValuesChange}
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
            rules={[{ required: true, message: 'Please enter character name' }]}
          >
            <Input placeholder="Enter character name" maxLength={24} />
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
            rules={[{ required: true, message: 'Please select server' }]}
          >
            <Select
              placeholder="Select server"
              loading={refDataLoading}
              showSearch
              optionFilterProp="children"
            >
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
            rules={[{ required: true, message: 'Please select faction' }]}
          >
            <Select
              placeholder="Select faction"
              loading={refDataLoading}
            >
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
            rules={[{ required: true, message: 'Please select race' }]}
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
            rules={[{ required: true, message: 'Please select class' }]}
          >
            <Select
              placeholder={formData.race ? 'Select class' : 'Select race first'}
              disabled={!formData.race || availableClasses.length === 0}
              loading={refDataLoading}
            >
              {availableClasses.map((cls) => (
                <Option key={cls.id} value={cls.id}>
                  {cls.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item className="form-actions">
        <Space>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!hasChanges}
          >
            Save
          </Button>
          <Button onClick={handleCancel} disabled={saving}>
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
  );

  // Loading state
  if (loading || refDataLoading) {
    return (
      <div className="bot-character">
        <Card className="character-card">
          <div className="loading-container">
            <Spin size="large" />
            <Text className="loading-text">Loading character data...</Text>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bot-character">
        <Card className="character-card">
          <Alert
            message="Error"
            description={error}
            type="error"
            showIcon
            action={
              <Button size="small" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="bot-character">
      <Card
        className="character-card"
        title={
          <div className="character-card-header">
            <EyeOutlined className="header-icon" />
            <span>Character Information</span>
            {!isCharacterComplete && (
              <Tooltip title="Character data is incomplete">
                <Badge dot className="incomplete-badge" />
              </Tooltip>
            )}
          </div>
        }
      >
        {isEditing ? renderEditForm() : renderViewMode()}
      </Card>
    </div>
  );
};
