#!/usr/bin/env node
/**
 * Live Preview Server — 轻量级实时预览（零依赖，纯 Node.js）
 *
 * 功能：
 *   - 本地 HTTP 静态文件服务
 *   - 自动打开浏览器
 *   - 文件变更 → WebSocket → 浏览器自动刷新
 *   - 所有依赖均为 Node.js 内置模块，无需 npm install
 *
 * 使用：node live-server.js [目录]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { exec } = require('child_process');

// ========== 配置 ==========
const PORT = process.env.PORT || 3000;
const ROOT = process.argv[2] || '.';

// ========== MIME 类型映射 ==========
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// ========== 注入到 HTML 中的热重载脚本 ==========
function injectScript(httpPort) {
  return `
<!-- 🔥 Live Preview Auto-Reload -->
<script>
;(function() {
  var wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var wsUrl = wsProtocol + '//' + location.hostname + ':${httpPort}';
  var reconnectTimer = null;
  var ws = null;

  function connect() {
    if (ws) { try { ws.close(); } catch(e) {} }
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
      console.log('%c🟢 实时预览已连接 %c(文件改动时自动刷新)',
        'color:#4caf50;font-weight:bold', 'color:#888');
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    ws.onmessage = function(e) {
      if (e.data === 'reload') {
        console.log('%c🔄 检测到文件变更，正在刷新...', 'color:#ff9800;font-weight:bold');
        var scrollX = window.scrollX;
        var scrollY = window.scrollY;
        try { sessionStorage.setItem('__live_preview_scroll', JSON.stringify({x: scrollX, y: scrollY})); } catch(e) {}
        requestAnimationFrame(function() { location.reload(); });
      }
    };

    ws.onclose = function() {
      console.log('%c🔴 预览已断开，1秒后重连...', 'color:#f44336');
      reconnectTimer = setTimeout(connect, 1000);
    };

    ws.onerror = function() { ws.close(); };
  }

  window.addEventListener('load', function() {
    try {
      var saved = sessionStorage.getItem('__live_preview_scroll');
      if (saved) { var pos = JSON.parse(saved); window.scrollTo(pos.x, pos.y); sessionStorage.removeItem('__live_preview_scroll'); }
    } catch(e) {}
  });

  connect();
})();
</script>
`;
}

// ========== 极简 WebSocket 服务器（纯 Node.js，零外部依赖） ==========
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class MiniWebSocketServer {
  constructor() {
    this.clients = new Set();
  }

  /** 处理 HTTP Upgrade 请求 → 升级为 WebSocket 连接 */
  handleUpgrade(req, socket, head) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    // 计算 Accept Key: base64(sha1(key + GUID))
    const hash = crypto.createHash('sha1').update(key + WS_GUID).digest();
    const acceptKey = hash.toString('base64');

    // 发送 101 Switching Protocols 响应
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey + '\r\n\r\n'
    );

    const client = new MiniWebSocketClient(socket);
    this.clients.add(client);

    socket.on('data', (buffer) => {
      try {
        const message = decodeFrame(buffer);
        if (message !== null) {
          client.emit('message', message);
        }
      } catch (e) {
        // 帧解析失败，忽略
      }
    });

    socket.on('close', () => {
      this.clients.delete(client);
      client.emit('close');
    });

    socket.on('error', () => {
      this.clients.delete(client);
      client.emit('close');
    });

    // 触发 connection 回调
    if (this._onConnection) {
      this._onConnection(client);
    }
  }

  onConnection(callback) {
    this._onConnection = callback;
  }

  /** 向所有连接的客户端广播消息 */
  broadcast(data) {
    const frame = encodeFrame(data);
    for (const client of this.clients) {
      try { client.socket.write(frame); } catch (e) { /* 忽略写入失败 */ }
    }
  }
}

class MiniWebSocketClient {
  constructor(socket) {
    this.socket = socket;
    this._listeners = {};
  }

  on(event, callback) {
    this._listeners[event] = callback;
  }

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event](data);
    }
  }

  /** 向此客户端发送消息 */
  send(data) {
    try {
      this.socket.write(encodeFrame(data));
    } catch (e) {
      // 忽略发送失败
    }
  }
}

/** 编码 WebSocket 文本帧 */
function encodeFrame(data) {
  const payload = Buffer.from(data, 'utf-8');
  const length = payload.length;

  let frame;
  if (length < 126) {
    frame = Buffer.alloc(2 + length);
    frame[0] = 0x81; // FIN + Text opcode
    frame[1] = length;
    payload.copy(frame, 2);
  } else if (length < 65536) {
    frame = Buffer.alloc(4 + length);
    frame[0] = 0x81;
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
  } else {
    frame = Buffer.alloc(10 + length);
    frame[0] = 0x81;
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    payload.copy(frame, 10);
  }

  return frame;
}

/** 解码 WebSocket 帧（仅处理文本帧） */
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const opcode = firstByte & 0x0f;

  // 只处理文本帧 (opcode 1) 和关闭帧 (opcode 8)
  if (opcode === 8) return null; // 关闭帧

  const secondByte = buffer[1];
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey;
  if (masked) {
    maskKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.slice(offset, offset + payloadLength);

  if (masked) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return payload.toString('utf-8');
}

