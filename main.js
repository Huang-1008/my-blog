// ===== 用户配置（请修改为你自己的信息） =====
const CONFIG = {
  githubUsername: 'Huang-1008',  // 替换为你的 GitHub 用户名
  personal: {
    name: 'Huang-1008',
    bio: '热爱技术，热爱开源，专注全栈开发与系统设计',
    avatar: 'https://github.com/torvalds.png',  // 替换为你的头像 URL
    skills: ['JavaScript', 'Python', 'Node.js', 'React', 'Vue', 'Git', 'Docker', 'MySQL', 'TypeScript', 'Linux'],
    email: 'example@email.com',
    social: {
      github: 'https://github.com/dashboard',  // 替换为你的链接
    },
    typewriterTexts: ['你好，我是 Huang-1008 ', '热爱技术，热爱开源', '欢迎来到我的博客 '],
  },
};

// ===== 全局状态 =====
const state = {
  posts: [],
  repos: [],
  userInfo: null,
  currentRoute: '',
};

// ===== Toast 通知 =====
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== 主题管理 =====
function initTheme() {
  const saved = localStorage.getItem('blog-theme');
  const theme = saved || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('blog-theme', next);
  updateThemeIcon(next);
  // 切换代码高亮主题
  const hljsTheme = document.getElementById('hljs-theme');
  hljsTheme.href = next === 'dark'
    ? 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css'
    : 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-light.min.css';
  showToast(next === 'dark' ? '🌙 已切换深色模式' : '☀️ 已切换浅色模式');
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ===== GitHub API（通过服务器代理） =====
const GitHubAPI = {
  async fetch(path) {
    const base = '/api/github';
    const res = await fetch(`${base}${path}`);
    if (!res.ok) {
      console.warn(`GitHub API ${path} 返回 ${res.status}`);
      return null;
    }
    return res.json();
  },

  async getUser() {
    return this.fetch(`/users/${CONFIG.githubUsername}`);
  },

  async getRepos() {
    return this.fetch(`/users/${CONFIG.githubUsername}/repos?sort=stars&per_page=100&type=owner`);
  },

  async getRepoStats() {
    const user = await this.getUser();
    const repos = await this.getRepos();
    if (!repos) return { repos: 0, stars: 0, followers: 0 };
    const stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
    return {
      repos: repos.length,
      stars,
      followers: user ? user.followers : 0,
    };
  },
};

// ===== 博文管理 =====
const BlogStore = {
  async loadPosts() {
    try {
      const res = await fetch('/api/posts');
      if (!res.ok) throw new Error('Failed to load posts');
      const files = await res.json();
      state.posts = files.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.warn('加载博文失败，使用空列表', e);
      state.posts = [];
    }
    return state.posts;
  },

  async loadPostContent(slug) {
    try {
      const res = await fetch(`/api/posts/${slug}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn(`加载博文 ${slug} 失败`, e);
      return null;
    }
  },

  getFilteredPosts(query, tag) {
    let posts = [...state.posts];
    if (query) {
      const q = query.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    if (tag) {
      posts = posts.filter(p => p.tags && p.tags.includes(tag));
    }
    return posts;
  },

  getAllTags() {
    const tagSet = new Set();
    state.posts.forEach(p => {
      if (p.tags) p.tags.forEach(t => tagSet.add(t));
    });
    return [...tagSet].sort();
  },
};

// ===== 路由管理 =====
const Router = {
  routes: {},

  register(pattern, handler) {
    this.routes[pattern] = handler;
  },

  navigate(hash) {
    const path = hash.replace(/^#/, '') || '/';
    state.currentRoute = path;
    this.resolve(path);
  },

  resolve(path) {
    // 更新导航 active 状态
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === `#${path}` || (path === '/' && href === '#/'));
    });

    // 匹配路由
    for (const [pattern, handler] of Object.entries(this.routes)) {
      const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
      const match = path.match(regex);
      if (match) {
        handler(...match.slice(1));
        return;
      }
    }

    // 404
    this.render404();
  },

  render404() {
    const tpl = document.getElementById('tpl-404');
    document.getElementById('app').innerHTML = tpl.innerHTML;
  },
};

// ===== 链接事件代理 =====
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-link]');
  if (!link) return;

  // 忽略外部链接
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http')) return;

  e.preventDefault();
  window.location.hash = href.replace(/^#/, '');
  // 关闭移动端菜单
  document.getElementById('navbar')?.querySelector('.nav-links')?.classList.remove('open');
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'instant' });
});

// 监听 hash 变化
window.addEventListener('hashchange', () => {
  Router.navigate(window.location.hash);
});

