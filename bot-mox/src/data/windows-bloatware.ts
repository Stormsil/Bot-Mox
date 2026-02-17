/** Windows bloatware packages (AppxProvisionedPackage) with display names. */
export interface BloatwarePackage {
  id: string;
  name: string;
  category: 'microsoft' | 'xbox' | 'media' | 'productivity' | 'social' | 'other';
}

export const BLOATWARE_PACKAGES: BloatwarePackage[] = [
  { id: 'Clipchamp.Clipchamp', name: 'Clipchamp', category: 'media' },
  { id: 'Microsoft.549981C3F5F10', name: 'Cortana', category: 'microsoft' },
  { id: 'Microsoft.BingNews', name: 'Bing News', category: 'microsoft' },
  { id: 'Microsoft.BingWeather', name: 'Bing Weather', category: 'microsoft' },
  { id: 'Microsoft.GamingApp', name: 'Xbox Gaming App', category: 'xbox' },
  { id: 'Microsoft.GetHelp', name: 'Get Help', category: 'microsoft' },
  { id: 'Microsoft.Getstarted', name: 'Tips', category: 'microsoft' },
  { id: 'Microsoft.MicrosoftOfficeHub', name: 'Office Hub', category: 'productivity' },
  { id: 'Microsoft.MicrosoftSolitaireCollection', name: 'Solitaire Collection', category: 'other' },
  { id: 'Microsoft.MicrosoftStickyNotes', name: 'Sticky Notes', category: 'productivity' },
  { id: 'Microsoft.Paint', name: 'Paint', category: 'media' },
  { id: 'Microsoft.People', name: 'People', category: 'social' },
  { id: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate', category: 'productivity' },
  { id: 'Microsoft.ScreenSketch', name: 'Snipping Tool', category: 'media' },
  { id: 'Microsoft.SkypeApp', name: 'Skype', category: 'social' },
  { id: 'Microsoft.StorePurchaseApp', name: 'Store Purchase App', category: 'microsoft' },
  { id: 'Microsoft.Todos', name: 'Microsoft To Do', category: 'productivity' },
  { id: 'Microsoft.WindowsAlarms', name: 'Alarms & Clock', category: 'other' },
  { id: 'Microsoft.WindowsCalculator', name: 'Calculator', category: 'other' },
  { id: 'Microsoft.WindowsCamera', name: 'Camera', category: 'media' },
  { id: 'Microsoft.WindowsFeedbackHub', name: 'Feedback Hub', category: 'microsoft' },
  { id: 'Microsoft.WindowsMaps', name: 'Maps', category: 'other' },
  { id: 'Microsoft.WindowsNotepad', name: 'Notepad', category: 'productivity' },
  { id: 'Microsoft.WindowsSoundRecorder', name: 'Sound Recorder', category: 'media' },
  { id: 'Microsoft.WindowsTerminal', name: 'Windows Terminal', category: 'other' },
  { id: 'Microsoft.Xbox.TCUI', name: 'Xbox TCUI', category: 'xbox' },
  { id: 'Microsoft.XboxGameOverlay', name: 'Xbox Game Overlay', category: 'xbox' },
  { id: 'Microsoft.XboxGamingOverlay', name: 'Xbox Game Bar', category: 'xbox' },
  { id: 'Microsoft.XboxIdentityProvider', name: 'Xbox Identity Provider', category: 'xbox' },
  { id: 'Microsoft.XboxSpeechToTextOverlay', name: 'Xbox Speech-to-Text', category: 'xbox' },
  { id: 'Microsoft.YourPhone', name: 'Phone Link', category: 'social' },
  { id: 'Microsoft.ZuneMusic', name: 'Groove Music / Media Player', category: 'media' },
  { id: 'Microsoft.ZuneVideo', name: 'Movies & TV', category: 'media' },
  { id: 'MicrosoftCorporationII.QuickAssist', name: 'Quick Assist', category: 'microsoft' },
  { id: 'MicrosoftTeams', name: 'Microsoft Teams', category: 'social' },
  { id: 'Microsoft.OutlookForWindows', name: 'Outlook (New)', category: 'productivity' },
  { id: 'Microsoft.Windows.Photos', name: 'Photos', category: 'media' },
  { id: 'Microsoft.WindowsCommunicationsApps', name: 'Mail and Calendar', category: 'productivity' },
  { id: 'Microsoft.MixedReality.Portal', name: 'Mixed Reality Portal', category: 'other' },
  { id: 'Microsoft.3DBuilder', name: '3D Builder', category: 'other' },
  { id: 'Microsoft.Microsoft3DViewer', name: '3D Viewer', category: 'other' },
  { id: 'Microsoft.BingFinance', name: 'Bing Finance', category: 'microsoft' },
  { id: 'Microsoft.BingSports', name: 'Bing Sports', category: 'microsoft' },
  { id: 'Microsoft.BingTravel', name: 'Bing Travel', category: 'microsoft' },
  { id: 'Microsoft.BingHealthAndFitness', name: 'Bing Health', category: 'microsoft' },
  { id: 'Microsoft.BingFoodAndDrink', name: 'Bing Food', category: 'microsoft' },
  { id: 'Microsoft.Copilot', name: 'Copilot', category: 'microsoft' },
  { id: 'MSTeams', name: 'Teams (new)', category: 'social' },
  { id: 'Microsoft.OneDriveSync', name: 'OneDrive', category: 'microsoft' },
  { id: 'Microsoft.Edge', name: 'Microsoft Edge', category: 'microsoft' },
];

/** Windows capabilities that can be removed. */
export interface WindowsCapability {
  id: string;
  name: string;
}

export const WINDOWS_CAPABILITIES: WindowsCapability[] = [
  { id: 'App.Support.QuickAssist', name: 'Quick Assist' },
  { id: 'Browser.InternetExplorer', name: 'Internet Explorer' },
  { id: 'Hello.Face', name: 'Windows Hello Face' },
  { id: 'MathRecognizer', name: 'Math Recognizer' },
  { id: 'Media.WindowsMediaPlayer', name: 'Windows Media Player' },
  { id: 'Microsoft.Wallpapers.Extended', name: 'Extended Wallpapers' },
  { id: 'Microsoft.Windows.Ai.Copilot.Provider', name: 'Copilot Provider' },
  { id: 'Microsoft.Windows.MSPaint', name: 'MS Paint (capability)' },
  { id: 'Microsoft.Windows.Notepad.System', name: 'Notepad (system)' },
  { id: 'Microsoft.Windows.PowerShell.ISE', name: 'PowerShell ISE' },
  { id: 'Microsoft.Windows.WordPad', name: 'WordPad' },
  { id: 'OneCoreUAP.OneSync', name: 'OneSync' },
  { id: 'Print.Fax.Scan', name: 'Fax and Scan' },
  { id: 'Print.Management.Console', name: 'Print Management' },
  { id: 'WMIC', name: 'WMIC (deprecated)' },
  { id: 'OpenSSH.Client', name: 'OpenSSH Client' },
  { id: 'Microsoft.Windows.StepsRecorder', name: 'Steps Recorder' },
];

/** Windows optional features that can be disabled. */
export interface WindowsFeature {
  id: string;
  name: string;
}

export const WINDOWS_FEATURES: WindowsFeature[] = [
  { id: 'WorkFolders-Client', name: 'Work Folders Client' },
  { id: 'Printing-Foundation-Features', name: 'Print and Document Services' },
  { id: 'MediaPlayback', name: 'Media Features' },
  { id: 'MicrosoftWindowsPowerShellV2Root', name: 'PowerShell 2.0' },
  { id: 'MicrosoftWindowsPowerShellV2', name: 'PowerShell 2.0 Engine' },
  { id: 'WindowsMediaPlayer', name: 'Windows Media Player (legacy)' },
  { id: 'Microsoft-Windows-Client-EmbeddedExp-Package', name: 'Windows Sandbox' },
  { id: 'Containers-DisposableClientVM', name: 'Windows Sandbox (Hyper-V)' },
  { id: 'Microsoft-Hyper-V-All', name: 'Hyper-V' },
  { id: 'Internet-Explorer-Optional-amd64', name: 'Internet Explorer 11' },
];
