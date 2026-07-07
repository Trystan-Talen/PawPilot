// 角色注册表：默认工具/模型只是默认值，招聘时一律可覆盖
// 2026 编制理念：一个 coding agent 前后端都能写，所以默认开发岗是「全栈」（按功能切片，
// 一狗包一个模块的前+后）；前端/后端只在「纯重前端动效 / 纯重后端数据」时才作为专才招。
// 分三组：core（核心三件套）/ quality（质量两件套）/ specialist（按需专才）。
export type RoleGroup = 'core' | 'quality' | 'specialist'

export interface RoleSpec {
  id: string
  name: string          // 中文名（显示用）
  emoji: string
  duty: string          // 职责一句话（招聘卡片用）
  group: RoleGroup
  promptFile: string    // resources/roles/ 下的文件名
  defaultTool: 'claude' | 'codex' | 'antigravity' | 'hermes' | 'custom'
  defaultModel: string | null   // null = 跟工具默认配置走
  isPm: boolean
}

export const GROUP_LABEL: Record<RoleGroup, string> = {
  core: '核心 · 多数项目就这几个',
  quality: '质量 · 把关验收',
  specialist: '专才 · 按需才招'
}

export const ROLES: RoleSpec[] = [
  // ===== 核心三件套 =====
  {
    id: 'pm',
    name: '项目经理',
    emoji: '👔',
    duty: '拆任务、写契约、派活、裁决升级、终验',
    group: 'core',
    promptFile: 'pm.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: true
  },
  {
    id: 'fullstack',
    name: '全栈工程师',
    emoji: '🛠️',
    duty: '开发主力：按功能切片，一人包一个模块的前+后端',
    group: 'core',
    promptFile: 'fullstack.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'ui-designer',
    name: 'UI 设计师',
    emoji: '🎭',
    duty: '产出设计规范，给前端定调（带界面项目必招）',
    group: 'core',
    promptFile: 'ui-designer.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },

  // ===== 质量两件套 =====
  {
    id: 'qa',
    name: '质检工程师',
    emoji: '🔍',
    duty: 'Code Review：换双眼睛挑刺，不动手',
    group: 'quality',
    promptFile: 'qa.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'tester',
    name: '测试工程师',
    emoji: '🧪',
    duty: '写自动化测试 + 真机验证',
    group: 'quality',
    promptFile: 'tester.md',
    defaultTool: 'codex',
    defaultModel: null,
    isPm: false
  },

  // ===== 按需专才 =====
  {
    id: 'frontend',
    name: '前端工程师',
    emoji: '🎨',
    duty: '专才：仅纯重前端 / 复杂动效时才招',
    group: 'specialist',
    promptFile: 'frontend.md',
    defaultTool: 'codex',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'backend',
    name: '后端工程师',
    emoji: '⚙️',
    duty: '专才：仅纯重后端 / 数据/算法时才招',
    group: 'specialist',
    promptFile: 'backend.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'devops',
    name: 'DevOps 工程师',
    emoji: '🚀',
    duty: '专才：要打包/部署/CI/配环境时才招',
    group: 'specialist',
    promptFile: 'devops.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'docs-engineer',
    name: '文档工程师',
    emoji: '📝',
    duty: '专才：通常不必单招，文档多为收尾任务',
    group: 'specialist',
    promptFile: 'docs-engineer.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  }
]

export function getRole(id: string): RoleSpec | undefined {
  // 兼容旧角色名
  if (id === 'manager') id = 'pm'
  if (id === 'worker') id = 'fullstack'
  return ROLES.find((r) => r.id === id)
}