// ========== 简易 Frontmatter 解析（不依赖外部库） ==========
function parseFrontmatter(mdContent) {
  const result = { meta: {}, content: mdContent };
  const match = mdContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return result;

  const yamlText = match[1];
  result.content = mdContent.slice(match[0].length);
  const lines = yamlText.split('\n');

  for (const line of lines) {
    // tags: [a, b, c]
    const tagMatch = line.match(/^(\w+):\s*\[([^\]]*)\]/);
    if (tagMatch) {
      result.meta[tagMatch[1]] = tagMatch[2].split(',').map(s => s.trim().replace(/['"]/g, ''));
      continue;
    }
    // key: value
    const kvMatch = line.match(/^(\w+):\s*(.+)/);
    if (kvMatch) {
      result.meta[kvMatch[1]] = kvMatch[2].trim();
    }
  }

  return result;
}

// ========== 计算阅读时间 ==========
function estimateReadTime(content) {
  const textLen = content.replace(/[#*`\[\]()>_\-\s]/g, '').length;
  return Math.max(1, Math.ceil(textLen / 1500));
}

// ========== GitHub API 代理 ==========
function proxyGitHub(reqUrl, res) {
  const githubPath = reqUrl.pathname.replace('/api/github', '');
  const targetUrl = `https://api.github.com${githubPath}${reqUrl.search || ''}`;

  const headers = {
    'User-Agent': 'blog-live-server/1.0',
    'Accept': 'application/vnd.github.v3+json',
  };

  // 从环境变量读取 token（可选，提升 API 速率限制）
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    headers,
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
  };

  // 使用 Node.js 内置 https 模块
  const https = require('https');
  https.get(targetUrl, options, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
    });
  }).on('error', (err) => {
    console.error(`  ⚠️ GitHub API 代理失败: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'GitHub API 代理失败', message: err.message }));
  });
}

// ========== 博文列表 API ==========
function servePostsList(res, rootDir) {
  const postsDir = path.join(rootDir, 'posts');

  if (!fs.existsSync(postsDir)) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('[]');
    return;
  }

  fs.readdir(postsDir, (err, files) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '读取 posts 目录失败' }));
      return;
    }

    const posts = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const slug = file.replace(/\.md$/, '');
      const filePath = path.join(postsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseFrontmatter(content);
        posts.push({
          slug,
          title: parsed.meta.title || slug,
          date: parsed.meta.date || '',
          tags: parsed.meta.tags || [],
          excerpt: parsed.meta.excerpt || parsed.content.replace(/[#*>`\[\]()\-\s]/g, '').substring(0, 150),
          readTime: estimateReadTime(parsed.content),
        });
      } catch (e) {
        console.error(`  ⚠️ 读取 ${file} 失败: ${e.message}`);
      }
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify(posts));
  });
}

// ========== 博文内容 API ==========
function servePostContent(res, rootDir, slug) {
  // 安全检查：防止路径穿越
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '博文不存在' }));
    return;
  }

  const filePath = path.join(rootDir, 'posts', `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '博文不存在' }));
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(JSON.stringify({
      slug,
      title: parsed.meta.title || slug,
      date: parsed.meta.date || '',
      tags: parsed.meta.tags || [],
      excerpt: parsed.meta.excerpt || '',
      content: parsed.content,
      readTime: estimateReadTime(parsed.content),
    }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '读取博文失败' }));
  }
}

// ========== HTTP 服务器 ==========
function createServer(rootDir, httpPort) {
  const resolvedRoot = path.resolve(rootDir);
  const injectCode = injectScript(httpPort);

  return http.createServer((req, res) => {
    // 使用 WHATWG URL API 解析请求路径
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let filePath = path.join(resolvedRoot, decodeURIComponent(reqUrl.pathname));

    // ===== API 路由 =====

    // GitHub API 代理：/api/github/* → api.github.com/*
    if (reqUrl.pathname.startsWith('/api/github/')) {
      return proxyGitHub(reqUrl, res);
    }

    // 博文列表：/api/posts
    if (reqUrl.pathname === '/api/posts') {
      return servePostsList(res, resolvedRoot);
    }

    // 博文内容：/api/posts/:slug
    if (reqUrl.pathname.startsWith('/api/posts/')) {
      const slug = decodeURIComponent(reqUrl.pathname.replace('/api/posts/', ''));
      return servePostContent(res, resolvedRoot, slug);
    }

    // 默认首页
    if (reqUrl.pathname === '/') {
      const indexFile = path.join(resolvedRoot, 'index.html');
      if (fs.existsSync(indexFile)) {
        filePath = indexFile;
      } else {
        return serveDirectory(res, resolvedRoot, reqUrl.pathname);
      }
    }

    // 安全检查
    const realPath = path.resolve(filePath);
    if (!realPath.startsWith(resolvedRoot)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    // 读取文件
    fs.stat(realPath, (err, stats) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<h1>404 Not Found</h1><p>${reqUrl.pathname}</p>`);
      }

      if (stats.isDirectory()) {
        const dirIndex = path.join(realPath, 'index.html');
        if (fs.existsSync(dirIndex)) {
          return serveFile(res, dirIndex, injectCode);
        }
        return serveDirectory(res, realPath, reqUrl.pathname);
      }

      serveFile(res, realPath, injectCode);
    });
  });
}

