// =====================================================
// EPA Punjab EnvironmentGPT - Query Processing Service
// Phase 4: Query Preprocessing and Expansion
// =====================================================

import { DOCUMENT_CATEGORIES, PUNJAB_REGIONS, AQI_PARAMETERS } from '@/lib/constants'

// ==================== Types ====================

export interface ProcessedQuery {
  original: string
  cleaned: string
  expanded: string
  keywords: string[]
  entities: ExtractedEntities
  intent: QueryIntent
  category: string | null
  suggestedFilters: QueryFilters
}

export interface ExtractedEntities {
  locations: string[]
  parameters: string[]
  years: number[]
  organizations: string[]
  measurements: { value: number; unit: string }[]
}

export interface QueryIntent {
  type: 'information' | 'comparison' | 'action' | 'definition' | 'status' | 'unknown'
  confidence: number
}

export interface QueryFilters {
  category?: string
  yearFrom?: number
  yearTo?: number
  location?: string
  parameter?: string
}

export interface QueryExpansion {
  synonyms: string[]
  related: string[]
  broader: string[]
}

// ==================== Environmental Knowledge Base ====================

const ENVIRONMENTAL_SYNONYMS: Record<string, string[]> = {
  'smog': ['air pollution', 'haze', 'fog', 'particulate matter', 'air quality'],
  'pollution': ['contamination', 'pollutant', 'harmful substances', 'toxic'],
  'air quality': ['air pollution', 'atmospheric quality', 'ambient air'],
  'water quality': ['water pollution', 'water contamination', 'hydrological quality'],
  'climate change': ['global warming', 'climate crisis', 'climatic changes'],
  'emission': ['discharge', 'release', 'outflow', 'exhaust'],
  'pm2.5': ['fine particulate matter', 'particulate matter 2.5', 'fine particles'],
  'pm10': ['coarse particulate matter', 'particulate matter 10', 'coarse particles'],
  'waste': ['garbage', 'refuse', 'trash', 'solid waste', 'rubbish'],
  'recycling': ['reprocessing', 'reuse', 'recovery', 'waste management'],
  'biodiversity': ['biological diversity', 'species variety', 'ecosystem diversity'],
  'wetland': ['marsh', 'swamp', 'water body', 'aquatic ecosystem'],
  'eia': ['environmental impact assessment', 'environmental assessment', 'impact study'],
  'pepa': ['pakistan environmental protection act', 'environmental act 1997'],
  'neqs': ['national environmental quality standards', 'environmental standards'],
}

const PUNJAB_LOCATIONS = [
  'lahore', 'faisalabad', 'rawalpindi', 'multan', 'gujranwala', 
  'sialkot', 'sargodha', 'bahawalpur', 'sheikhupura', 'kasur',
  'sahiwal', 'okara', 'vehari', 'khanewal', 'toba tek singh',
  'jhelum', 'gujrat', 'mandi bahauddin', 'hafizabad', 'narowal',
  'attock', 'chakwal', 'khushab', 'mianwali', 'bhakkar',
  'layyah', 'rajanpur', 'dg khan', 'muzaffargarh', 'lodhran',
  'pakpattan', 'nankana sahib', 'nankana'
]

const ORGANIZATIONS = [
  'epa', 'environmental protection agency', 'epunjab', 'government punjab',
  'unep', 'who', 'world health organization', 'environment department',
  'pollution control', 'environment ministry', 'climate change ministry'
]

const INTENT_KEYWORDS: Record<QueryIntent['type'], string[]> = {
  'information': ['tell me', 'explain', 'describe', 'about', 'information on', 'details about'],
  'comparison': ['compare', 'difference between', 'versus', 'vs', 'better', 'worse', 'higher', 'lower'],
  'action': ['how to', 'steps', 'process', 'procedure', 'apply', 'submit', 'file', 'report'],
  'definition': ['what is', 'define', 'meaning of', 'definition of', 'what does', 'what are'],
  'status': ['current', 'latest', 'recent', 'now', 'today', 'status', 'situation', 'level'],
  'unknown': []
}

const INTENT_PRIORITY: QueryIntent['type'][] = [
  'status',
  'definition',
  'action',
  'comparison',
  'information'
]

// ==================== Query Processor Service ====================

export class QueryProcessorService {
  
