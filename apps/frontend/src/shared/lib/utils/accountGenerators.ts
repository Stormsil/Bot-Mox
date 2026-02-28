/**
 * Утилиты для генерации аккаунтных данных
 * - Транслитерация имен (кириллица, турецкий → латиница)
 * - Генератор паролей с настройками
 * - Генератор email на основе данных person
 */

// Маппинг для транслитерации украинского/русского
const cyrillicToLatinMap: Record<string, string> = {
  // Украинские и русские буквы
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  // Украинские специфичные
  ї: 'yi',
  і: 'i',
  є: 'ye',
  ґ: 'g',
  // Турецкие буквы
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'C',
  Ğ: 'G',
  İ: 'I',
  Ö: 'O',
  Ş: 'S',
  Ü: 'U',
  // Заглавные
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'Yo',
  Ж: 'Zh',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'Kh',
  Ц: 'Ts',
  Ч: 'Ch',
  Ш: 'Sh',
  Щ: 'Shch',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'Yu',
  Я: 'Ya',
  Ї: 'Yi',
  І: 'I',
  Є: 'Ye',
  Ґ: 'G',
};

/**
 * Транслитерация текста в латиницу
 * Поддерживает: украинский, русский, турецкий
 */
export const transliterate = (text: string): string => {
  if (!text) return '';

  return text
    .split('')
    .map((char) => cyrillicToLatinMap[char] || char)
    .join('')
    .toLowerCase();
};

/**
 * Настройки генератора пароля
 */
export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

/**
 * Генератор пароля с настройками
 */
export const generatePassword = (options: PasswordOptions): string => {
  const chars = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  };

  let availableChars = '';
  if (options.uppercase) availableChars += chars.uppercase;
  if (options.lowercase) availableChars += chars.lowercase;
  if (options.numbers) availableChars += chars.numbers;
  if (options.symbols) availableChars += chars.symbols;

  // Если ничего не выбрано, используем все
  if (!availableChars) {
    availableChars = chars.lowercase + chars.numbers;
  }

  let password = '';
  const length = Math.max(8, Math.min(32, options.length));

  // Гарантируем хотя бы один символ из каждой выбранной категории
  if (options.uppercase) {
    password += chars.uppercase[Math.floor(Math.random() * chars.uppercase.length)];
  }
  if (options.lowercase) {
    password += chars.lowercase[Math.floor(Math.random() * chars.lowercase.length)];
  }
  if (options.numbers) {
    password += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
  }
  if (options.symbols) {
    password += chars.symbols[Math.floor(Math.random() * chars.symbols.length)];
  }

  // Заполняем оставшуюся длину
  while (password.length < length) {
    password += availableChars[Math.floor(Math.random() * availableChars.length)];
  }

  // Перемешиваем
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Параметры для генерации email
 */
export interface EmailGeneratorParams {
  firstName: string;
  lastName: string;
  birthDate: string; // DD-MM-YYYY
  domain: string;
}

/**
 * Проверка заполненности данных person
 */
export const isPersonDataComplete = (person?: {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
}): boolean => {
  if (!person) return false;
  return !!(person.first_name?.trim() && person.last_name?.trim() && person.birth_date?.trim());
};

/**
 * Генератор email на основе данных person
 * Алгоритм:
 * - Транслитерация имени и фамилии
 * - 50% шанс: фамилия_имя или имя_фамилия
 * - 33% шанс на разделитель: _, -, или слитно
 * - Случайные 2 цифры в конце (год, месяц или день рождения)
 */
export const generateEmail = (params: EmailGeneratorParams): string => {
  const { firstName, lastName, birthDate, domain } = params;

  // Транслитерация
  const translitFirst = transliterate(firstName);
  const translitLast = transliterate(lastName);

  // 50% шанс на порядок (фамилия в начале или в конце)
  const lastNameFirst = Math.random() < 0.5;

  // 33% шанс на разделитель
  const separatorRandom = Math.random();
  let separator = '';
  if (separatorRandom < 0.33) {
    separator = '_';
  } else if (separatorRandom < 0.66) {
    separator = '-';
  }
  // else остаётся пустым (слитно)

  // Парсим дату рождения DD-MM-YYYY
  const dateParts = birthDate.split('-');
  let suffix = '';

  if (dateParts.length === 3) {
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2].slice(-2); // последние 2 цифры года

    // Случайно выбираем: год, месяц или день
    const suffixRandom = Math.random();
    if (suffixRandom < 0.33) {
      suffix = year;
    } else if (suffixRandom < 0.66) {
      suffix = month;
    } else {
      suffix = day;
    }
  } else {
    // Если дата не распарсилась, используем случайные 2 цифры
    suffix = String(Math.floor(Math.random() * 90) + 10);
  }

  // Собираем email
  const localPart = lastNameFirst
    ? `${translitLast}${separator}${translitFirst}${suffix}`
    : `${translitFirst}${separator}${translitLast}${suffix}`;

  return `${localPart}@${domain}`;
};

/**
 * Популярные домены для email
 */
export const popularEmailDomains = ['outlook.com', 'proton.me', 'gmail.com'];

/**
 * Получить случайный домен из популярных
 */
export const getRandomDomain = (): string => {
  return popularEmailDomains[Math.floor(Math.random() * popularEmailDomains.length)];
};

/**
 * Ключ для localStorage backup
 */
export const getBackupKey = (botId: string): string => `bot_account_backup_${botId}`;

/**
 * Сохранить backup в localStorage
 */
export const saveBackup = (
  botId: string,
  data: {
    email: string;
    password: string;
    registration_date: number;
  },
): void => {
  try {
    localStorage.setItem(getBackupKey(botId), JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save backup:', e);
  }
};

/**
 * Загрузить backup из localStorage
 */
export const loadBackup = (
  botId: string,
): {
  email: string;
  password: string;
  registration_date: number;
} | null => {
  try {
    const data = localStorage.getItem(getBackupKey(botId));
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Failed to load backup:', e);
    return null;
  }
};

/**
 * Проверить существование backup
 */
export const hasBackup = (botId: string): boolean => {
  return !!localStorage.getItem(getBackupKey(botId));
};

/**
 * Удалить backup
 */
export const clearBackup = (botId: string): void => {
  localStorage.removeItem(getBackupKey(botId));
};
