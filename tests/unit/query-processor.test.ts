// =====================================================
// EPA Punjab EnvironmentGPT - Query Processor Tests
// Phase 8: Unit Tests for query-processor.ts
// =====================================================

import { queryProcessorService } from '@/lib/services/query-processor'

// ==================== processQuery() Tests ====================

describe('QueryProcessorService', () => {
  describe('processQuery()', () => {
    it('should process a simple query correctly', () => {
      const result = queryProcessorService.processQuery('What is the air quality in Lahore?')
      
      expect(result.original).toBe('What is the air quality in Lahore?')
      expect(result.cleaned).toBe('what is the air quality in lahore?')
      expect(result.keywords.length).toBeGreaterThan(0)
    })

    it('should detect Air Quality category', () => {
      const result = queryProcessorService.processQuery('What is the PM2.5 level in Lahore?')
      
      expect(result.category).toBe('Air Quality')
    })

    it('should detect Water Resources category', () => {
      const result = queryProcessorService.processQuery('What is the water quality in River Ravi?')
      
      expect(result.category).toBe('Water Resources')
    })

    it('should detect Climate Change category', () => {
      const result = queryProcessorService.processQuery('How does climate change affect Punjab?')
      
      expect(result.category).toBe('Climate Change')
    })

    it('should detect Policy & Regulation category', () => {
      const result = queryProcessorService.processQuery('What are the environmental laws in Pakistan?')
      
      expect(result.category).toBe('Policy & Regulation')
    })

    it('should detect Waste Management category', () => {
      const result = queryProcessorService.processQuery('How should I dispose of hazardous waste?')
      
      expect(result.category).toBe('Waste Management')
    })
  })

  // ==================== Entity Extraction Tests ====================

  describe('entity extraction', () => {
    it('should extract location entities', () => {
      const result = queryProcessorService.processQuery('What is the air quality in Lahore and Faisalabad?')
      
      expect(result.entities.locations).toContain('Lahore')
      expect(result.entities.locations).toContain('Faisalabad')
    })

    it('should extract year entities', () => {
      const result = queryProcessorService.processQuery('What was the pollution level in 2023 and 2024?')
      
      expect(result.entities.years).toContain(2023)
      expect(result.entities.years).toContain(2024)
    })

    it('should extract parameter entities', () => {
      const result = queryProcessorService.processQuery('What are the PM2.5 and PM10 levels?')
      
      expect(result.entities.parameters).toContain('PM2.5')
      expect(result.entities.parameters).toContain('PM10')
    })

    it('should extract organization entities', () => {
      const result = queryProcessorService.processQuery('What does EPA and WHO say about pollution?')
      
      expect(result.entities.organizations.length).toBeGreaterThan(0)
    })

    it('should extract measurement entities', () => {
      const result = queryProcessorService.processQuery('Is 50 ug/m3 safe for PM2.5?')
      
      expect(result.entities.measurements.length).toBeGreaterThan(0)
      expect(result.entities.measurements[0].value).toBe(50)
    })
  })

  // ==================== Intent Detection Tests ====================

  describe('intent detection', () => {
    it('should detect information intent', () => {
      const result = queryProcessorService.processQuery('What is the air quality index?')
      
      expect(result.intent.type).toBe('definition')
    })

    it('should detect comparison intent', () => {
      const result = queryProcessorService.processQuery('Compare air quality in Lahore vs Islamabad')
      
      expect(result.intent.type).toBe('comparison')
    })

    it('should detect action intent', () => {
      const result = queryProcessorService.processQuery('How to file an environmental complaint?')
      
      expect(result.intent.type).toBe('action')
    })

    it('should detect definition intent', () => {
      const result = queryProcessorService.processQuery('What is PM2.5?')
      
      expect(result.intent.type).toBe('definition')
    })

    it('should detect status intent', () => {
      const result = queryProcessorService.processQuery('What is the current air quality status?')
      
      expect(result.intent.type).toBe('status')
    })
  })

  // ==================== Query Expansion Tests ====================

  describe('query expansion', () => {
    it('should expand smog-related queries', () => {
      const result = queryProcessorService.processQuery('What causes smog?')
      
      expect(result.expanded).toContain('smog')
    })

    it('should expand pollution-related queries', () => {
      const result = queryProcessorService.processQuery('Tell me about pollution')
      
      expect(result.keywords).toContain('pollution')
    })
  })

  // ==================== Filter Suggestion Tests ====================

  describe('filter suggestions', () => {
    it('should suggest category filter', () => {
      const result = queryProcessorService.processQuery('What is the air quality situation?')
      
      expect(result.suggestedFilters.category).toBe('Air Quality')
    })

    it('should suggest location filter', () => {
      const result = queryProcessorService.processQuery('What is the water quality in Multan?')
      
      expect(result.suggestedFilters.location).toBe('Multan')
    })

    it('should suggest year filter from single year', () => {
      const result = queryProcessorService.processQuery('What was the situation in 2023?')
      
      expect(result.suggestedFilters.yearFrom).toBe(2023)
      expect(result.suggestedFilters.yearTo).toBe(2023)
    })

    it('should suggest year range from multiple years', () => {
      const result = queryProcessorService.processQuery('Compare data from 2020 to 2023')
      
      expect(result.suggestedFilters.yearFrom).toBe(2020)
      expect(result.suggestedFilters.yearTo).toBe(2023)
    })
  })

  // ==================== Scope Check Tests ====================

  describe('isWithinScope()', () => {
    it('should accept environmental queries', () => {
      const result = queryProcessorService.isWithinScope('What is the air quality in Lahore?')
      
      expect(result.inScope).toBe(true)
    })

    it('should reject political queries', () => {
      const result = queryProcessorService.isWithinScope('Who will win the election?')
      
      expect(result.inScope).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should reject sports queries', () => {
      const result = queryProcessorService.isWithinScope('What is the cricket score?')
      
      expect(result.inScope).toBe(false)
    })

    it('should reject entertainment queries', () => {
      const result = queryProcessorService.isWithinScope('What movies are playing?')
      
      expect(result.inScope).toBe(false)
    })

    it('should reject religious queries', () => {
      const result = queryProcessorService.isWithinScope('What is the best religion?')
      
      expect(result.inScope).toBe(false)
    })
  })

  // ==================== Follow-up Question Tests ====================

  describe('generateFollowUpQuestions()', () => {
    it('should generate follow-up questions for Air Quality', () => {
      const processedQuery = queryProcessorService.processQuery('What is the air quality?')
      const suggestions = queryProcessorService.generateFollowUpQuestions(processedQuery)
      
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.length).toBeLessThanOrEqual(3)
    })

    it('should generate location-specific follow-ups', () => {
      const processedQuery = queryProcessorService.processQuery('Air quality in Lahore')
      const suggestions = queryProcessorService.generateFollowUpQuestions(processedQuery)
      
      const hasLahoreSuggestion = suggestions.some(s => 
        s.toLowerCase().includes('lahore')
      )
      expect(hasLahoreSuggestion).toBe(true)
    })
  })
})
