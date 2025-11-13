/**
 * Internationalization (i18n) Service
 * 
 * Handles:
 * - Multi-language support
 * - Multi-currency support
 * - Localization
 * - Regional configuration
 */

/**
 * Supported languages
 */
export type Language = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'pt' | 'ru' | 'ar';

/**
 * Supported currencies
 */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'KRW' | 'INR' | 'AUD' | 'CAD' | 'SGD';

/**
 * Language configuration
 */
export interface LanguageConfig {
  code: Language;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  timeFormat: string;
  decimalSeparator: string;
  thousandsSeparator: string;
}

/**
 * Currency configuration
 */
export interface CurrencyConfig {
  code: Currency;
  name: string;
  symbol: string;
  decimals: number;
  exchangeRate: number; // relative to USD
}

/**
 * Locale configuration
 */
export interface LocaleConfig {
  language: Language;
  currency: Currency;
  timezone: string;
  dateFormat: string;
}

/**
 * Translation strings
 */
export interface TranslationStrings {
  [key: string]: string | TranslationStrings;
}

/**
 * Language configurations
 */
const languageConfigs: Record<Language, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    dateFormat: 'YYYY/MM/DD',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    dateFormat: 'YYYY年MM月DD日',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    dateFormat: 'YYYY.MM.DD',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    dateFormat: 'DD.MM.YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: ',',
    thousandsSeparator: ' ',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    decimalSeparator: '٫',
    thousandsSeparator: '٬',
  },
};

/**
 * Currency configurations
 */
const currencyConfigs: Record<Currency, CurrencyConfig> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimals: 2,
    exchangeRate: 1.0,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimals: 2,
    exchangeRate: 0.92,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    decimals: 2,
    exchangeRate: 0.79,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    decimals: 0,
    exchangeRate: 149.5,
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    decimals: 2,
    exchangeRate: 7.24,
  },
  KRW: {
    code: 'KRW',
    name: 'South Korean Won',
    symbol: '₩',
    decimals: 0,
    exchangeRate: 1319.5,
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    decimals: 2,
    exchangeRate: 83.12,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    decimals: 2,
    exchangeRate: 1.53,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    decimals: 2,
    exchangeRate: 1.36,
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    decimals: 2,
    exchangeRate: 1.35,
  },
};

/**
 * Translation resources
 */