// ===== UI 工具 =====
function renderCard(post, clickable = true) {
  const tags = post.tags || [];
  const date = post.date ? new Date(post.date).toLocaleDateString('zh-CN') : '';
  const readTime = post.readTime || estimateReadTime(post.content || '');

  return `
    <div class="card" data-slug="${post.slug || ''}" style="cursor:${clickable ? 'pointer' : 'default'}">
      ${tags[0] ? `<span class="card-tag">${escapeHtml(tags[0])}</span>` : ''}
      <div class="card-title">${escapeHtml(post.title)}</div>
      <div class="card-desc">${escapeHtml(post.excerpt || '')}</div>
      <div class="card-meta">
        <span>${date} · ${readTime} 分钟阅读</span>
        <span>${tags.slice(1, 3).map(t => `#${escapeHtml(t)}`).join(' ')}</span>
      </div>
    </div>
  `;
}

function renderRepoCard(repo) {
  const lang = repo.language || 'Unknown';
  return `
    <div class="card">
      <div class="card-title">
        📁 ${escapeHtml(repo.name)}
      </div>
      <div class="card-desc">${escapeHtml(repo.description || '暂无描述')}</div>
      <div class="card-meta">
        <span>
          <span class="repo-language-dot" style="background:${getLanguageColor(lang)}"></span>
          ${escapeHtml(lang)}
        </span>
        <div class="card-stats">
          <span class="card-stat">⭐ ${repo.stargazers_count || 0}</span>
          <span class="card-stat">🔀 ${repo.forks_count || 0}</span>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text).replace(/[&<>"']/g, c => map[c]);
}

function estimateReadTime(content) {
  const words = content.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.ceil(words / 400));
}

// 语言颜色映射
function getLanguageColor(lang) {
  const colors = {
    JavaScript: '#f1e05a', Python: '#3572A5', TypeScript: '#3178c6',
    Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
    C: '#555555', Ruby: '#701516', PHP: '#4F5D95', HTML: '#e34c26',
    CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883', Kotlin: '#A97BFF',
    Swift: '#F05138', Dart: '#00B4AB', Dockerfile: '#384d54',
  };
  return colors[lang] || '#8b8b8b';
}

// ===== 数字滚动动画 =====
function animateNumber(el, target) {
  const start = 0;
  const duration = 1200;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }

  requestAnimationFrame(step);
}

// ===== 打字机效果 =====
let typewriterTimer = null;
function startTypewriter(texts) {
  // 清除上一个打字机实例，防止多个定时器叠加
  if (typewriterTimer) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }

  const el = document.getElementById('typewriter');
  if (!el) return;
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function tick() {
    // 元素已被移除（页面切换），停止打字
    if (!document.getElementById('typewriter')) {
      typewriterTimer = null;
      return;
    }

    const current = texts[textIndex];
    if (isDeleting) {
      el.textContent = current.substring(0, charIndex);
      charIndex--;
    } else {
      el.textContent = current.substring(0, charIndex);
      charIndex++;
    }

    let speed = isDeleting ? 40 : 80;
    if (!isDeleting && charIndex > current.length) {
      // 打完当前文本，停顿后开始删除
      speed = 2000;
      isDeleting = true;
      charIndex = current.length;
    } else if (isDeleting && charIndex < 0) {
      // 删除完毕，切换到下一条文本
      isDeleting = false;
      textIndex = (textIndex + 1) % texts.length;
      charIndex = 0;
      speed = 400;
    }

    typewriterTimer = setTimeout(tick, speed);
  }

  tick();
}

// ===== 搜索弹窗 =====
function initSearch() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  function openSearch() {
    overlay.classList.add('open');
    input.focus();
    input.value = '';
    renderSearchResults('');
  }

  function closeSearch() {
    overlay.classList.remove('open');
  }

  document.getElementById('searchBtn').addEventListener('click', openSearch);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSearch();
  });

  input.addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSearch();
    }
  });

  function renderSearchResults(query) {
    if (!query) { results.innerHTML = ''; return; }
    const filtered = BlogStore.getFilteredPosts(query);
    if (filtered.length === 0) {
      results.innerHTML = '<div class="empty-state" style="padding:30px"><p>😕 没有找到结果</p></div>';
      return;
    }
    results.innerHTML = filtered.slice(0, 8).map(p => `
      <a href="#/blog/${p.slug}" class="search-result-item" data-link>
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml((p.excerpt || '').substring(0, 80))}...</p>
      </a>
    `).join('');
  }
}

// ===== 返回顶部按钮 =====
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  let scrollTimer;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      btn.classList.toggle('visible', window.scrollY > 400);
      scrollTimer = null;
    }, 100);
  }, { passive: true });
}

