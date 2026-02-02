const fs = require('fs');
const path = require('path');

// Helper functions
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool = () => Math.random() > 0.5;

// Data pools
const racesTBC = ['orc', 'undead', 'tauren', 'troll', 'blood_elf'];
const racesMidnight = ['human', 'dwarf', 'night_elf', 'gnome', 'draenei'];
const classes = ['warrior', 'mage', 'rogue', 'hunter', 'warlock', 'priest', 'druid', 'paladin', 'shaman'];
const serversTBC = ['Gehennas', 'Golemagg', 'Firemaw', 'Mograine', 'Earthshaker'];
const serversMidnight = ['Silvermoon', 'Ravencrest', 'Stormscale', 'Draenor', 'Kazzak'];
const firstNames = ['John', 'Anna', 'Mehmet', 'Olga', 'Ivan', 'Maria', 'Alex', 'Elena', 'David', 'Sophie', 'James', 'Emma'];
const lastNames = ['Smith', 'Johnson', 'Yilmaz', 'Petrova', 'Ivanov', 'Garcia', 'Müller', 'Silva', 'Chen', 'Kim'];
const countries = ['Turkey', 'Ukraine', 'Russia', 'Germany', 'USA', 'UK', 'France', 'Spain'];
const cities = {
  'Turkey': ['Istanbul', 'Ankara', 'Izmir'],
  'Ukraine': ['Kyiv', 'Lviv', 'Odessa'],
  'Russia': ['Moscow', 'St. Petersburg', 'Novosibirsk'],
  'Germany': ['Berlin', 'Munich', 'Hamburg'],
  'USA': ['New York', 'Los Angeles', 'Chicago'],
  'UK': ['London', 'Manchester', 'Birmingham'],
  'France': ['Paris', 'Lyon', 'Marseille'],
  'Spain': ['Madrid', 'Barcelona', 'Valencia']
};
const mailProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'mail.ru', 'yandex.ru'];
const proxyProviders = ['smartproxy', 'luminati', 'oxylabs', 'brightdata', 'packetstream'];
const proxyCountries = ['TR', 'UA', 'RU', 'DE', 'US', 'UK', 'FR', 'ES'];
const statuses = ['offline', 'prepare', 'leveling', 'profession', 'farming', 'banned'];
const professions = ['mining', 'herbalism', 'skinning', 'enchanting', 'engineering', 'blacksmithing', 'jewelcrafting', 'inscription'];

// Generate random date within range
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate person data
const generatePerson = () => {
  const country = randomChoice(countries);
  const city = randomChoice(cities[country]);
  const birthDate = randomDate(new Date(1980, 0, 1), new Date(2000, 11, 31));
  
  return {
    first_name: randomChoice(firstNames),
    last_name: randomChoice(lastNames),
    birth_date: `${String(birthDate.getDate()).padStart(2, '0')}-${String(birthDate.getMonth() + 1).padStart(2, '0')}-${birthDate.getFullYear()}`,
    country: country,
    city: city,
    address: `${randomInt(1, 999)} ${randomChoice(['Main St', 'Central Ave', 'Republic Square', 'Park Road', 'High Street'])}`,
    zip: String(randomInt(10000, 99999))
  };
};

// Generate account data
const generateAccount = () => {
  const provider = randomChoice(mailProviders);
  const id = generateUUID().substring(0, 8);
  return {
    email: `wowbot${id}@${provider}`,
    password: `pass_${generateUUID().substring(0, 12)}`,
    mail_provider: provider.split('.')[0],
    bnet_created_at: Date.now() - randomInt(30, 365) * 24 * 60 * 60 * 1000,
    mail_created_at: Date.now() - randomInt(30, 365) * 24 * 60 * 60 * 1000
  };
};

// Generate proxy data
const generateProxy = (hasProxy = true) => {
  if (!hasProxy) {
    return {
      full_string: '',
      type: 'none',
      ip: '',
      port: 0,
      login: '',
      password: '',
      provider: '',
      country: '',
      fraud_score: 0,
      VPN: false,
      Proxy: false,
      detect_country: false,
      created_at: 0,
      expires_at: 0
    };
  }
  
  const ip = `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`;
  const port = randomChoice([8080, 3128, 1080, 8081, 8118]);
  const login = `user${randomInt(1, 1000)}`;
  const password = `pass${randomInt(1000, 9999)}`;
  
  return {
    full_string: `${ip}:${port}:${login}:${password}`,
    type: randomChoice(['http', 'socks5']),
    ip: ip,
    port: port,
    login: login,
    password: password,
    provider: randomChoice(proxyProviders),
    country: randomChoice(proxyCountries),
    fraud_score: randomInt(0, 50),
    VPN: false,
    Proxy: true,
    detect_country: true,
    created_at: Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000,
    expires_at: Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000
  };
};

