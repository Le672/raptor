-- Yukino Portal D1 Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '随笔' CHECK (tag IN ('开发', '随笔', '收藏')),
  author_id INTEGER NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS box_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('software', 'document', 'media', 'other')),
  size TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert default admin user (password: admin123, change after first login!)
-- password_hash is bcrypt hash of 'admin123'
INSERT OR IGNORE INTO users (email, password_hash, name, role)
VALUES ('admin@yukino.bond', '$2a$10$rKzJvQx5mX8YqZ3nWpL7aOeHfGkMjNbVcXdSaQwErTyUiOpAsDfG', 'Yukino', 'admin');

-- Insert default box items
INSERT OR IGNORE INTO box_items (title, description, url, category, size, sort_order) VALUES
  ('Visual Studio Code', '轻量级代码编辑器，支持丰富的插件生态。', 'https://code.visualstudio.com/', 'software', '~80 MB', 1),
  ('7-Zip', '开源压缩解压工具，支持多种格式。', 'https://7-zip.org/', 'software', '~1.5 MB', 2),
  ('Docker Desktop', '容器化开发环境，简化部署与协作。', 'https://www.docker.com/products/docker-desktop/', 'software', '~500 MB', 3),
  ('Node.js LTS', 'JavaScript 运行时，长期支持版本。', 'https://nodejs.org/', 'software', '~30 MB', 4),
  ('Git for Windows', '版本控制工具，开发必备。', 'https://git-scm.com/download/win', 'software', '~50 MB', 5),
  ('Cloudflare 文档', 'Cloudflare 各项服务的官方文档与指南。', 'https://developers.cloudflare.com/', 'document', '在线', 10),
  ('React 官方文档', 'React 框架的完整文档与教程。', 'https://react.dev/', 'document', '在线', 11),
  ('Tailwind CSS 文档', '实用优先的 CSS 框架参考文档。', 'https://tailwindcss.com/docs', 'document', '在线', 12),
  ('MDN Web Docs', 'Mozilla 维护的 Web 技术权威参考。', 'https://developer.mozilla.org/', 'document', '在线', 13),
  ('Unsplash', '高质量免费图片资源库。', 'https://unsplash.com/', 'media', '在线', 20),
  ('Font Awesome', '图标字体与 SVG 图标库。', 'https://fontawesome.com/', 'media', '在线', 21),
  ('Google Fonts', '开源 Web 字体集合。', 'https://fonts.google.com/', 'media', '在线', 22),
  ('Music For Programming', '适合编程时听的背景音乐合集。', 'https://musicforprogramming.net/', 'media', '在线', 23),
  ('Can I Use', '浏览器兼容性查询工具。', 'https://caniuse.com/', 'other', '在线', 30),
  ('Regex101', '正则表达式在线测试与调试工具。', 'https://regex101.com/', 'other', '在线', 31),
  ('cURL Converter', '将 cURL 命令转换为各种语言代码。', 'https://curlconverter.com/', 'other', '在线', 32);

-- Insert default blog posts
INSERT OR IGNORE INTO posts (title, slug, summary, content, tag, author_id, published) VALUES
  ('把个人域名整理成可持续维护的入口站', 'domain-structure', '从根域名定位、子域分工到 Cloudflare 托管，整理一套不依赖服务器的轻量方案。', '## 为什么需要一个清晰的域名结构\n\n当个人站点开始积累多个子域时，如果没有提前规划，后期维护会变得非常混乱。我从一开始就决定把 yukino.bond 做成一个"根域名 + 多个子域"的结构。\n\n## 根域名的定位\n\n根域名 yukino.bond 首先是博客首页，展示最新的文章、近况和子域入口。\n\n## 子域的分工\n\n- **mail.yukino.bond** - 邮件入口，统一联系渠道\n- **dev.yukino.bond** - 开发小工具，如 Base64、JSON 格式化等\n- **box.yukino.bond** - 资源整理，软件和文档的下载索引\n- **blog.yukino.bond** - 完整的文章站点\n\n## Cloudflare Pages 托管\n\n整个站点托管在 Cloudflare Pages 上，纯静态构建，不需要服务器。\n\n## 后续计划\n\n持续完善各个子域的功能，让每个子域都有独立的价值。', '开发', 1, 1),
  ('常用开发工具应该怎样拆到 dev.yukino.bond', 'dev-tools-design', '把 JSON、时间戳、编码和文本处理拆成清晰的小页面，避免一个工具页过于拥挤。', '## 工具页的设计原则\n\n一个好的工具页应该做到：\n1. 功能明确，一眼就知道能做什么\n2. 操作简单，不需要学习成本\n3. 响应迅速，所有计算在本地完成\n\n## 工具分类\n\n我把开发工具分成了几个大类：\n\n- **编码转换**：Base64、URL 编码解码\n- **格式化**：JSON 格式化和校验\n- **时间处理**：时间戳转换\n- **文本处理**：大小写转换、哈希计算\n- **颜色工具**：HEX/RGB/HSL 互转\n\n## 技术实现\n\n所有工具都是纯前端实现，使用 React 的 useMemo 和 useCallback 优化性能。', '开发', 1, 1),
  ('为什么资源站更适合叫 box 而不是 download', 'box-vs-download', '更中性，也更适合后续从资源下载扩展到索引、清单、镜像和文档入口。', '## 命名的考量\n\n"download" 这个子域名字太具体了，它暗示这个站点只能用来下载文件。\n\n## box 的灵活性\n\n"box" 这个词更中性，可以包含：\n- 软件下载链接\n- 文档和教程索引\n- 媒体资源推荐\n- 常用工具书签\n\n## 未来的扩展\n\n随着内容的积累，box 可以继续细分为更多子页面，但子域名称不需要改变。', '随笔', 1, 1),
  ('个人站里那些值得长期保留的页面', 'essential-pages', '从 about、uses、links、changelog 到 rss，哪些页面最能形成完整感。', '## 个人站的基本页面\n\n一个完整的个人站点至少需要这些页面：\n\n- **首页** - 展示最新内容和入口\n- **关于** - 个人介绍和联系方式\n- **文章** - 博客内容主体\n- **工具** - 实用小工具\n\n## 加分项\n\n- **uses** - 设备和工具清单\n- **changelog** - 更新记录\n- **friends** - 友情链接\n- **rss** - 订阅源', '收藏', 1, 1);
