# CLAUDE.md — 个人博客主页

## 项目概述

纯 vanilla JS 构建的 SPA 单页应用个人博客，配有 Node.js 实时预览服务器。支持 Markdown 博文、GitHub 仓库展示、深色/浅色主题、代码高亮、全文搜索。

## 常用命令

```bash
npm start              # 启动开发服务器（自动打开浏览器 + 文件监听热重载）
node live-server.js    # 同上（直接调用）
```

无需构建步骤 — 项目是纯静态文件 + Node.js 服务端代理。

## 架构

### 前端（SPA）

| 文件 | 职责 |
|------|------|
| `index.html` | SPA 外壳 + 所有 `<template>` 页面模板（home/blog/post/projects/about/404） |
| `style.css` | 设计系统：CSS 变量、深色/浅色主题、所有组件样式、响应式 768px 断点 |
| `main.js` | 核心逻辑：用户配置 `CONFIG`、路由管理、GitHub API 代理、博文加载、Markdown 渲染、交互功能 |

**路由** — 基于 `window.location.hash` + 正则匹配参数（如 `#/blog/:slug`）。无前端框架依赖。

**主题** — `[data-theme="dark"]` / `[data-theme="light"]` 通过 CSS 变量切换，localStorage 持久化。highlight.js 主题联动切换。

### 后端（Node.js 开发服务器）

`live-server.js` — 单文件零外部依赖服务器（WebSocket 实现也是手写的，不依赖 `ws` 包）。

核心功能：
- 静态文件服务（MIME 映射、目录浏览、防路径穿越）
- API 代理：`/api/posts` / `/api/posts/:slug` / `/api/github/*`
- Frontmatter 解析（纯正则，不依赖 YAML 库）
- WebSocket 热重载（纯 Node.js 实现，无 `ws` 依赖）
- 文件变更监听（`fs.watch` + 防抖 150ms）
- 端口自动选择（从 3000 开始扫描）

### 数据流

```
posts/*.md → live-server 解析 frontmatter → /api/posts → main.js → DOM 渲染
GitHub API → live-server 代理 → /api/github/* → main.js → DOM 渲染
Markdown → marked.parse() → highlight.js → 代码复制按钮 → DOM
```

## 关键约定

### CONFIG 配置

所有用户个性化信息集中在 `main.js` 顶部的 `CONFIG` 对象中修改。**不要将 GitHub token 写入前端代码。**

### 博文格式

`.md` 文件 + YAML frontmatter：

```markdown
---
title: 标题
date: YYYY-MM-DD
tags: [标签1, 标签2]
excerpt: 摘要
---
正文...
```

### 打字机效果

`startTypewriter()` 函数需要注意：
- 每次调用前先 `clearTimeout` 旧定时器
- 在 `tick()` 内部检查 `document.getElementById('typewriter')` 是否存在，页面切换后自动停止
- `charIndex` 先取值再增减，不要将 `charIndex++/--` 直接作为 `substring` 参数

### GitHub API 代理

`live-server.js` 中 `rejectUnauthorized` 必须设置，避免企业代理 SSL 证书问题：
```javascript
rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
```

### 路径安全

博文 API 中 slug 参数必须校验：`if (slug.includes('..') || slug.includes('/') || slug.includes('\\'))`

## Skill

本项目包含一个 `blog-generator` Skill（位于 `.claude/skills/blog-generator/SKILL.md`），用于一键生成新的个人博客主页实例。触发词包括：

- `/博客生成器`
- `生成一个个人博客主页`
- `帮我搭建博客`

Skill 生成流程：收集用户信息 → 创建项目结构 → 生成代码文件 → 创建示例博文 → 验证 → 可选发布到 GitHub Pages。
