import { ReloadOutlined } from '@ant-design/icons';
import { Button, Spin, Tag } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProxmoxLoginMutation } from '../../entities/vm/api/useVmActionMutations';
import { useVmSettingsQuery } from '../../entities/vm/api/useVmQueries';
import type { VMGeneratorSettings } from '../../types';
import {
  getTitle,
  resolveServiceUrl,
  runServiceAutoLoginFallback,
  type ServiceKind,
  shouldRunAutoLoginFallback,
} from './page/serviceUiHelpers';
import styles from './VMServicePage.module.css';

interface VMServicePageProps {
  kind: ServiceKind;
}

export const VMServicePage: React.FC<VMServicePageProps> = ({ kind }) => {
  const proxmoxLoginMutation = useProxmoxLoginMutation();
  const { data: cachedVmSettings, refetch: refetchVmSettings } = useVmSettingsQuery();
  const [settings, setSettings] = useState<VMGeneratorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading settings...');
  const [reloadKey, setReloadKey] = useState(0);
  const [proxmoxApiLoginOk, setProxmoxApiLoginOk] = useState<boolean | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const runJsAutoLoginFallback = useCallback(() => {
    runServiceAutoLoginFallback(kind, settings, iframeRef.current);
  }, [kind, settings]);

  useEffect(() => {
    void reloadKey;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadingText('Loading settings...');
      try {
        const queryResult = await refetchVmSettings();
        const next = queryResult.data || cachedVmSettings;
        if (!next) {
          return;
        }
        if (cancelled) return;
        setSettings(next);

        if (kind === 'proxmox' && next.services.proxmoxAutoLogin) {
          setLoadingText('Proxmox auto login...');
          const ok = await proxmoxLoginMutation.mutateAsync();
          if (cancelled) return;
          setProxmoxApiLoginOk(ok);
          if (!ok) {
            setLoadingText('API auto login failed, trying form login...');
          }
        } else {
          setProxmoxApiLoginOk(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [cachedVmSettings, kind, proxmoxLoginMutation, refetchVmSettings, reloadKey]);

  useEffect(() => {
    void reloadKey;
    if (loading) return;
    if (!shouldRunAutoLoginFallback(kind, settings, proxmoxApiLoginOk)) return;

    const timer = window.setTimeout(() => {
      runJsAutoLoginFallback();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loading, kind, settings, reloadKey, runJsAutoLoginFallback, proxmoxApiLoginOk]);

  const iframeUrl = useMemo(() => {
    if (!settings) return '';
    return resolveServiceUrl(kind);
  }, [kind, settings]);

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <span className={styles.title}>{getTitle(kind)}</span>
          {kind === 'proxmox' && settings?.services.proxmoxAutoLogin && (
            <Tag color="success">Auto Login</Tag>
          )}
          {kind === 'proxmox' &&
            settings?.services.proxmoxAutoLogin &&
            proxmoxApiLoginOk === false && <Tag color="warning">API Login Failed, JS Fallback</Tag>}
          {kind === 'tinyfm' && settings?.services.tinyFmAutoLogin && (
            <Tag color="success">Auto Login</Tag>
          )}
          {kind === 'syncthing' && settings?.services.syncThingAutoLogin && (
            <Tag color="success">Auto Login</Tag>
          )}
        </div>

        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => setReloadKey((prev) => prev + 1)}
        >
          Reload
        </Button>
      </div>

      <div className={styles.frameWrap}>
        {loading ? (
          <div className={styles.loading}>
            <Spin />
            <span>{loadingText}</span>
          </div>
        ) : iframeUrl ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={iframeUrl}
            title={getTitle(kind)}
            onLoad={() => {
              if (shouldRunAutoLoginFallback(kind, settings, proxmoxApiLoginOk)) {
                runJsAutoLoginFallback();
              }
            }}
          />
        ) : (
          <div className={styles.loading}>Service URL is not configured in VM settings.</div>
        )}
      </div>
    </div>
  );
};

export const VMProxmoxPage: React.FC = () => <VMServicePage kind="proxmox" />;
export const VMTinyFMPage: React.FC = () => <VMServicePage kind="tinyfm" />;
export const VMSyncThingPage: React.FC = () => <VMServicePage kind="syncthing" />;
