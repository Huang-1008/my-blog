---
name: blog-generator
description: "生成功能丰富的个人博客主页。触发词：'生成博客'、'创建博客主页'、'搭建个人博客'、'博客生成器'、'blog generator'。生成 SPA 单页应用博客，支持 Markdown 博文、GitHub 仓库展示、深色/浅色主题、代码高亮、全文搜索等。可自动发布到 GitHub Pages。"
---

# 个人博客主页生成器

## 概述

此 Skill 用于一键生成功能丰富的个人博客主页。基于纯 vanilla JS 的 SPA 架构，配有 Node.js 实时预览服务器，支持 Markdown 博客文章、GitHub 项目集成、主题切换等完整功能。

## 调用方式

用户通过以下方式触发：
```
/博客生成器
生成一个个人博客主页
帮我搭建博客
create blog homepage
```

## 前置条件

### 必需信息（生成前询问用户）

使用 `AskUserQuestion` 收集以下信息：

1. **GitHub 用户名**（必填）：用于展示仓库列表和头像
2. **个人名称/昵称**（必填）
3. **个人简介**（选填，默认："热爱技术，热爱开源"）
4. **技能列表**（选填，默认：JavaScript, Python, Node.js, Git, Docker）
5. **邮箱**（选填）
6. **目标目录**（选填，默认当前工作目录）
7. **是否发布到 GitHub**（选填）：是否自动初始化 git 并推送到 GitHub Pages

### 依赖

| 依赖 | 用途 | 引入方式 |
|------|------|---------|
| `marked` ^11.2 | Markdown → HTML | CDN jsdelivr |
| `highlight.js` ^11.9 | 代码语法高亮 | CDN jsdelivr |
| GitHub REST API | 仓库/用户数据 | 通过 Node.js 代理 |
| Node.js (内置模块) | 服务器/文件监听 | `http`, `fs`, `path`, `crypto` |

---

## 生成流程

### 第 1 步：收集用户信息

```
使用 AskUserQuestion 收集：
- GitHub 用户名
- 个人名称
- 个人简介（可选）
- 目标目录（可选）
```

### 第 2 步：创建项目结构

创建以下文件（按顺序）：

```
{targetDir}/
├── index.html          # SPA 入口
├── style.css           # 设计系统
├── main.js             # 核心逻辑
├── live-server.js      # Node.js 服务器
├── favicon.svg         # 网站图标
├── package.json        # 项目配置
└── posts/              # 博客文章
    ├── hello-world.md
    ├── git-tips.md
    └── docker-intro.md
```

### 第 3 步：生成代码文件

#### 3.1 `package.json`

```json
{
  "name": "personal-blog",
  "version": "1.0.0",
  "description": "个人技术博客",
  "scripts": {
    "start": "node live-server.js",
    "preview": "node live-server.js"
  }
}
```

#### 3.2 `live-server.js` — 核心服务器

**关键点（避免重复踩坑）：**

- GitHub API 代理必须设置 `rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'`，避免企业代理 SSL 证书问题
- 博文 API `/api/posts` 和 `/api/posts/:slug` 需要路径穿越检查
- Frontmatter 解析器用纯正则实现，不依赖 YAML 库

```javascript
// 代理配置（关键！）
const options = {
  headers,
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
};
```

#### 3.3 `index.html` — SPA 外壳

- 使用 `<template>` 标签存放各页面模板
- 引入 CDN：marked + highlight.js
- 导航栏包含：Logo、首页/博客/项目/关于 链接、主题切换按钮、搜索按钮
- 全局元素：Toast 通知、返回顶部、阅读进度条、搜索弹窗

#### 3.4 `style.css` — 设计系统

- 使用 CSS 变量实现深色/浅色主题切换（`[data-theme="dark"]` / `[data-theme="light"]`）
- 包含：导航栏、卡片、按钮、表单、标签、骨架屏、Toast
- 响应式断点：768px（移动端）、1024px
- 页面过渡动画 `@keyframes fadeIn`

#### 3.5 `main.js` — 核心逻辑（重点）

**必须包含以下模块化设计：**

```javascript
// 用户配置（根据收集的信息填充）
const CONFIG = {
  githubUsername: '{用户提供的GitHub用户名}',
  personal: { name, bio, avatar, skills, email, social, typewriterTexts },
};

// 全局状态
const state = { posts: [], repos: [], userInfo: null, currentRoute: '' };
```

**关键修复点（必须严格遵守）：**

1. **打字机效果** — 使用以下模式，避免定时器叠加和页面切换后继续运行：

```javascript
let typewriterTimer = null;
function startTypewriter(texts) {
  // ✅ 必须先清除旧定时器
  if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
  const el = document.getElementById('typewriter');
  if (!el) return;
  let textIndex = 0, charIndex = 0, isDeleting = false;

  function tick() {
    // ✅ 元素被移除时自动停止
    if (!document.getElementById('typewriter')) { typewriterTimer = null; return; }
    const current = texts[textIndex];
    // ✅ 先取值再增减，不要用 charIndex++/-- 作为参数
    if (isDeleting) {
      el.textContent = current.substring(0, charIndex);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex);
      charIndex++;
    }
    let speed = isDeleting ? 40 : 80;
    if (!isDeleting && charIndex > current.length) {
      speed = 2000; isDeleting = true; charIndex = current.length;
    } else if (isDeleting && charIndex < 0) {
      isDeleting = false; textIndex = (textIndex + 1) % texts.length; charIndex = 0; speed = 400;
    }
    typewriterTimer = setTimeout(tick, speed);
  }
  tick();
}
```

2. **主题管理** — localStorage 持久化 + 代码高亮主题联动：

