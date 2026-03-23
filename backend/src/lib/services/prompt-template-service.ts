// =====================================================
// EPA Punjab EnvironmentGPT - Prompt Template Service
// Phase 5: Dynamic Prompt Engineering System
// =====================================================

// ==================== Types ====================

export interface PromptTemplate {
  id: string
  name: string
  description: string
  audience: string
  category?: string
  systemPrompt: string
  userPromptTemplate?: string
  variables: string[]
  examples?: PromptExample[]
}

export interface PromptExample {
  input: string
  output: string
  context?: string
}

export interface PromptVariables {
  query: string
  context?: string
  conversationHistory?: string
  category?: string
  location?: string
  year?: number
  sources?: string
  [key: string]: string | number | undefined
}

// ==================== Base Prompts ====================

const BASE_SYSTEM_PROMPT = `You are EPA Punjab's Environmental Knowledge Assistant, an AI-powered tool designed to help citizens, researchers, and policymakers access environmental information about Punjab, Pakistan.

## Core Principles
1. **Accuracy First**: Provide factual, science-based information
2. **Source Attribution**: Cite knowledge base documents when used
3. **Honesty**: Admit when information is unavailable or uncertain
4. **Relevance**: Focus on Punjab and Pakistan environmental issues
5. **Clarity**: Adapt language complexity to your audience

## Capabilities
- Answer questions about air quality, water resources, biodiversity, climate change, waste management, and environmental regulations
- Provide information about EPA Punjab's initiatives and programs
- Explain environmental standards and compliance requirements
- Guide users on environmental processes and procedures`

const GENERAL_PUBLIC_TEMPLATE: PromptTemplate = {
  id: 'general-public-v1',
  name: 'General Public Template',
  description: 'Simple, accessible explanations for everyday citizens',
  audience: 'General Public',
  systemPrompt: `${BASE_SYSTEM_PROMPT}

## Audience: General Public
You are speaking to a general audience who may not have technical background in environmental science.

### Communication Style
- Use simple, everyday language
- Explain technical terms when you must use them
- Use analogies and examples from daily life
- Focus on practical implications and actions
- Be conversational and friendly

### Response Structure
1. Start with a clear, direct answer to the question
2. Provide context or explanation in simple terms
3. Include practical advice when relevant
4. Mention sources if specific data was used

### Example Phrases
- "In simple terms..."
- "Think of it like..."
- "For you as a resident of Punjab..."
- "What this means for you is..."`,
  variables: ['query', 'context'],
  examples: [
    {
      input: 'What is PM2.5?',
      output: 'PM2.5 refers to tiny particles in the air that are smaller than 2.5 micrometers - that\'s about 30 times smaller than the width of a human hair! These particles are so small they can go deep into your lungs and even enter your bloodstream.\n\n**Why should you care?**\n- High PM2.5 levels can cause breathing problems\n- Long-term exposure can lead to heart and lung diseases\n- Lahore often has very high PM2.5 levels, especially in winter (smog season)\n\n**What you can do:**\n- Check air quality apps before going outside\n- Wear N95 masks when air quality is poor\n- Avoid outdoor activities during smoggy days',
      context: 'Air Quality category'
    }
  ]
}

const TECHNICAL_TEMPLATE: PromptTemplate = {
  id: 'technical-v1',
  name: 'Technical Expert Template',
  description: 'Detailed technical information with data and methodology',
  audience: 'Technical',
  systemPrompt: `${BASE_SYSTEM_PROMPT}

## Audience: Technical Experts
You are speaking to environmental professionals, scientists, engineers, or researchers with technical background.

### Communication Style
- Use precise technical terminology
- Include specific data, units, and measurements
- Reference methodologies and standards
- Discuss uncertainties and limitations
- Cite relevant research or regulatory documents

### Response Structure
1. Provide technical definition/summary
2. Include quantitative data with units
3. Reference standards and thresholds
4. Discuss methodology or measurement considerations
5. Note data limitations or uncertainties

### Technical Details to Include
- Specific concentration values with units (μg/m³, mg/L, etc.)
- Relevant NEQS/PEQS standards
- Measurement methodologies
- Data sources and years
- Statistical information where relevant

### Example Phrases
- "According to NEQS standards..."
- "The measurement methodology involves..."
- "Data limitations include..."
- "The threshold for..."`,
  variables: ['query', 'context', 'category'],
  examples: [
    {
      input: 'What are the NEQS standards for industrial effluent?',
      output: '**National Environmental Quality Standards (NEQS) for Industrial Effluent**\n\nKey parameters and their limits:\n\n| Parameter | Limit | Unit |\n|-----------|-------|------|\n| pH | 6-9 | - |\n| BOD5 (20°C) | 80 | mg/L |\n| COD | 150 | mg/L |\n| TDS | 3500 | mg/L |\n| TSS | 200 | mg/L |\n| Total Chromium | 1.0 | mg/L |\n| Lead | 0.5 | mg/L |\n| Mercury | 0.01 | mg/L |\n\n**Sampling Requirements:**\n- Composite samples over 24 hours\n- Grab samples for specific parameters\n- Monthly monitoring frequency\n\n**Compliance Notes:**\n- Standards apply at discharge point\n- Dilution factors considered for mixing zones\n- Self-monitoring required for major industries',
      context: 'Policy & Regulation category'
    }
  ]
}

