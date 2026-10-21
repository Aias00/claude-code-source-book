# 发布验证

- 全部 1,902 个业务源码文件：原始文件、在线阅读数据与 EPUB 分段重组结果逐字节一致。
- EPUB 3：EPUBCheck 5.4.0 检查通过，0 错误、0 警告。
- 检查了 XHTML/XML、内部文件链接、manifest 与阅读 spine。
- 浏览器检查覆盖导读、源码、路径搜索、全文检索、深链接、主题保存、移动目录和 EPUB 下载。

复现内容核查：`python3 scripts/build.py && python3 scripts/verify.py`。
EPUBCheck 为独立验证工具，不是生成依赖。上述核查不代表已运行或审计原始 Claude Code 功能。
