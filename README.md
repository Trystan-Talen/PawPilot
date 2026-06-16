# PawPilot

A playful desktop command center for managing multiple AI coding agents as little office dogs. PawPilot wraps terminal agents like Codex or Claude, tracks their live status, logs their work, preserves handoff context, and helps you recover or continue tasks when sessions are interrupted.

一个深夜办公室，让你的 AI agent 全变成小狗。

每只狗坐在自己的工位上敲键盘干活；屏幕上写着它正在做什么；进度条一格一格往前走。
完成的狗合上电脑、走出办公室，自动归档。一眼扫过去就知道谁在工作、谁卡住了、谁在等你回应。

---

## 干嘛用

如果你同时跑好几个终端 agent（Claude Code / Codex / Anti-Gravity / Hermes …），窗口看不过来，这个工具帮你：

- 📺 **一眼总览** — 每个 agent 一个工位，状态、进度、当前动作直接显示
- 💬 **当前在干什么** — 屏幕上滚出来"正在修改 api.py"这样的实时信息
- 🛎️ **关键时刻通知你** — 完成 / 报错 / 在等你回应，弹原生通知
- 📁 **档案柜** — 历史任务自动归档，可以回看日志和成本

---

## 快速开始

```bash
# 1. 装依赖（首次需要重编 better-sqlite3 给 Electron 用）
npm install

# 2. 启动 dashboard
npm run dev

# 3. 把 dog CLI 加到 PATH
export PATH="$(pwd)/sdk:$PATH"

# 4. 把任何 agent 命令包一层 dog run 跑起来
dog run "修复登录bug" claude
dog run "写PRD" codex
dog run -- npx tsx my-agent.ts   # -- 之后是完整命令
```

新狗会立刻出现在 dashboard 的办公室里。

---

## 6 种狗的状态

| 状态 | 动画 | 触发 |
|------|------|------|
| 🐕 工作中 | 爪子敲键盘 | 有新输出 |
| 🤔 思考中 | 头左右晃 | 12 秒无输出 |
| 😴 摸鱼中 | 闭眼睡觉 + ZZ | 空闲 |
| ✅ 完成 | 举爪欢呼 | 进程退出 0 |
| ⛔️ 报错 | 抖动 + 屏幕红闪 | 进程退出非 0 |
| ⏳ 等你回应 | 耳朵竖起 + ! 气泡 | 检测到 "Do you want to..." |

---

## 在 dashboard 上招聘新狗

点右上角 **+ 招聘**，选工具 + 输入任务 + 选终端，会自动开一个新终端窗口跑 `dog run ...`。

---

## 架构

```
┌──────────────────────────────────┐
│   Electron 主进程                 │
│   ┌─────────────┐  ┌──────────┐  │
│   │ React UI    │  │ Express  │  │
│   │ (renderer)  │←→│ + WS     │  │
│   │             │  │ + SQLite │  │
│   └─────────────┘  └────┬─────┘  │
└─────────────────────────┼────────┘
                          │ HTTP
            ┌─────────────┴─────────────┐
            │                           │
       dog run …                   dog run …
       (claude)                    (codex)
```

- 主进程跑本地服务器（端口 17890）
- `dog` Python 包装器把 stdout/stderr 解析后 POST 给服务器
- 服务器写 SQLite + 广播到 React UI
- 心跳超时 30s 标记失联

---

## 项目结构

```
dog-office/
├── src/
│   ├── main/          # Electron 主进程：server.ts / db.ts / terminal.ts
│   ├── preload/       # 安全桥
│   └── renderer/src/  # React UI
│       ├── components/
│       │   ├── DogCharacter.tsx    # SVG 狗 + 6 状态
│       │   ├── WorkstationCard.tsx # 工位卡片
│       │   ├── OfficeFloor.tsx     # 办公室网格
│       │   ├── HeaderBar.tsx       # 顶栏统计
│       │   ├── DetailPanel.tsx     # 详情面板
│       │   ├── HireModal.tsx       # 招聘弹窗
│       │   ├── ArchiveCabinet.tsx  # 档案柜
│       │   └── effects/            # 粉尘等氛围效果
│       └── store/agentStore.ts     # Zustand
└── sdk/
    └── dog            # Python CLI 包装器
```

---

## 之后想加的

- [ ] 在 dashboard 上直接点"允许 / 拒绝"（双向交互）
- [ ] 把 SVG 狗换成你画的更精致的插画（接口已预留）
- [ ] 多 agent 协作时的依赖关系视图
- [ ] 系统托盘图标
- [ ] 声音通知
