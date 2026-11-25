import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { GithubMark } from '@/ui/Icon'
import { Spin } from '@/chat/bits'
import { Label, Pick, Steps, field } from './bits'
import { BRANCHES, ENV_LABEL, FOLDERS, PRESETS, PROJECTS, REGIONS, REPOS, TAKEN, VPC_LIST, WHERE_LABEL, askDiscard, cancelConnect, continueWhere, createApp, discardSetup, generateYaml, keepEditing, setDep, startConnect, type Env, type Where } from './state'

const OPTIONS: { id: Where; title: string; sub: string; logo: string }[] = [
  { id: 'cloud', title: 'Revolte Cloud', sub: 'Isolated, no setup. Revolte handles scaling, TLS and backups.', logo: 'R' },
  { id: 'aws', title: 'Your AWS account', sub: 'Deploys into your own VPC with a cross-account role.', logo: 'aws' },
  { id: 'gcp', title: 'Your Google Cloud project', sub: 'Deploys to Cloud Run in your project.', logo: 'G' },
]

function Logo({ id }: { id: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background text-[11px] font-semibold">
      {id === 'R' ? <img src={`${import.meta.env.BASE_URL}assets/submark.svg`} alt="" className="size-4" /> : id === 'G' ? <span className="bg-gradient-to-br from-[#4285f4] via-[#34a853] to-[#ea4335] bg-clip-text text-[14px] text-transparent">G</span> : id}
    </span>
  )
}

function Frame({ step, title, desc, children, foot }: { step: number; title: string; desc: string; children: React.ReactNode; foot: React.ReactNode }) {
  return (
    <>
      <div className="px-6 pt-6 pb-4">
        {step > 1 && <p className="mb-1 text-[13px] text-muted-foreground">Step {step} of 4</p>}
        <DialogTitle className="text-[20px] leading-7 font-semibold">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-[14px] leading-5 text-muted-foreground">{desc}</DialogDescription>
        <div className="mt-4"><Steps n={step} /></div>
      </div>
      <div className="max-h-[56vh] overflow-y-auto px-6 pb-4">{children}</div>
      <div className="flex items-center gap-2 border-t border-border-subtle px-6 py-4">{foot}</div>
    </>
  )
}

