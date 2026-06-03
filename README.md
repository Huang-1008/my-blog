# 🏠 个人博客主页

纯 vanilla JS 构建的 SPA 单页应用个人博客，配有 Node.js 实时预览服务器。支持 Markdown 撰写博文、GitHub 仓库展示、深色/浅色主题、代码语法高亮、全文搜索等功能。

## ✨ 功能特性

- **📝 Markdown 博客** — 使用 `.md` 文件撰写文章，支持 YAML frontmatter 元数据
- **🚀 GitHub 集成** — 自动拉取 GitHub 仓库列表、Stars 数、关注者统计
- **🌙 深色/浅色主题** — 一键切换，localStorage 持久化，highlight.js 主题联动
- **🔍 全文搜索** — `Ctrl+K` 全局搜索弹窗，支持标题/摘要/标签匹配
- **💻 代码高亮** — highlight.js 语法高亮 + 代码块一键复制
- **📑 文章目录** — 自动生成 TOC 导航目录
- **📊 统计面板** — 首页展示仓库/Stars/关注者/文章数量，数字滚动动画
- **⌨️ 打字机效果** — Hero 区域打字机动画
- **📱 响应式布局** — 适配桌面端和移动端
- **🔥 实时预览** — 文件保存后通过 WebSocket 自动刷新浏览器
- **⚡ 零前端依赖** — marked 和 highlight.js 通过 CDN 引入，构建产物体积极小

## 🚀 快速开始

### 前置要求

- **Node.js** >= 16.x（仅用于本地开发服务器）

### 启动开发服务器

```bash
# 安装依赖（仅 ws 用于 WebSocket，可选）
npm install

# 启动预览服务器
npm start
```

服务器会自动：
1. 扫描可用端口（默认 3000）
2. 打开浏览器访问 `http://localhost:3000`
3. 监听文件变更，保存后自动刷新

### 仅静态托管

如果你不需要实时预览，可以直接用任意 HTTP 服务器托管静态文件。注意 GitHub API 代理需要服务器端支持（见下方说明）。

## ⚙️ 配置

编辑 [main.js](main.js) 顶部的 `CONFIG` 对象：

```javascript
const CONFIG = {
  githubUsername: 'Huang-1008',  // 你的 GitHub 用户名
  personal: {
    name: 'Huang-1008',          // 你的昵称
    bio: '热爱技术，热爱开源...',   // 个人简介
    avatar: 'https://...',       // 头像 URL
    skills: ['JavaScript', 'Python', 'Node.js', ...],  // 技能列表
    email: 'example@email.com',  // 邮箱（可选）
    social: {
      github: 'https://github.com/...',  // GitHub 主页
    },
    typewriterTexts: ['你好...', '欢迎...'],  // 打字机效果文本
  },
};
```

### GitHub API 速率限制

默认匿名 API 访问每小时 60 次请求。如需提升限制，设置环境变量：

```bash
# Windows (PowerShell)
$env:GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Linux / macOS
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

## 📁 项目结构

```
my-blog/
├── index.html          # SPA 入口，包含所有页面模板
├── style.css           # 完整设计系统（CSS 变量 + 深色/浅色主题）
├── main.js             # 核心逻辑（路由/API/渲染/交互）
├── live-server.js      # Node.js 开发服务器（HTTP + WebSocket + API 代理）
├── favicon.svg         # 网站图标
├── package.json        # 项目配置
└── posts/              # Markdown 博文目录
    ├── hello-world.md  # 示例博文
    ├── second-post.md
    └── docker-intro.md
```

## 🛠 API 代理

开发服务器内置了以下 API 路由：

| 端点 | 说明 |
|------|------|
| `GET /api/posts` | 获取所有博文列表（含 frontmatter 元数据） |
| `GET /api/posts/:slug` | 获取单篇博文内容 |
| `GET /api/github/*` | 代理 GitHub REST API 请求 |

> ⚠️ 如果你使用静态托管（如 GitHub Pages），GitHub API 代理不可用。需要配置 GitHub Actions 或使用其他后端方案。

## 📄 博文格式

博文使用 `.md` 格式，支持 YAML frontmatter：

```markdown
---
title: 文章标题
date: 2026-06-01
tags: [技术, 博客]
excerpt: 文章摘要，显示在卡片中
---

## 正文标题

正文内容使用标准 Markdown 语法...

​```javascript
// 代码块自动高亮
console.log('Hello World');
​```
```

## 🚢 部署到 GitHub Pages

1. 在 GitHub 上创建仓库 `your-username/your-username.github.io`（或任意仓库名）

2. 推送代码：

```bash
git init
git checkout -b main
git add .
git commit -m "feat: 初始化个人博客主页"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

3. 在仓库 Settings → Pages 中启用 GitHub Pages，选择部署分支。

4. 如需 GitHub API 数据，创建 `.github/workflows/deploy.yml` 配置 Actions 构建。

## 🎨 技术栈

| 技术 | 用途 |
|------|------|
| Vanilla JS (ES6+) | SPA 路由、状态管理、DOM 渲染 |
| CSS Variables | 主题系统 |
| marked ^11.2 | Markdown to HTML（CDN） |
| highlight.js ^11.9 | 代码语法高亮（CDN） |
| Node.js http/https | 开发服务器 + API 代理 |
| WebSocket | 实时预览热重载 |
| GitHub REST API | 用户/仓库数据 |

## 📄 许可证

MIT
