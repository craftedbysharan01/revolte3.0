import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '@/components/solar'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DEFAULT_PICKERS, Toolbar, type Pickers } from './Composer'
import { AttachMenu, DEFAULT_MODEL } from './menus'
import { setEditMode, setModel } from './engine'
import type { Chat } from './types'

const MODE_OF = { manual: 'Manual', auto: 'Auto in this chat', project: 'Auto in this project' } as const
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`

const ENTER = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 3v5H4m0 0 3-3M4 8l3 3" />
  </svg>
)

/**
 * Design System 3.0 "Reply composer": the chat box after the first message. One line, return key at its right edge;
 * add, agent and credits under it on the left, mode and model on the right. A light runs once around it when the chat
 * Mode and model live on the chat. The add button sits inside the box, before the text.
 */
export function Composer({ c, credits, placeholder, running, onSend, onStop, extra, disabled, onNote = () => undefined }: { c: Chat; credits: number; placeholder: string; running: boolean; onSend: (t: string) => void; onStop: () => void; extra?: ReactNode; disabled?: boolean; onNote?: (s: string) => void }) {
  const [local, setLocal] = useState<Pickers>(DEFAULT_PICKERS)
  const [text, setText] = useState('')
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const pick = useRef<HTMLInputElement>(null)
  const value: Pickers = { ...local, mode: MODE_OF[c.editMode ?? 'auto'], model: c.model && c.model !== 'Sonnet 5' ? c.model : DEFAULT_MODEL }
  const change = (p: Pickers) => {
    setLocal(p)
    if (p.mode !== value.mode) setEditMode(c.id, p.mode === 'Manual' ? 'manual' : p.mode === 'Auto in this project' ? 'project' : 'auto')
    if (p.model !== value.model) setModel(c.id, p.model)
  }
  const can = !!text.trim() && !disabled
  const send = () => {
    if (!can) return
    onSend(file ? `${text}\n\n📎 ${file.name}` : text)
    setText('')
    setFile(null)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }
  return (
    <div className="@container mx-auto w-full max-w-[740px] shrink-0 px-[30px] pb-4">
      {extra}
      <div className="relative rounded-xl border border-input bg-surface transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/40 focus-within:ring-[3px] focus-within:ring-foreground/10">
        {file && (
          <div className="px-3 pt-3">
            <span className="inline-flex items-center gap-2.5 rounded-lg bg-muted py-1.5 pr-2 pl-2.5 text-[12px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
              <Icon name="doc" size={14} className="text-muted-foreground" />
              <span className="leading-4">
                <span className="block font-medium">{file.name}</span>
                <span className="block text-[11px] text-subtle-foreground">
                  {file.name.split('.').pop()?.toUpperCase()} · {kb(file.size)}
                </span>
              </span>
              <button aria-label={`Remove ${file.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setFile(null)}>
                <Icon name="close" size={12} />
              </button>
            </span>
          </div>
        )}
        <div className="flex min-h-[48px] items-center">
          <AttachMenu
            onNote={onNote}
            onFiles={() => pick.current?.click()}
            trigger={
              <button aria-label="Add files or context" className="group/add ml-2.5 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-all hover:bg-selected hover:text-foreground active:scale-90 data-[state=open]:bg-selected data-[state=open]:text-foreground">
                <Icon name="plus" size={16} className="transition-transform duration-200 group-hover/add:rotate-90" />
              </button>
            }
          />
          <Textarea
            aria-label="Message Revolte"
            rows={1}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent py-[13px] pr-3 pl-1.5 text-[14px] leading-[22px] shadow-none [field-sizing:content] focus-visible:ring-0 dark:bg-transparent"
          />
          {running ? (
            <button aria-label="Stop" className="mr-3 grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95" onClick={onStop}>
              <Icon name="stop" size={12} bold />
            </button>
          ) : (
            <button
              aria-label="Send"
              disabled={!can}
              className={cn('mr-3 grid size-6 shrink-0 place-items-center rounded-md transition-all', can ? 'bg-foreground text-background hover:scale-105 active:scale-95' : 'text-subtle-foreground')}
              onClick={send}
            >
              {ENTER}
            </button>
          )}
        </div>
      </div>
      <input ref={pick} type="file" hidden onChange={(e) => (setFile(e.target.files?.[0] ? { name: e.target.files[0].name, size: e.target.files[0].size } : null), (e.target.value = ''))} />
      <Toolbar credits={credits} value={value} onChange={change} compact plainAdd noAdd modeKind="chat" onNote={onNote} sendSlot={null} />
    </div>
  )
}