// ===== 阅读进度条 =====
function initReadingProgress() {
  const bar = document.getElementById('readingProgress');
  window.addEventListener('scroll', () => {
    if (!document.querySelector('.post-detail')) {
      bar.classList.remove('visible');
      return;
    }
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${progress}%`;
    bar.classList.toggle('visible', progress > 0 && progress < 100);
  }, { passive: true });
}

// ===== 移动端菜单 =====
function initMobileMenu() {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('open');
  });
}

// ===== 代码高亮 & 复制按钮 =====
function enhanceCodeBlocks(container) {
  // 高亮代码块
  if (typeof hljs !== 'undefined') {
    container.querySelectorAll('pre code').forEach(block => {
      hljs.highlightElement(block);
    });
  }

  // 添加复制按钮
  container.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.code-copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '已复制!';
        setTimeout(() => btn.textContent = '复制', 1500);
      }).catch(() => showToast('复制失败'));
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });
}

// ===== 生成 TOC 目录 =====
function generateTOC(container) {
  const headings = container.querySelectorAll('h2, h3');
  const tocNav = document.getElementById('tocNav');
  if (!tocNav || headings.length === 0) {
    document.getElementById('postToc').style.display = 'none';
    return;
  }
  document.getElementById('postToc').style.display = 'block';

  let html = '';
  headings.forEach((h, i) => {
    const id = `heading-${i}`;
    h.id = id;
    const cls = h.tagName === 'H2' ? 'toc-h2' : 'toc-h3';
    html += `<a href="#${id}" class="${cls}">${escapeHtml(h.textContent)}</a>`;
  });
  tocNav.innerHTML = html;
}

// ===== Markdown 渲染 =====
function renderMarkdown(md) {
  if (typeof marked === 'undefined') return `<p>${escapeHtml(md)}</p>`;

  // 配置 marked
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  let html = marked.parse(md);
  return html;
}

// ================================================================
// == 页面渲染函数
// ================================================================

// 首页
async function renderHome() {
  const tpl = document.getElementById('tpl-home');
  document.getElementById('app').innerHTML = tpl.innerHTML;

  // 设置个人信息
  document.getElementById('heroAvatar').querySelector('img').src = CONFIG.personal.avatar;
  document.getElementById('heroDesc').textContent = CONFIG.personal.bio;

  // 打字机效果
  startTypewriter(CONFIG.personal.typewriterTexts);

  // 加载统计数据
  document.getElementById('statPosts').textContent = state.posts.length;

  try {
    const stats = await GitHubAPI.getRepoStats();
    if (stats) {
      animateNumber(document.getElementById('statRepos'), stats.repos);
      animateNumber(document.getElementById('statStars'), stats.stars);
      animateNumber(document.getElementById('statFollowers'), stats.followers);
    }
  } catch (e) {
    console.warn('加载 GitHub 统计失败', e);
  }

  // 加载精选博文
  renderFeaturedPosts();

  // 加载精选项目
  renderFeaturedRepos();
}

function renderFeaturedPosts() {
  const container = document.getElementById('featuredPosts');
  if (!container) return;
  const recent = state.posts.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>📝 还没有文章</p></div>';
    return;
  }
  container.innerHTML = recent.map(p => renderCard(p)).join('');
  // 绑定点击事件
  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = `/blog/${card.dataset.slug}`;
    });
  });
}

function renderFeaturedRepos() {
  const container = document.getElementById('featuredRepos');
  if (!container) return;
  GitHubAPI.getRepos().then(repos => {
    if (!repos || repos.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>🚀 暂无项目</p></div>';
      return;
    }
    state.repos = repos;
    const top = repos.slice(0, 3);
    container.innerHTML = top.map(r => renderRepoCard(r)).join('');
    // 绑定点击
    container.querySelectorAll('.card').forEach((card, i) => {
      card.addEventListener('click', () => {
        window.open(top[i].html_url, '_blank');
      });
      card.style.cursor = 'pointer';
    });
  }).catch(() => {
    container.innerHTML = '<div class="empty-state"><p>⚠️ 无法加载 GitHub 仓库</p></div>';
  });
}

// 博客列表
function renderBlog() {
  const tpl = document.getElementById('tpl-blog');
  document.getElementById('app').innerHTML = tpl.innerHTML;

  const listContainer = document.getElementById('postList');
  const emptyEl = document.getElementById('blogEmpty');
  const searchInput = document.getElementById('blogSearch');
  const sortBtns = document.getElementById('blogSort').querySelectorAll('.sort-tab');
  const tagFilterEl = document.getElementById('tagFilter');

  let currentQuery = '';
  let currentTag = '';
  let currentSort = 'newest';

  // 渲染标签过滤
  const allTags = BlogStore.getAllTags();
  tagFilterEl.innerHTML = `<button class="tag-filter-btn active" data-tag="">全部</button>` +
    allTags.map(t => `<button class="tag-filter-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');

  // 渲染列表
  function refreshList() {
    let posts = BlogStore.getFilteredPosts(currentQuery, currentTag);
    if (currentSort === 'oldest') posts = [...posts].reverse();
    if (currentSort === 'newest') posts = [...posts]; // already sorted

    if (posts.length === 0) {
      listContainer.innerHTML = '';
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      listContainer.innerHTML = posts.map(p => renderCard(p)).join('');
      listContainer.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
          window.location.hash = `/blog/${card.dataset.slug}`;
        });
      });
    }
  }

  searchInput.addEventListener('input', (e) => {
    currentQuery = e.target.value;
    refreshList();
  });

  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      refreshList();
    });
  });

  tagFilterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-filter-btn');
    if (!btn) return;
    tagFilterEl.querySelectorAll('.tag-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTag = btn.dataset.tag;
    refreshList();
  });

  refreshList();
}

