import { ExclamationCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Alert, Badge, Card, Spin, Tooltip } from 'antd';
import type React from 'react';
import styles from './person.module.css';

interface PersonCardTitleProps {
  hasIncompleteData: boolean;
}

interface PersonStatusAlertsProps {
  hasIncompleteData: boolean;
  manualEditLocked: boolean;
}

export const PersonCardTitle: React.FC<PersonCardTitleProps> = ({ hasIncompleteData }) => (
  <div className={styles['person-card-header']}>
    <span>Person Information</span>
    {hasIncompleteData && (
      <Tooltip title="Some fields are empty. Please fill in all person data.">
        <Badge dot color="orange">
          <ExclamationCircleOutlined className={styles['warning-icon']} />
        </Badge>
      </Tooltip>
    )}
  </div>
);

export const PersonStatusAlerts: React.FC<PersonStatusAlertsProps> = ({
  hasIncompleteData,
  manualEditLocked,
}) => (
  <>
    {hasIncompleteData && (
      <Alert
        className={styles['config-incomplete-alert']}
        message={<span className={styles['alert-title']}>Incomplete Person Data</span>}
        description={
          <span className={styles['alert-description']}>
            Some fields are empty. Please fill in all person data or use the Generate button to create random data.
          </span>
        }
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined className={styles['alert-icon']} />}
        style={{ marginBottom: '16px' }}
      />
    )}

    {manualEditLocked && (
      <Alert
        className={styles['person-workflow-alert']}
        message={
          <span className={styles['person-workflow-message']}>
            Person data is locked
            <Tooltip title="Unlock -> edit or generate -> Save to lock again.">
              <QuestionCircleOutlined className={styles['person-workflow-help-icon']} />
            </Tooltip>
          </span>
        }
        type="info"
        showIcon
        style={{ marginBottom: '10px', padding: '6px 10px' }}
      />
    )}
  </>
);

export const PersonUnavailableState: React.FC = () => (
  <div className={styles['bot-person']}>
    <Alert message="Error" description="Bot data is not available" type="error" showIcon />
  </div>
);

export const PersonLoadingState: React.FC = () => (
  <div className={styles['bot-person']}>
    <Card title="Person Information" className={styles['person-card']}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <p style={{ marginTop: '16px', color: 'var(--boxmox-color-text-secondary)' }}>
          Loading person data...
        </p>
      </div>
    </Card>
  </div>
);
