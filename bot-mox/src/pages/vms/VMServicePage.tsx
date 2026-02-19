import { ReloadOutlined } from '@ant-design/icons';
import { Button, Spin, Tag } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildProxyUiUrl } from '../../config/env';
import { useProxmoxLoginMutation } from '../../entities/vm/api/useVmActionMutations';
import { useVmSettingsQuery } from '../../entities/vm/api/useVmQueries';
import type { VMGeneratorSettings } from '../../types';
import styles from './VMServicePage.module.css';

type ServiceKind = 'proxmox' | 'tinyfm' | 'syncthing';
const AUTH_TOKEN_KEY = 'botmox.auth.token';

interface VMServicePageProps {
  kind: ServiceKind;
}

function getProxyServerBaseUrl(): string {
  return buildProxyUiUrl('');
}

function resolveServiceUrl(kind: ServiceKind): string {
  const withToken = (rawUrl: string): string => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    if (!token) return rawUrl;
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      parsed.searchParams.set('access_token', token);
      return parsed.toString();
    } catch {
      const separator = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${separator}access_token=${encodeURIComponent(token)}`;
    }
  };

  if (kind === 'proxmox') {
    const base = getProxyServerBaseUrl();
    return withToken(`${base}/proxmox-ui/`);
  }

  if (kind === 'tinyfm') {
    return withToken(buildProxyUiUrl('/tinyfm-ui/'));
  }

  return withToken(buildProxyUiUrl('/syncthing-ui/'));
}

function getTitle(kind: ServiceKind): string {
  switch (kind) {
    case 'proxmox':
      return 'Proxmox';
    case 'tinyfm':
      return 'TinyFileManager';
    default:
      return 'SyncThing';
  }
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

  const tryProxmoxFormAutoLogin = useCallback(() => {
    if (kind !== 'proxmox') return;
    if (!settings?.services.proxmoxAutoLogin) return;

    const username = String(settings.proxmox.username || '').trim();
    const password = String(settings.proxmox.password || '');
    if (!username || !password) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let attempts = 0;
    const maxAttempts = 40;
    const attemptLogin = () => {
      attempts++;
      let doc: Document | null = null;
      try {
        doc = iframe.contentDocument || iframe.contentWindow?.document || null;
      } catch {
        doc = null;
      }
      if (!doc) return false;

      if (doc.querySelector('.x-tree-panel')) {
        return true;
      }

      const userInput = doc.querySelector('input[name="username"]') as HTMLInputElement | null;
      const passInput = doc.querySelector('input[name="password"]') as HTMLInputElement | null;
      if (!userInput || !passInput) return false;

      const fireEvents = (el: HTMLInputElement) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      userInput.focus();
      userInput.value = username;
      fireEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireEvents(passInput);

      const loginNode = Array.from(doc.querySelectorAll('span.x-btn-inner,button,span')).find(
        (el) => /^\s*Login\s*$/i.test(el.textContent || ''),
      );
      const loginButton = loginNode?.closest('span.x-btn-button,button') as HTMLElement | null;
      if (loginButton) {
        loginButton.click();
      } else if (passInput.form) {
        passInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      return true;
    };

    if (attemptLogin()) return;

    const timer = window.setInterval(() => {
      const done = attemptLogin();
      if (done || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 500);
  }, [kind, settings]);

  const tryTinyFmFormAutoLogin = useCallback(() => {
    if (kind !== 'tinyfm') return;
    if (!settings?.services.tinyFmAutoLogin) return;

    const username = String(settings.services.tinyFmUsername || '').trim();
    const password = String(settings.services.tinyFmPassword || '');
    if (!username || !password) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let attempts = 0;
    const maxAttempts = 40;
    const attemptLogin = () => {
      attempts++;
      let doc: Document | null = null;
      try {
        doc = iframe.contentDocument || iframe.contentWindow?.document || null;
      } catch {
        doc = null;
      }
      if (!doc) return false;

      const userInput = doc.getElementById('fm_usr') as HTMLInputElement | null;
      const passInput = doc.getElementById('fm_pwd') as HTMLInputElement | null;

      // Login form is absent => already authenticated (stay on index.php?p=).
      if (!userInput && !passInput) {
        return true;
      }

      if (!userInput || !passInput) return false;

      const fireEvents = (el: HTMLInputElement) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      userInput.focus();
      userInput.value = username;
      fireEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireEvents(passInput);

      const loginButton = doc.querySelector(
        'button[type="submit"], button.btn-success, input[type="submit"]',
      ) as HTMLElement | null;
      if (loginButton) {
        loginButton.click();
      } else if (passInput.form) {
        passInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      return false;
    };

    if (attemptLogin()) return;

    const timer = window.setInterval(() => {
      const done = attemptLogin();
      if (done || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 500);
  }, [kind, settings]);

  const trySyncThingFormAutoLogin = useCallback(() => {
    if (kind !== 'syncthing') return;
    if (!settings?.services.syncThingAutoLogin) return;

    const username = String(settings.services.syncThingUsername || '').trim();
    const password = String(settings.services.syncThingPassword || '');
    if (!username || !password) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    let attempts = 0;
    const maxAttempts = 40;
    const attemptLogin = () => {
      attempts++;
      let doc: Document | null = null;
      try {
        doc = iframe.contentDocument || iframe.contentWindow?.document || null;
      } catch {
        doc = null;
      }
      if (!doc) return false;

      const loggedInUi = doc.querySelector('#folders, .panel, [ng-controller]');
      if (loggedInUi) {
        return true;
      }

      const userInput = doc.querySelector(
        'input[name="user"], input[type="text"]',
      ) as HTMLInputElement | null;
      const passInput = doc.querySelector(
        'input[name="password"], input[type="password"]',
      ) as HTMLInputElement | null;
      if (!userInput || !passInput) return false;

      const fireEvents = (el: HTMLInputElement) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      userInput.focus();
      userInput.value = username;
      fireEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireEvents(passInput);

      const loginButton = doc.querySelector(
        'button[type="submit"], input[type="submit"], .btn-primary',
      ) as HTMLElement | null;
      if (loginButton) {
        loginButton.click();
      } else if (passInput.form) {
        passInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      return false;
    };

    if (attemptLogin()) return;

    const timer = window.setInterval(() => {
      const done = attemptLogin();
      if (done || attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 500);
  }, [kind, settings]);

  const runJsAutoLoginFallback = useCallback(() => {
    if (kind === 'proxmox') {
      tryProxmoxFormAutoLogin();
      return;
    }
    if (kind === 'tinyfm') {
      tryTinyFmFormAutoLogin();
      return;
    }
    if (kind === 'syncthing') {
      trySyncThingFormAutoLogin();
    }
  }, [kind, tryProxmoxFormAutoLogin, tryTinyFmFormAutoLogin, trySyncThingFormAutoLogin]);

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
    if (kind === 'proxmox' && (!settings?.services.proxmoxAutoLogin || proxmoxApiLoginOk === true))
      return;
    if (kind === 'tinyfm' && !settings?.services.tinyFmAutoLogin) return;
    if (kind === 'syncthing' && !settings?.services.syncThingAutoLogin) return;
    const t = window.setTimeout(() => {
      runJsAutoLoginFallback();
    }, 300);
    return () => window.clearTimeout(t);
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
              if (
                kind === 'proxmox' &&
                settings?.services.proxmoxAutoLogin &&
                proxmoxApiLoginOk !== true
              )
                runJsAutoLoginFallback();
              if (kind === 'tinyfm' && settings?.services.tinyFmAutoLogin) runJsAutoLoginFallback();
              if (kind === 'syncthing' && settings?.services.syncThingAutoLogin)
                runJsAutoLoginFallback();
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
