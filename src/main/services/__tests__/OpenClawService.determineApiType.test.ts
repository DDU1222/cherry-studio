import { describe, expect, it, vi } from 'vitest'

// Mock transitive dependencies that pull in electron
vi.mock('../WindowService', () => ({
  windowService: {}
}))

vi.mock('../VertexAIService', () => ({
  default: {}
}))

vi.mock('@expo/sudo-prompt', () => ({
  exec: vi.fn()
}))

vi.mock('@main/utils/ipService', () => ({
  isUserInChina: vi.fn(() => false)
}))

vi.mock('@main/utils/process', () => ({
  crossPlatformSpawn: vi.fn(),
  executeCommand: vi.fn(),
  findExecutableInEnv: vi.fn()
}))

vi.mock('@main/utils/shell-env', () => ({
  default: vi.fn(),
  refreshShellEnv: vi.fn()
}))

vi.mock('semver', () => ({
  default: { satisfies: vi.fn(), gte: vi.fn() }
}))

import { determineApiType } from '../OpenClawService'

/**
 * Minimal provider/model stubs — only fields used by determineApiType.
 */
function makeProvider(overrides: { id?: string; type?: string; anthropicApiHost?: string } = {}) {
  return {
    id: overrides.id ?? 'test-provider',
    type: overrides.type ?? 'openai',
    ...(overrides.anthropicApiHost !== undefined && { anthropicApiHost: overrides.anthropicApiHost })
  }
}

function makeModel(overrides: { id?: string; endpoint_type?: string } = {}) {
  return {
    id: overrides.id ?? 'gpt-4o',
    endpoint_type: overrides.endpoint_type
  }
}

