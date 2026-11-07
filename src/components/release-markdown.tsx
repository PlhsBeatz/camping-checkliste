'use client'

import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Schlanke Markdown-Darstellung für GitHub-Release-Notizen
 * (Überschriften, Listen, Fett/Kursiv, Code, Links) – ohne Extra-Dependency.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Links, inline code, bold, italic – der Reihe nach
  const pattern =
    /(!?\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${i++}`}>{text.slice(last, match.index)}</Fragment>
      )
    }
    if (match[2] != null && match[3] != null) {
      const label = match[2]
      const href = match[3]
      const isImage = match[0].startsWith('!')
      if (isImage) {
        nodes.push(
          <span key={`${keyPrefix}-img-${i++}`} className="text-muted-foreground">
            [{label}]
          </span>
        )
      } else {
        nodes.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-words"
          >
            {label}
          </a>
        )
      }
    } else if (match[4] != null) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i++}`}
          className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
        >
          {match[4]}
        </code>
      )
    } else if (match[5] != null || match[7] != null) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i++}`}>{match[5] ?? match[7]}</strong>
      )
    } else if (match[6] != null || match[8] != null) {
      nodes.push(
        <em key={`${keyPrefix}-i-${i++}`}>{match[6] ?? match[8]}</em>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t-end`}>{text.slice(last)}</Fragment>)
  }
  return nodes
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'hr' }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (trimmed.startsWith('```')) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        codeLines.push(lines[i] ?? '')
        i++
      }
      if (i < lines.length) i++ // closing fence
      blocks.push({ type: 'code', text: codeLines.join('\n') })
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      })
      i++
      continue
    }

    const ulMatch = /^[-*+]\s+(.+)$/.exec(trimmed)
    if (ulMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^[-*+]\s+(.+)$/.exec((lines[i] ?? '').trim())
        if (!m) break
        items.push(m[1]!.trim())
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    const olMatch = /^\d+[.)]\s+(.+)$/.exec(trimmed)
    if (olMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\d+[.)]\s+(.+)$/.exec((lines[i] ?? '').trim())
        if (!m) break
        items.push(m[1]!.trim())
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const para: string[] = [trimmed]
    i++
    while (i < lines.length) {
      const next = (lines[i] ?? '').trim()
      if (!next) break
      if (/^(#{1,3})\s+/.test(next)) break
      if (/^[-*+]\s+/.test(next)) break
      if (/^\d+[.)]\s+/.test(next)) break
      if (next.startsWith('```')) break
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(next)) break
      para.push(next)
      i++
    }
    blocks.push({ type: 'paragraph', text: para.join(' ') })
  }

  return blocks
}

export function ReleaseMarkdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const blocks = parseBlocks(content.trim())
  if (blocks.length === 0) return null

  return (
    <div className={cn('space-y-3 text-sm text-foreground break-words', className)}>
      {blocks.map((block, idx) => {
        const key = `b-${idx}`
        switch (block.type) {
          case 'heading': {
            const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5'
            return (
              <Tag
                key={key}
                className={cn(
                  'font-semibold text-brand-heading tracking-tight',
                  block.level === 1 && 'text-base',
                  block.level === 2 && 'text-sm',
                  block.level === 3 && 'text-sm'
                )}
              >
                {renderInline(block.text, key)}
              </Tag>
            )
          }
          case 'paragraph':
            return (
              <p key={key} className="leading-relaxed text-foreground/90">
                {renderInline(block.text, key)}
              </p>
            )
          case 'ul':
            return (
              <ul key={key} className="list-disc pl-5 space-y-1.5 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} className="list-decimal pl-5 space-y-1.5 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            )
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-md border border-border/60 bg-muted/50 p-3 text-xs font-mono leading-relaxed"
              >
                <code>{block.text}</code>
              </pre>
            )
          case 'hr':
            return <hr key={key} className="border-border/60" />
          default:
            return null
        }
      })}
    </div>
  )
}
