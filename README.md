# kg

把 `aiwiki` / `xwiki` / `linux` / `opt` / `math` 五个 wiki 的 `docs/NNNN_*.md` 编译成**预渲染静态 HTML**，部署到 GitHub Pages：<https://junxnone.github.io/kg/>

| 浏览方式 | 入口 |
|--|--|
| 树形浏览 | `tree.html`；文章页左侧也有可折叠的树（共用 `tree.json`） |
| 搜索结果列表 | `search.html`（[Pagefind](https://pagefind.app)，支持中文，可按库 / label 过滤） |
| 标签浏览 | `tags/`；标签 = issue Labels + 路径各层级，点击进入文章列表 |
| 3D 知识图谱 | `graph.html`，嵌入 [jstools/3dkg](https://github.com/junxnone/jstools)，数据是构建生成的 `kg.json` |
| RoadMap 鱼骨图 | `roadmap/`；文件名含 RoadMap 的文章各一张卡片，点击进入鱼骨图。解析和 HTML 在构建时生成（移植自 [jstools/mdfishbone](https://github.com/junxnone/jstools)，不再用 iframe），骨线由 `assets/fishbone.js` 在浏览器里画；md 里的站内链接按 issue 编号改写成本站文章地址，深色模式跟随站点 |

`docs/bk/` 不处理。文章 URL 为 `/<repo>/<NNNN_Title>.html`（编号只在库内唯一，所以带库名前缀）。

## 构建

CI（`.github/workflows/deploy.yml`）在 push / 手动 / `repository_dispatch: docs-updated` 时直接构建；另外每小时（xx:17 UTC）轮询一次，先比较五个源库的 HEAD 与线上 `sources.json` 记录的版本，没有变化就跳过：
稀疏 clone 5 个源库的 `docs/*.md` → `node scripts/build.js` → `pagefind` → 部署 Pages。

首次使用：仓库 Settings → Pages → Source 选 **GitHub Actions**。

本地（需 Node 18+）：

```bash
npm install
node scripts/build.js --src /path/to/kg --out dist   # --src 下要有 aiwiki/ xwiki/ linux/ opt/ math/
npx pagefind --site dist
BASE_PATH=/ SITE_URL=http://localhost:8000/ node scripts/build.js --src /path/to/kg   # 本地预览用根路径
npx serve dist
```

配置在 `site.config.js`；代码在 `scripts/lib/`（parse → markdown → tree/kg → templates）。
