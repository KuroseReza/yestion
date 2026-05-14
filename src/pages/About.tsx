import { createMemo } from 'solid-js'
import MarkdownPreview from '../components/MarkdownPreview'
import { lang } from '../stores/i18n'

const ABOUT_EN = `# Yestion

A lightweight Markdown note-taking and sharing tool.

## What it does

- Write Markdown notes with images, code blocks, and Mermaid diagrams
- Generate share links with expiry time
- Import and download .md files
- English and Chinese interface

## Tech

SolidJS + Milkdown editor on the frontend, Cloudflare Pages Functions as the backend, D1 + R2 for data and storage.

## GitHub

[yestion](https://github.com/KuroseReza/yestion)
`

const ABOUT_ZH = `# Yestion

一个轻量的 Markdown 笔记与分享工具。

## 能做什么

- 写 Markdown 笔记，支持图片、代码块、Mermaid 图表
- 生成分享链接分享给他人，可设过期时间
- 导入和下载 .md 文件
- 支持英文和中文界面

## 技术

前端 SolidJS + Milkdown 编辑器，后端 Cloudflare Pages Functions，数据存 D1 + R2。

## GitHub

[yestion](https://github.com/KuroseReza/yestion)
`

export default function About() {
  const content = createMemo(() => lang() === 'zh' ? ABOUT_ZH : ABOUT_EN)
  return (
    <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 md:p-12">
      <article class="relative max-w-4xl mx-auto glass-panel rounded-[2rem] p-5 sm:p-8 md:p-12 animate-fade-in">
        <header class="flex flex-col gap-3 border-b border-amber-900/10 dark:border-white/10 pb-7 mb-8">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_24px_rgba(245,158,11,.55)]" />
            <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700/80 dark:text-amber-300/80">About Yestion</div>
          </div>
        </header>

        <MarkdownPreview content={content()} class="share-markdown wysiwyg-share" />
      </article>
    </div>
  )
}