// Generate leveling data
const generateLeveling = (currentLevel, maxLevel, status) => {
  const targetLevel = maxLevel;
  const xpCurrent = status === 'leveling' ? randomInt(0, 1000000) : (currentLevel >= maxLevel ? 0 : randomInt(0, 500000));
  const xpRequired = status === 'leveling' ? 1000000 : 0;
  
  return {
    current_level: currentLevel,
    target_level: targetLevel,
    xp_current: xpCurrent,
    xp_required: xpRequired,
    xp_per_hour: status === 'leveling' ? randomInt(5000, 15000) : 0,
    estimated_time_to_level: status === 'leveling' ? randomInt(1, 20) : 0,
    location: randomChoice(['Nagrand', 'Shadowmoon Valley', 'Netherstorm', 'Terokkar Forest', 'Blade\'s Edge Mountains']),
    sub_location: '',
    started_at: Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
    finished_at: currentLevel >= maxLevel ? Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000 : 0
  };
};

// Generate professions data
const generateProfessions = (status) => {
  const numProfessions = randomInt(0, 2);
  const profs = {};
  
  for (let i = 0; i < numProfessions; i++) {
    const profName = randomChoice(professions);
    const skillPoints = status === 'profession' ? randomInt(200, 375) : (randomBool() ? randomInt(1, 375) : 0);
    
    profs[profName] = {
      name: profName.charAt(0).toUpperCase() + profName.slice(1),
      skill_points: skillPoints,
      max_skill_points: 375,
      started_at: skillPoints > 0 ? Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000 : 0,
      finished_at: skillPoints >= 375 ? Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000 : 0
    };
  }
  
  return profs;
};

// Generate schedule data
const generateSchedule = (status) => {
  const schedule = {};
  
  for (let day = 0; day < 7; day++) {
    const isWeekend = day === 0 || day === 6;
    const enabled = isWeekend ? randomBool() : randomBool();
    
    if (enabled) {
      const startHour = isWeekend ? randomInt(8, 12) : randomInt(7, 10);
      const endHour = isWeekend ? randomInt(14, 18) : randomInt(16, 22);
      
      schedule[day] = [{
        start: `${String(startHour).padStart(2, '0')}:00`,
        end: `${String(endHour).padStart(2, '0')}:00`,
        enabled: true,
        profile: status === 'farming' ? 'farming' : (status === 'leveling' ? 'leveling' : 'profession')
      }];
    } else {
      schedule[day] = [];
    }
  }
  
  return schedule;
};

// Generate farm data
const generateFarm = (status) => {
  const totalGold = randomInt(1000, 50000);
  const sessionGold = status === 'farming' ? randomInt(500, 5000) : 0;
  
  return {
    total_gold: sessionGold,
    gold_per_hour: status === 'farming' ? randomInt(50, 200) : 0,
    session_start: status === 'farming' ? Date.now() - randomInt(1, 12) * 60 * 60 * 1000 : 0,
    location: status === 'farming' ? randomChoice(['Shadowmoon Valley', 'Nagrand', 'Netherstorm']) : '',
    profile: status === 'farming' ? randomChoice(['mining_herbs', 'skinning', 'fishing']) : '',
    all_farmed_gold: totalGold
  };
};

// Generate finance data
const generateFinance = (totalGold, goldPrice) => {
  const farmedUsd = (totalGold / 1000) * goldPrice;
  const expenses = randomInt(20, 100);
  
  return {
    total_farmed_usd: parseFloat(farmedUsd.toFixed(2)),
    total_expenses_usd: expenses,
    roi_percent: parseFloat(((farmedUsd / expenses) * 100).toFixed(2))
  };
};

