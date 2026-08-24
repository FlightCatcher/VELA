# VELA

**A local-first, independent AI agent that plans, acts, verifies and learns with you.**

VELA 是一个可独立运行的桌面 AI Agent。它拥有对话、任务规划、DAG 执行、
受控工具调用、失败诊断、有限重试、版本化重新规划、记忆、知识库和本地生图能力。
它不依赖 OpenClaw Gateway，也不要求绑定某一家模型服务。

## 核心能力

- 独立 Agent Runtime 与本地持久化会话
- Planner、Executor、Reflection、有限重试与版本化 Replanning
- Ollama 本地模型：在模型中心一键下载、安装后即用
- DeepSeek、OpenAI Compatible 与自定义 API：凭据由 Windows 安全存储保护
- 文件、Git、Python、Shell、浏览器、Home Assistant 等受控工具
- 本地记忆、RAG 知识库与任务恢复
- VELA 原生生图、角色参考检索、身份评分与失败回退
- Windows 原生桌面 UI，支持明暗模式、玻璃质感与任务可视化

## 一键安装（Windows）

需要 Windows 11、Python 3.12、uv、Node.js 20+。首次从源码安装：

```powershell
git clone https://github.com/FlightCatcher/VELA.git
cd VELA
uv sync --dev
.\scripts\install_vela.ps1
```

安装完成后可从桌面或开始菜单打开 **VELA**。运行状态、会话和模型配置保存在
Windows 用户数据目录，不写入 Git 仓库。

## 模型中心

桌面端顶部打开“模型中心”：

- 一键安装 `qwen3:4b`、`qwen3:8b`、`qwen3-vl:4b`、`qwen3-embedding:0.6b`
- 选择已安装的 Ollama 模型并立即切换
- 添加 DeepSeek、OpenAI Compatible 或其他兼容 API
- API Key 不写入项目文件，使用系统安全存储加密

VELA 默认推荐 `qwen3:8b` 作为综合 Agent 模型；低内存环境可使用 `qwen3:4b`。

## 开发

```powershell
uv sync --dev
uv run ruff check .
uv run mypy src
uv run pytest

cd integrations\vela-desktop
npm ci
npm test
npm start
```

CLI：

```powershell
uv run vela doctor
uv run vela chat
uv run vela serve
```

## 安全原则

- 默认本地优先、最小权限、重要写操作需确认
- Shell 与高风险工具不默认开放
- 不自动上传本地文件或密钥
- 重试有次数上限；重新规划会保留原计划版本
- 每个关键执行步骤都有状态、错误上下文和审计记录

## 兼容说明

早期版本曾以 OpenClaw-Ultimate 为项目名。Python 导入包暂时保留
`openclaw_ultimate` 作为迁移兼容层，但 VELA 的桌面端、运行时、会话、模型中心、
安装目录和公开接口均可独立运行，不再依赖 OpenClaw。

## License

MIT
