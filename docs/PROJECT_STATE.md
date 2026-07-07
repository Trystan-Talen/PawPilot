# PawPilot 项目状态交接文档

> 这是 PawPilot 的“活交接文档”。任何新窗口、新 Agent、或未来的你接手本项目时，先读本文。
> 每次完成一次实质迭代后，都必须更新本文，再提交代码。

## 维护规则

- 本文记录项目“当前真实状态”，不是一次性总结。
- 每轮迭代后必须更新：
  - 最新完成了什么
  - 验证了什么
  - 还欠什么
  - 下一步建议从哪里开始
- 如果代码、提示词、启动方式、数据目录、已知坑发生变化，必须同步更新对应章节。
- 完工交付总结可以另写 `docs/HANDOVER.md`，但日常接续优先读本文。

## 当前快照

- 更新时间：2026-07-07
- 当前分支：`main`
- 远端仓库：`https://github.com/Trystan-Talen/PawPilot.git`
- 最新提交：`da0fa45 Add safe scroll inset to hire modal`
- 当前工作区：代码已推送到 `origin/main`；仅 `sdk/__pycache__/` 为未跟踪 Python 缓存，不应提交。
- 当前产品名：PawPilot
- 当前定位：把终端里的 Claude Code / Codex 等 agent 变成一间可视化办公室，并逐步支持 PM 带队、多角色分工、项目验收闭环。

## 一句话现状

PawPilot 已经具备“单 agent 可视化监控 + 多 agent 团队雏形 + 项目维度 + 9 角色招聘 + 终端消息直连 + 招聘前预检”的主链路；下一阶段重点应转向“老板验收台”和“真实完整项目闭环压测”。

## 已完成能力

### 单 Agent 监控

- `dog run` 包装任意终端 agent，并实时上报状态、日志、进度。
- Electron 主进程启动本地 server：`127.0.0.1:17890`。
- React UI 展示办公室、工位、详情面板、档案柜。
- 工位支持工作中、思考中、等待、报错、完成、失联、中断、待验收、额度暂停等状态。
- 详情面板支持查看活动流、复制日志、生成接手上下文、发送消息到终端、清退/终止。

### 多 Agent 团队

- 角色注册表已有 9 角色：
  - PM
  - 全栈工程师
  - UI 设计师
  - 质检工程师
  - 测试工程师
  - 前端工程师
  - 后端工程师
  - DevOps 工程师
  - 文档工程师
- `resources/roles/*.md` 中有完整角色提示词。
- `dog team/send/submit/escalate/ask/hire/uilib/hook` 已实现。
- PM 可通过 `dog hire` 招人，团队归属通过 `projectId` / `parentId` 继承。
- 交付后进入 `submitted`，不会因为后续普通输出被冲回 `working`。

### 终端控制与运行时

- `sdk/dog` 已重写成 PTY pump：
  - 子进程 stdin/stdout/stderr 接 PTY
  - 父终端 raw 转发键盘
  - server 可通过 `/tmp/dogoffice-ipc/<agentId>.sock` 注入消息
- 详情面板发消息优先走 PTY socket，不再依赖 macOS 辅助功能权限；失败才退回 osascript。
- Claude Code 注入 PostToolUse hook，通过 `dog hook` 上报结构化工具动作。
- Claude 狗使用独立配置目录：`~/.dog-office/claude-cfg`。
- 代理配置来源：`~/.dog-office/proxy.env` 或 PawPilot 进程环境。

### 前端近期改动

- 招聘弹窗接入招聘前预检：
  - dog wrapper
  - 角色 prompt
  - 项目目录
  - Agent 工具命令
  - Claude 配置目录
  - 代理透传
- 招聘按钮有超时和 `finally` 恢复，不会无限“招聘中”。
- 主进程 AppleScript 调用有 15 秒超时。
- 招聘弹窗滚动区已修复：
  - 外层弹窗负责圆角/边框/裁切
  - 内层滚动区负责滚动
  - 外层保留 8px 安全内缩
  - 内层保留 16px 上下安全 padding
  - 规则已沉淀到 `docs/DESIGN.md`
- 待验收、等额度状态已有专属工位姿态。

## 近期提交记录

- `4b60cc3 Restore PawPilot collaboration baseline`
  - 把本地协作基线推到 GitHub。
- `2f05a70 Add hire preflight checks`
  - 新增招聘前预检。
- `c095910 Improve agent startup health signals`
  - 识别代理/地区 403，补 `paused` 状态展示。
- `b5d41bf Add distinct workstation waiting states`
  - 工位新增待验收/等额度姿态。
- `e2fae5b Fix hire modal scroll and loading recovery`
  - 修复弹窗滚动穿模、招聘按钮无限 loading。
- `da0fa45 Add safe scroll inset to hire modal`
  - 将弹窗滚动方案升级为安全边距方案。

## 最近验证记录

已跑过：

- `npm run typecheck`
- `npm run build`
- `python3 -m py_compile sdk/dog`
- `curl --noproxy '*' http://127.0.0.1:17890/health`
- 真实走过一次 `/api/hire` 招聘全栈测试狗，接口返回 `ok:true`。

