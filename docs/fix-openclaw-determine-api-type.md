# Fix: OpenClaw `determineApiType` 协议判断逻辑重构

## 问题描述

当前 `OpenClawService.determineApiType()` 在判断模型应使用何种 OpenClaw 协议时存在缺陷：

**位置**: `src/main/services/OpenClawService.ts` L938-960

**现有判断逻辑（4 步优先级）**:

1. `provider.type` 是 `anthropic` / `vertex-anthropic` → `anthropic-messages`
2. `model.endpoint_type` 是 `anthropic` → `anthropic-messages`
3. `provider.anthropicApiHost` 有值 → `anthropic-messages` ← **问题所在**
4. 默认 → `openai-completions`

**Bug 表现**: 选择 `cherry-aihubmix/gpt-5.4` 作为主模型时，配置文件中 `api` 字段被错误写为 `anthropic-messages`，应为 `openai-completions`。

**根因**: Step 3 将 "provider 支持 Anthropic 端点" 等同于 "当前模型应使用 Anthropic 协议"。`anthropicApiHost` 是 provider 级别配置（在 `src/renderer/src/config/providers.ts` 中硬编码），导致 aihubmix、dmxapi、silicon 等十余个混合 provider 下的所有模型都被错误判断为 Anthropic 协议。

**额外问题**: 当前逻辑只覆盖了 3 种协议（`openai-completions`、`anthropic-messages`、`openai-responses`），但 OpenClaw 实际支持 8 种协议。

## OpenClaw 支持的协议

| 协议 | 说明 |
|---|---|
| `openai-completions` | OpenAI Chat Completions API |
| `openai-responses` | OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI API |
| `github-copilot` | GitHub Copilot API |
| `bedrock-converse-stream` | AWS Bedrock Converse Stream API |
| `ollama` | Ollama 本地 API |

## 方案设计

### 核心思路

利用项目已有的 `Model.endpoint_type` 字段和模型名推断函数，建立 **EndpointType → OpenClaw 协议** 的映射表，分层判断，将协议决策从 provider 级别下沉到 model 级别。

### Cherry EndpointType 与 OpenClaw 协议的映射关系

项目中 `EndpointType` 定义于 `src/renderer/src/types/index.ts`:

```typescript
EndpointType = 'openai' | 'openai-response' | 'anthropic' | 'gemini' | 'image-generation' | 'jina-rerank'
```

映射表：

| Cherry `EndpointType` | OpenClaw 协议 |
|---|---|
| `openai` | `openai-completions` |
| `openai-response` | `openai-responses` |
| `anthropic` | `anthropic-messages` |
| `gemini` | `google-generative-ai` |

Provider 特殊类型映射：

| Cherry `provider.type` / `provider.id` | OpenClaw 协议 |
|---|---|
| `provider.type === 'ollama'` | `ollama` |
| `provider.type === 'aws-bedrock'` | `bedrock-converse-stream` |
| `provider.id === 'copilot'` | `github-copilot` |

### 新的判断逻辑

```
优先级 1: model.endpoint_type（模型自身声明的端点类型）
    ↓ 未命中
优先级 2: provider 特殊类型（ollama / bedrock / copilot 等专属协议）
    ↓ 未命中
优先级 3: 模型名推断（兜底，覆盖混合 provider 下未标记 endpoint_type 的模型）
    ↓ 未命中
优先级 4: 默认 openai-completions
```

### 代码变更

**文件**: `src/main/services/OpenClawService.ts`

#### 1. 新增映射常量

```typescript
/**
 * Mapping from Cherry Studio EndpointType to OpenClaw API protocol.
 * Used when model has explicit endpoint_type metadata.
 */
const ENDPOINT_TO_OPENCLAW_API: Record<string, string> = {
  anthropic: OPENCLAW_API_TYPES.ANTHROPIC,
  openai: OPENCLAW_API_TYPES.OPENAI,
  'openai-response': OPENCLAW_API_TYPES.OPENAI_RESPONSE,
  gemini: 'google-generative-ai'
}

/**
 * Mapping from Cherry Studio provider type/id to OpenClaw API protocol.
 * Used for providers that always use a specific protocol regardless of model.
 */
const PROVIDER_TO_OPENCLAW_API: Partial<Record<string, string>> = {
  ollama: 'ollama',
  'aws-bedrock': 'bedrock-converse-stream'
}

const PROVIDER_ID_TO_OPENCLAW_API: Partial<Record<string, string>> = {
  copilot: 'github-copilot'
}
```

