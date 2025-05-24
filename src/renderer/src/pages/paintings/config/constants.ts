import type { PaintingAction } from '@renderer/types'

// 几种默认的绘画配置
export const DEFAULT_PAINTING: PaintingAction = {
  id: 'aihubmix_1',
  model: 'V_3',
  aspectRatio: 'ASPECT_1_1',
  numImages: 1,
  styleType: 'AUTO',
  prompt: '',
  negativePrompt: '',
  magicPromptOption: true,
  seed: '',
  imageWeight: 50,
  resemblance: 50,
  detail: 50,
  imageFile: undefined,
  mask: undefined,
  files: [],
  urls: [],
  renderingSpeed: 'DEFAULT'
}

export const ASPECT_RATIOS = [
  {
    label: 'paintings.aspect_ratios.square',
    options: [
      {
        label: '1:1',
        value: 'ASPECT_1_1'
      }
    ]
  },
  {
    label: 'paintings.aspect_ratios.landscape',
    options: [
      {
        label: '1:2',
        value: 'ASPECT_1_2'
      },
      {
        label: '1:3',
        value: 'ASPECT_1_3'
      },
      {
        label: '2:3',
        value: 'ASPECT_2_3'
      },
      {
        label: '3:4',
        value: 'ASPECT_3_4'
      },
      {
        label: '4:5',
        value: 'ASPECT_4_5'
      },
      {
        label: '9:16',
        value: 'ASPECT_9_16'
      },
      {
        label: '10:16',
        value: 'ASPECT_10_16'
      }
    ]
  },
  {
    label: 'paintings.aspect_ratios.landscape',
    options: [
      {
        label: '2:1',
        value: 'ASPECT_2_1'
      },
      {
        label: '3:1',
        value: 'ASPECT_3_1'
      },
      {
        label: '3:2',
        value: 'ASPECT_3_2'
      },
      {
        label: '4:3',
        value: 'ASPECT_4_3'
      },
      {
        label: '5:4',
        value: 'ASPECT_5_4'
      },
      {
        label: '16:9',
        value: 'ASPECT_16_9'
      },
      {
        label: '16:10',
        value: 'ASPECT_16_10'
      }
    ]
  }
]

export const STYLE_TYPES = [
  {
    label: 'paintings.style_types.auto',
    value: 'AUTO'
  },
  {
    label: 'paintings.style_types.general',
    value: 'GENERAL'
  },
  {
    label: 'paintings.style_types.realistic',
    value: 'REALISTIC'
  },
  {
    label: 'paintings.style_types.design',
    value: 'DESIGN'
  },
  {
    label: 'paintings.style_types.3d',
    value: 'RENDER_3D',
    onlyV2: true // 仅V2模型支持
  },
  {
    label: 'paintings.style_types.anime',
    value: 'ANIME',
    onlyV2: true // 仅V2模型支持
  }
]

// V3模型支持的样式类型
export const V3_STYLE_TYPES = STYLE_TYPES.filter((style) => !style.onlyV2)

// 新增V3渲染速度选项
export const RENDERING_SPEED_OPTIONS = [
  {
    label: 'paintings.rendering_speeds.default',
    value: 'DEFAULT'
  },
  {
    label: 'paintings.rendering_speeds.turbo',
    value: 'TURBO'
  },
  {
    label: 'paintings.rendering_speeds.quality',
    value: 'QUALITY'
  }
]
