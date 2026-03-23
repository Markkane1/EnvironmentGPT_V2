// =====================================================
// EPA Punjab EnvironmentGPT - Internationalization
// Phase 4: Multi-Language Support (English, Urdu, Punjabi)
// =====================================================

export const languages = {
  en: {
    name: 'English',
    native: 'English',
    dir: 'ltr',
    locale: 'en-PK'
  },
  ur: {
    name: 'Urdu',
    native: 'اردو',
    dir: 'rtl',
    locale: 'ur-PK'
  },
  pa: {
    name: 'Punjabi',
    native: 'پنجابی',
    dir: 'rtl',
    locale: 'pa-PK'
  }
} as const

export type LanguageCode = keyof typeof languages

// English translations
export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    // App
    'app.title': 'EPA Punjab EnvironmentGPT',
    'app.subtitle': 'Environmental Knowledge Assistant',
    'app.description': 'Ask questions about environmental issues in Punjab, Pakistan',
    'app.version': 'Beta Version',
    
    // Navigation
    'nav.newChat': 'New Chat',
    'nav.filters': 'Filters',
    'nav.documents': 'Documents',
    'nav.history': 'History',
    'nav.admin': 'Admin Dashboard',
    'nav.settings': 'Settings',
    'nav.help': 'Help',
    
    // Chat
    'chat.placeholder': 'Ask about environmental issues in Punjab...',
    'chat.send': 'Send',
    'chat.regenerate': 'Regenerate',
    'chat.copy': 'Copy',
    'chat.copied': 'Copied',
    'chat.sources': 'Sources',
    'chat.thinking': 'Searching knowledge base...',
    'chat.error': 'Failed to get response. Please try again.',
    
    // Filters
    'filter.audience': 'Select Audience',
    'filter.category': 'Filter by Category',
    'filter.reportSeries': 'Filter by Report Series',
    'filter.search': 'Search Documents',
    'filter.allCategories': 'All Categories',
    'filter.allReports': 'All Reports',
    
    // Audience Types
    'audience.general': 'General Public',
    'audience.technical': 'Technical Experts',
    'audience.policy': 'Policy Makers',
    
    // Documents
    'docs.title': 'Documents',
    'docs.upload': 'Upload Document',
    'docs.noDocuments': 'No documents found',
    'docs.uploadFirst': 'Upload First Document',
    'docs.processing': 'Processing...',
    
    // Stats
    'stats.documents': 'Documents',
    'stats.chunks': 'Chunks',
    'stats.queries': 'Queries',
    'stats.sessions': 'Sessions',
    
    // Suggested Questions
    'suggested.airQuality': 'What is the current air quality situation in Punjab?',
    'suggested.waterQuality': 'How does EPA Punjab monitor water quality?',
    'suggested.climate': 'What are the climate change impacts in Punjab?',
    'suggested.policy': 'What are the key environmental laws in Punjab?',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    
    // Export
    'export.title': 'Export',
    'export.pdf': 'Export as PDF',
    'export.csv': 'Export as CSV',
    'export.json': 'Export as JSON',
    
    // Feedback
    'feedback.title': 'Was this helpful?',
    'feedback.submit': 'Submit Feedback',
    'feedback.thanks': 'Thanks for your feedback!',
    
    // Admin
    'admin.title': 'Admin Dashboard',
    'admin.overview': 'Overview',
    'admin.health': 'System Health',
    'admin.uptime': 'Uptime',
    'admin.status': 'Status',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.confirm': 'Confirm',
    'common.search': 'Search',
    'common.clear': 'Clear',
  },
  
  ur: {
    // App
    'app.title': 'EPA پنجاب ماحولیاتی GPT',
    'app.subtitle': 'ماحولیاتی علم کا مددگار',
    'app.description': 'پنجاب، پاکستان میں ماحولیاتی مسائل کے بارے میں سوالات پوچھیں',
    'app.version': 'بیٹا ورژن',
    
    // Navigation
    'nav.newChat': 'نیا چیٹ',
    'nav.filters': 'فلٹرز',
    'nav.documents': 'دستاویزات',
    'nav.history': 'تاریخ',
    'nav.admin': 'ایڈمن ڈیش بورڈ',
    'nav.settings': 'ترتیبات',
    'nav.help': 'مدد',
    
    // Chat
    'chat.placeholder': 'پنجاب میں ماحولیاتی مسائل کے بارے میں پوچھیں...',
    'chat.send': 'بھیجیں',
    'chat.regenerate': 'دوبارہ بنائیں',
    'chat.copy': 'کاپی',
    'chat.copied': 'کاپی ہو گیا',
    'chat.sources': 'ذرائع',
    'chat.thinking': 'علمی ذخیرہ تلاش کیا جا رہا ہے...',
    'chat.error': 'جواب حاصل کرنے میں ناکام۔ براہ کرم دوبارہ کوشش کریں۔',
    
    // Filters
    'filter.audience': 'شریکین منتخب کریں',
    'filter.category': 'زمرے کے مطابق فلٹر',
    'filter.reportSeries': 'رپورٹ سیریز کے مطابق فلٹر',
    'filter.search': 'دستاویزات تلاش کریں',
    'filter.allCategories': 'تمام زمرے',
    'filter.allReports': 'تمام رپورٹیں',
    
    // Audience Types
    'audience.general': 'عام عوام',
    'audience.technical': 'تکنیکی ماہرین',
    'audience.policy': 'پالیسی ساز',
    
    // Documents
    'docs.title': 'دستاویزات',
    'docs.upload': 'دستاویز اپ لوڈ کریں',
    'docs.noDocuments': 'کوئی دستاویز نہیں ملی',
    'docs.uploadFirst': 'پہلی دستاویز اپ لوڈ کریں',
    'docs.processing': 'پروسیسنگ...',
    
    // Stats
    'stats.documents': 'دستاویزات',
    'stats.chunks': 'حصے',
    'stats.queries': 'استفسارات',
    'stats.sessions': 'سیشنز',
    
    // Suggested Questions
    'suggested.airQuality': 'پنجاب میں موجودہ ہوا کا معیار کیسا ہے؟',
    'suggested.waterQuality': 'EPA پنجاب پانی کا معیار کیسے ناپتا ہے؟',
    'suggested.climate': 'پنجاب میں موسمیاتی تبدیلی کے اثرات کیا ہیں؟',
    'suggested.policy': 'پنجاب میں اہم ماحولیاتی قوانین کیا ہیں؟',
    
    // Settings
    'settings.title': 'ترتیبات',
    'settings.language': 'زبان',
    'settings.theme': 'تھیم',
    'settings.theme.light': 'روشنی',
    'settings.theme.dark': 'اندھیرا',
    'settings.theme.system': 'سسٹم',
    
    // Export
    'export.title': 'برآمد',
    'export.pdf': 'PDF کے طور پر برآمد',
    'export.csv': 'CSV کے طور پر برآمد',
    'export.json': 'JSON کے طور پر برآمد',
    
    // Feedback
    'feedback.title': 'کیا یہ مددگار تھا؟',
    'feedback.submit': 'رائے جمع کرائیں',
    'feedback.thanks': 'آپ کی رائے کا شکریہ!',
    
    // Admin
    'admin.title': 'ایڈمن ڈیش بورڈ',
    'admin.overview': 'جائزہ',
    'admin.health': 'سسٹم صحت',
    'admin.uptime': 'اپ ٹائم',
    'admin.status': 'حیثیت',
    
    // Common
    'common.loading': 'لوڈ ہو رہا ہے...',
    'common.error': 'ایک خرابی پیش آگئی',
    'common.success': 'کامیاب',
    'common.cancel': 'منسوخ',
    'common.save': 'محفوظ کریں',
    'common.delete': 'حذف',
    'common.confirm': 'تصدیق',
    'common.search': 'تلاش',
    'common.clear': 'صاف',
  },
  
  pa: {
    // App
    'app.title': 'EPA پنجاب ماحول GPT',
    'app.subtitle': 'ماحولیاتی علم دا مددگار',
    'app.description': 'پنجاب، پاکستان چ ماحولیاتی مسائل بارے سوال پچھو',
    'app.version': 'بیٹا ورژن',
    
    // Navigation
    'nav.newChat': 'نیا گل بات',
    'nav.filters': 'فلٹر',
    'nav.documents': 'دستاویز',
    'nav.history': 'تاریخ',
    'nav.admin': 'ایڈمن ڈیش بورڈ',
    'nav.settings': 'سیٹنگاں',
    'nav.help': 'مدد',
    
    // Chat
    'chat.placeholder': 'پنجاب چ ماحولیاتی مسائل بارے پچھو...',
    'chat.send': 'بھیجو',
    'chat.regenerate': 'فیر بناؤ',
    'chat.copy': 'کاپی',
    'chat.copied': 'کاپی ہو گیا',
    'chat.sources': 'ذخیرے',
    'chat.thinking': 'علمی ذخیرہ لبھیا جا رہا اے...',
    'chat.error': 'جواب نہیں ملیا۔ فیر کوشش کرو۔',
    
    // Filters
    'filter.audience': 'شریکین چݨو',
    'filter.category': 'قسم دے مطابق فلٹر',
    'filter.reportSeries': 'رپورٹ سیریز دے مطابق فلٹر',
    'filter.search': 'دستاویز لبھو',
    'filter.allCategories': 'ساریاں قسماں',
    'filter.allReports': 'ساریاں رپورٹاں',
    
    // Audience Types
    'audience.general': 'عام لوک',
    'audience.technical': 'تکنیکی ماہر',
    'audience.policy': 'پالیسی بنان والے',
    
    // Documents
    'docs.title': 'دستاویز',
    'docs.upload': 'دستاویز اپ لوڈ کرو',
    'docs.noDocuments': 'کوئی دستاویز نہیں ملی',
    'docs.uploadFirst': 'پہلی دستاویز اپ لوڈ کرو',
    'docs.processing': 'پروسیسنگ...',
    
    // Stats
    'stats.documents': 'دستاویز',
    'stats.chunks': 'حصے',
    'stats.queries': 'سوال',
    'stats.sessions': 'سیشن',
    
    // Settings
    'settings.title': 'سیٹنگاں',
    'settings.language': 'بولی',
    'settings.theme': 'تھیم',
    'settings.theme.light': 'چانن',
    'settings.theme.dark': 'ہنیرا',
    'settings.theme.system': 'سسٹم',
    
    // Common
    'common.loading': 'لوڈ ہو رہا اے...',
    'common.error': 'اک خرابی ہو گئی',
    'common.success': 'کامیاب',
    'common.cancel': 'منسوخ',
    'common.save': 'محفوظ کرو',
    'common.delete': 'مٹاؤ',
    'common.confirm': 'تصدیق',
    'common.search': 'لبھو',
    'common.clear': 'صاف',
  }
}

// Translation function
export function t(key: string, lang: LanguageCode = 'en'): string {
  return translations[lang]?.[key] || translations['en'][key] || key
}

// Format number for locale
export function formatNumber(num: number, lang: LanguageCode = 'en'): string {
  const locale = languages[lang]?.locale || 'en-PK'
  return new Intl.NumberFormat(locale).format(num)
}

// Format date for locale
export function formatDateLocale(date: Date | string, lang: LanguageCode = 'en'): string {
  const locale = languages[lang]?.locale || 'en-PK'
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Get RTL status
export function isRTL(lang: LanguageCode): boolean {
  return languages[lang]?.dir === 'rtl'
}
