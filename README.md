# Claude Code 源码阅读

**中文架构导读 + 完整业务源码附录**，基于本地 Claude Code 2.1.88 source map 提取快照编排。非官方出版物。

- [在线阅读](https://aias00.github.io/claude-code-source-book/)
- [下载 EPUB](https://aias00.github.io/claude-code-source-book/downloads/claude-code-source-book.epub)
- [GitHub Release](https://github.com/Aias00/claude-code-source-book/releases/latest)

收录 14 篇导读（前言、12 章、附录说明）与 1,902 个业务源码文件，共 513,237 行。源码按目录编排，EPUB 内有分级目录、源码入口链接和长文件分段；在线版支持路径筛选、源码全文搜索、深链接、字号、深浅主题及本地阅读进度。

## 阅读内容

导读覆盖快照与构建边界、启动流程、对话引擎、工具协议、权限、上下文压缩、终端 UI、API/MCP、子代理与任务、扩展机制、持久化和远程连接，并提供阅读练习。

“完整业务源码”明确指原始 `package/src-extracted/src/` 集合，不包含第三方依赖逐文件附录或另一个恢复工程的补丁。本仓库 `source/` 保留原文件字节；生成站点的 `manifest.json` 提供路径、行数、字节数和 SHA-256。源码存在不意味着功能已开放或能直接编译运行。

## 本地生成

只需 Python 3.10+，不依赖第三方 Python 包：

```sh
python3 scripts/build.py
python3 scripts/verify.py
python3 -m http.server 8000 --directory site
```

访问 `http://localhost:8000`。EPUB 位于 `site/downloads/claude-code-source-book.epub`。请通过 HTTP 服务打开网页，浏览器的 `file://` 模式无法正常加载章节数据。

## 在线部署

推送到 main 后 GitHub Actions 会重新生成、核查并部署 GitHub Pages。仓库 Pages 设置使用 **GitHub Actions**。构建结果不重复提交到 Git 历史；Release 单独附带 EPUB 和收录清单。

## 验证

`verify.py` 逐文件比较原始源码与在线数据、EPUB 分段重组结果，检查 XML、内部链接、EPUB spine 与收录清单。EPUB 还应使用 EPUBCheck 验证。网页功能通过实际浏览器检查。可选的浏览器复测（需 Node.js）：

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
# 另一个终端启动上面的本地 HTTP 服务后：
BOOK_URL=http://localhost:8000/ node scripts/browser-check.cjs
```

`BOOK_URL` 也可设为公开站点地址，以核查实际部署。全文搜索按需加载约 30 MB 源码，在首次使用时可能较慢；仅在本地浏览器检索，不向第三方搜索引擎提交查询。

## 权利与来源

原始代码 © Anthropic PBC，保留其原始条款，见 [原始许可声明](source/ORIGINAL-LICENSE.md)。本书不为原始代码额外授予开源许可。导读由整理者根据本地快照编写，不是 Anthropic 官方文档，不应把静态阅读当作完整运行测试或安全审计结论。版本来自本地发布包声明，未进行官方包签名认证。
