import {
  ExclamationCircleOutlined,
  LockOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import styles from './account.module.css';
import type { AccountGenerationLocks } from './types';

interface ActionButtonsSectionProps {
  accountLocked: boolean;
  locks: AccountGenerationLocks;
  pendingLocks: AccountGenerationLocks;
  isPersonComplete: boolean;
  hasBackup: boolean;
  saving: boolean;
  requestGeneration: (type: 'password' | 'email' | 'both') => void;
  handleUnlockGeneration: () => void;
  handleRestore: () => void;
}

export function ActionButtonsSection({
  accountLocked,
  locks,
  pendingLocks,
  isPersonComplete,
  hasBackup,
  saving,
  requestGeneration,
  handleUnlockGeneration,
  handleRestore,
}: ActionButtonsSectionProps) {
  return (
    <div className={styles['account-form-actions']}>
      <div className={styles['generate-section']}>
        <span className={styles['generate-label']}>Generate:</span>
        <Tooltip title={locks.password ? 'Generation locked' : 'Generate password'}>
          <Button
            type="default"
            icon={locks.password ? <LockOutlined /> : <ThunderboltOutlined />}
            onClick={() => requestGeneration('password')}
            className={styles['generate-btn']}
            disabled={accountLocked}
          >
            Password
          </Button>
        </Tooltip>
        <Tooltip title={locks.email ? 'Generation locked' : 'Generate email'}>
          <Button
            type="default"
            icon={locks.email ? <LockOutlined /> : <ThunderboltOutlined />}
            onClick={() => requestGeneration('email')}
            className={styles['generate-btn']}
            disabled={!isPersonComplete || accountLocked}
          >
            Email
          </Button>
        </Tooltip>
        <Tooltip title={accountLocked ? 'Generation locked' : 'Generate email and password'}>
          <Button
            type="default"
            icon={accountLocked ? <LockOutlined /> : <ThunderboltOutlined />}
            onClick={() => requestGeneration('both')}
            className={styles['generate-btn']}
            disabled={!isPersonComplete || accountLocked}
          >
            Both
          </Button>
        </Tooltip>
        {(locks.email || locks.password || pendingLocks.email || pendingLocks.password) && (
          <Tooltip title="Unlock generator to allow regeneration">
            <Button
              type="default"
              icon={<UnlockOutlined />}
              onClick={handleUnlockGeneration}
              className={styles['unlock-btn']}
            >
              Unlock
            </Button>
          </Tooltip>
        )}
        {!isPersonComplete && (
          <Tooltip title="Fill Person data first to generate email">
            <ExclamationCircleOutlined className={styles['field-warning-icon']} />
          </Tooltip>
        )}
      </div>

      <div className={styles['action-buttons']}>
        {hasBackup && (
          <Button
            type="default"
            icon={<UndoOutlined />}
            onClick={handleRestore}
            className={styles['restore-btn']}
            style={{ marginRight: '8px' }}
            disabled={accountLocked}
          >
            Restore Previous
          </Button>
        )}
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={saving}
          className={styles['save-btn']}
          disabled={accountLocked}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}
