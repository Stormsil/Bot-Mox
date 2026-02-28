/**
 * Windows visual effects — registry paths under
 * HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects
 * and HKCU\Control Panel\Desktop.
 *
 * VisualFXSetting values: 0=LetWindowsDecide, 1=BestAppearance, 2=BestPerformance, 3=Custom
 */

export interface VisualEffect {
  key: string;
  name: string;
  registryPath: string;
  registryValue: string;
  /** 1 = enabled (appearance), 0 = disabled (performance) */
  appearanceDefault: number;
}

export const VISUAL_EFFECTS: VisualEffect[] = [
  {
    key: 'animateControls',
    name: 'Animate controls and elements inside windows',
    registryPath: 'HKCU\\Control Panel\\Desktop\\WindowMetrics',
    registryValue: 'MinAnimate',
    appearanceDefault: 1,
  },
  {
    key: 'animateMinMax',
    name: 'Animate windows when minimizing and maximizing',
    registryPath: 'HKCU\\Control Panel\\Desktop\\WindowMetrics',
    registryValue: 'MinAnimate',
    appearanceDefault: 1,
  },
  {
    key: 'animateTaskbar',
    name: 'Animations in the taskbar',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    registryValue: 'TaskbarAnimations',
    appearanceDefault: 1,
  },
  {
    key: 'aeropeek',
    name: 'Enable Aero Peek',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\DWM',
    registryValue: 'EnableAeroPeek',
    appearanceDefault: 1,
  },
  {
    key: 'fadeMenuItems',
    name: 'Fade or slide menus into view',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'UserPreferencesMask',
    appearanceDefault: 1,
  },
  {
    key: 'fadeTooltips',
    name: 'Fade or slide ToolTips into view',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'UserPreferencesMask',
    appearanceDefault: 1,
  },
  {
    key: 'fadeAfterClick',
    name: 'Fade out menu items after clicking',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'UserPreferencesMask',
    appearanceDefault: 1,
  },
  {
    key: 'fontSmoothing',
    name: 'Smooth edges of screen fonts',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'FontSmoothing',
    appearanceDefault: 1,
  },
  {
    key: 'dragFullWindows',
    name: 'Show window contents while dragging',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'DragFullWindows',
    appearanceDefault: 1,
  },
  {
    key: 'listBoxSmoothScrolling',
    name: 'Smooth-scroll list boxes',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'SmoothScroll',
    appearanceDefault: 1,
  },
  {
    key: 'comboBoxSlide',
    name: 'Slide open combo boxes',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'UserPreferencesMask',
    appearanceDefault: 1,
  },
  {
    key: 'cursorShadow',
    name: 'Show shadows under mouse pointer',
    registryPath: 'HKCU\\Control Panel\\Desktop',
    registryValue: 'UserPreferencesMask',
    appearanceDefault: 1,
  },
  {
    key: 'windowShadow',
    name: 'Show shadows under windows',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\DWM',
    registryValue: 'EnableAeroPeek',
    appearanceDefault: 1,
  },
  {
    key: 'thumbnailPreviews',
    name: 'Show thumbnails instead of icons',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    registryValue: 'IconsOnly',
    appearanceDefault: 1,
  },
  {
    key: 'translucent',
    name: 'Show translucent selection rectangle',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    registryValue: 'ListviewAlphaSelect',
    appearanceDefault: 1,
  },
  {
    key: 'iconShadow',
    name: 'Use drop shadows for icon labels on the desktop',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    registryValue: 'ListviewShadow',
    appearanceDefault: 1,
  },
  {
    key: 'peekDesktop',
    name: 'Use Peek to preview the desktop',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\DWM',
    registryValue: 'EnableAeroPeek',
    appearanceDefault: 1,
  },
  {
    key: 'saveThumbnails',
    name: 'Save taskbar thumbnail previews',
    registryPath: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    registryValue: 'DisableThumbnailCache',
    appearanceDefault: 1,
  },
];

/** Desktop icon CLSIDs — registry under HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel */
export interface DesktopIcon {
  key: string;
  name: string;
  clsid: string;
}

export const DESKTOP_ICONS: DesktopIcon[] = [
  { key: 'thisPC', name: 'This PC', clsid: '{20D04FE0-3AEA-1069-A2D8-08002B30309D}' },
  { key: 'recycleBin', name: 'Recycle Bin', clsid: '{645FF040-5081-101B-9F08-00AA002F954E}' },
  { key: 'userFiles', name: "User's Files", clsid: '{59031a47-3f72-44a7-89c5-5595fe6b30ee}' },
  { key: 'controlPanel', name: 'Control Panel', clsid: '{5399E694-6CE5-4D6C-8FCE-1D8870FDCBA0}' },
  { key: 'network', name: 'Network', clsid: '{F02C1A0D-BE21-4350-88B0-7367FC96EF3C}' },
];

/** Start menu folders that can be enabled/disabled */
export interface StartFolder {
  key: string;
  name: string;
  registryValue: string;
}

export const START_FOLDERS: StartFolder[] = [
  { key: 'documents', name: 'Documents', registryValue: 'Start_ShowDocuments' },
  { key: 'downloads', name: 'Downloads', registryValue: 'Start_ShowDownloads' },
  { key: 'music', name: 'Music', registryValue: 'Start_ShowMusic' },
  { key: 'pictures', name: 'Pictures', registryValue: 'Start_ShowPictures' },
  { key: 'videos', name: 'Videos', registryValue: 'Start_ShowVideos' },
  { key: 'personalFolder', name: 'Personal Folder', registryValue: 'Start_ShowPersonalFolder' },
  { key: 'settings', name: 'Settings', registryValue: 'Start_ShowSettings' },
  { key: 'fileExplorer', name: 'File Explorer', registryValue: 'Start_ShowFileExplorer' },
  { key: 'network', name: 'Network', registryValue: 'Start_ShowNetwork' },
];