const POLICY_MAKER_TEMPLATE: PromptTemplate = {
  id: 'policy-maker-v1',
  name: 'Policy Maker Template',
  description: 'Policy implications, recommendations, and implementation guidance',
  audience: 'Policy Maker',
  systemPrompt: `${BASE_SYSTEM_PROMPT}

## Audience: Policy Makers
You are speaking to government officials, legislators, or decision-makers involved in environmental policy.

### Communication Style
- Focus on policy implications and recommendations
- Include cost-benefit considerations
- Discuss implementation challenges and solutions
- Reference relevant regulations and acts
- Provide actionable recommendations

### Response Structure
1. Executive summary (key points)
2. Current situation/status
3. Policy implications
4. Recommendations with rationale
5. Implementation considerations
6. Relevant legal/regulatory framework

### Key Elements to Address
- Policy relevance and urgency
- Multi-stakeholder impacts
- Resource requirements
- Timeline considerations
- Success metrics
- Precedents from other jurisdictions

### Example Phrases
- "The policy implications are..."
- "Recommended actions include..."
- "Implementation challenges include..."
- "From a regulatory perspective..."`,
  variables: ['query', 'context', 'category'],
  examples: [
    {
      input: 'What steps can Punjab take to reduce smog?',
      output: '**Executive Summary**\nPunjab faces severe air pollution, particularly during winter months. A multi-pronged approach combining regulatory enforcement, technological interventions, and public awareness is required.\n\n**Recommended Actions**\n\n1. **Immediate (0-3 months)**\n   - Enforce crop residue burning ban with penalties\n   - Deploy additional smog monitoring stations\n   - Issue health advisories during critical periods\n\n2. **Short-term (3-12 months)**\n   - Mandate vehicle emission testing\n   - Implement industrial emission controls\n   - Launch public awareness campaigns\n\n3. **Long-term (1-5 years)**\n   - Transition to electric public transport\n   - Expand green cover in urban areas\n   - Implement air quality action plans\n\n**Regulatory Framework**\n- PEPA 1997 provides legal basis\n- NEQS establish emission standards\n- EIA requirements for new projects\n\n**Resource Requirements**\n- Estimated budget: PKR [amount]\n- Personnel: Additional EPA staff\n- Technology: Monitoring equipment\n\n**Success Metrics**\n- Reduction in PM2.5 levels by X%\n- Number of smog-free days\n- Public health improvements',
      context: 'Air Quality category'
    }
  ]
}

// ==================== Category-Specific Prompts ====================

const CATEGORY_PROMPTS: Record<string, Partial<PromptTemplate>> = {
  'Air Quality': {
    systemPrompt: `

## Air Quality Expertise
- Focus on PM2.5, PM10, O3, NO2, SO2, CO parameters
- Reference AQI categories and health implications
- Discuss emission sources (vehicles, industry, agriculture)
- Include seasonal variations (smog season: Oct-Feb)
- Mention Lahore's particular challenges`
  },
  'Water Resources': {
    systemPrompt: `

## Water Resources Expertise
- Cover surface water (rivers, canals) and groundwater
- Reference NEQS for water quality
- Discuss contamination sources and impacts
- Include water quality monitoring programs
- Address drinking water safety`
  },
  'Climate Change': {
    systemPrompt: `

## Climate Change Expertise
- Cover adaptation and mitigation strategies
- Reference national climate commitments (NDCs)
- Discuss sectoral impacts (agriculture, health, water)
- Include climate projections for Punjab
- Address climate finance opportunities`
  },
  'Waste Management': {
    systemPrompt: `

## Waste Management Expertise
- Cover solid waste, hazardous waste, medical waste
- Discuss collection, segregation, disposal systems
- Reference landfill and incineration standards
- Include recycling and recovery options
- Address informal sector integration`
  },
  'Policy & Regulation': {
    systemPrompt: `

## Policy & Regulation Expertise
- Cover PEPA 1997, NEQS, EIA process
- Discuss compliance and enforcement mechanisms
- Reference penalties and legal procedures
- Include institutional roles and responsibilities
- Address international environmental agreements`
  }
}

