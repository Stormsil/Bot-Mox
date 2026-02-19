import {
  CheckCircleOutlined,
  GoldOutlined,
  LoadingOutlined,
  RiseOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  useBanBotMutation,
  useUnbanBotMutation,
} from '../../entities/bot/api/useBotLifecycleMutations';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import type { BanDetails, Bot } from '../../types';
import type { LifeStage } from './lifeStages/config';
import { formatDate, getStageColor, getStageIcon, getStageLabel } from './lifeStages/config';
import styles from './lifeStages/lifeStages.module.css';
import { StagePanels } from './lifeStages/StagePanels';
import { StageTimeline } from './lifeStages/StageTimeline';

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
  const banBotMutation = useBanBotMutation();
  const unbanBotMutation = useUnbanBotMutation();
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
  const botQuery = useBotByIdQuery(botId);

  useEffect(() => {
    if (botQuery.isLoading && !botQuery.data) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (botQuery.error) {
        console.error('Error loading bot status:', botQuery.error);
        setError('Failed to load bot status');
        setLoading(false);
        return;
      }

      const status = typeof botQuery.data?.status === 'string' ? botQuery.data.status : '';
      if (status) {
        const mappedStage = STATUS_TO_STAGE_MAP[status];
        if (mappedStage) {
          setCurrentStage(mappedStage);
        }
      }

      setError(null);
      setLoading(false);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [botQuery.data, botQuery.error, botQuery.isLoading]);

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
      await banBotMutation.mutateAsync({ botId, details: banFormData });
      message.success('Бот заблокирован и перемещён в архив');
      setIsBanModalVisible(false);
    } catch (err) {
      message.error('Ошибка при блокировке бота');
      console.error(err);
    }
  };

  const handleUnban = async () => {
    try {
      await unbanBotMutation.mutateAsync(botId);
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
              variant="filled"
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
            title={<span className={styles['detail-card-title']}>Life Cycle</span>}
            styles={{
              header: {
                background: 'var(--boxmox-color-surface-panel)',
                borderBottom: '1px solid var(--boxmox-color-border-default)',
              },
            }}
          >
            <StageTimeline currentStage={currentStage} />
            <Divider />
            {currentStage !== 'banned' ? (
              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={() => setIsBanModalVisible(true)}
                block
                className={styles['timeline-action-btn']}
              >
                Подтвердить блокировку
              </Button>
            ) : (
              <Button
                type="default"
                icon={<CheckCircleOutlined />}
                onClick={handleUnban}
                block
                className={styles['timeline-action-btn']}
              >
                Подтвердить снятие бана
              </Button>
            )}
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
        confirmLoading={banBotMutation.isPending}
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
              <Option value="battlenet_account_closure">Закрытие учетной записи BattleNet</Option>
              <Option value="battlenet_account_suspension">
                Приостановка учетной записи BattleNet
              </Option>
              <Option value="game_suspension">Блокировка в игре</Option>
              <Option value="hardware_ban">Блокировка железа (HWID)</Option>
              <Option value="ip_ban">Блокировка IP-адреса</Option>
              <Option value="other">Другое</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