function serveFile(res, filePath, injectCode) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('500 Internal Server Error');
    }

    if (ext === '.html' || ext === '.htm') {
      data = data.toString('utf-8').replace('</body>', injectCode + '\n</body>');
    }

    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
}

function serveDirectory(res, dirPath, urlPath) {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('500 Internal Server Error');
    }

    const list = files
      .filter(f => !f.startsWith('.') && f !== 'node_modules')
      .sort((a, b) => {
        const aDir = fs.statSync(path.join(dirPath, a)).isDirectory();
        const bDir = fs.statSync(path.join(dirPath, b)).isDirectory();
        if (aDir && !bDir) return -1;
        if (!aDir && bDir) return 1;
        return a.localeCompare(b);
      })
      .map(f => {
        const isDir = fs.statSync(path.join(dirPath, f)).isDirectory();
        const icon = isDir ? '📁' : '📄';
        const href = path.posix.join(urlPath, f);
        return `<li>${icon} <a href="${href}">${f}${isDir ? '/' : ''}</a></li>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>📂 ${urlPath}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; padding: 40px; background: #1a1a2e; color: #eee; min-height: 100vh; }
    h1 { font-size: 20px; margin-bottom: 20px; color: #e94560; }
    ul { list-style: none; }
    li { padding: 8px 12px; margin: 2px 0; border-radius: 6px; transition: background 0.15s; }
    li:hover { background: #16213e; }
    a { color: #0f9dce; text-decoration: none; font-size: 15px; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📂 ${urlPath}</h1>
  <ul>${list}</ul>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
}

// ========== 文件监听 ==========
function startWatcher(rootDir, wss) {
  const resolvedRoot = path.resolve(rootDir);
  let reloadTimeout = null;
  const DEBOUNCE_MS = 150;

  const ignored = /\b(\.git|\.claude|node_modules|\.vscode|__pycache__|dist|build|\.next)\b/;

  fs.watch(resolvedRoot, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (ignored.test(filename)) return;
    if (filename.endsWith('~') || filename.startsWith('.') || filename.includes('___')) return;

    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      console.log(`  \x1b[33m📝\x1b[0m [${now}] 文件变更，刷新浏览器...`);
      wss.broadcast('reload');
      reloadTimeout = null;
    }, DEBOUNCE_MS);
  });

  console.log(`  \x1b[32m👀\x1b[0m 正在监听文件变更...\n`);
}

// ========== 浏览器自动打开 ==========
function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.log(`  ⚠️  无法自动打开浏览器，请手动访问：${url}\n`);
    }
  });
}

// ========== 端口自动选择 ==========
function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// ========== 主函数 ==========
async function main() {
  const resolvedRoot = path.resolve(ROOT);

  if (!fs.existsSync(resolvedRoot)) {
    console.error(`\n  ❌ 目录不存在：${resolvedRoot}\n`);
    process.exit(1);
  }

  // 自动找可用端口
  const httpPort = await findAvailablePort(PORT);

  // HTTP 服务器（WebSocket 共用同一端口）
  const httpServer = createServer(ROOT, httpPort);

  // WebSocket 服务器（挂在 HTTP Upgrade 上）
  const wss = new MiniWebSocketServer();

  // 统计连接数
  let connectionCount = 0;
  wss.onConnection((client) => {
    connectionCount++;
    console.log(`  \x1b[32m🔗\x1b[0m 浏览器已连接 (${connectionCount} 个连接)`);

    client.on('close', () => {
      connectionCount = Math.max(0, connectionCount - 1);
      if (connectionCount === 0) {
        console.log(`  \x1b[31m🔌\x1b[0m 浏览器断开，等待重连...`);
      }
    });
  });

  // 监听 HTTP Upgrade → 升级为 WebSocket
  httpServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head);
  });

  // 启动 HTTP 服务器
  httpServer.listen(httpPort, '127.0.0.1', () => {
    const url = `http://localhost:${httpPort}`;
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║  \x1b[36m🚀 Live Preview Server\x1b[0m             ║`);
    console.log(`  ╠══════════════════════════════════════╣`);
    console.log(`  ║  地址：\x1b[33m ${url}\x1b[0m     ║`);
    console.log(`  ║  目录：\x1b[33m ${resolvedRoot}\x1b[0m`);
    console.log(`  ║  刷新：\x1b[31m 文件保存后自动刷新\x1b[0m             ║`);
    console.log(`  ║  退出：\x1b[31m Ctrl+C\x1b[0m                       ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });

  // 文件监听
  startWatcher(ROOT, wss);

  // 自动打开浏览器
  setTimeout(() => openBrowser(`http://localhost:${httpPort}`), 800);

  // 优雅退出
  const shutdown = () => {
    console.log('\n  👋 正在关闭服务器...');
    wss.broadcast = () => {}; // 停止广播
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('启动失败：', err);
  process.exit(1);
});