describe('determineApiType', () => {
  // ─── Priority 1: model.endpoint_type ───────────────────────────────

  describe('Priority 1 — model endpoint_type', () => {
    it('anthropic endpoint_type → anthropic-messages', () => {
      const provider = makeProvider({ type: 'new-api' })
      const model = makeModel({ id: 'claude-sonnet-4', endpoint_type: 'anthropic' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('openai endpoint_type → openai-completions', () => {
      const provider = makeProvider({ type: 'new-api' })
      const model = makeModel({ id: 'gpt-5', endpoint_type: 'openai' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('openai-response endpoint_type → openai-responses', () => {
      const provider = makeProvider({ type: 'new-api' })
      const model = makeModel({ id: 'gpt-5', endpoint_type: 'openai-response' })
      expect(determineApiType(provider, model)).toBe('openai-responses')
    })

    it('gemini endpoint_type → google-generative-ai', () => {
      const provider = makeProvider({ type: 'new-api' })
      const model = makeModel({ id: 'gemini-2.5-pro', endpoint_type: 'gemini' })
      expect(determineApiType(provider, model)).toBe('google-generative-ai')
    })

    it('endpoint_type takes priority over provider type', () => {
      const provider = makeProvider({ type: 'anthropic' })
      const model = makeModel({ id: 'some-model', endpoint_type: 'openai' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('unknown endpoint_type is ignored (falls through)', () => {
      const provider = makeProvider({ type: 'openai' })
      const model = makeModel({ id: 'gpt-4o', endpoint_type: 'image-generation' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })
  })

  // ─── Priority 2: provider.id ───────────────────────────────────────

  describe('Priority 2 — provider id', () => {
    it('copilot provider id → github-copilot', () => {
      const provider = makeProvider({ id: 'copilot', type: 'openai' })
      const model = makeModel({ id: 'gpt-4o' })
      expect(determineApiType(provider, model)).toBe('github-copilot')
    })

    it('copilot id takes priority over model name inference', () => {
      const provider = makeProvider({ id: 'copilot', type: 'openai' })
      const model = makeModel({ id: 'claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('github-copilot')
    })
  })

  // ─── Priority 3: provider.type ─────────────────────────────────────

  describe('Priority 3 — provider type', () => {
    it('anthropic provider → anthropic-messages', () => {
      const provider = makeProvider({ type: 'anthropic' })
      const model = makeModel({ id: 'claude-opus-4.6' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('vertex-anthropic provider → anthropic-messages', () => {
      const provider = makeProvider({ type: 'vertex-anthropic' })
      const model = makeModel({ id: 'claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('ollama provider → ollama', () => {
      const provider = makeProvider({ type: 'ollama' })
      const model = makeModel({ id: 'llama3.1:70b' })
      expect(determineApiType(provider, model)).toBe('ollama')
    })

    it('gemini provider → google-generative-ai', () => {
      const provider = makeProvider({ type: 'gemini' })
      const model = makeModel({ id: 'gemini-2.5-pro' })
      expect(determineApiType(provider, model)).toBe('google-generative-ai')
    })

    it('aws-bedrock provider → bedrock-converse-stream', () => {
      const provider = makeProvider({ type: 'aws-bedrock' })
      const model = makeModel({ id: 'anthropic.claude-sonnet-4-v2' })
      expect(determineApiType(provider, model)).toBe('bedrock-converse-stream')
    })

    it('openai-response provider → openai-responses', () => {
      const provider = makeProvider({ type: 'openai-response' })
      const model = makeModel({ id: 'gpt-5' })
      expect(determineApiType(provider, model)).toBe('openai-responses')
    })

    it('openai-response provider with claude model name → still openai-responses (not anthropic)', () => {
      const provider = makeProvider({ type: 'openai-response' })
      const model = makeModel({ id: 'claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('openai-responses')
    })
  })

  // ─── Priority 4: model name + anthropicApiHost inference ─────────

  describe('Priority 4 — model name inference (requires anthropicApiHost)', () => {
    it('claude model on provider WITH anthropicApiHost → anthropic-messages', () => {
      const provider = makeProvider({ id: 'aihubmix', type: 'openai', anthropicApiHost: 'https://aihubmix.com' })
      const model = makeModel({ id: 'claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('claude model with path prefix on provider WITH anthropicApiHost → anthropic-messages', () => {
      const provider = makeProvider({ id: 'dmxapi', type: 'openai', anthropicApiHost: 'https://www.dmxapi.cn' })
      const model = makeModel({ id: 'dmxapi/anthropic/claude-opus-4.6' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('claude model on provider WITHOUT anthropicApiHost → openai-completions (e.g. openrouter)', () => {
      const provider = makeProvider({ id: 'openrouter', type: 'openai' })
      const model = makeModel({ id: 'openrouter/anthropic/claude-opus-4.6' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('gemini model on provider WITH anthropicApiHost → openai-completions (no gemini inference)', () => {
      const provider = makeProvider({ id: 'aihubmix', type: 'openai', anthropicApiHost: 'https://aihubmix.com' })
      const model = makeModel({ id: 'gemini-2.5-pro' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('gemini model on openrouter → openai-completions', () => {
      const provider = makeProvider({ id: 'openrouter', type: 'openai' })
      const model = makeModel({ id: 'google/gemini-2.5-flash-preview' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('non-claude model on provider WITH anthropicApiHost → openai-completions', () => {
      const provider = makeProvider({ id: 'aihubmix', type: 'openai', anthropicApiHost: 'https://aihubmix.com' })
      const model = makeModel({ id: 'gpt-5.4' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })
  })

  // ─── Priority 5: default ───────────────────────────────────────────

  describe('Priority 5 — default to openai-completions', () => {
    it('unknown model on openai provider → openai-completions', () => {
      const provider = makeProvider({ type: 'openai' })
      const model = makeModel({ id: 'gpt-5.4' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('unknown model on gateway provider → openai-completions', () => {
      const provider = makeProvider({ type: 'gateway' })
      const model = makeModel({ id: 'my-custom-model' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })
  })

  // ─── Regression scenarios ──────────────────────────────────────────

  describe('regression — original bug & openrouter fix', () => {
    it('aihubmix + GPT-5.4 → openai-completions (NOT anthropic-messages)', () => {
      const provider = makeProvider({ id: 'aihubmix', type: 'openai', anthropicApiHost: 'https://aihubmix.com' })
      const model = makeModel({ id: 'cherry-aihubmix/gpt-5.4' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('aihubmix + claude-sonnet-4 → anthropic-messages', () => {
      const provider = makeProvider({ id: 'aihubmix', type: 'openai', anthropicApiHost: 'https://aihubmix.com' })
      const model = makeModel({ id: 'cherry-aihubmix/claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('anthropic-messages')
    })

    it('openrouter + gemini → openai-completions (NOT google-generative-ai)', () => {
      const provider = makeProvider({ id: 'openrouter', type: 'openai' })
      const model = makeModel({ id: 'cherry-openrouter/google/gemini-2.5-flash-preview' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })

    it('openrouter + claude → openai-completions (NOT anthropic-messages)', () => {
      const provider = makeProvider({ id: 'openrouter', type: 'openai' })
      const model = makeModel({ id: 'cherry-openrouter/anthropic/claude-sonnet-4' })
      expect(determineApiType(provider, model)).toBe('openai-completions')
    })
  })
})
