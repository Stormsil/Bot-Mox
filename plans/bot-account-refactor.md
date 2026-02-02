# План рефакторинга BotAccount компонента

## Обзор задачи

Рефакторинг компонента `BotAccount` для поддержки:
- Загрузки данных из Firebase
- Валидации и предупреждений (как в BotPerson)
- Генератора паролей с настройками
- Генератора email на основе данных person
- Модального подтверждения перед генерацией
- Локального сохранения предыдущих значений

## Архитектура

```mermaid
flowchart TD
    A[BotAccount Component] --> B[Firebase Data Loading]
    A --> C[Form State Management]
    A --> D[Validation & Warnings]
    A --> E[Password Generator]
    A --> F[Email Generator]
    A --> G[Local Storage Backup]
    
    B --> B1[useEffect: Load from bots/{id}/account]
    B --> B2[Auto-sync with Firebase]
    
    C --> C1[email, password, registration_date]
    C --> C2[Domain selector]
    
    D --> D1[Check empty fields]
    D --> D2[Show warning icons]
    D --> D3[Alert banner]
    
    E --> E1[Length: 12 default]
    E --> E2[Options: uppercase, lowercase, numbers, symbols]
    E --> E3[Modal confirmation]
    
    F --> F1[Translit: name + surname]
    F --> F2[Random algorithm: 50% order, 33% separator]
    F --> F3[Suffix: year/month/day from birth_date]
    F --> F4[Check person data exists]
    F --> F5[Modal confirmation]
    
    G --> G1[Save to localStorage on generate]
    G --> G2[Restore button]
```

## Структура данных

### AccountData (обновлённый тип)
```typescript
interface AccountData {
  email: string;
  password: string;
  registration_date: number; // timestamp
}
```

### ExtendedBot (account поле)
```typescript
interface ExtendedBot extends Bot {
  account?: {
    email: string;
    password: string;
    bnet_created_at?: number; // timestamp из схемы
    mail_created_at?: number;
  };
  person?: {
    first_name: string;
    last_name: string;
    birth_date: string; // DD-MM-YYYY
  };
}
```

## Компоненты

### 1. Утилиты (`utils/accountGenerators.ts`)

#### Транслитерация
```typescript
// Поддержка: украинский, русский, турецкий
const transliterate = (text: string): string
// Примеры:
// "Олександр" → "oleksandr"
// "Коваленко" → "kovaleko"
// "Mehmet" → "mehmet"
// "Yılmaz" → "yilmaz"
```

#### Генератор пароля
```typescript
interface PasswordOptions {
  length: number;        // default: 12
  uppercase: boolean;    // default: true
  lowercase: boolean;    // default: true
  numbers: boolean;      // default: true
  symbols: boolean;      // default: true
}

const generatePassword = (options: PasswordOptions): string
```

#### Генератор email
```typescript
interface EmailGeneratorParams {
  firstName: string;
  lastName: string;
  birthDate: string; // DD-MM-YYYY
  domain: string;    // например: gmail.com
}

const generateEmail = (params: EmailGeneratorParams): string
// Алгоритм:
// 1. Транслитерация firstName и lastName
// 2. 50% шанс: lastName_firstName или firstName_lastName
// 3. 33% шанс на разделитель: _, -, или слитно
// 4. Случайный суффикс из birthDate: YY, MM, или DD
// Примеры:
// - kovale_ivan90@gmail.com
// - ivan.kovalenko05@outlook.com
// - mehmetyilmaz20@yahoo.com
```

### 2. BotAccount Component

#### State
```typescript
const [account, setAccount] = useState<AccountData>({
  email: '',
  password: '',
  registration_date: 0,
});
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [showPassword, setShowPassword] = useState(false);
const [selectedDomain, setSelectedDomain] = useState('gmail.com');

// Generator options
const [passwordOptions, setPasswordOptions] = useState({
  length: 12,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
});

// Modals
const [showGenerateModal, setShowGenerateModal] = useState(false);
const [pendingGeneration, setPendingGeneration] = useState<{
  type: 'password' | 'email' | 'both';
} | null>(null);

// Local storage backup
const [hasBackup, setHasBackup] = useState(false);
```

#### Effects
```typescript
// Загрузка из Firebase
useEffect(() => {
  if (!bot?.id) return;
  
  const accountRef = ref(database, `bots/${bot.id}/account`);
  const unsubscribe = onValue(accountRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      setAccount({
        email: data.email || '',
        password: data.password || '',
        registration_date: data.bnet_created_at || data.mail_created_at || 0,
      });
    }
    setLoading(false);
  });
  
  // Check localStorage backup
  const backup = localStorage.getItem(`bot_account_backup_${bot.id}`);
  setHasBackup(!!backup);
  
  return () => unsubscribe();
}, [bot?.id]);
```

