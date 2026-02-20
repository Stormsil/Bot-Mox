import { buildProxyUiUrl } from '../../../config/env';
import type { VMGeneratorSettings } from '../../../types';

export type ServiceKind = 'proxmox' | 'tinyfm' | 'syncthing';

const AUTH_TOKEN_KEY = 'botmox.auth.token';

function getProxyServerBaseUrl(): string {
  return buildProxyUiUrl('');
}

function withAuthToken(rawUrl: string): string {
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
}

export function resolveServiceUrl(kind: ServiceKind): string {
  if (kind === 'proxmox') {
    const base = getProxyServerBaseUrl();
    return withAuthToken(`${base}/proxmox-ui/`);
  }

  if (kind === 'tinyfm') {
    return withAuthToken(buildProxyUiUrl('/tinyfm-ui/'));
  }

  return withAuthToken(buildProxyUiUrl('/syncthing-ui/'));
}

export function getTitle(kind: ServiceKind): string {
  switch (kind) {
    case 'proxmox':
      return 'Proxmox';
    case 'tinyfm':
      return 'TinyFileManager';
    default:
      return 'SyncThing';
  }
}

function getIframeDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument || iframe.contentWindow?.document || null;
  } catch {
    return null;
  }
}

function fireInputEvents(element: HTMLInputElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function runLoginAttempts({
  maxAttempts,
  tryAttempt,
}: {
  maxAttempts: number;
  tryAttempt: () => boolean;
}): void {
  let attempts = 0;
  if (tryAttempt()) {
    return;
  }

  const timer = window.setInterval(() => {
    attempts += 1;
    const done = tryAttempt();
    if (done || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, 500);
}

function tryProxmoxFormAutoLogin(settings: VMGeneratorSettings, iframe: HTMLIFrameElement): void {
  const username = String(settings.proxmox.username || '').trim();
  const password = String(settings.proxmox.password || '');
  if (!username || !password) return;

  runLoginAttempts({
    maxAttempts: 40,
    tryAttempt: () => {
      const doc = getIframeDocument(iframe);
      if (!doc) return false;

      if (doc.querySelector('.x-tree-panel')) {
        return true;
      }

      const userInput = doc.querySelector('input[name="username"]') as HTMLInputElement | null;
      const passInput = doc.querySelector('input[name="password"]') as HTMLInputElement | null;
      if (!userInput || !passInput) return false;

      userInput.focus();
      userInput.value = username;
      fireInputEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireInputEvents(passInput);

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
    },
  });
}

function tryTinyFmFormAutoLogin(settings: VMGeneratorSettings, iframe: HTMLIFrameElement): void {
  const username = String(settings.services.tinyFmUsername || '').trim();
  const password = String(settings.services.tinyFmPassword || '');
  if (!username || !password) return;

  runLoginAttempts({
    maxAttempts: 40,
    tryAttempt: () => {
      const doc = getIframeDocument(iframe);
      if (!doc) return false;

      const userInput = doc.getElementById('fm_usr') as HTMLInputElement | null;
      const passInput = doc.getElementById('fm_pwd') as HTMLInputElement | null;

      if (!userInput && !passInput) {
        return true;
      }

      if (!userInput || !passInput) return false;

      userInput.focus();
      userInput.value = username;
      fireInputEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireInputEvents(passInput);

      const loginButton = doc.querySelector(
        'button[type="submit"], button.btn-success, input[type="submit"]',
      ) as HTMLElement | null;
      if (loginButton) {
        loginButton.click();
      } else if (passInput.form) {
        passInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      return false;
    },
  });
}

function trySyncThingFormAutoLogin(settings: VMGeneratorSettings, iframe: HTMLIFrameElement): void {
  const username = String(settings.services.syncThingUsername || '').trim();
  const password = String(settings.services.syncThingPassword || '');
  if (!username || !password) return;

  runLoginAttempts({
    maxAttempts: 40,
    tryAttempt: () => {
      const doc = getIframeDocument(iframe);
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

      userInput.focus();
      userInput.value = username;
      fireInputEvents(userInput);

      passInput.focus();
      passInput.value = password;
      fireInputEvents(passInput);

      const loginButton = doc.querySelector(
        'button[type="submit"], input[type="submit"], .btn-primary',
      ) as HTMLElement | null;
      if (loginButton) {
        loginButton.click();
      } else if (passInput.form) {
        passInput.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }

      return false;
    },
  });
}

export function shouldRunAutoLoginFallback(
  kind: ServiceKind,
  settings: VMGeneratorSettings | null,
  proxmoxApiLoginOk: boolean | null,
): boolean {
  if (!settings) {
    return false;
  }

  if (kind === 'proxmox') {
    return Boolean(settings.services.proxmoxAutoLogin && proxmoxApiLoginOk !== true);
  }
  if (kind === 'tinyfm') {
    return Boolean(settings.services.tinyFmAutoLogin);
  }
  return Boolean(settings.services.syncThingAutoLogin);
}

export function runServiceAutoLoginFallback(
  kind: ServiceKind,
  settings: VMGeneratorSettings | null,
  iframe: HTMLIFrameElement | null,
): void {
  if (!settings || !iframe) return;

  if (kind === 'proxmox' && settings.services.proxmoxAutoLogin) {
    tryProxmoxFormAutoLogin(settings, iframe);
    return;
  }

  if (kind === 'tinyfm' && settings.services.tinyFmAutoLogin) {
    tryTinyFmFormAutoLogin(settings, iframe);
    return;
  }

  if (kind === 'syncthing' && settings.services.syncThingAutoLogin) {
    trySyncThingFormAutoLogin(settings, iframe);
  }
}