export function Wizard({ onNote }: { onNote: (s: string) => void }) {
  const d = useStore((s) => s.dep)
  const set = setDep
  const aws = d.where === 'aws'
  const width = d.step === 1 ? 'max-w-[480px]' : d.step === 2 ? 'max-w-[560px]' : d.step === 3 ? 'max-w-[520px]' : 'max-w-[680px]'
  const urlText = d.repoQuery.trim()
  const isUrl = /^https?:\/\//.test(urlText)
  const shownRepos = REPOS.filter((r) => !urlText || isUrl || r.n.includes(urlText.toLowerCase()))
  const taken = TAKEN.includes(d.name.trim())
  const ready1 = d.name.trim() && d.repo && !taken && !d.creating && (!d.mono || (d.branch && d.folder))
  const vpcsDone = (['dev', 'qa', 'stage', 'prod'] as Env[]).every((e) => d.vpcs[e])
  const next3 = d.region && (!aws || vpcsDone)
  const noVpc = aws && d.region === 'EU (Ireland)'

  const foot = (back: boolean, primary: React.ReactNode, count?: string) => (
    <>
      {back ? <button className="mr-auto px-1 text-[13px]" onClick={() => set({ step: (d.step - 1) as 1 | 2 | 3 })}>Back</button> : <span className="mr-auto text-[13px] text-muted-foreground">{count}</span>}
      <Button variant="outline" size="sm" className="h-9 border-input bg-transparent" onClick={askDiscard}>Cancel</Button>
      {primary}
    </>
  )

  return (
    <>
      <Dialog open={d.wizard && !d.connecting && !d.discard} onOpenChange={(o) => !o && askDiscard()}>
        <DialogContent showCloseButton={false} className={cn('gap-0 border-border-subtle bg-card p-0', width)}>
          <button aria-label="Close" className="absolute top-5 right-5 text-muted-foreground hover:text-foreground" onClick={askDiscard}>
            <Icon name="close" size={16} />
          </button>

          {d.step === 1 && (
            <Frame step={1} title="Create application" desc="Revolte deploys this repository as an application in your project." foot={foot(false, <Button size="sm" className="h-9" disabled={!ready1} onClick={createApp}>{d.creating ? <><Spin size={14} className="invert" /> Creating…</> : 'Create application'}</Button>, 'Step 1 of 4')}>
              <div className="flex flex-col gap-4">
                <div>
                  <Label>Project</Label>
                  <Pick icon="folder" value={d.project} items={PROJECTS.map((p) => ({ id: p, label: p }))} onPick={(p) => set({ project: p })} />
                </div>
                <div>
                  <Label>Jira project</Label>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-[14px]">
                    <span className="grid size-4 place-items-center rounded-sm bg-[#2684ff] text-[9px] font-bold text-white">J</span>
                    <span className="flex-1">Payments platform · PAY</span>
                    <Icon name="lock" size={14} className="text-muted-foreground" />
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Icon name="lock" size={12} /> Linked to {d.project}. It cannot be changed.</p>
                </div>
                <div>
                  <Label>Application name</Label>
                  <input className={cn(field, taken && 'border-danger')} value={d.name} aria-invalid={taken} onChange={(e) => set({ name: e.target.value })} />
                  {taken && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger" role="alert"><Icon name="danger" size={12} /> An application named {d.name.trim()} already exists in {d.project}. Choose another name.</p>}
                </div>
                <div>
                  <Label>Repository</Label>
                  <button type="button" aria-expanded={d.repoOpen} className={cn(field, 'flex items-center gap-2 text-left', !d.repo && 'text-muted-foreground', d.urlState === 'bad' && 'border-danger')} onClick={() => set({ repoOpen: !d.repoOpen })}>
                    <GithubMark size={16} />
                    <span className="min-w-0 flex-1 truncate">{d.repo || 'Choose a repository'}</span>
                    <Icon name="down" size={14} className="text-muted-foreground" />
                  </button>
                  {d.repoOpen && (
                    <div className="mt-1 rounded-lg border border-border-subtle bg-card p-1.5" role="listbox" aria-label="Repositories">
                      <input autoFocus className={cn(field, 'mb-1 h-8 text-[13px]')} placeholder="Search or paste a public repository URL" value={d.repoQuery} onChange={(e) => set({ repoQuery: e.target.value, urlState: /^https?:\/\//.test(e.target.value) && e.target.value.length > 12 ? (/github\.com\/[^/]+\/[^/]+/.test(e.target.value) ? '' : 'bad') : '' })} />
                      {isUrl ? (
                        d.urlState === 'bad' ? (
                          <p className="px-2 py-2 text-[12px] text-danger" role="alert">That URL cannot be opened. Check that the repository is public.</p>
                        ) : (
                          <button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-selected" onClick={() => set({ repo: urlText.replace(/^https?:\/\/github\.com\//, ''), repoOpen: false, repoQuery: '' })}>
                            <GithubMark size={14} /> Use {urlText.replace(/^https?:\/\//, '')}
                          </button>
                        )
                      ) : (
                        <>
                          <p className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-[0.7px] text-subtle-foreground uppercase">Your repositories</p>
                          {d.refreshing ? <p className="flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground"><Spin size={14} /> Refreshing the list…</p> : shownRepos.length === 0 ? <p className="px-2 py-3 text-[13px] text-muted-foreground">No repositories match.</p> : shownRepos.map((r) => (
                            <button key={r.n} role="option" aria-selected={d.repo === r.n} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-selected" onClick={() => set({ repo: r.n, repoOpen: false, repoQuery: '', branch: '', folder: '' })}>
                              <GithubMark size={14} /> <span className="flex-1">{r.n}</span> <span className="text-[12px] text-muted-foreground">{r.b}</span>
                            </button>
                          ))}
                        </>
                      )}
                      <div className="mt-1 flex items-center justify-between border-t border-border-subtle px-2 pt-2 pb-1 text-[12px]">
                        <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => onNote('Adding a repository opens GitHub in the real product.')}><Icon name="plus" size={12} /> Add a repository on GitHub <Icon name="out" size={11} /></button>
                        <button className="flex items-center gap-1.5 hover:underline" onClick={() => (set({ refreshing: true }), setTimeout(() => set({ refreshing: false }), 1200))}><Icon name="refresh" size={12} /> Refresh</button>
                      </div>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <Checkbox checked={d.mono} onCheckedChange={(v) => set({ mono: !!v, branch: '', folder: '' })} /> This is a monorepo
                  <Icon name="info" size={13} className="text-muted-foreground" />
                </label>
                {d.mono && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Branch</Label><Pick icon="branch" value={d.branch} placeholder="Choose a branch" items={BRANCHES.map((b) => ({ id: b, label: b }))} onPick={(b) => set({ branch: b })} /></div>
                    <div><Label>Application folder</Label><Pick icon="folder" value={d.folder} placeholder="Choose a folder" items={FOLDERS.map((b) => ({ id: b, label: b }))} onPick={(b) => set({ folder: b })} /></div>
                  </div>
                )}
              </div>
            </Frame>
          )}

          {d.step === 2 && (
            <Frame step={2} title={`Where should ${d.name} run?`} desc="You can change this later in environment settings." foot={foot(true, <Button size="sm" className="h-9" onClick={continueWhere}>{d.where === 'cloud' || d.connected[d.where] ? 'Continue' : `Continue to ${d.where === 'aws' ? 'AWS' : 'Google Cloud'}`}</Button>)}>
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Where to run">
                {OPTIONS.map((o) => {
                  const on = d.where === o.id
                  return (
                    <button key={o.id} role="radio" aria-checked={on} className={cn('flex items-center gap-3 rounded-xl border p-3.5 text-left', on ? 'border-input bg-selected' : 'border-border-subtle hover:bg-surface')} onClick={() => set({ where: o.id })}>
                      <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', on ? 'border-foreground' : 'border-input')}>{on && <span className="size-2 rounded-full bg-foreground" />}</span>
                      <Logo id={o.logo} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium">{o.title}</span>
                        <span className="block text-[13px] leading-[18px] text-muted-foreground">{o.sub}{o.id !== 'cloud' && d.connected[o.id] ? ' Connected.' : ''}</span>
                      </span>
                      {o.id === 'cloud' && <span className="flex items-center gap-1 text-[12px]"><Icon name="star" size={12} bold /> Recommended</span>}
                    </button>
                  )
                })}
              </div>
            </Frame>
          )}

          {d.step === 3 && (
            <Frame step={3} title={aws ? 'Choose a region and VPCs' : 'Choose a region'} desc={aws ? 'Pick where Revolte runs in your AWS account, then choose a VPC for each environment.' : `Pick where ${d.name} runs. Close to your users is faster.`} foot={foot(true, <Button size="sm" className="h-9" disabled={!next3 || noVpc} onClick={() => set({ step: 4 })}>Continue</Button>)}>
              <div className="flex flex-col gap-4">
                <div><Label>Region</Label><Pick value={d.region} placeholder="Choose a region" items={REGIONS.map((r) => ({ id: r, label: r }))} onPick={(r) => set({ region: r, vpcs: { dev: '', qa: '', stage: '', prod: '' } })} /></div>
                {aws && (
                  !d.region ? <p className="text-[13px] text-muted-foreground">Choose a region first. Then map each environment to a VPC.</p>
                  : noVpc ? (
                    <p className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface p-3 text-[13px]"><Icon name="info" size={14} className="mt-0.5" /> No VPC in {d.region}. Choose another region, or create a VPC in AWS first.</p>
                  ) : (
                    <>
                      <div><p className="text-[14px] font-medium">Map environments to VPCs</p><p className="text-[13px] text-muted-foreground">Choose a VPC for each environment in this region.</p></div>
                      {(['dev', 'qa', 'stage', 'prod'] as Env[]).map((e) => (
                        <div key={e}>
                          <Label>{ENV_LABEL[e]}</Label>
                          <Pick placeholder="Choose a VPC" value={d.vpcs[e]} items={VPC_LIST.map((v) => ({ id: v, label: v }))} onPick={(v) => set({ vpcs: { ...d.vpcs, [e]: v } })} />
                        </div>
                      ))}
                    </>
                  )
                )}
              </div>
            </Frame>
          )}

          {d.step === 4 && (
            <Frame step={4} title="Choose a preset" desc={`Pick what ${d.name} needs. You can add services later.`} foot={foot(true, <Button size="sm" className="h-9" disabled={!d.preset} onClick={generateYaml}>Generate deployment.yml</Button>)}>
              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Preset">
                {PRESETS.map(([t, s]) => {
                  const on = d.preset === t
                  return (
                    <button key={t} role="radio" aria-checked={on} className={cn('flex items-center gap-3 rounded-lg border p-3.5 text-left', on ? 'border-input bg-selected' : 'border-border-subtle hover:bg-surface')} onClick={() => set({ preset: t })}>
                      <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', on ? 'border-foreground' : 'border-input')}>{on && <span className="size-2 rounded-full bg-foreground" />}</span>
                      <span><span className="block text-[14px] font-medium">{t}</span><span className="block text-[12px] text-muted-foreground">{s}</span></span>
                    </button>
                  )
                })}
              </div>
            </Frame>
          )}
        </DialogContent>
      </Dialog>

      {/* D05-D05c: waiting for the cloud account */}
      <Dialog open={d.wizard && !!d.connecting && !d.discard} onOpenChange={(o) => !o && cancelConnect()}>
        <DialogContent showCloseButton={false} className="max-w-[480px] gap-0 overflow-hidden border-border-subtle bg-card p-0">
          <button aria-label="Close" className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground" onClick={cancelConnect}><Icon name="close" size={16} /></button>
          <div className="grid h-[150px] place-items-center bg-surface">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-lg border border-border-subtle bg-card"><img src={`${import.meta.env.BASE_URL}assets/submark.svg`} alt="" className="size-5" /></span>
              {d.connectFail ? <Icon name="danger" size={20} className="text-danger" /> : <Spin size={26} />}
              <span className="grid size-12 place-items-center rounded-lg border border-border-subtle bg-card text-[12px] font-semibold">{d.connecting === 'aws' ? 'aws' : 'G'}</span>
            </div>
          </div>
          <div className="border-t border-border-subtle p-6">
            <DialogTitle className="text-[18px] font-semibold">{d.connectFail ? `${d.connecting === 'aws' ? 'AWS' : 'Google Cloud'} connection did not finish` : `Finish connecting ${d.connecting === 'aws' ? 'AWS' : 'Google Cloud'}`}</DialogTitle>
            <DialogDescription className="mt-2 text-[14px] leading-5 text-muted-foreground">
              {d.connectFail ? 'Revolte did not get a confirmation. Check that the role was created, then try again.' : d.connecting === 'aws' ? 'Create the Revolte role in the AWS tab that opened. This updates when AWS confirms.' : 'Allow Revolte in the Google Cloud tab that opened. This updates when Google confirms.'}
            </DialogDescription>
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle px-6 py-3.5">
            <span className="flex items-center gap-2 text-[13px]">{d.connectFail ? <><span className="size-1.5 rounded-full bg-danger" /> Not connected</> : <><span className="size-1.5 rounded-full bg-[#5b8def]" /> Waiting for {d.connecting === 'aws' ? 'AWS' : 'Google Cloud'}</>}</span>
            <span className="flex gap-2">
              <button className="px-2 text-[13px]" onClick={cancelConnect}>Cancel</button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-input bg-transparent" onClick={() => startConnect(d.connecting as 'aws' | 'gcp')}>{d.connectFail ? 'Try again' : <>Reopen {d.connecting === 'aws' ? 'AWS' : 'Google Cloud'} <Icon name="out" size={12} /></>}</Button>
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* D08 */}
      <Dialog open={d.discard} onOpenChange={(o) => !o && keepEditing()}>
        <DialogContent showCloseButton={false} className="max-w-[440px] gap-0 border-border-subtle bg-card p-6">
          <DialogTitle className="text-[18px] font-semibold">Discard this deploy setup?</DialogTitle>
          <DialogDescription className="mt-3 text-[14px] leading-5 text-muted-foreground">The application has not been created yet. Your build and pull request stay as they are.</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-9 border-input bg-transparent" onClick={keepEditing}>Keep editing</Button>
            <Button size="sm" className="h-9 bg-danger text-white hover:bg-danger/90" onClick={discardSetup}>Discard setup</Button>
          </div>
        </DialogContent>
      </Dialog>
      <span hidden>{WHERE_LABEL.cloud}</span>
    </>
  )
}
