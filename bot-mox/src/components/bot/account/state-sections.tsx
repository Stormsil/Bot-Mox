import { Alert, Badge, Card, Spin, Tooltip } from 'antd';
import {
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

interface AccountWorkflowAlertProps {
  accountLocked: boolean;
}

export function AccountWorkflowAlert({ accountLocked }: AccountWorkflowAlertProps) {
  return (
    <Alert
      className="account-workflow-alert"
      type={accountLocked ? 'info' : 'success'}
      showIcon
      message={(
        <span className="account-workflow-message">
          {accountLocked ? 'Account is locked' : 'Ready to configure'}
          <Tooltip
            title={(
              accountLocked
                ? 'Unlock -> edit or generate -> Save to lock again.'
                : 'Set options -> generate email/password -> Save to lock.'
            )}
          >
            <QuestionCircleOutlined className="account-workflow-help-icon" />
          </Tooltip>
        </span>
      )}
      style={{ marginBottom: '16px' }}
    />
  );
}

interface AccountCardTitleProps {
  hasIncompleteData: boolean;
}

export function AccountCardTitle({ hasIncompleteData }: AccountCardTitleProps) {
  return (
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
  );
}

export function IncompleteAccountAlert() {
  return (
    <Alert
      className="config-incomplete-alert"
      message="Incomplete Account Data"
      description="Some fields are empty. Please fill in all account data or use the Generate buttons."
      type="warning"
      showIcon
      icon={<ExclamationCircleOutlined />}
      style={{ marginBottom: '16px' }}
    />
  );
}

export function AccountUnavailableState() {
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

export function AccountLoadingState() {
  return (
    <div className="bot-account">
      <Card title="Account Information" className="account-card">
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