// 文章详情
async function renderPost(slug) {
  const tpl = document.getElementById('tpl-post');
  document.getElementById('app').innerHTML = tpl.innerHTML;

  const post = await BlogStore.loadPostContent(slug);

  if (!post) {
    document.getElementById('app').innerHTML = document.getElementById('tpl-404').innerHTML;
    return;
  }

  document.getElementById('postTitle').textContent = post.title;
  document.getElementById('postDate').textContent = post.date
    ? new Date(post.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  document.getElementById('postReadtime').textContent = `⏱ ${post.readTime || estimateReadTime(post.content || '')} 分钟阅读`;
  document.getElementById('postTags').innerHTML = (post.tags || [])
    .map(t => `<span class="post-tag">${escapeHtml(t)}</span>`).join('');

  const contentHtml = renderMarkdown(post.content || '');
  const contentEl = document.getElementById('postContent');
  contentEl.innerHTML = contentHtml;

  // 代码高亮与复制
  enhanceCodeBlocks(contentEl);

  // 生成 TOC
  setTimeout(() => generateTOC(contentEl), 100);
}

// 项目展示
async function renderProjects() {
  const tpl = document.getElementById('tpl-projects');
  document.getElementById('app').innerHTML = tpl.innerHTML;

  const grid = document.getElementById('allRepos');
  const empty = document.getElementById('projectEmpty');
  const langFilter = document.getElementById('langFilter');
  const sortBtns = document.getElementById('projectSort').querySelectorAll('.sort-tab');

  let currentSort = 'stars';
  let currentLang = '';

  const repos = await GitHubAPI.getRepos();

  if (!repos || repos.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  state.repos = repos;

  // 语言选项
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))].sort();
  langFilter.innerHTML = '<option value="">全部语言</option>' +
    langs.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');

  function refreshGrid() {
    let filtered = [...repos];
    if (currentLang) filtered = filtered.filter(r => r.language === currentLang);

    if (currentSort === 'stars') filtered.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
    else if (currentSort === 'updated') filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    else if (currentSort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
      grid.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      grid.innerHTML = filtered.map(r => renderRepoCard(r)).join('');
      grid.querySelectorAll('.card').forEach((card, i) => {
        card.addEventListener('click', () => window.open(filtered[i].html_url, '_blank'));
        card.style.cursor = 'pointer';
      });
    }
  }

  langFilter.addEventListener('change', (e) => {
    currentLang = e.target.value;
    refreshGrid();
  });

  sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sortBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      refreshGrid();
    });
  });

  refreshGrid();
}

// 关于页面
function renderAbout() {
  const tpl = document.getElementById('tpl-about');
  document.getElementById('app').innerHTML = tpl.innerHTML;

  const c = CONFIG.personal;
  document.getElementById('aboutBio').textContent = c.bio;
  document.getElementById('skillsCloud').innerHTML = c.skills
    .map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');

  const contactList = document.getElementById('contactList');
  contactList.innerHTML = `
    ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="contact-item">📧 ${escapeHtml(c.email)}</a>` : ''}
    ${c.social.github ? `<a href="${escapeHtml(c.social.github)}" target="_blank" class="contact-item">🐙 GitHub</a>` : ''}
  `;
}

// ================================================================
// == 初始化
// ================================================================

function init() {
  // 主题
  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // 搜索
  initSearch();

  // 返回顶部
  initBackToTop();

  // 阅读进度
  initReadingProgress();

  // 移动端菜单
  initMobileMenu();

  // 注册路由
  Router.register('/', renderHome);
  Router.register('/blog', renderBlog);
  Router.register('/blog/:slug', renderPost);
  Router.register('/projects', renderProjects);
  Router.register('/about', renderAbout);

  // 加载博文索引，然后渲染首页
  BlogStore.loadPosts().then(() => {
    Router.navigate(window.location.hash);
  });
}

// 启动
document.addEventListener('DOMContentLoaded', init);