  /**
   * Process a user query for enhanced retrieval
   */
  processQuery(query: string): ProcessedQuery {
    const original = query
    const cleaned = this.cleanQuery(query)
    const entities = this.extractEntities(query)
    const intent = this.detectIntent(query)
    const category = this.detectCategory(query)
    const keywords = this.extractKeywords(cleaned)
    const expansion = this.expandQuery(cleaned, keywords)
    const suggestedFilters = this.suggestFilters(entities, category)
    
    const expanded = this.buildExpandedQuery(cleaned, expansion)
    
    return {
      original,
      cleaned,
      expanded,
      keywords,
      entities,
      intent,
      category,
      suggestedFilters
    }
  }

  // ==================== Query Cleaning ====================

  private cleanQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^\w\s.?!,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ==================== Entity Extraction ====================

  private extractEntities(query: string): ExtractedEntities {
    const queryLower = query.toLowerCase()
    
    return {
      locations: this.extractLocations(queryLower),
      parameters: this.extractParameters(queryLower),
      years: this.extractYears(query),
      organizations: this.extractOrganizations(queryLower),
      measurements: this.extractMeasurements(query)
    }
  }

  private extractLocations(query: string): string[] {
    const locations: string[] = []
    
    for (const location of PUNJAB_LOCATIONS) {
      if (query.includes(location)) {
        locations.push(location.charAt(0).toUpperCase() + location.slice(1))
      }
    }
    
    return [...new Set(locations)]
  }

  private extractParameters(query: string): string[] {
    const parameters: string[] = []
    
    for (const param of AQI_PARAMETERS) {
      if (query.includes(param.code.toLowerCase()) || 
          query.includes(param.name.toLowerCase())) {
        parameters.push(param.code)
      }
    }
    
    // Additional environmental parameters
    const additionalParams = ['ph', 'tds', 'bod', 'cod', 'tss', 'do', 'ec']
    for (const param of additionalParams) {
      if (query.includes(param)) {
        parameters.push(param.toUpperCase())
      }
    }
    
    return [...new Set(parameters)]
  }

  private extractYears(query: string): number[] {
    const yearPattern = /\b(19|20)\d{2}\b/g
    const matches = query.match(yearPattern)
    return matches ? matches.map(y => parseInt(y)) : []
  }

  private extractOrganizations(query: string): string[] {
    const organizations: string[] = []
    
    for (const org of ORGANIZATIONS) {
      if (query.includes(org)) {
        organizations.push(org.toUpperCase())
      }
    }
    
    return [...new Set(organizations)]
  }

  private extractMeasurements(query: string): { value: number; unit: string }[] {
    const measurements: { value: number; unit: string }[] = []
    
    // Pattern for measurements like "50 ug/m3", "35 ppm", "100 mg/L"
    const pattern = /(\d+(?:\.\d+)?)\s*(ug\/m3|μg\/m³|ppm|ppb|mg\/l|mg\/L|ml|ml|g\/m3|%)/gi
    let match
    
    while ((match = pattern.exec(query)) !== null) {
      measurements.push({
        value: parseFloat(match[1]),
        unit: match[2]
      })
    }
    
    return measurements
  }

  // ==================== Intent Detection ====================

  private detectIntent(query: string): QueryIntent {
    const queryLower = query.toLowerCase()
    
    for (const type of INTENT_PRIORITY) {
      for (const keyword of INTENT_KEYWORDS[type]) {
        if (queryLower.includes(keyword)) {
          return {
            type,
            confidence: 0.8
          }
        }
      }
    }
    
    return {
      type: 'unknown',
      confidence: 0.3
    }
  }

  // ==================== Category Detection ====================

