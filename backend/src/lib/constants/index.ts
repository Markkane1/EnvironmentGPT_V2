// =====================================================
// EPA Punjab EnvironmentGPT - Application Constants
// Phase 1: Core Configuration Values
// =====================================================

// ==================== Application Info ====================

export const APP_CONFIG = {
  name: 'EPA Punjab EnvironmentGPT',
  shortName: 'EnvGPT',
  version: '1.0.0',
  description: 'Environmental Knowledge Assistant for Punjab, Pakistan',
  organization: 'Environmental Protection Agency Punjab',
  organizationUrl: 'https://epunjab.gov.pk/epa',
  copyright: '© 2024 EPA Punjab. All rights reserved.',
} as const

// ==================== Document Categories ====================

export const DOCUMENT_CATEGORIES = [
  { value: 'Air Quality', label: 'Air Quality', icon: 'Wind' },
  { value: 'Water Resources', label: 'Water Resources', icon: 'Droplets' },
  { value: 'Biodiversity', label: 'Biodiversity', icon: 'Trees' },
  { value: 'Climate Change', label: 'Climate Change', icon: 'Thermometer' },
  { value: 'Waste Management', label: 'Waste Management', icon: 'Trash2' },
  { value: 'Policy & Regulation', label: 'Policy & Regulation', icon: 'Scale' },
  { value: 'Environmental Impact Assessment', label: 'EIA', icon: 'FileSearch' },
  { value: 'Industrial Pollution', label: 'Industrial Pollution', icon: 'Factory' },
  { value: 'Agricultural Environment', label: 'Agricultural Environment', icon: 'Wheat' },
  { value: 'Urban Environment', label: 'Urban Environment', icon: 'Building2' },
] as const

// ==================== Report Series ====================

export const REPORT_SERIES = [
  { value: 'GEO Report', label: 'Global Environment Outlook' },
  { value: 'IPBES Assessment', label: 'IPBES Assessment Report' },
  { value: 'National Communications', label: 'National Communications (UNFCCC)' },
  { value: 'State of Environment', label: 'State of Environment Report' },
  { value: 'Technical Reports', label: 'Technical Reports' },
  { value: 'Annual Report', label: 'EPA Annual Report' },
  { value: 'Research Paper', label: 'Research Papers' },
  { value: 'Policy Brief', label: 'Policy Briefs' },
] as const

// ==================== Audience Types ====================

export const AUDIENCE_TYPES = [
  { 
    value: 'General Public', 
    label: 'General Public',
    description: 'Simple, easy-to-understand explanations'
  },
  { 
    value: 'Technical', 
    label: 'Technical Experts',
    description: 'Detailed technical information with data sources'
  },
  { 
    value: 'Policy Maker', 
    label: 'Policy Makers',
    description: 'Policy implications and recommendations'
  },
] as const

// ==================== Punjab-Specific Data ====================

export const PUNJAB_REGIONS = [
  'Lahore',
  'Faisalabad',
  'Rawalpindi',
  'Multan',
  'Gujranwala',
  'Sialkot',
  'Sargodha',
  'Bahawalpur',
  'Sheikhupura',
  'Kasur',
] as const

export const MAJOR_WATER_BODIES = [
  { name: 'River Ravi', type: 'River' },
  { name: 'River Sutlej', type: 'River' },
  { name: 'River Chenab', type: 'River' },
  { name: 'River Jhelum', type: 'River' },
  { name: 'River Beas', type: 'River' },
  { name: 'Khabikki Lake', type: 'Lake' },
  { name: 'Uchhali Lake', type: 'Lake' },
  { name: 'Head Marala', type: 'Wetland' },
  { name: 'Head Sulemanki', type: 'Wetland' },
] as const

export const PROTECTED_AREAS = [
  { name: 'Chinji National Park', district: 'Chakwal' },
  { name: 'Kala Chitta Range', district: 'Attock' },
  { name: 'Murree Forest Division', district: 'Rawalpindi' },
  { name: 'Khabikki Lake Wildlife Sanctuary', district: 'Khushab' },
  { name: 'Head Marala Wildlife Sanctuary', district: 'Sialkot' },
] as const

// ==================== Air Quality Parameters ====================

export const AQI_PARAMETERS = [
  { code: 'PM2.5', name: 'Fine Particulate Matter', unit: 'μg/m³', threshold: 35 },
  { code: 'PM10', name: 'Coarse Particulate Matter', unit: 'μg/m³', threshold: 150 },
  { code: 'O3', name: 'Ozone', unit: 'ppb', threshold: 70 },
  { code: 'NO2', name: 'Nitrogen Dioxide', unit: 'ppb', threshold: 100 },
  { code: 'SO2', name: 'Sulfur Dioxide', unit: 'ppb', threshold: 75 },
  { code: 'CO', name: 'Carbon Monoxide', unit: 'ppm', threshold: 9 },
] as const