#### Handlers
```typescript
// Save to Firebase
const handleSave = async (values: AccountData) => {
  const accountRef = ref(database, `bots/${bot.id}/account`);
  await update(accountRef, {
    email: values.email,
    password: values.password,
    bnet_created_at: values.registration_date,
  });
};

// Generate with confirmation
const requestGeneration = (type: 'password' | 'email' | 'both') => {
  // Save current values to localStorage
  localStorage.setItem(`bot_account_backup_${bot.id}`, JSON.stringify(account));
  setHasBackup(true);
  
  setPendingGeneration({ type });
  setShowGenerateModal(true);
};

const confirmGeneration = () => {
  if (!pendingGeneration) return;
  
  const { type } = pendingGeneration;
  
  if (type === 'password' || type === 'both') {
    const newPassword = generatePassword(passwordOptions);
    form.setFieldValue('password', newPassword);
  }
  
  if (type === 'email' || type === 'both') {
    if (!isPersonDataComplete(bot.person)) {
      message.error('Person data must be filled first');
      return;
    }
    
    const newEmail = generateEmail({
      firstName: bot.person.first_name,
      lastName: bot.person.last_name,
      birthDate: bot.person.birth_date,
      domain: selectedDomain,
    });
    form.setFieldValue('email', newEmail);
  }
  
  setShowGenerateModal(false);
  setPendingGeneration(null);
};

// Restore from backup
const handleRestore = () => {
  const backup = localStorage.getItem(`bot_account_backup_${bot.id}`);
  if (backup) {
    const data = JSON.parse(backup);
    form.setFieldsValue(data);
    message.success('Previous values restored');
  }
};

// Set current date/time
const setCurrentDateTime = () => {
  form.setFieldValue('registration_date', Date.now());
};
```

#### Render
```typescript
// Warning icons for empty fields (как в BotPerson)
<Form.Item
  label={
    <span className="field-label">
      Email
      {!form.getFieldValue('email') && (
        <ExclamationCircleOutlined className="field-warning-icon" />
      )}
    </span>
  }
  name="email"
>

// Domain selector for email generation
<Select value={selectedDomain} onChange={setSelectedDomain}>
  <Option value="gmail.com">gmail.com</Option>
  <Option value="outlook.com">outlook.com</Option>
  <Option value="yahoo.com">yahoo.com</Option>
  <Option value="custom">Custom...</Option>
</Select>

// Password generator options
<Card title="Password Generator" size="small">
  <InputNumber value={passwordOptions.length} onChange={...} min={8} max={32} />
  <Checkbox checked={passwordOptions.uppercase} onChange={...}>A-Z</Checkbox>
  <Checkbox checked={passwordOptions.lowercase} onChange={...}>a-z</Checkbox>
  <Checkbox checked={passwordOptions.numbers} onChange={...}>0-9</Checkbox>
  <Checkbox checked={passwordOptions.symbols} onChange={...}>!@#$%</Checkbox>
</Card>

// Registration date with "Now" button
<Form.Item label="Registration Date" name="registration_date">
  <DatePicker showTime />
  <Button onClick={setCurrentDateTime}>Now</Button>
</Form.Item>

// Generate buttons
<Button onClick={() => requestGeneration('password')}>Generate Password</Button>
<Button onClick={() => requestGeneration('email')}>Generate Email</Button>
<Button onClick={() => requestGeneration('both')}>Generate Both</Button>

// Restore button (if backup exists)
{hasBackup && (
  <Button onClick={handleRestore}>Restore Previous</Button>
)}

// Confirmation Modal
<Modal
  title="Confirm Generation"
  open={showGenerateModal}
  onOk={confirmGeneration}
  onCancel={() => setShowGenerateModal(false)}
>
  <p>Current email and password will be replaced.</p>
  <p>Previous values will be saved and can be restored.</p>
</Modal>
```

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Account Information                              [⚠️]      │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Some fields are empty...                                │
├─────────────────────────────────────────────────────────────┤
│  Email * [⚠️]          [👁️] [📋]                            │
│  [user@example.com    ] [Generate Email ▼]                  │
│                          - gmail.com                        │
│                          - outlook.com                      │
│                          - yahoo.com                        │
│                          - Custom...                        │
├─────────────────────────────────────────────────────────────┤
│  Password * [⚠️]       [👁️] [📋]                            │
│  [••••••••••••        ] [Generate Password]                 │
├─────────────────────────────────────────────────────────────┤
│  Password Generator:                                        │
│  Length: [12]  [✓] A-Z  [✓] a-z  [✓] 0-9  [✓] !@#$%        │
├─────────────────────────────────────────────────────────────┤
│  Registration Date * [⚠️]                                   │
│  [2026-01-30 17:30    ] [Now]                               │
├─────────────────────────────────────────────────────────────┤
│  [Restore Previous]    [Generate Both]  [Save Changes]      │
└─────────────────────────────────────────────────────────────┘
```

## Файлы для изменения

1. **`src/types/index.ts`** - Обновить AccountData тип
2. **`src/utils/accountGenerators.ts`** - Новый файл с утилитами
3. **`src/components/bot/BotAccount.tsx`** - Полный рефакторинг
4. **`src/components/bot/BotAccount.css`** - Обновить стили
5. **`src/pages/bot/index.tsx`** - Проверить передачу person данных

## Проверка перед генерацией email

```typescript
const isPersonDataComplete = (person?: PersonData): boolean => {
  if (!person) return false;
  return !!(
    person.first_name?.trim() &&
    person.last_name?.trim() &&
    person.birth_date?.trim()
  );
};

// Вызов перед генерацией email
if (!isPersonDataComplete(bot.person)) {
  message.error('Please fill Person data first (First Name, Last Name, Birth Date)');
  return;
}
```

## Локальное сохранение

```typescript
// Ключ для localStorage
const getBackupKey = (botId: string) => `bot_account_backup_${botId}`;

// Сохранение перед генерацией
localStorage.setItem(getBackupKey(bot.id), JSON.stringify({
  email: currentEmail,
  password: currentPassword,
  registration_date: currentDate,
}));

// Восстановление
const backup = localStorage.getItem(getBackupKey(bot.id));
if (backup) {
  const data = JSON.parse(backup);
  form.setFieldsValue(data);
}
```