  private detectCategory(query: string): string | null {
    const queryLower = query.toLowerCase()
    
    const categoryKeywords: Record<string, string[]> = {
      'Air Quality': ['air', 'smog', 'pollution', 'pm2.5', 'pm10', 'emission', 'vehicle', 
                      'exhaust', 'dust', 'fog', 'haze', 'breathing', 'lung', 'respiratory'],
      'Water Resources': ['water', 'river', 'groundwater', 'drinking', 'aquifer', 'contamination',
                          'sewage', 'effluent', 'wetland', 'lake', 'stream'],
      'Climate Change': ['climate', 'weather', 'temperature', 'global warming', 'carbon',
                         'greenhouse', 'emission', 'adaptation', 'mitigation'],
      'Waste Management': ['waste', 'garbage', 'trash', 'recycling', 'landfill', 'dump',
                           'solid waste', 'hazardous', 'medical waste'],
      'Biodiversity': ['biodiversity', 'species', 'wildlife', 'habitat', 'ecosystem',
                       'conservation', 'protected area', 'forest', 'wildlife'],
      'Policy & Regulation': ['law', 'regulation', 'act', 'policy', 'standard', 'compliance',
                              'legal', 'permit', 'license', 'violation', 'penalty'],
      'Environmental Impact Assessment': ['eia', 'impact assessment', 'environmental assessment',
                                          'project clearance', 'environmental clearance'],
      'Industrial Pollution': ['industrial', 'factory', 'mill', 'industrial zone', 'effluent',
                               'industrial waste', 'manufacturing']
    }
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          return category
        }
      }
    }
    
    return null
  }

  // ==================== Keyword Extraction ====================

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
    ])
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  }

  // ==================== Query Expansion ====================

  private expandQuery(query: string, keywords: string[]): QueryExpansion {
    const synonyms: string[] = []
    const related: string[] = []
    const broader: string[] = []
    
    for (const keyword of keywords) {
      // Find synonyms
      if (ENVIRONMENTAL_SYNONYMS[keyword]) {
        synonyms.push(...ENVIRONMENTAL_SYNONYMS[keyword])
      }
      
      // Find partial matches for related terms
      for (const [term, syns] of Object.entries(ENVIRONMENTAL_SYNONYMS)) {
        if (term.includes(keyword) || keyword.includes(term)) {
          related.push(term, ...syns)
        }
      }
    }
    
    return {
      synonyms: [...new Set(synonyms)].slice(0, 5),
      related: [...new Set(related)].slice(0, 5),
      broader: [...new Set(broader)].slice(0, 3)
    }
  }

  private buildExpandedQuery(original: string, expansion: QueryExpansion): string {
    const expansionTerms = [...expansion.synonyms, ...expansion.related]
    if (expansionTerms.length === 0) return original
    
    // Add expansion terms with weighting toward original
    const expandedTerms = expansionTerms.slice(0, 3).join(' ')
    return `${original} ${expandedTerms}`
  }

  // ==================== Filter Suggestions ====================

  private suggestFilters(entities: ExtractedEntities, category: string | null): QueryFilters {
    const filters: QueryFilters = {}
    
    if (category) {
      filters.category = category
    }
    
    if (entities.locations.length > 0) {
      filters.location = entities.locations[0]
    }
    
    if (entities.years.length > 0) {
      const sortedYears = entities.years.sort((a, b) => a - b)
      if (sortedYears.length === 1) {
        filters.yearFrom = sortedYears[0]
        filters.yearTo = sortedYears[0]
      } else {
        filters.yearFrom = sortedYears[0]
        filters.yearTo = sortedYears[sortedYears.length - 1]
      }
    }
    
    if (entities.parameters.length > 0) {
      filters.parameter = entities.parameters[0]
    }
    
    return filters
  }

  // ==================== Utility Methods ====================

  /**
   * Generate suggested follow-up questions
   */
  generateFollowUpQuestions(processedQuery: ProcessedQuery): string[] {
    const suggestions: string[] = []
    const { intent, category, entities } = processedQuery
    
    if (category === 'Air Quality') {
      if (entities.locations.length > 0) {
        suggestions.push(`What are the main sources of air pollution in ${entities.locations[0]}?`)
        suggestions.push(`How can I protect myself from air pollution in ${entities.locations[0]}?`)
      } else {
        suggestions.push('What is the current air quality situation in Lahore?')
        suggestions.push('What are the health effects of PM2.5?')
      }
    }
    
    if (category === 'Water Resources') {
      suggestions.push('What are the drinking water quality standards in Pakistan?')
      suggestions.push('How can I test my drinking water quality?')
    }
    
    if (intent.type === 'action') {
      suggestions.push('What documents do I need for this process?')
      suggestions.push('Where can I submit my application?')
    }
    
    if (intent.type === 'definition') {
      suggestions.push('What are the regulations related to this?')
      suggestions.push('How does this affect Punjab?')
    }
    
    return suggestions.slice(0, 3)
  }

  /**
   * Check if query is within scope
   */
  isWithinScope(query: string): { inScope: boolean; reason?: string } {
    const queryLower = query.toLowerCase()
    
    // Check for off-topic keywords
    const offTopicKeywords = [
      'politics', 'election', 'vote', 'politician', 'party',
      'religion', 'religious', 'faith', 'belief',
      'sports', 'cricket', 'football', 'match',
      'entertainment', 'movie', 'song', 'celebrity'
    ]
    
    for (const keyword of offTopicKeywords) {
      if (queryLower.includes(keyword)) {
        return {
          inScope: false,
          reason: 'This topic is outside the environmental domain. I can help with questions about air quality, water resources, climate change, waste management, biodiversity, and environmental regulations in Punjab.'
        }
      }
    }
    
    return { inScope: true }
  }
}

// Export singleton instance
export const queryProcessorService = new QueryProcessorService()
