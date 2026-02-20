export interface KeyboardLayout {
  id: string;
  name: string;
  languageId: string;
}

export interface KeyboardLanguageGroup {
  tag: string;
  name: string;
  languageId: string;
  layouts: KeyboardLayout[];
}
