import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Alert, Badge, Card, Spin, Tooltip } from 'antd';
import styles from './account.module.css';

interface AccountWorkflowAlertProps {
  accountLocked: boolean;
}

export function AccountWorkflowAlert({ accountLocked }: AccountWorkflowAlertProps) {
  const messageText = accountLocked ? 'Account is locked' : 'Ready to configure';

  return (
    <Alert
      className={styles['account-workflow-alert']}
      type={accountLocked ? 'info' : 'success'}
      showIcon
      icon={
        accountLocked ? (
          <LockOutlined style={{ fontSize: 14, color: 'var(--boxmox-color-text-secondary)' }} />
        ) : (
          <CheckCircleOutlined
            style={{ fontSize: 14, color: 'var(--boxmox-color-brand-primary)' }}
          />
        )
      }
      message={
        <span className={styles['account-workflow-message']}>
          <span className={styles['account-workflow-text']}>{messageText}</span>
          <Tooltip
            title={
              accountLocked
                ? 'Unlock -> edit or generate -> Save to lock again.'
                : 'Set options -> generate email/password -> Save to lock.'
            }
          >
            <QuestionCircleOutlined className={styles['account-workflow-help-icon']} />
          </Tooltip>
        </span>
      }
      style={{
        marginBottom: 16,
        padding: '6px 10px',
        borderLeft: `3px solid var(--boxmox-color-brand-primary)`,
      }}
    />
  );
}

interface AccountCardTitleProps {
  hasIncompleteData: boolean;
}

export function AccountCardTitle({ hasIncompleteData }: AccountCardTitleProps) {
  return (
    <div className={styles['account-card-header']}>
      <span className={styles['account-card-title']}>Account Information</span>
      {hasIncompleteData && (
        <Tooltip title="Some fields are empty. Please fill in all account data.">
          <Badge dot color="orange">
            <ExclamationCircleOutlined className={styles['warning-icon']} />
          </Badge>
        </Tooltip>
      )}
    </div>
  );
}

export function IncompleteAccountAlert() {
  return (
    <Alert
      className={styles['config-incomplete-alert']}
      message={<span className={styles['alert-title']}>Incomplete Account Data</span>}
      description={
        <span className={styles['alert-description']}>
          Some fields are empty. Please fill in all account data or use the Generate buttons.
        </span>
      }
      type="warning"
      showIcon
      icon={<ExclamationCircleOutlined />}
      style={{
        marginBottom: 16,
        borderColor: 'var(--boxmox-color-brand-warning)',
        background:
          'color-mix(in srgb, var(--boxmox-color-brand-warning) 10%, var(--boxmox-color-surface-muted))',
      }}
    />
  );
}

export function AccountUnavailableState() {
  return (
    <div className={styles['bot-account']}>
      <Alert message="Error" description="Bot data is not available" type="error" showIcon />
    </div>
  );
}

export function AccountLoadingState() {
  return (
    <div className={styles['bot-account']}>
      <Card
        title={<span className={styles['account-card-title']}>Account Information</span>}
        className={styles['account-card']}
        headStyle={{
          background: 'var(--boxmox-color-surface-muted)',
          borderColor: 'var(--boxmox-color-border-default)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px', color: 'var(--boxmox-color-text-secondary)' }}>
            Loading account data...
          </p>
        </div>
      </Card>
    </div>
  );
}