export const AQI_CATEGORIES = [
  { range: [0, 50], label: 'Good', color: '#00e400' },
  { range: [51, 100], label: 'Moderate', color: '#ffff00' },
  { range: [101, 150], label: 'Unhealthy for Sensitive', color: '#ff7e00' },
  { range: [151, 200], label: 'Unhealthy', color: '#ff0000' },
  { range: [201, 300], label: 'Very Unhealthy', color: '#8f3f97' },
  { range: [301, 500], label: 'Hazardous', color: '#7e0023' },
] as const

// ==================== Water Quality Parameters ====================

export const WATER_QUALITY_PARAMETERS = [
  { code: 'pH', name: 'pH Level', unit: '', standard: '6.5-8.5' },
  { code: 'TDS', name: 'Total Dissolved Solids', unit: 'mg/L', standard: '<1000' },
  { code: 'BOD', name: 'Biochemical Oxygen Demand', unit: 'mg/L', standard: '<80' },
  { code: 'COD', name: 'Chemical Oxygen Demand', unit: 'mg/L', standard: '<150' },
  { code: 'TSS', name: 'Total Suspended Solids', unit: 'mg/L', standard: '<200' },
  { code: 'EC', name: 'Electrical Conductivity', unit: 'μS/cm', standard: '<2500' },
] as const

// ==================== RAG Configuration ====================

export const RAG_CONFIG = {
  embeddingModel: 'BAAI/bge-large-en-v1.5',
  llmModel: 'llama3.1:70b',
  defaultChunkSize: 512,
  chunkOverlap: 50,
  defaultTopK: 5,
  similarityThreshold: 0.7,
  maxContextTokens: 4096,
  embeddingDimension: 384,
} as const

// ==================== System Limits ====================

export const SYSTEM_LIMITS = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxDocumentsPerQuery: 10,
  maxSessionMessages: 100,
  rateLimitPerMinute: 60,
  maxQueryLength: 1000,
  minQueryLength: 3,
} as const

// ==================== Feature Flags ====================

export const DEFAULT_FEATURE_FLAGS = {
  chatEnabled: true,
  documentUploadEnabled: true,
  analyticsEnabled: true,
  feedbackEnabled: true,
  multiLanguageEnabled: false,
  voiceInputEnabled: false,
  exportEnabled: true,
} as const

// ==================== Supported Languages ====================

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'pa', name: 'Punjabi', native: 'پنجابی' },
] as const

// ==================== Supported File Types ====================

export const SUPPORTED_FILE_TYPES = {
  documents: ['.pdf', '.doc', '.docx', '.md', '.markdown', '.txt'],
} as const

// ==================== Date Formats ====================

export const DATE_FORMATS = {
  display: 'DD MMM YYYY',
  displayWithTime: 'DD MMM YYYY, HH:mm',
  iso: 'YYYY-MM-DD',
  api: 'YYYY-MM-DDTHH:mm:ss.sssZ',
} as const

// ==================== HTTP Status Codes ====================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

// ==================== Error Messages ====================

export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  VALIDATION: 'Please check your input and try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  CHAT: 'Failed to process your message. Please try again.',
  UPLOAD: 'Failed to upload the document. Please check the file format.',
  DATABASE: 'A database error occurred. Please try again later.',
} as const

// ==================== Suggested Questions ====================

export const SUGGESTED_QUESTIONS = [
  {
    category: 'Air Quality',
    questions: [
      'What is the current air quality situation in Punjab?',
      'How does smog affect health in Lahore?',
      'What are the main sources of air pollution in Punjab?',
    ]
  },
  {
    category: 'Water Resources',
    questions: [
      'How does EPA Punjab monitor water quality?',
      'What are the water quality standards for drinking water?',
      'Which rivers in Punjab are most polluted?',
    ]
  },
  {
    category: 'Climate Change',
    questions: [
      'What are the climate change impacts in Punjab?',
      'What is Punjab doing to combat climate change?',
      'How does climate change affect agriculture in Punjab?',
    ]
  },
  {
    category: 'Policy & Regulation',
    questions: [
      'What are the key environmental laws in Punjab?',
      'How can I report an environmental violation?',
      'What is the process for environmental impact assessment?',
    ]
  },
] as const
