import { useState, type KeyboardEvent } from 'react'
import { Icon } from '@/components/solar'
import { AgentMenu, AttachMenu, DEFAULT_MODEL, ModeMenu, ModelMenu } from './menus'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export type Pickers = { agent: string; mode: string; model: string; effort: string }
export const DEFAULT_PICKERS: Pickers = { agent: 'Agent', mode: 'Auto', model: DEFAULT_MODEL, effort: 'Medium' }

/** Agent / credits on the left, mode and model on the right (N01, N10-N16, Reply composer). */
export function Toolbar({ credits, value, onChange, compact, sendSlot, onAdd, plainAdd, noAdd, modeKind = 'home', onNote = () => undefined, onFiles }: { credits: number; value: Pickers; onChange: (p: Pickers) => void; compact?: boolean; sendSlot: React.ReactNode; onAdd?: () => void; plainAdd?: boolean; noAdd?: boolean; modeKind?: 'home' | 'chat'; onNote?: (s: string) => void; onFiles?: () => void }) {
  const set = (k: keyof Pickers, v: string) => onChange({ ...value, [k]: v })
  return (
    <div className={cn('flex items-center gap-2 text-[13px]', plainAdd ? 'px-1 pt-2.5' : 'px-3 pt-1 pb-3')}>
      {!noAdd && (
        <AttachMenu
          onNote={onNote}
          onFiles={onFiles ?? onAdd ?? (() => undefined)}
          trigger={
            <button aria-label="Add" className={cn('group/add grid size-7 place-items-center rounded-md text-muted-foreground transition-all hover:text-foreground active:scale-90 data-[state=open]:text-foreground', !plainAdd && 'border border-foreground/20 hover:border-foreground/40')}>
              <Icon name="plus" size={14} className="transition-transform duration-200 group-hover/add:rotate-90" />
            </button>
          }
        />
      )}
      <AgentMenu value={value.agent} onChange={(v) => set('agent', v)} onNote={onNote} />
      <span className="shrink-0 whitespace-nowrap text-foreground/90">
        Credits : <span className={cn('text-subtle-foreground', credits < 8 && 'text-danger')}>{credits}</span>
      </span>
      <span className="grow" />
      <ModeMenu kind={modeKind} value={value.mode} onChange={(v) => set('mode', v)} />
      <ModelMenu compact={compact} model={value.model} effort={value.effort} onModel={(m) => set('model', m)} onEffort={(e) => set('effort', e)} />
      {sendSlot}
    </div>
  )
}

/** Reply box under the conversation ("Reply to Revolte", "Queue a message…", "Give feedback on the plan"). */
export function ReplyBox({ placeholder, running, onSend, onStop, disabled }: { placeholder: string; running: boolean; onSend: (t: string) => void; onStop: () => void; disabled?: boolean }) {
  const [text, setText] = useState('')
  const send = () => {
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }
  return (
    <div className="relative flex h-[50px] items-center rounded-2xl border border-input bg-transparent focus-within:border-foreground/60 focus-within:ring-[3px] focus-within:ring-foreground/10">
      <Textarea
        aria-label="Message Revolte"
        rows={1}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        className="min-h-0 flex-1 resize-none border-0 bg-transparent px-4 py-0 text-[14px] leading-[50px] shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      {running ? (
        <button aria-label="Stop" className="mr-2.5 grid size-6 place-items-center rounded-full bg-foreground text-background" onClick={onStop}>
          <Icon name="stop" size={12} bold />
        </button>
      ) : (
        <button aria-label="Send" disabled={!text.trim()} className="mr-3.5 text-subtle-foreground hover:text-foreground disabled:opacity-60" onClick={send}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 3v5H4m0 0 3-3M4 8l3 3" />
          </svg>
        </button>
      )}
    </div>
  )
}
