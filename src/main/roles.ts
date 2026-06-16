// 9 角色注册表：默认工具/模型只是默认值，招聘时一律可覆盖
export interface RoleSpec {
  id: string
  name: string          // 中文名（显示用）
  emoji: string
  duty: string          // 职责一句话（招聘卡片用）
  promptFile: string    // resources/roles/ 下的文件名
  defaultTool: 'claude' | 'codex' | 'antigravity' | 'hermes' | 'custom'
  defaultModel: string | null   // null = 跟工具默认配置走
  isPm: boolean
}

export const ROLES: RoleSpec[] = [
  {
    id: 'pm',
    name: '项目经理',
    emoji: '👔',
    duty: '拆任务、写契约、派活、裁决升级、终验',
    promptFile: 'pm.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: true
  },
  {
    id: 'frontend',
    name: '前端工程师',
    emoji: '🎨',
    duty: 'UI / 页面 / 交互实现',
    promptFile: 'frontend.md',
    defaultTool: 'codex',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'backend',
    name: '后端工程师',
    emoji: '⚙️',
    duty: '接口 / 数据库 / 业务逻辑',
    promptFile: 'backend.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'fullstack',
    name: '全栈工程师',
    emoji: '🛠️',
    duty: '小项目包圆，杂活兜底',
    promptFile: 'fullstack.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'qa',
    name: '质检工程师',
    emoji: '🔍',
    duty: 'Code Review：只挑刺，不动手',
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
    promptFile: 'tester.md',
    defaultTool: 'codex',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'ui-designer',
    name: 'UI 设计师',
    emoji: '🎭',
    duty: '产出设计规范，给前端定调',
    promptFile: 'ui-designer.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'docs-engineer',
    name: '文档工程师',
    emoji: '📝',
    duty: 'README / 使用文档 / 注释',
    promptFile: 'docs-engineer.md',
    defaultTool: 'claude',
    defaultModel: null,
    isPm: false
  },
  {
    id: 'devops',
    name: 'DevOps 工程师',
    emoji: '🚀',
    duty: '打包 / 部署 / CI / 环境',
    promptFile: 'devops.md',
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