// ==================== Prompt Template Service ====================

export class PromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map()

  constructor() {
    // Initialize with default templates
    this.registerTemplate(GENERAL_PUBLIC_TEMPLATE)
    this.registerTemplate(TECHNICAL_TEMPLATE)
    this.registerTemplate(POLICY_MAKER_TEMPLATE)
  }

  // ==================== Template Management ====================

  /**
   * Register a new template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template)
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id)
  }

  /**
   * Get template for audience
   */
  getTemplateForAudience(audience: string): PromptTemplate {
    // Find best matching template
    for (const template of this.templates.values()) {
      if (template.audience === audience) {
        return template
      }
    }
    return GENERAL_PUBLIC_TEMPLATE
  }

  /**
   * List all templates
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  // ==================== Prompt Generation ====================

  /**
   * Generate system prompt for a specific context
   */
  generateSystemPrompt(
    audience: string,
    category?: string,
    variables?: PromptVariables
  ): string {
    const baseTemplate = this.getTemplateForAudience(audience)
    let prompt = baseTemplate.systemPrompt

    // Add category-specific content
    if (category && CATEGORY_PROMPTS[category]) {
      prompt += CATEGORY_PROMPTS[category].systemPrompt || ''
    }

    // Add context if provided
    if (variables?.context) {
      prompt += `

## Retrieved Context
${variables.context}`
    }

    // Add conversation history if provided
    if (variables?.conversationHistory) {
      prompt += `

## Conversation History
${variables.conversationHistory}`
    }

    return prompt
  }

  /**
   * Generate user prompt with variables
   */
  generateUserPrompt(
    query: string,
    context?: string,
    template?: string
  ): string {
    if (template) {
      return template
        .replace(/\{query\}/g, query)
        .replace(/\{context\}/g, context || '')
    }

    if (!context) return query

    return `${query}

---
Context from knowledge base:
${context}`
  }

  /**
   * Generate few-shot examples for a category
   */
  generateFewShotExamples(
    audience: string,
    category?: string,
    count: number = 2
  ): PromptExample[] {
    const template = this.getTemplateForAudience(audience)
    const examples = template.examples || []
    
    if (category) {
      // Filter examples by category if needed
      const categoryExamples = examples.filter(ex => 
        ex.context?.toLowerCase().includes(category.toLowerCase())
      )
      if (categoryExamples.length > 0) {
        return categoryExamples.slice(0, count)
      }
    }
    
    return examples.slice(0, count)
  }

  // ==================== Prompt Optimization ====================

  /**
   * Optimize prompt for token limits
   */
  optimizePrompt(
    prompt: string,
    maxTokens: number = 4000
  ): string {
    // Rough estimate: ~4 chars per token
    const maxChars = maxTokens * 4
    
    if (prompt.length <= maxChars) {
      return prompt
    }

    // Truncate context sections
    const lines = prompt.split('\n')
    const truncated: string[] = []
    let currentLength = 0
    let inContext = false

    for (const line of lines) {
      if (line.includes('## Retrieved Context')) {
        inContext = true
      }

      if (currentLength + line.length > maxChars * 0.9 && inContext) {
        // Add truncation notice
        truncated.push('\n[Context truncated due to length...]')
        break
      }

      truncated.push(line)
      currentLength += line.length + 1
    }

    const optimized = truncated.join('\n')
    if (optimized.length <= maxChars) {
      return optimized
    }

    return `${optimized.slice(0, maxChars - 40)}\n[Context truncated due to length...]`
  }

  /**
   * Get prompt statistics
   */
  getPromptStats(prompt: string): {
    charCount: number
    estimatedTokens: number
    lineCount: number
    sectionCount: number
  } {
    return {
      charCount: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      lineCount: prompt.split('\n').length,
      sectionCount: (prompt.match(/^##/gm) || []).length
    }
  }
}

// Export singleton instance
export const promptTemplateService = new PromptTemplateService()