注意：

- 之前有一次只做了 typecheck/build/server health，没有足够验证招聘弹窗交互，导致用户发现 UI 穿模和“招聘中”卡住问题。
- 以后涉及 UI 的改动，必须至少真实打开应用检查对应界面；涉及招聘/终端启动的改动，必须验证 `/api/hire` 或真实按钮路径不会卡死。

## 已知问题与风险

### 高优先级

- 缺“老板验收台”：
  - 项目待验收横幅
  - PM 验收报告
  - 通过/打回按钮
  - 结构化返工单
  - 项目归档包
- 多 agent 团队协作还缺完整真实项目端到端压测。

### 中优先级

- 招聘前预检仍是静态/轻量预检，不会真正调用模型验证 Claude 登录态，以免烧额度或卡网络。
- 测试狗/历史狗可能留在本地数据库里，需要 UI 或工具层更优雅地清理测试记录。
- `docs/STATUS-体检报告.md` 和 `docs/续接-下一窗口.md` 有历史价值，但不是最新唯一真相；以后以本文为接续入口。

### 低优先级

- `sdk/__pycache__/` 会因 Python 编译检查生成，保持未跟踪即可。
- README 的项目结构仍可能提到旧组件名，后续可顺手同步。

## 下一步建议

### 第一优先：老板验收台

目标：让 PawPilot 不只是“看见 agent 在干活”，而是能管理交付。

建议拆分：

1. 后端增加项目验收相关 API：
   - 设置项目状态为 `acceptance`
   - 记录 PM 验收报告
   - 通过验收
   - 打回并发送意见给 PM
2. 前端增加项目待验收横幅：
   - 当前项目状态
   - 待验收成员数
   - PM 报告入口
3. 详情或独立面板中增加：
   - PM 验收报告展示
   - “通过归档”
   - “打回修改”
4. 打回时生成结构化消息发给 PM：
   - 问题
   - 期望结果
   - 必须复测项
   - 是否需要重新招测试/QA

### 第二优先：完整项目闭环压测

拿一个小但真实的项目跑：

1. 新建项目
2. 招 PM
3. PM 出计划并 `dog ask`
4. 招 UI 设计师 / 全栈 / 测试 / QA
5. 工程师 `dog submit`
6. PM 汇总终验
7. 老板通过或打回
8. 记录全链路问题并更新本文

### 第三优先：测试与 QA 基建

- 加 Playwright 或等价 UI 自动化，至少覆盖：
  - 打开招聘弹窗
  - 角色切换
  - 弹窗滚动不穿圆角
  - 招聘按钮异常时恢复
- 给 `sdk/dog` 的关键解析逻辑加轻量单测：
  - 401 鉴权失败
  - 403 代理/地区失败
  - 额度暂停
  - 等待输入

## 关键文件索引

- 主进程入口：`src/main/index.ts`
- 本地 server / API / 状态机：`src/main/server.ts`
- 终端启动 / 消息发送 / 预检：`src/main/terminal.ts`
- SQLite 数据层：`src/main/db.ts`
- 角色注册表：`src/main/roles.ts`
- Python wrapper：`sdk/dog`
- preload API：`src/preload/index.ts`
- preload 类型：`src/preload/index.d.ts`
- 前端 store：`src/renderer/src/store/agentStore.ts`
- 招聘弹窗：`src/renderer/src/components/HireModal.tsx`
- 工位视觉：`src/renderer/src/components/Workstation.tsx`
- 详情面板：`src/renderer/src/components/DetailPanel.tsx`
- 设计规范：`docs/DESIGN.md`
- 本文：`docs/PROJECT_STATE.md`

## 本地启动与验证

启动：

```bash
npm run dev
```

健康检查：

```bash
curl --noproxy '*' http://127.0.0.1:17890/health
```

类型检查：

```bash
npm run typecheck
```

生产构建：

```bash
npm run build
```

Python wrapper 语法检查：

```bash
python3 -m py_compile sdk/dog
```

## 环境与踩坑

- macOS Desktop / Documents 目录可能受 TCC 限制，所以 `dog` 会安装到：
  - `~/.dog-office/bin/dog`
- Claude 独立配置目录：
  - `~/.dog-office/claude-cfg`
- 代理配置：
  - `~/.dog-office/proxy.env`
- 本地 IPC socket：
  - `/tmp/dogoffice-ipc/<agentId>.sock`
- 应用数据目录：
  - `~/Library/Application Support/pawpilot/dog-office.db`
- 旧数据可能在：
  - `~/Library/Application Support/dog-office/`

## 给下一个接手 Agent 的开工步骤

1. 读本文。
2. 执行 `git status --short --branch`，确认是否有未提交改动。
3. 执行 `npm run typecheck`，必要时执行 `npm run build`。
4. 如果要改 UI，启动 `npm run dev` 后真实打开界面验证，不要只靠编译。
5. 如果要改招聘/终端链路，验证 `/api/hire` 或真实招聘按钮，不要只测 server health。
6. 完成本轮迭代后，先更新本文，再提交和推送。
