import defaultUnattendTemplateRaw from '../data/default-unattend-template.xml?raw';
import type { UnattendProfileConfig } from '../services/unattendProfileService';

export const DEFAULT_UNATTEND_XML_TEMPLATE = defaultUnattendTemplateRaw.trim();

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceTagValues(xml: string, tagName: string, value: string): string {
  const safeValue = escapeXml(value);
  const pattern = new RegExp(`(<${tagName}>)([\\s\\S]*?)(</${tagName}>)`, 'g');
  return xml.replace(pattern, `$1${safeValue}$3`);
}

function replaceFirst(xml: string, pattern: RegExp, replacement: string): string {
  if (!pattern.global) {
    return xml.replace(pattern, replacement);
  }
  let replaced = false;
  return xml.replace(pattern, (match) => {
    if (replaced) return match;
    replaced = true;
    return replacement;
  });
}

function resolveUserName(config: UnattendProfileConfig): string | null {
  const mode = config.user?.nameMode || 'random';
  if (mode === 'custom') {
    const custom = String(config.user?.customName || '').trim();
    return custom || 'User';
  }
  if (mode === 'fixed') {
    return 'User';
  }
  return null;
}

function resolveComputerName(config: UnattendProfileConfig): string {
  const mode = config.computerName?.mode || 'random';
  if (mode === 'custom') {
    const custom = String(config.computerName?.customName || '').trim();
    return custom || '*';
  }
  if (mode === 'fixed') {
    return 'WIN-PC';
  }
  return '*';
}

function resolveInputLocale(config: UnattendProfileConfig): string {
  const layouts = Array.isArray(config.locale?.keyboardLayouts)
    ? config.locale.keyboardLayouts
    : [];
  if (layouts.length === 0) return '0409:00000409';
  return layouts
    .map((entry) => `${String(entry.language || '').trim()}:${String(entry.layout || '').trim()}`)
    .filter(Boolean)
    .join(';');
}

function resolveCustomScriptExecutable(config: UnattendProfileConfig): string {
  const raw = String(config.customScript?.executable || 'START.ps1').trim();
  if (!raw) return 'START.ps1';
  const normalized = raw.replace(/\//g, '\\');
  const parts = normalized.split('\\').filter(Boolean);
  return parts[parts.length - 1] || 'START.ps1';
}

export function validateUnattendXml(
  xml: string,
): { valid: true } | { valid: false; error: string } {
  const text = String(xml || '').trim();
  if (!text) {
    return { valid: false, error: 'XML is empty.' };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'application/xml');
    const parserErrors = doc.getElementsByTagName('parsererror');
    if (parserErrors.length > 0) {
      const details = parserErrors[0]?.textContent?.trim() || 'Unknown XML parser error.';
      return { valid: false, error: details };
    }
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown XML parser error.';
    return { valid: false, error: message };
  }
}

export function buildFinalUnattendXml(
  xmlTemplate: string | undefined,
  config: UnattendProfileConfig,
): string {
  let xml = String(xmlTemplate || '').trim() || DEFAULT_UNATTEND_XML_TEMPLATE;

  const uiLanguage = String(config.locale?.uiLanguage || 'en-US').trim() || 'en-US';
  const inputLocale = resolveInputLocale(config);
  const timeZone =
    String(config.locale?.timeZone || 'Turkey Standard Time').trim() || 'Turkey Standard Time';
  const geoLocation = Number(config.locale?.geoLocation || 235);
  const password = String(config.user?.password || '1204');
  const group = String(config.user?.group || 'Administrators');
  const displayName = String(config.user?.displayName || '').trim();
  const autoLogonCount = Number(config.user?.autoLogonCount || 9999999);
  const userName = resolveUserName(config);
  const computerName = resolveComputerName(config);
  const delaySeconds = Number(config.customScript?.delaySeconds || 20);
  const executable = resolveCustomScriptExecutable(config);

  xml = replaceTagValues(xml, 'InputLocale', inputLocale);
  xml = replaceTagValues(xml, 'SystemLocale', uiLanguage);
  xml = replaceTagValues(xml, 'UILanguage', uiLanguage);
  xml = replaceTagValues(xml, 'UserLocale', uiLanguage);
  xml = replaceTagValues(xml, 'TimeZone', timeZone);
  xml = replaceTagValues(xml, 'ComputerName', computerName);
  xml = replaceTagValues(xml, 'Group', group);
  xml = replaceTagValues(
    xml,
    'LogonCount',
    String(Math.max(0, Number.isFinite(autoLogonCount) ? autoLogonCount : 9999999)),
  );

  if (displayName) {
    xml = replaceTagValues(xml, 'DisplayName', displayName);
  }

  if (userName) {
    xml = replaceFirst(
      xml,
      /(<LocalAccount[\s\S]*?<Name>)([\s\S]*?)(<\/Name>)/i,
      `$1${escapeXml(userName)}$3`,
    );
    xml = replaceFirst(
      xml,
      /(<AutoLogon[\s\S]*?<Username>)([\s\S]*?)(<\/Username>)/i,
      `$1${escapeXml(userName)}$3`,
    );
  }

  xml = replaceFirst(
    xml,
    /(<LocalAccount[\s\S]*?<Password>[\s\S]*?<Value>)([\s\S]*?)(<\/Value>)/i,
    `$1${escapeXml(password)}$3`,
  );
  xml = replaceFirst(
    xml,
    /(<AutoLogon[\s\S]*?<Password>[\s\S]*?<Value>)([\s\S]*?)(<\/Value>)/i,
    `$1${escapeXml(password)}$3`,
  );

  if (Number.isFinite(geoLocation) && geoLocation > 0) {
    xml = xml.replace(/(Set-WinHomeLocation\s+-GeoId\s+)\d+/gi, `$1${Math.trunc(geoLocation)}`);
  }

  if (Number.isFinite(delaySeconds) && delaySeconds >= 0) {
    xml = xml.replace(/(timeout\s+\/t\s+)\d+/gi, `$1${Math.trunc(delaySeconds)}`);
  }

  xml = xml.replace(
    /(C:\\WindowsSetup\\)([A-Za-z0-9_.-]+)(?=(?:"|<|\s))/gi,
    `$1${escapeXml(executable)}`,
  );

  return xml;
}

export function triggerXmlDownload(fileName: string, xml: string): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
