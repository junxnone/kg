// 站点配置。BASE_PATH / SITE_URL 可用环境变量覆盖（本地预览时设 BASE_PATH=/）
const basePath = (process.env.BASE_PATH || '/kg/').replace(/\/?$/, '/');
const siteUrl = (process.env.SITE_URL || 'https://junxnone.github.io/kg/').replace(/\/?$/, '/');

export default {
  title: 'Junx KG',
  basePath,
  siteUrl,
  // 3D 图谱查看器（jstools 3dkg），通过 ?json= 加载本站 kg.json
  viewer3d: 'https://junxnone.github.io/jstools/3dkg/',
  // RoadMap 鱼骨图查看器（jstools mdfishbone），通过 ?md= 读取本站生成的 md
  viewerFishbone: 'https://junxnone.github.io/jstools/mdfishbone/',
  // 源库：docs 下顶层的 NNNN_*.md（docs/bk 不处理）
  repos: [
    { name: 'aiwiki', title: 'AI Wiki', desc: '机器学习 / 深度学习 / 工具', repo: 'junxnone/aiwiki' },
    { name: 'xwiki', title: 'X Wiki', desc: '编程 / 工具 / 硬件', repo: 'junxnone/xwiki' },
    { name: 'linux', title: 'Linux', desc: 'Linux / Ubuntu / 工具', repo: 'junxnone/linux' },
    { name: 'opt', title: 'Opt', desc: '优化 / 性能', repo: 'junxnone/opt' },
    { name: 'math', title: 'Math', desc: '线性代数 / 图论 / 概率统计', repo: 'junxnone/math' },
  ],
};