// Generate bot
const generateBot = (index, projectId) => {
  const id = generateUUID();
  const status = randomChoice(statuses);
  const isTBC = projectId === 'wow_tbc';
  const maxLevel = isTBC ? 70 : 80;
  
  let currentLevel;
  if (status === 'leveling') {
    currentLevel = randomInt(1, maxLevel - 1);
  } else if (status === 'banned') {
    currentLevel = randomInt(10, maxLevel);
  } else {
    currentLevel = randomInt(60, maxLevel);
  }
  
  const character = {
    name: `Bot${String(index).padStart(3, '0')}`,
    level: currentLevel,
    race: randomChoice(isTBC ? racesTBC : racesMidnight),
    class: randomChoice(classes),
    server: randomChoice(isTBC ? serversTBC : serversMidnight),
    faction: isTBC ? 'horde' : 'alliance'
  };
  
  const farm = generateFarm(status);
  const goldPrice = isTBC ? 0.0125 : 0.0085;
  
  return {
    id: id,
    project_id: projectId,
    status: status,
    vm: {
      name: `WoW${randomInt(1, 50)}`,
      ip: `192.168.${randomInt(1, 255)}.${randomInt(1, 255)}`,
      created_at: new Date(Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000).toISOString()
    },
    character: character,
    account: generateAccount(),
    person: generatePerson(),
    proxy: generateProxy(status !== 'banned' && randomBool()),
    leveling: generateLeveling(currentLevel, maxLevel, status),
    professions: generateProfessions(status),
    schedule: generateSchedule(status),
    farm: farm,
    finance: generateFinance(farm.all_farmed_gold, goldPrice),
    monitor: {
      screenshot_request: false,
      screenshot_url: null,
      screenshot_timestamp: null,
      status: 'idle'
    },
    last_seen: Date.now() - (status === 'offline' || status === 'banned' ? randomInt(5, 1440) : randomInt(0, 5)) * 60 * 1000,
    updated_at: Date.now(),
    created_at: Date.now() - randomInt(1, 90) * 24 * 60 * 60 * 1000
  };
};

// Generate license
const generateLicense = (index, botId = null) => {
  const status = botId ? 'active' : randomChoice(['active', 'expired', 'revoked']);
  const expiresAt = status === 'active' 
    ? Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000 
    : Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000;
  
  return {
    id: `lic_${String(index).padStart(3, '0')}`,
    key: `SIN-${generateUUID().substring(0, 4).toUpperCase()}-${generateUUID().substring(0, 4).toUpperCase()}-${randomInt(1000, 9999)}`,
    type: 'sin',
    status: status,
    bot_id: botId,
    expires_at: expiresAt,
    created_at: Date.now() - randomInt(30, 90) * 24 * 60 * 60 * 1000,
    updated_at: Date.now()
  };
};

// Generate proxy
const generateProxyEntry = (index, botId = null) => {
  const ip = `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 255)}`;
  const port = randomChoice([8080, 3128, 1080, 8081, 8118]);
  const login = `user${randomInt(1, 1000)}`;
  const password = `pass${randomInt(1000, 9999)}`;
  const status = botId ? 'active' : randomChoice(['active', 'expired', 'banned']);
  
  return {
    id: `proxy_${String(index).padStart(3, '0')}`,
    ip: ip,
    port: port,
    login: login,
    password: password,
    provider: randomChoice(proxyProviders),
    country: randomChoice(proxyCountries),
    type: randomChoice(['http', 'socks5']),
    status: status,
    bot_id: botId,
    fraud_score: randomInt(0, 50),
    expires_at: status === 'active' 
      ? Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000 
      : Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
    created_at: Date.now() - randomInt(30, 90) * 24 * 60 * 60 * 1000,
    updated_at: Date.now()
  };
};

// Generate subscription
const generateSubscription = (index, botId, type) => {
  const status = randomChoice(['active', 'active', 'active', 'expired', 'cancelled']);
  
  return {
    id: `sub_${String(index).padStart(3, '0')}`,
    bot_id: botId,
    type: type,
    status: status,
    expires_at: status === 'active' 
      ? Date.now() + randomInt(7, 90) * 24 * 60 * 60 * 1000 
      : Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
    auto_renew: randomBool(),
    created_at: Date.now() - randomInt(30, 90) * 24 * 60 * 60 * 1000,
    updated_at: Date.now()
  };
};

// Generate finance operation
const generateFinanceOperation = (index, botId) => {
  const type = randomChoice(['income', 'expense', 'expense', 'expense']);
  const categories = type === 'income' 
    ? ['sale'] 
    : ['subscription bot', 'subscription game', 'proxy', 'license'];
  
  return {
    id: `op_${String(index).padStart(3, '0')}`,
    type: type,
    category: randomChoice(categories),
    bot_id: botId,
    description: type === 'income' ? `Gold sold - ${randomInt(1000, 10000)}g` : randomChoice(['Monthly subscription', 'Proxy renewal', 'Game time', 'License fee']),
    amount: type === 'income' ? randomInt(50, 500) : randomInt(10, 100),
    currency: 'USD',
    gold_price_at_time: type === 'income' ? 0.0125 : null,
    date: Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
    created_at: Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000
  };
};

