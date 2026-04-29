import MarkdownPreview from '../components/MarkdownPreview'

const ABOUT_MARKDOWN = `# Yestion

Yestion 希望成为一个更安静、更可信的知识空间：你可以在这里记录想法、整理资料、沉淀长期项目，并把值得公开的部分以清晰、稳定的文档形式分享出去。

它不是为了把写作变成复杂流程，而是让“写下来、整理好、分享给合适的人”变得自然。私人笔记应该足够顺手，公开页面应该足够克制，未来的协同也应该围绕内容本身展开，而不是被工具感打断。

## 愿景

我们希望 Yestion 最终成为一个从个人知识到公开知识库的连续空间：

- **先服务个人**：提供快速、可靠、低打扰的 Markdown 写作与整理体验。
- **再连接他人**：让一份文档可以从私人草稿自然过渡到可分享、可协作、可公开沉淀的状态。
- **长期可维护**：内容不被锁在复杂平台里，Markdown 始终是核心格式，导入、导出、自动化和 API 都应该保持开放。
- **阅读优先**：公开页面应该像精心排版的文档，而不是一个被强行设成只读的编辑器。

## 当前阶段

当前版本更偏向个人工作台和公开分享能力：

- 编辑页使用 Milkdown / Crepe，保留顺手的 WYSIWYG Markdown 编辑体验。
- 分享页与 About 页使用同一套静态 Markdown renderer，保证只读、稳定、适合公开阅读。
- 文档图片、Mermaid 图表、代码块和公开分享样式已经接入统一的 Yestion 视觉体系。
- 本地草稿缓存和同步菜单用于降低编辑时的丢稿风险。

## 接下来会加入

### 协同工作

未来 Yestion 会加入协同工作能力，让文档不只停留在“我写完发给你看”，而是可以围绕同一份内容进行共同维护。

计划方向包括：

- 多人共同编辑或分阶段协作
- 文档级权限与成员管理
- 评论、建议、审阅等轻量协作流程
- 团队/项目空间，用于组织一组长期文档

协同功能会尽量保持克制：它应该帮助内容变好，而不是把笔记系统变成复杂的项目管理工具。

### 公开文档库

Yestion 也会加入公开文档库功能，把零散的分享链接进一步组织成可浏览、可检索、可持续维护的知识集合。

计划方向包括：

- 将公开文档收集到个人或团队文档库
- 支持目录、标签、搜索和精选页面
- 让长期项目、教程、说明书、研究笔记可以稳定公开
- 保持每篇文档独立可分享，同时也能归入更大的知识结构

这会让 Yestion 不只是“笔记 + 分享链接”，而是逐步成为一个可以沉淀公开知识的空间。

## 设计原则

> 私人写作要顺手，公开阅读要稳定，协同工作要围绕内容本身。

Yestion 的方向是小而清晰：先把写作、保存、分享做好，再把协同和公开文档库建立在同一套内容模型之上。它应该像一个可以长期使用的知识工作台，而不是一次性的文档发布工具。

## GitHub

项目源码已公开在 GitHub： [KuroseReza/yestion](https://github.com/KuroseReza/yestion)
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
