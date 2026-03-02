import { useGetIdentity } from '@refinedev/core';
import { message } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  activateBillingMock,
  BillingApiError,
  fetchBillingWhoami,
  startBillingTrial,
} from '../../entities/billing/api/billingClient';
import {
  AppAlert as Alert,
  AppButton as Button,
  AppCard as Card,
  AppSpace as Space,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../shared/ui';
import styles from './BillingPage.module.css';

type AccessTier = 'free' | 'trial' | 'premium' | 'admin';

interface IdentityAccess {
  access_tier?: AccessTier;
  premium_active?: boolean;
  write_access?: boolean;
  lifetime_premium?: boolean;
  trial_used?: boolean;
  trial_ends_at?: string | null;
  premium_until?: string | null;
}

interface IdentityShape {
  email?: string;
  access?: IdentityAccess;
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function calcRemainingHours(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
}

export const BillingPage: React.FC = () => {
  const { data: identity } = useGetIdentity<IdentityShape>();
  const [isActivating, setIsActivating] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const access = identity?.access;

  const tier: AccessTier = (access?.access_tier || 'free') as AccessTier;
  const remainingTrialHours = calcRemainingHours(access?.trial_ends_at || null);

  const tierTag = useMemo(() => {
    if (tier === 'admin') return <Tag color="gold">ADMIN</Tag>;
    if (tier === 'premium') return <Tag color="green">PREMIUM</Tag>;
    if (tier === 'trial') return <Tag color="blue">TRIAL</Tag>;
    return <Tag color="default">FREE</Tag>;
  }, [tier]);

  const refreshIdentity = async (): Promise<void> => {
    const token = String(localStorage.getItem('botmox.auth.token') || '').trim();
    if (!token) return;
    const whoami = await fetchBillingWhoami();
    const payload = whoami || {};
    const identitySnapshot = {
      id: String(payload.uid || 'unknown'),
      name: String(payload.email || payload.uid || 'User'),
      email: String(payload.email || ''),
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      access:
        payload.access && typeof payload.access === 'object'
          ? {
              tenant_type: 'user' as const,
              access_tier: String(payload.access.accessTier || '')
                .trim()
                .toLowerCase() as AccessTier,
              premium_active: Boolean(payload.access.premiumActive),
              write_access: Boolean(payload.access.writeAccess),
              lifetime_premium: Boolean(payload.access.lifetimePremium),
              trial_used: Boolean(payload.access.trialUsed),
              trial_ends_at: String(payload.access.trialEndsAt || '').trim() || null,
              premium_until: String(payload.access.premiumUntil || '').trim() || null,
            }
          : undefined,
    };
    localStorage.setItem('botmox.auth.identity', JSON.stringify(identitySnapshot));
    localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
  };

  const handleActivateStubPremium = async () => {
    setIsActivating(true);
    try {
      await activateBillingMock(30);
      await refreshIdentity();
      message.success('Stub premium activated for 30 days');
      window.location.reload();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to activate stub premium';
      message.error(text);
    } finally {
      setIsActivating(false);
    }
  };

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    try {
      await startBillingTrial();
      await refreshIdentity();
      message.success('24-hour trial activated');
      window.location.reload();
    } catch (error) {
      if (error instanceof BillingApiError && error.code === 'AUTH_TRIAL_ALREADY_USED') {
        await refreshIdentity().catch(() => undefined);
        message.warning('Trial already used for this account');
        return;
      }
      const text = error instanceof Error ? error.message : 'Failed to start trial';
      message.error(text);
    } finally {
      setIsStartingTrial(false);
    }
  };

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={4} style={{ marginBottom: 8 }}>
              Billing & Access
            </Typography.Title>
            <Typography.Text type="secondary">
              Account: {identity?.email || 'unknown'}
            </Typography.Text>
          </div>

          <div className={styles.row}>
            <Typography.Text strong>Current tier:</Typography.Text>
            {tierTag}
          </div>

          <div className={styles.row}>
            <Typography.Text strong>Write access:</Typography.Text>
            <Tag color={access?.write_access ? 'green' : 'red'}>
              {access?.write_access ? 'ENABLED' : 'DISABLED'}
            </Tag>
          </div>

          <div className={styles.row}>
            <Typography.Text strong>Trial ends:</Typography.Text>
            <Typography.Text>{formatDate(access?.trial_ends_at || null)}</Typography.Text>
          </div>

          <div className={styles.row}>
            <Typography.Text strong>Premium until:</Typography.Text>
            <Typography.Text>
              {access?.lifetime_premium ? 'Lifetime' : formatDate(access?.premium_until || null)}
            </Typography.Text>
          </div>

          {tier === 'free' ? (
            <Alert
              type="warning"
              showIcon
              message="Free plan: read-only navigation mode"
              description={
                access?.trial_used
                  ? 'Trial already used. To create/edit bots, resources, and VM commands, activate premium.'
                  : 'You can start a one-time 24h trial or activate premium to enable write operations.'
              }
            />
          ) : null}

          {tier === 'trial' ? (
            <Alert
              type="info"
              showIcon
              message="Trial active"
              description={`Remaining trial time: ${remainingTrialHours ?? 0} hours`}
            />
          ) : null}

          <Space>
            {tier === 'free' ? (
              <Button
                loading={isStartingTrial}
                onClick={handleStartTrial}
                disabled={access?.trial_used === true}
              >
                Start 24h Trial
              </Button>
            ) : null}
            <Button type="primary" loading={isActivating} onClick={handleActivateStubPremium}>
              Activate Stub Premium (30 days)
            </Button>
            <Button href="https://t.me/your_support" target="_blank" rel="noreferrer">
              Contact support
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};