// Generate note
const generateNote = (index, botId = null) => {
  return {
    id: `note_${String(index).padStart(3, '0')}`,
    text: randomChoice([
      'Check proxy settings',
      'Update schedule',
      'Review ROI performance',
      'Check for bans',
      'Update character gear',
      'Monitor gold prices',
      'Review daily stats',
      'Check VM performance'
    ]),
    completed: randomBool(),
    bot_id: botId,
    created_at: Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
    updated_at: Date.now()
  };
};

// Main generation function
const generateAllData = () => {
  const data = {
    _meta: {
      description: 'Generated test data for Bot-Mox System',
      version: '1.1.0',
      created_at: new Date().toISOString(),
      note: 'This data was auto-generated with diverse statuses and configurations'
    },
    projects: {
      wow_tbc: {
        id: 'wow_tbc',
        name: 'WoW TBC Classic',
        game: 'World of Warcraft',
        expansion: 'The Burning Crusade',
        currency: 'gold',
        currency_symbol: 'g',
        max_level: 70,
        professions: ['mining', 'herbalism', 'skinning', 'enchanting', 'engineering', 'blacksmithing', 'jewelcrafting', 'alchemy'],
        gold_price_usd: 0.0125,
        server_region: 'Europe',
        created_at: Date.now() - 90 * 24 * 60 * 60 * 1000,
        updated_at: Date.now()
      },
      wow_midnight: {
        id: 'wow_midnight',
        name: 'WoW Midnight',
        game: 'World of Warcraft',
        expansion: 'Midnight',
        currency: 'gold',
        currency_symbol: 'g',
        max_level: 80,
        professions: ['mining', 'herbalism', 'skinning', 'enchanting', 'engineering', 'blacksmithing', 'jewelcrafting', 'alchemy', 'inscription'],
        gold_price_usd: 0.0085,
        server_region: 'Europe',
        created_at: Date.now() - 60 * 24 * 60 * 60 * 1000,
        updated_at: Date.now()
      }
    },
    bots: {},
    archive: {},
    daily_stats: {},
    logs: {},
    finance: {
      operations: {},
      daily_stats: {},
      gold_price_history: {}
    },
    notes: {},
    gold_prices: {
      wow_tbc: {
        current: {
          price_per_1000: 12.50,
          updated_at: Date.now(),
          updated_by: 'admin_001',
          source: 'manual'
        },
        history: {}
      },
      wow_midnight: {
        current: {
          price_per_1000: 8.50,
          updated_at: Date.now(),
          updated_by: 'admin_001',
          source: 'manual'
        },
        history: {}
      }
    },
    users: {
      admin_001: {
        id: 'admin_001',
        email: 'admin@botmox.local',
        name: 'Administrator',
        role: 'admin',
        permissions: {
          bots: ['read', 'write', 'delete'],
          finance: ['read', 'write'],
          settings: ['read', 'write'],
          archive: ['read', 'write']
        },
        telegram_id: '123456789',
        notifications: {
          bot_start: true,
          bot_status_change: true,
          bot_offline: true,
          bot_banned: true,
          daily_report: true,
          low_roi_alert: true
        },
        last_login: Date.now(),
        created_at: Date.now() - 90 * 24 * 60 * 60 * 1000
      },
      operator_001: {
        id: 'operator_001',
        email: 'operator@botmox.local',
        name: 'Operator',
        role: 'operator',
        permissions: {
          bots: ['read', 'write'],
          finance: ['read'],
          settings: ['read'],
          archive: ['read']
        },
        telegram_id: '987654321',
        notifications: {
          bot_start: true,
          bot_status_change: true,
          bot_offline: true,
          bot_banned: true,
          daily_report: false,
          low_roi_alert: false
        },
        last_login: Date.now() - 24 * 60 * 60 * 1000,
        created_at: Date.now() - 80 * 24 * 60 * 60 * 1000
      }
    },
    settings: {
      system: {
        app_name: 'Bot-Mox',
        theme: 'dark',
        currency: 'USD'
      },
      offline_detection: {
        offline_timeout_sec: 300
      },
      data_retention: {
        logs_retention_days: 7
      },
      notifications: {
        telegram_bot_token: '',
        telegram_chat_id: '',
        alerts: {
          bot_offline_delay_minutes: 5,
          low_roi_threshold: 50,
          daily_report_time: '09:00'
        }
      },
      roi_calculation: {
        include_proxy_cost: true,
        include_subscription_cost: true,
        include_session_cost: true,
        depreciation_days: 30
      },
      data_export: {
        auto_archive_daily: true,
        local_storage_key: 'botmox_archived_data'
      },
      development: {
        show_example_data: false,
        use_mock_data: false
      }
    },
    bot_licenses: {},
    proxies: {},
    subscriptions: {},
    subscriptions_summary: {
      total_active: 0,
      total_expired: 0,
      by_type: {
        wow_tbc: { active_count: 0, expired_count: 0, total_count: 0 },
        wow_midnight: { active_count: 0, expired_count: 0, total_count: 0 }
      },
      expiring_soon: {},
      last_updated: Date.now()
    }
  };

  // Generate bots for TBC
  const tbcBotCount = 8;
  const tbcBots = [];
  for (let i = 1; i <= tbcBotCount; i++) {
    const bot = generateBot(i, 'wow_tbc');
    data.bots[bot.id] = bot;
    tbcBots.push(bot);
  }

  // Generate bots for Midnight
  const midnightBotCount = 6;
  const midnightBots = [];
  for (let i = 1; i <= midnightBotCount; i++) {
    const bot = generateBot(i + tbcBotCount, 'wow_midnight');
    data.bots[bot.id] = bot;
    midnightBots.push(bot);
  }

  const allBots = [...tbcBots, ...midnightBots];

  // Generate licenses
  let licIndex = 1;
  allBots.forEach(bot => {
    if (bot.status !== 'banned') {
      const license = generateLicense(licIndex++, bot.id);
      data.bot_licenses[license.id] = license;
    }
  });
  // Add some unassigned licenses
  for (let i = 0; i < 3; i++) {
    const license = generateLicense(licIndex++, null);
    data.bot_licenses[license.id] = license;
  }

  // Generate proxies
  let proxyIndex = 1;
  allBots.forEach(bot => {
    if (bot.proxy.type !== 'none') {
      const proxy = generateProxyEntry(proxyIndex++, bot.id);
      data.proxies[proxy.id] = proxy;
    }
  });
  // Add some unassigned proxies
  for (let i = 0; i < 5; i++) {
    const proxy = generateProxyEntry(proxyIndex++, null);
    data.proxies[proxy.id] = proxy;
  }

  // Generate subscriptions
  let subIndex = 1;
  allBots.forEach(bot => {
    const sub = generateSubscription(subIndex++, bot.id, bot.project_id);
    data.subscriptions[sub.id] = sub;
    
    // Update summary
    if (sub.status === 'active') {
      data.subscriptions_summary.total_active++;
      data.subscriptions_summary.by_type[bot.project_id].active_count++;
    } else {
      data.subscriptions_summary.total_expired++;
      data.subscriptions_summary.by_type[bot.project_id].expired_count++;
    }
    data.subscriptions_summary.by_type[bot.project_id].total_count++;
    
    // Check if expiring soon
    const daysRemaining = Math.ceil((sub.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7 && daysRemaining > 0) {
      data.subscriptions_summary.expiring_soon[sub.id] = {
        id: sub.id,
        bot_id: bot.id,
        type: bot.project_id,
        expires_at: sub.expires_at,
        days_remaining: daysRemaining
      };
    }
  });

  // Generate finance operations
  let opIndex = 1;
  allBots.forEach(bot => {
    const numOps = randomInt(1, 5);
    for (let i = 0; i < numOps; i++) {
      const op = generateFinanceOperation(opIndex++, bot.id);
      data.finance.operations[op.id] = op;
    }
  });

  // Generate notes
  let noteIndex = 1;
  for (let i = 0; i < 5; i++) {
    const note = generateNote(noteIndex++, null);
    data.notes[note.id] = note;
  }
  allBots.forEach(bot => {
    if (randomBool()) {
      const note = generateNote(noteIndex++, bot.id);
      data.notes[note.id] = note;
    }
  });

  // Generate archive entries for banned bots
  let archIndex = 1;
  allBots.filter(b => b.status === 'banned').forEach(bot => {
    data.archive[`arch_${bot.id}`] = {
      bot_id: bot.id,
      archived_at: Date.now(),
      reason: 'banned',
      ban_details: {
        date: Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000,
        reason: randomChoice(['suspicious_activity', 'botting_detected', 'player_reports']),
        ban_mechanism: 'account_suspension'
      },
      snapshot: {
        project_id: bot.project_id,
        character: bot.character,
        final_level: bot.character.level,
        total_farmed: bot.farm.all_farmed_gold,
        total_earned_gold: bot.farm.all_farmed_gold,
        total_runtime_hours: randomInt(100, 1000)
      }
    };
  });

  // Generate gold price history
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    const timestamp = date.getTime();
    
    data.finance.gold_price_history[dateKey] = {
      price: 0.0125 + (Math.random() * 0.005 - 0.0025)
    };
    
    data.gold_prices.wow_tbc.history[timestamp] = {
      price_per_1000: 12.50 + (Math.random() * 2 - 1),
      date: timestamp
    };
    data.gold_prices.wow_midnight.history[timestamp] = {
      price_per_1000: 8.50 + (Math.random() * 1.5 - 0.75),
      date: timestamp
    };
  }

  // Generate daily stats
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split('T')[0];
    
    data.daily_stats[dateKey] = {};
    allBots.filter(b => b.status !== 'banned').forEach(bot => {
      data.daily_stats[dateKey][bot.id] = {
        gold_farmed: randomInt(500, 3000),
        hours_online: randomInt(4, 16),
        xp_gained: randomInt(50000, 500000),
        deaths: randomInt(0, 5),
        levels_gained: randomInt(0, 2),
        last_update: Date.now() - i * 24 * 60 * 60 * 1000
      };
    });
    
    data.finance.daily_stats[dateKey] = {
      date: dateKey,
      total_expenses: randomInt(30, 100),
      total_revenue: randomInt(50, 300),
      net_profit: randomInt(-20, 200),
      active_bots: allBots.filter(b => b.status !== 'banned').length,
      total_farmed: {
        wow_tbc: { gold: randomInt(5000, 15000) },
        wow_midnight: { gold: randomInt(3000, 10000) }
      }
    };
  }

  // Generate logs
  allBots.forEach(bot => {
    data.logs[bot.id] = {};
    const numLogs = randomInt(3, 10);
    
    for (let i = 1; i <= numLogs; i++) {
      const eventTypes = ['level_up', 'death', 'status_change', 'gold_milestone'];
      const type = randomChoice(eventTypes);
      
      let message, eventData;
      switch (type) {
        case 'level_up':
          const oldLevel = bot.character.level - 1;
          message = `Level up: ${oldLevel} -> ${bot.character.level}`;
          eventData = { old_level: oldLevel, new_level: bot.character.level, location: bot.leveling.location };
          break;
        case 'death':
          message = `Died in ${bot.leveling.location || 'Unknown'}`;
          eventData = { location: bot.leveling.location || 'Unknown', killer: randomChoice(['Mob', 'Player', 'Boss']) };
          break;
        case 'status_change':
          const oldStatus = randomChoice(['offline', 'prepare', 'leveling']);
          message = `Status changed: ${oldStatus} -> ${bot.status}`;
          eventData = { old_status: oldStatus, new_status: bot.status };
          break;
        case 'gold_milestone':
          const milestone = Math.floor(bot.farm.all_farmed_gold / 1000) * 1000;
          message = `Gold milestone reached: ${milestone}g`;
          eventData = { milestone: milestone, total: bot.farm.all_farmed_gold };
          break;
      }
      
      data.logs[bot.id][`evt_${String(i).padStart(3, '0')}`] = {
        type: type,
        timestamp: Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000,
        message: message,
        data: eventData
      };
    }
  });

  return data;
};

// Generate and save data
const data = generateAllData();
const outputPath = path.join(__dirname, '..', 'EXAMPLE_DATA.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log('✅ Data generated successfully!');
console.log(`📁 Saved to: ${outputPath}`);
console.log('\n📊 Generated entities:');
console.log(`  - Projects: ${Object.keys(data.projects).length}`);
console.log(`  - Bots: ${Object.keys(data.bots).length}`);
console.log(`  - Archive entries: ${Object.keys(data.archive).length}`);
console.log(`  - Licenses: ${Object.keys(data.bot_licenses).length}`);
console.log(`  - Proxies: ${Object.keys(data.proxies).length}`);
console.log(`  - Subscriptions: ${Object.keys(data.subscriptions).length}`);
console.log(`  - Finance operations: ${Object.keys(data.finance.operations).length}`);
console.log(`  - Notes: ${Object.keys(data.notes).length}`);
console.log(`  - Log entries: ${Object.keys(data.logs).length}`);
