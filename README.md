# VELA

**A local-first, independent AI agent that plans, acts, verifies and learns with you.**

VELA 是一个可独立运行的桌面 AI Agent。它拥有对话、任务规划、DAG 执行、
受控工具调用、失败诊断、有限重试、版本化重新规划、记忆、知识库和本地生图能力。
它不依赖 OpenClaw Gateway，也不要求绑定某一家模型服务。

## 核心能力

- 独立 Agent Runtime 与本地持久化会话
- Planner、Executor、Reflection、有限重试与版本化 Replanning
- Ollama 本地模型：在模型中心一键下载、安装后即用
- DeepSeek、OpenAI Compatible 与自定义 API：凭据由操作系统安全存储保护
- 文件、Git、Python、Shell、浏览器、Home Assistant 等受控工具
- 本地记忆、RAG 知识库与任务恢复
- VELA 原生生图、角色参考检索、身份评分与失败回退
- Windows 与 macOS 桌面 UI，支持明暗模式、玻璃质感与任务可视化

## 一键安装

普通用户从 GitHub Releases 下载 `VELA-Setup-<版本>.exe`，按向导安装即可。
无需预先安装 Python、Node.js、uv 或 Ollama。首次启动时 VELA 会打开恢复界面、
检测硬件与模型盘，引导安装匹配的直连模型或配置 API。卸载应用默认不会删除大型模型。

macOS 用户从 Releases 下载与处理器匹配的 `arm64`（Apple Silicon）或 `x64`（Intel）DMG/ZIP。
首个公测包可能尚未签名和公证，具体限制见 [安装与快速入门](docs/PUBLIC_BETA_INSTALL.md)。

公测文档：[隐私说明](docs/PRIVACY.md) · [已知问题](docs/KNOWN_ISSUES_PUBLIC_BETA.md) · [外部测试计划](docs/PUBLIC_BETA_TEST_PLAN.md)

包管理器安装：

```powershell
# Windows (Scoop)
scoop bucket add vela https://github.com/FlightCatcher/scoop-vela
scoop install vela
```

```bash
# macOS (Homebrew)
brew tap FlightCatcher/vela
brew trust FlightCatcher/vela
brew install --cask vela
```

详见 [包管理器安装说明](docs/PACKAGE_INSTALL.md)。WinGet 首次提交已进入
[微软社区仓库审核](https://github.com/microsoft/winget-pkgs/pull/423803)。

开发者从源码安装：

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
- 按通用、Agent、推理、编程、视觉和知识库分类选择本地模型
- 一键下载 Qwen、DeepSeek R1、Gemma、Phi、Llama 和 Embedding 模型，完成后自动接入
- 选择已安装的 Ollama 模型并立即切换
- 使用直连 GGUF 引擎绕过 Ollama，并保持一次只加载一个模型
- 接入并验证 DeepSeek、MiniMax M2.7、Gemini、Mistral、OpenRouter、OpenAI 或其他 OpenAI-compatible API
- 添加 DeepSeek、OpenAI Compatible 或其他兼容 API
- API Key 不写入项目文件，使用系统安全存储加密
- 自动识别生图模型，并把缺失资源安装到用户选择的数据盘
- 下载支持进度、断点续传、取消、磁盘空间检查和已发布哈希校验
- 模型、缓存、输出和运行时目录可在界面中更改

VELA 默认推荐 `qwen3:8b` 作为综合 Agent 模型；低内存环境可使用 `qwen3.5:4b`。MiniMax 当前按官方 M2.7 API 接入，避免在普通个人电脑上下载无法实际运行的超大权重。

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
- 桌面端提供安全、标准、完全访问三级权限；完全访问必须明确确认风险，并可一键撤销
- 插件中心预留网页、浏览器、电脑控制、Home Assistant、Google、Microsoft、Slack、Notion、Box、Atlassian、Figma 与自定义 MCP 接入口
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
