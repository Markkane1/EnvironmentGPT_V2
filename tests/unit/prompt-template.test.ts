// =====================================================
// EPA Punjab EnvironmentGPT - Prompt Template Service Tests
// Phase 8: Unit Tests for prompt-template-service.ts
// =====================================================

import { PromptTemplateService, PromptTemplate } from '@/lib/services/prompt-template-service'

describe('PromptTemplateService', () => {
  let templateService: PromptTemplateService

  beforeEach(() => {
    templateService = new PromptTemplateService()
  })

  describe('template lookup', () => {
    it('returns the general public template for that audience', () => {
      const template = templateService.getTemplateForAudience('General Public')

      expect(template.audience).toBe('General Public')
      expect(template.systemPrompt).toContain('General Public')
    })

    it('lists the built-in templates', () => {
      const templates = templateService.listTemplates()

      expect(templates).toHaveLength(3)
      expect(templates.map(t => t.audience)).toEqual(
        expect.arrayContaining(['General Public', 'Technical', 'Policy Maker'])
      )
    })
  })

  describe('generateSystemPrompt()', () => {
    it('includes category-specific instructions and runtime context', () => {
      const prompt = templateService.generateSystemPrompt('Technical', 'Air Quality', {
        query: 'What is PM2.5?',
        context: 'AQI readings from Lahore',
        conversationHistory: 'User: What is PM2.5?'
      })

      expect(prompt).toContain('Technical Experts')
      expect(prompt).toContain('Air Quality Expertise')
      expect(prompt).toContain('AQI readings from Lahore')
      expect(prompt).toContain('User: What is PM2.5?')
    })
  })

  describe('generateUserPrompt()', () => {
    it('returns the query when no context is provided', () => {
      expect(templateService.generateUserPrompt('What is PM2.5?')).toBe('What is PM2.5?')
    })

    it('formats query and context when context is provided', () => {
      const prompt = templateService.generateUserPrompt(
        'What is PM2.5?',
        'PM2.5 is fine particulate matter'
      )

      expect(prompt).toContain('What is PM2.5?')
      expect(prompt).toContain('PM2.5 is fine particulate matter')
    })

    it('renders placeholder templates when a custom template is provided', () => {
      const prompt = templateService.generateUserPrompt(
        'What is PM2.5?',
        'AQI context',
        'Q: {query}\nC: {context}'
      )

      expect(prompt).toBe('Q: What is PM2.5?\nC: AQI context')
    })
  })

  describe('generateFewShotExamples()', () => {
    it('returns examples for the audience', () => {
      const examples = templateService.generateFewShotExamples('General Public')

      expect(examples.length).toBeGreaterThan(0)
      expect(examples[0]).toHaveProperty('input')
      expect(examples[0]).toHaveProperty('output')
    })

    it('filters examples by category when possible', () => {
      const examples = templateService.generateFewShotExamples('General Public', 'Air Quality')

      expect(examples.length).toBeGreaterThan(0)
      expect(examples[0].context?.toLowerCase()).toContain('air quality')
    })
  })

  describe('optimizePrompt()', () => {
    it('returns the original prompt when within the token budget', () => {
      const prompt = 'Short prompt'

      expect(templateService.optimizePrompt(prompt, 100)).toBe(prompt)
    })

    it('truncates oversized prompts', () => {
      const prompt = `## Retrieved Context\n${'A'.repeat(6000)}`
      const optimized = templateService.optimizePrompt(prompt, 100)

      expect(optimized.length).toBeLessThan(prompt.length)
      expect(optimized).toContain('Context truncated due to length')
    })
  })

  describe('getPromptStats()', () => {
    it('returns basic prompt metrics', () => {
      const stats = templateService.getPromptStats('## A\nSome text\n## B')

      expect(stats.charCount).toBeGreaterThan(0)
      expect(stats.estimatedTokens).toBeGreaterThan(0)
      expect(stats.lineCount).toBe(3)
      expect(stats.sectionCount).toBe(2)
    })
  })

  describe('registerTemplate()', () => {
    it('adds a custom template to the registry', () => {
      const customTemplate: PromptTemplate = {
        id: 'custom-template',
        name: 'Custom',
        description: 'Custom template for testing',
        audience: 'General Public',
        category: 'Air Quality',
        systemPrompt: 'Custom system prompt',
        userPromptTemplate: 'Answer: {query}',
        variables: ['query']
      }

      templateService.registerTemplate(customTemplate)

      expect(templateService.getTemplate('custom-template')).toEqual(customTemplate)
    })
  })
})
