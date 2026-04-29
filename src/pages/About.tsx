import MarkdownPreview from '../components/MarkdownPreview'

const ABOUT_MARKDOWN = `# Yestion

Yestion 是一个面向个人知识整理与轻量协作的 Markdown 笔记系统。它把编辑体验、图片管理、公开分享和 API 集成放在同一个清晰的工作流里：私有内容在编辑器中完成，公开内容通过独立的只读分享层展示。

## 当前项目定位

- **个人笔记工作台**：用于创建、编辑、保存和管理 Markdown 文档。
- **所见即所得编辑**：编辑页面继续使用 Milkdown / Crepe，保留更接近文档编辑器的输入体验。
- **静态分享页**：分享页面不使用编辑器内核，而是使用静态 Markdown 渲染器，减少焦点、选区、移动端键盘和只读副作用。
- **图片与媒体管理**：支持文档图片上传、懒加载、预览放大和分享页安全访问。
- **Cloudflare 原生部署**：前端运行在 Cloudflare Pages，API 通过 Pages Functions、D1 和 R2 组合实现。

## 核心功能

### 编辑

- Markdown / WYSIWYG 编辑
- 标题与正文自动本地草稿缓存
- 主按钮默认执行“同步”
- 下拉菜单支持“放弃当前更改”，清除本地缓存并从云端重新同步
- 图片上传与文档引用管理

### 分享

- 可撤销分享链接
- 只读 Markdown 展示
- 图片点击放大
- Mermaid 图表渲染
- 代码块静态展示，不触发编辑器焦点或移动端键盘
- 分享图片通过分享作用域接口访问，不直接暴露任意媒体 key

### API

- 文档创建、读取、更新、删除
- 分享链接管理
- 媒体上传与访问
- 适合和自动化脚本、个人工具或外部工作流集成

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | SolidJS, Vite, Tailwind CSS |
| 编辑器 | Milkdown / Crepe |
| Markdown 渲染 | marked + 自定义静态渲染层 |
| 图表 | Mermaid |
| 部署 | Cloudflare Pages |
| 后端 | Cloudflare Pages Functions |
| 数据 | Cloudflare D1 |
| 对象存储 | Cloudflare R2 |

## 渲染策略

Yestion 当前有两套明确分工的 Markdown 体验：

1. **编辑页**使用 Milkdown / Crepe，优先保证输入、编辑、图片插入和文档操作体验。
2. **分享页与 About 页**使用和公开分享相同的静态 Markdown renderer，优先保证只读展示、稳定布局、图片放大、Mermaid 和代码块展示一致性。

这种拆分避免把编辑器的复杂交互带到公开阅读场景里，同时让静态页面保持和 Yestion 主视觉一致的 glassmorphism、warm aurora、stone / amber 色系。

## 项目状态

当前版本已经完成：

- 分享页从编辑器内核迁移到静态 Markdown renderer
- 编辑页保留 Milkdown / Crepe
- 分享页图片预览、Mermaid、代码块和视觉细节对齐
- 编辑页本地草稿缓存与同步菜单
- GitHub 干净仓库初始化
- Cloudflare Pages 生产部署流程

## 设计原则

> 编辑场景保持强交互，阅读场景保持静态、稳定、可分享。

Yestion 的目标不是做一个臃肿的协作套件，而是保持小而清晰：写作、保存、分享、自动化，每个环节都尽量直接可靠。
`

export default function About() {
  return (
    <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 md:p-12">
      <article class="relative max-w-4xl mx-auto glass-panel rounded-[2rem] p-5 sm:p-8 md:p-12 animate-fade-in">
        <header class="flex flex-col gap-3 border-b border-amber-900/10 dark:border-white/10 pb-7 mb-8">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_24px_rgba(245,158,11,.55)]" />
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700/80 dark:text-amber-300/80">About Yestion</div>
          </div>
        </header>

        <MarkdownPreview content={ABOUT_MARKDOWN} class="share-markdown wysiwyg-share" />
      </article>
    </div>
  )
}