const translations: Record<Language, TranslationStrings> = {
  en: {
    common: {
      welcome: 'Welcome',
      logout: 'Logout',
      settings: 'Settings',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
    },
    order: {
      title: 'Orders',
      create: 'Create Order',
      status: 'Status',
      total: 'Total',
      items: 'Items',
      completed: 'Completed',
      pending: 'Pending',
      failed: 'Failed',
    },
    payment: {
      title: 'Payment',
      method: 'Payment Method',
      amount: 'Amount',
      currency: 'Currency',
      success: 'Payment Successful',
      failed: 'Payment Failed',
    },
  },
  zh: {
    common: {
      welcome: '欢迎',
      logout: '退出登录',
      settings: '设置',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      search: '搜索',
    },
    order: {
      title: '订单',
      create: '创建订单',
      status: '状态',
      total: '总计',
      items: '项目',
      completed: '已完成',
      pending: '待处理',
      failed: '失败',
    },
    payment: {
      title: '支付',
      method: '支付方式',
      amount: '金额',
      currency: '货币',
      success: '支付成功',
      failed: '支付失败',
    },
  },
  es: {
    common: {
      welcome: 'Bienvenido',
      logout: 'Cerrar sesión',
      settings: 'Configuración',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      add: 'Añadir',
      search: 'Buscar',
    },
    order: {
      title: 'Pedidos',
      create: 'Crear Pedido',
      status: 'Estado',
      total: 'Total',
      items: 'Artículos',
      completed: 'Completado',
      pending: 'Pendiente',
      failed: 'Fallido',
    },
    payment: {
      title: 'Pago',
      method: 'Método de Pago',
      amount: 'Cantidad',
      currency: 'Moneda',
      success: 'Pago Exitoso',
      failed: 'Pago Fallido',
    },
  },
  fr: {
    common: {
      welcome: 'Bienvenue',
      logout: 'Déconnexion',
      settings: 'Paramètres',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      add: 'Ajouter',
      search: 'Rechercher',
    },
    order: {
      title: 'Commandes',
      create: 'Créer une Commande',
      status: 'Statut',
      total: 'Total',
      items: 'Articles',
      completed: 'Complété',
      pending: 'En attente',
      failed: 'Échoué',
    },
    payment: {
      title: 'Paiement',
      method: 'Méthode de Paiement',
      amount: 'Montant',
      currency: 'Devise',
      success: 'Paiement Réussi',
      failed: 'Paiement Échoué',
    },
  },
  de: {
    common: {
      welcome: 'Willkommen',
      logout: 'Abmelden',
      settings: 'Einstellungen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      add: 'Hinzufügen',
      search: 'Suchen',
    },
    order: {
      title: 'Bestellungen',
      create: 'Bestellung Erstellen',
      status: 'Status',
      total: 'Gesamtbetrag',
      items: 'Artikel',
      completed: 'Abgeschlossen',
      pending: 'Ausstehend',
      failed: 'Fehlgeschlagen',
    },
    payment: {
      title: 'Zahlung',
      method: 'Zahlungsmethode',
      amount: 'Betrag',
      currency: 'Währung',
      success: 'Zahlung Erfolgreich',
      failed: 'Zahlung Fehlgeschlagen',
    },
  },
  ja: {
    common: {
      welcome: 'ようこそ',
      logout: 'ログアウト',
      settings: '設定',
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      edit: '編集',
      add: '追加',
      search: '検索',
    },
    order: {
      title: '注文',
      create: '注文を作成',
      status: 'ステータス',
      total: '合計',
      items: 'アイテム',
      completed: '完了',
      pending: '保留中',
      failed: '失敗',
    },
    payment: {
      title: '支払い',
      method: '支払い方法',
      amount: '金額',
      currency: '通貨',
      success: '支払い成功',
      failed: '支払い失敗',
    },
  },
  ko: {
    common: {
      welcome: '환영합니다',
      logout: '로그아웃',
      settings: '설정',
      save: '저장',
      cancel: '취소',
      delete: '삭제',
      edit: '편집',
      add: '추가',
      search: '검색',
    },
    order: {
      title: '주문',
      create: '주문 생성',
      status: '상태',
      total: '합계',
      items: '항목',
      completed: '완료',
      pending: '대기 중',
      failed: '실패',
    },
    payment: {
      title: '결제',
      method: '결제 방법',
      amount: '금액',
      currency: '통화',
      success: '결제 성공',
      failed: '결제 실패',
    },
  },
  pt: {
    common: {
      welcome: 'Bem-vindo',
      logout: 'Sair',
      settings: 'Configurações',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      edit: 'Editar',
      add: 'Adicionar',
      search: 'Pesquisar',
    },
    order: {
      title: 'Pedidos',
      create: 'Criar Pedido',
      status: 'Status',
      total: 'Total',
      items: 'Itens',
      completed: 'Concluído',
      pending: 'Pendente',
      failed: 'Falha',
    },
    payment: {
      title: 'Pagamento',
      method: 'Método de Pagamento',
      amount: 'Valor',
      currency: 'Moeda',
      success: 'Pagamento Bem-sucedido',
      failed: 'Pagamento Falhou',
    },
  },
  ru: {
    common: {
      welcome: 'Добро пожаловать',
      logout: 'Выход',
      settings: 'Настройки',
      save: 'Сохранить',
      cancel: 'Отмена',
      delete: 'Удалить',
      edit: 'Редактировать',
      add: 'Добавить',
      search: 'Поиск',
    },
    order: {
      title: 'Заказы',
      create: 'Создать Заказ',
      status: 'Статус',
      total: 'Итого',
      items: 'Товары',
      completed: 'Завершено',
      pending: 'В ожидании',
      failed: 'Ошибка',
    },
    payment: {
      title: 'Платеж',
      method: 'Способ Платежа',
      amount: 'Сумма',
      currency: 'Валюта',
      success: 'Платеж Успешен',
      failed: 'Платеж Не Удался',
    },
  },
  ar: {
    common: {
      welcome: 'أهلا وسهلا',
      logout: 'تسجيل الخروج',
      settings: 'الإعدادات',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تحرير',
      add: 'إضافة',
      search: 'بحث',
    },
    order: {
      title: 'الطلبات',
      create: 'إنشاء طلب',
      status: 'الحالة',
      total: 'الإجمالي',
      items: 'العناصر',
      completed: 'مكتمل',
      pending: 'قيد الانتظار',
      failed: 'فشل',
    },
    payment: {
      title: 'الدفع',
      method: 'طريقة الدفع',
      amount: 'المبلغ',
      currency: 'العملة',
      success: 'نجح الدفع',
      failed: 'فشل الدفع',
    },
  },
};

/**
 * Get language configuration
 */
export function getLanguageConfig(language: Language): LanguageConfig {
  return languageConfigs[language];
}

/**
 * Get currency configuration
 */
export function getCurrencyConfig(currency: Currency): CurrencyConfig {
  return currencyConfigs[currency];
}

/**
 * Get translation
 */
export function getTranslation(language: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[language];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const config = getCurrencyConfig(currency);
  const formatted = (amount / Math.pow(10, config.decimals)).toLocaleString(
    undefined,
    {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }
  );

  return `${config.symbol}${formatted}`;
}

/**
 * Convert currency
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number {
  const fromRate = getCurrencyConfig(fromCurrency).exchangeRate;
  const toRate = getCurrencyConfig(toCurrency).exchangeRate;

  return (amount / fromRate) * toRate;
}

/**
 * Format date
 */
export function formatDate(date: Date, language: Language): string {
  const config = getLanguageConfig(language);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (config.dateFormat === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  } else if (config.dateFormat === 'YYYY/MM/DD') {
    return `${year}/${month}/${day}`;
  } else if (config.dateFormat === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  } else if (config.dateFormat === 'DD.MM.YYYY') {
    return `${day}.${month}.${year}`;
  } else if (config.dateFormat === 'YYYY.MM.DD') {
    return `${year}.${month}.${day}`;
  } else if (config.dateFormat === 'YYYY年MM月DD日') {
    return `${year}年${month}月${day}日`;
  }

  return date.toLocaleDateString();
}

/**
 * Format number
 */
export function formatNumber(value: number, language: Language): string {
  const config = getLanguageConfig(language);
  const parts = value.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
  
  if (decimalPart) {
    return `${formattedInteger}${config.decimalSeparator}${decimalPart}`;
  }

  return formattedInteger;
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): LanguageConfig[] {
  return Object.values(languageConfigs);
}

/**
 * Get supported currencies
 */
export function getSupportedCurrencies(): CurrencyConfig[] {
  return Object.values(currencyConfigs);
}
