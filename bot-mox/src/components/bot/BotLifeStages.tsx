import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  GoldOutlined,
  LoadingOutlined,
  RiseOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { banBot, unbanBot } from '../../services/botLifecycleService';
import { subscribeBotById } from '../../services/botsApiService';
import type { BanDetails, Bot } from '../../types';
import { formatDate, getStageColor, getStageIcon, getStageLabel } from './lifeStages/config';
import type { LifeStage } from './lifeStages/config';
import { StagePanels } from './lifeStages/StagePanels';
import { StageTimeline } from './lifeStages/StageTimeline';
import styles from './lifeStages/lifeStages.module.css';

const { Title } = Typography;
const { Option } = Select;

interface BotLifeStagesProps {
  bot: Bot;
  botId: string;
}

const STATUS_TO_STAGE_MAP: Record<string, LifeStage | 'banned'> = {
  prepare: 'prepare',
  leveling: 'leveling',
  profession: 'professions',
  professions: 'professions',
  farming: 'farm',
  farm: 'farm',
  banned: 'banned',
};

export type { LifeStage };

export const BotLifeStages: React.FC<BotLifeStagesProps> = ({ botId }) => {
  const [currentStage, setCurrentStage] = useState<LifeStage>('prepare');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderTimestamp] = useState(() => Date.now());
  const [isBanModalVisible, setIsBanModalVisible] = useState(false);
  const [banFormData, setBanFormData] = useState<BanDetails>({
    ban_date: formatDate(new Date()),
    ban_reason: '',
    ban_mechanism: 'battlenet_account_closure',
  });

  useEffect(() => {
    const unsubscribe = subscribeBotById(
      botId,
      (payload) => {
        const status = typeof payload?.status === 'string' ? payload.status : '';
        if (!status) {
          setLoading(false);
          return;
        }

        const mappedStage = STATUS_TO_STAGE_MAP[status];
        if (mappedStage) {
          setCurrentStage(mappedStage);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error loading bot status:', err);
        setError('Failed to load bot status');
        setLoading(false);
      },
      { intervalMs: 5000 }
    );

    return () => {
      unsubscribe();
    };
  }, [botId]);

  const handleStageChange = (value: LifeStage) => {
    setCurrentStage(value);
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handleBan = async () => {
    if (!banFormData.ban_reason.trim()) {
      message.error('Укажите причину блокировки');
      return;
    }
    try {
      await banBot(botId, banFormData);
      message.success('Бот заблокирован и перемещён в архив');
      setIsBanModalVisible(false);
    } catch (err) {
      message.error('Ошибка при блокировке бота');
      console.error(err);
    }
  };

  const handleUnban = async () => {
    try {
      await unbanBot(botId);
      message.success('Бан снят, бот восстановлен');
    } catch (err) {
      message.error('Ошибка при снятии бана');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className={[styles['bot-life-stages'], styles.loading].join(' ')}>
        <Spin size="large" />
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['bot-life-stages']}>
        <Alert message="Error" description={error} type="error" showIcon />
      </div>
    );
  }

  return (
    <div className={styles['bot-life-stages']}>
      <Card className={styles['stage-selector-card']}>
        <div className={styles['stage-selector-header']}>
          <div className={styles['stage-selector-left']}>
            <Title level={5}>Life Stage</Title>
            <Select
              value={currentStage}
              onChange={handleStageChange}
              className={styles['stage-select']}
              disabled={currentStage === 'banned'}
              style={{
                background: 'var(--boxmox-color-surface-base)',
                color: 'var(--boxmox-color-text-primary)',
              }}
            >
              <Option value="prepare">
                <span className={styles['stage-option']}>
                  <LoadingOutlined style={{ color: getStageColor('prepare') }} />
                  Preparation
                </span>
              </Option>
              <Option value="leveling">
                <span className={styles['stage-option']}>
                  <RiseOutlined style={{ color: getStageColor('leveling') }} />
                  Leveling
                </span>
              </Option>
              <Option value="professions">
                <span className={styles['stage-option']}>
                  <ToolOutlined style={{ color: getStageColor('professions') }} />
                  Professions
                </span>
              </Option>
              <Option value="farm">
                <span className={styles['stage-option']}>
                  <GoldOutlined style={{ color: getStageColor('farm') }} />
                  Farm
                </span>
              </Option>
            </Select>
          </div>
          <div className={styles['stage-indicator']}>
            <Tag
              icon={getStageIcon(currentStage)}
              color={getStageColor(currentStage)}
              className={styles['current-stage-tag']}
            >
              {getStageLabel(currentStage)}
            </Tag>
          </div>
        </div>
      </Card>

      <Row gutter={[16, 16]} className={styles['stages-content-row']}>
        <Col xs={24} xl={18}>
          <StagePanels
            currentStage={currentStage}
            renderTimestamp={renderTimestamp}
            formatDuration={formatDuration}
          />
        </Col>
        <Col xs={24} xl={6}>
          <Card
            className={styles['timeline-card']}
            title="Life Cycle"
            styles={{
              header: {
                background: 'var(--boxmox-color-surface-panel)',
                borderBottom: '1px solid var(--boxmox-color-border-default)',
              },
              title: { color: 'var(--boxmox-color-text-primary)' },
            }}
          >
            <StageTimeline currentStage={currentStage} />
            <Divider />
            <div className={styles['timeline-action']}>
              {currentStage !== 'banned' ? (
                <Button
                  type="primary"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => setIsBanModalVisible(true)}
                  block
                >
                  Подтвердить блокировку
                </Button>
              ) : (
                <Button
                  type="default"
                  icon={<CheckCircleOutlined />}
                  onClick={handleUnban}
                  block
                >
                  Подтвердить снятие бана
                </Button>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title="Подтверждение блокировки"
        open={isBanModalVisible}
        onOk={handleBan}
        onCancel={() => setIsBanModalVisible(false)}
        okText="Заблокировать"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <Form layout="vertical">
          <Form.Item label="Дата блокировки" required>
            <Input
              value={banFormData.ban_date}
              onChange={(e) => setBanFormData({ ...banFormData, ban_date: e.target.value })}
            />
          </Form.Item>

          <Form.Item label="Причина блокировки" required>
            <Input.TextArea
              rows={3}
              value={banFormData.ban_reason}
              onChange={(e) => setBanFormData({ ...banFormData, ban_reason: e.target.value })}
              placeholder="Опишите причину блокировки..."
            />
          </Form.Item>

          <Form.Item label="Мера пресечения" required>
            <Select
              value={banFormData.ban_mechanism}
              onChange={(value) => setBanFormData({ ...banFormData, ban_mechanism: value })}
            >
              <Option value="battlenet_account_closure">
                Закрытие учетной записи BattleNet
              </Option>
              <Option value="battlenet_account_suspension">
                Приостановка учетной записи BattleNet
              </Option>
              <Option value="game_suspension">
                Блокировка в игре
              </Option>
              <Option value="hardware_ban">
                Блокировка железа (HWID)
              </Option>
              <Option value="ip_ban">
                Блокировка IP-адреса
              </Option>
              <Option value="other">
                Другое
              </Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