```javascript
function initTheme() {
  const saved = localStorage.getItem('blog-theme');
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const next = current === 'dark' ? 'light' : 'dark';
  // 同步切换 highlight.js 主题
  hljsTheme.href = next === 'dark' ? 'atom-one-dark.min.css' : 'atom-one-light.min.css';
}
```

3. **路由管理** — 基于 hash + 正则匹配：

```javascript
const Router = {
  routes: {},
  register(pattern, handler) { this.routes[pattern] = handler; },
  navigate(hash) { /* 解析 hash 并匹配路由 */ },
  resolve(path) { /* 正则匹配 :param */ },
};
```

4. **GitHub API** — 通过服务器代理，不暴露 token：

```javascript
const GitHubAPI = {
  async fetch(path) { return fetch(`/api/github${path}`).then(r => r.json()); },
};
```

5. **博客管理** — 从 `/api/posts` 加载索引，支持搜索和标签过滤

6. **代码高亮 + 复制** — 渲染 Markdown 后自动高亮，给每个 `<pre>` 添加复制按钮

### 第 4 步：创建示例博文

创建 3 篇 `.md` 博文，使用 YAML frontmatter：

```markdown
---
title: 文章标题
date: YYYY-MM-DD
tags: [标签1, 标签2]
excerpt: 文章摘要
---

正文内容...
```

### 第 5 步：验证

生成完成后，依次验证：

```bash
# 1. 启动服务器
node live-server.js

# 2. 验证 API
curl http://localhost:3000/api/posts          # 博文列表
curl http://localhost:3000/api/posts/hello-world  # 博文内容
curl http://localhost:3000/api/github/users/{username}  # GitHub 代理

# 3. 验证前端页面（使用 Playwright MCP）
# 依次访问 #/ #/blog #/blog/hello-world #/projects #/about
# 验证主题切换、搜索功能、响应式布局
```

### 第 6 步（可选）：发布到 GitHub

如果用户选择发布：

1. 使用 `mcp__github__create_repository` 创建仓库（如已存在则跳过）
2. 初始化 git 并推送：

```bash
cd {targetDir}
git init
git checkout -b main
git add .
git commit -m "feat: 初始化个人博客主页"
git remote add origin https://github.com/{username}/{repo}.git
git push -u origin main
```

3. 如需 GitHub Pages，使用 `mcp__github__create_or_update_file` 创建 `.github/workflows/pages.yml`

---

## 页面与功能清单

| 路由 | 页面 | 功能 |
|------|------|------|
| `#/` | 首页 | Hero（打字机效果）+ 统计面板（数字动画）+ 精选博文 + 精选项目 |
| `#/blog` | 博客列表 | 全文搜索 + 标签过滤 + 排序 |
| `#/blog/:slug` | 文章详情 | Markdown 渲染 + 代码高亮 + 一键复制 + 目录 + 进度条 |
| `#/projects` | 项目展示 | GitHub 仓库网格 + 语言过滤 + 排序 |
| `#/about` | 关于我 | 简介 + 技能标签云 + 联系方式 |

## 交互功能

- 深色/浅色主题切换（localStorage 持久化 + highlight.js 联动）
- 全局搜索弹窗（`Ctrl+K`）
- `Ctrl+K` 打开搜索、`Esc` 关闭
- 代码块一键复制
- 阅读进度条
- 返回顶部按钮
- Toast 通知
- 骨架屏加载态
- 响应式布局（移动端汉堡菜单）
- 实时预览（文件保存自动刷新）

---

## 常见问题与解决方案

### 1. GitHub API 代理 SSL 错误

**错误：** `unable to verify the first certificate`
**原因：** 企业网络环境下的 SSL 检查代理
**解决：** live-server.js 中已配置 `rejectUnauthorized` 选项，必要时设置 `NODE_TLS_REJECT_UNAUTHORIZED=0`

### 2. 打字机效果异常

**症状：** 文字闪烁、速度异常、切换页面后仍在运行
**原因：** 定时器未清除 + 元素被移除后继续引用
**解决：** 见上文 "关键修复点" 第 1 条

### 3. 代码高亮不生效

**原因：** CDN 加载顺序或 marked 版本不兼容
**解决：** 确保 `marked` 先于 `highlight.js` 加载，在 `enhanceCodeBlocks` 中调用 `hljs.highlightElement`

### 4. 博文加载失败

**原因：** Frontmatter 解析器对特殊字符处理不当
**解决：** 使用 `^---\s*\n([\s\S]*?)\n---\s*\n` 正则匹配

---

## 适配环境

| 环境 | 说明 |
|------|------|
| **操作系统** | Windows / macOS / Linux 均可 |
| **Node.js** | >= 16.x（使用内置 `http`, `fs`, `path`, `crypto`, `https` 模块） |
| **浏览器** | Chrome / Firefox / Safari / Edge 最新版 |
| **CDN** | jsdelivr.net（marked + highlight.js） |
| **MCP 工具** | `mcp__github__*` 系列（用于发布到 GitHub） |
| **Playwright MCP** | `mcp__playwright__browser_*` 系列（用于验证页面） |

## 用到的 Agent

| Agent | 用途 |
|-------|------|
| `general-purpose` | 执行文件生成、代码修改、git 操作 |
| `Explore` | 生成前探索目标目录结构 |

## 安全注意事项

- ⚠️ **绝不将 GitHub token 写入代码文件**
- Token 仅通过环境变量 `GITHUB_TOKEN` 注入到服务器端
- 前端代码中不包含任何认证凭据
- 生成的 `main.js` 中 `CONFIG.githubUsername` 仅存储用户名（公开信息）