#### 2. 重写 `determineApiType`

```typescript
private determineApiType(provider: Provider, model: Model): string {
  // 1. Model's explicit endpoint_type (highest priority - model knows best)
  if (model.endpoint_type && ENDPOINT_TO_OPENCLAW_API[model.endpoint_type]) {
    return ENDPOINT_TO_OPENCLAW_API[model.endpoint_type]
  }

  // 2. Provider-specific protocol (ollama, bedrock, copilot, etc.)
  if (PROVIDER_ID_TO_OPENCLAW_API[provider.id]) {
    return PROVIDER_ID_TO_OPENCLAW_API[provider.id]
  }
  if (PROVIDER_TO_OPENCLAW_API[provider.type]) {
    return PROVIDER_TO_OPENCLAW_API[provider.type]
  }

  // 3. Provider type is always Anthropic
  if (ANTHROPIC_ONLY_PROVIDERS.includes(provider.type)) {
    return OPENCLAW_API_TYPES.ANTHROPIC
  }

  // 4. Infer from model name (fallback for mixed providers without endpoint_type)
  if (isAnthropicModel(model)) {
    return OPENCLAW_API_TYPES.ANTHROPIC
  }
  if (isGeminiModel(model)) {
    return 'google-generative-ai'
  }

  // 5. OpenAI Responses provider type
  if (provider.type === 'openai-response') {
    return OPENCLAW_API_TYPES.OPENAI_RESPONSE
  }

  // 6. Default to OpenAI-compatible
  return OPENCLAW_API_TYPES.OPENAI
}
```

#### 3. 需要新增的 import

```typescript
import { isAnthropicModel, isGeminiModel } from '@renderer/config/models/utils'
```

> **注意**: `isAnthropicModel` 和 `isGeminiModel` 定义在 renderer 侧 (`src/renderer/src/config/models/utils.ts`)，而 `OpenClawService` 位于 main 进程。需要确认这两个函数是否可以从 main 进程引用，或者需要将其提取到 `packages/shared/` 中。

#### 4. 移除的逻辑

- 删除原 Step 3 中对 `provider.anthropicApiHost` 的判断（这是 bug 的根源）
- `isAnthropicEndpointType()` 函数可以移除，其功能已被 `ENDPOINT_TO_OPENCLAW_API` 映射覆盖

#### 5. `getBaseUrlForApiType` 需要扩展

新增协议可能需要相应的 URL 格式化逻辑：

```typescript
private getBaseUrlForApiType(provider: Provider, apiType: string): string {
  switch (apiType) {
    case OPENCLAW_API_TYPES.ANTHROPIC:
      return this.formatAnthropicUrl(provider.anthropicApiHost || provider.apiHost)
    case 'google-generative-ai':
      return this.formatGeminiUrl(provider)
    case 'ollama':
      return this.formatOllamaUrl(provider)
    case 'bedrock-converse-stream':
      return this.formatBedrockUrl(provider)
    case 'github-copilot':
      return this.formatCopilotUrl(provider)
    default:
      return this.formatOpenAIUrl(provider)
  }
}
```

### 影响范围

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/main/services/OpenClawService.ts` | 修改 | 重写 `determineApiType`，扩展 `getBaseUrlForApiType` |
| `packages/shared/` (可能) | 新增 | 如需将 `isAnthropicModel` 等函数提取为共享模块 |

### 测试计划

- [ ] aihubmix + GPT-5.4 → `openai-completions`
- [ ] aihubmix + claude-sonnet-4 → `anthropic-messages`
- [ ] aihubmix + gemini-2.5-pro → `google-generative-ai`（如 endpoint_type 有标记）
- [ ] anthropic + claude-opus-4.6 → `anthropic-messages`
- [ ] ollama + 任意模型 → `ollama`
- [ ] openai + gpt-5 → `openai-completions`
- [ ] huggingface (openai-response type) + 任意模型 → `openai-responses`
- [ ] aws-bedrock + 任意模型 → `bedrock-converse-stream`
- [ ] copilot + 任意模型 → `github-copilot`
- [ ] new-api + 带 endpoint_type=anthropic 的模型 → `anthropic-messages`
- [ ] new-api + 无 endpoint_type 的 GPT 模型 → `openai-completions`

### 向后兼容

本次变更不涉及 Redux 数据模型或 IndexedDB schema 变更，符合 v2.0.0 之前的贡献限制。
