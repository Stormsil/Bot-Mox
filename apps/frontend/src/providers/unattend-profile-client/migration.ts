import { DEFAULT_UNATTEND_XML_TEMPLATE } from '../../utils/unattendXml';
import { DEFAULT_PROFILE_CONFIG, isLegacyStubTemplate } from './defaults';
import type {
  UnattendCapabilityRemovalConfig,
  UnattendComputerNameConfig,
  UnattendCustomScript,
  UnattendDesktopIcons,
  UnattendLocaleConfig,
  UnattendProfileConfig,
  UnattendSoftwareRemovalConfig,
  UnattendUserConfig,
  UnattendVisualEffects,
  UnattendWindowsSettings,
} from './types';

interface LegacyLocaleConfig extends Partial<UnattendLocaleConfig> {
  inputLocales?: string[];
}

interface LegacyVisualEffectsConfig extends Omit<Partial<UnattendVisualEffects>, 'mode'> {
  mode?: UnattendVisualEffects['mode'] | 'balanced' | 'random';
  cursorShadow?: boolean;
  fontSmoothing?: boolean;
}

interface LegacyDesktopIconsConfig extends Partial<UnattendDesktopIcons> {
  recycleBin?: boolean;
  thisPC?: boolean;
}

interface LegacyProfileConfig {
  user?: Partial<UnattendUserConfig>;
  computerName?: Partial<UnattendComputerNameConfig>;
  locale?: LegacyLocaleConfig;
  softwareRemoval?: Omit<Partial<UnattendSoftwareRemovalConfig>, 'mode'> & {
    mode?: UnattendSoftwareRemovalConfig['mode'] | 'mixed';
  };
  capabilityRemoval?: Omit<Partial<UnattendCapabilityRemovalConfig>, 'mode'> & {
    mode?: UnattendCapabilityRemovalConfig['mode'] | 'mixed';
  };
  windowsSettings?: Partial<UnattendWindowsSettings>;
  visualEffects?: LegacyVisualEffectsConfig;
  desktopIcons?: LegacyDesktopIconsConfig;
  customScript?: Partial<UnattendCustomScript>;
  xmlTemplate?: string;
}

export function migrateProfileConfig(raw: unknown): UnattendProfileConfig {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_PROFILE_CONFIG);

  const config: LegacyProfileConfig = structuredClone(raw as LegacyProfileConfig);

  if (config.user) {
    if (config.user.autoLogonCount === undefined) config.user.autoLogonCount = 9999999;
    if (config.user.customNameSuffix === undefined) config.user.customNameSuffix = 'none';
  } else {
    config.user = structuredClone(DEFAULT_PROFILE_CONFIG.user);
  }

  if (config.locale) {
    if (!config.locale.keyboardLayouts && Array.isArray(config.locale.inputLocales)) {
      config.locale.keyboardLayouts = config.locale.inputLocales.map((il: string) => {
        const parts = String(il).split(':');
        return { language: parts[0] || '0409', layout: parts[1] || '00000409' };
      });
      delete config.locale.inputLocales;
    }
    if (!config.locale.keyboardLayouts) {
      config.locale.keyboardLayouts = structuredClone(
        DEFAULT_PROFILE_CONFIG.locale.keyboardLayouts,
      );
    }
  } else {
    config.locale = structuredClone(DEFAULT_PROFILE_CONFIG.locale);
  }

  if (config.softwareRemoval) {
    if (config.softwareRemoval.mode === 'mixed') config.softwareRemoval.mode = 'fixed_random';
    if (!Array.isArray(config.softwareRemoval.neverRemove)) config.softwareRemoval.neverRemove = [];
  } else {
    config.softwareRemoval = structuredClone(DEFAULT_PROFILE_CONFIG.softwareRemoval);
  }

  if (config.capabilityRemoval) {
    if (config.capabilityRemoval.mode === 'mixed') config.capabilityRemoval.mode = 'fixed_random';
  } else {
    config.capabilityRemoval = structuredClone(DEFAULT_PROFILE_CONFIG.capabilityRemoval);
  }

  if (config.windowsSettings) {
    if (config.windowsSettings.enableRemoteDesktop === undefined) {
      config.windowsSettings.enableRemoteDesktop = false;
    }
  } else {
    config.windowsSettings = structuredClone(DEFAULT_PROFILE_CONFIG.windowsSettings);
  }

  if (config.visualEffects) {
    if (!config.visualEffects.effects || typeof config.visualEffects.effects !== 'object') {
      config.visualEffects.effects = {};
    }
    if (config.visualEffects.mode === 'balanced') config.visualEffects.mode = 'default';
    if (config.visualEffects.mode === 'random') config.visualEffects.mode = 'custom_randomize';
    if (config.visualEffects.cursorShadow !== undefined) {
      config.visualEffects.effects.cursorShadow = config.visualEffects.cursorShadow;
      delete config.visualEffects.cursorShadow;
    }
    if (config.visualEffects.fontSmoothing !== undefined) {
      config.visualEffects.effects.fontSmoothing = config.visualEffects.fontSmoothing;
      delete config.visualEffects.fontSmoothing;
    }
  } else {
    config.visualEffects = structuredClone(DEFAULT_PROFILE_CONFIG.visualEffects);
  }

  if (config.desktopIcons) {
    if (config.desktopIcons.mode === undefined) {
      const oldIcons: Record<string, boolean> = {};
      if (config.desktopIcons.recycleBin !== undefined) {
        oldIcons.recycleBin = config.desktopIcons.recycleBin;
      }
      if (config.desktopIcons.thisPC !== undefined) {
        oldIcons.thisPC = config.desktopIcons.thisPC;
      }
      config.desktopIcons = {
        mode: 'custom',
        icons: oldIcons,
        startFolders: {},
        deleteEdgeShortcut: true,
      };
    }
    if (!config.desktopIcons.icons) config.desktopIcons.icons = {};
    if (!config.desktopIcons.startFolders) config.desktopIcons.startFolders = {};
    if (config.desktopIcons.deleteEdgeShortcut === undefined) {
      config.desktopIcons.deleteEdgeShortcut = true;
    }
  } else {
    config.desktopIcons = structuredClone(DEFAULT_PROFILE_CONFIG.desktopIcons);
  }

  if (!config.customScript) {
    config.customScript = structuredClone(DEFAULT_PROFILE_CONFIG.customScript);
  }

  const resolvedTemplate = typeof config.xmlTemplate === 'string' ? config.xmlTemplate.trim() : '';
  if (!resolvedTemplate || isLegacyStubTemplate(resolvedTemplate)) {
    config.xmlTemplate = DEFAULT_UNATTEND_XML_TEMPLATE;
  }

  if (!config.computerName) {
    config.computerName = structuredClone(DEFAULT_PROFILE_CONFIG.computerName);
  }

  return config as UnattendProfileConfig;
}
