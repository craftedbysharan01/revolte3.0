/* Revolte chat prototype. Plain JS, no build step. Open index.html. */
;(function () {
  const { FILES, REPO_FILES, QUESTIONS, PLAN_TASKS, BUILD, DELIVERIES } = window.DATA
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  // ---------- Icons ----------
  const svg = (n, s) => (s ? (ICONS[n] || '').replace('width="16" height="16"', `width="${s}" height="${s}"`) : ICONS[n] || '')
  const ic = (n, s, cls) => `<i data-i="${n}"${cls ? ` class="${cls}"` : ''}>${svg(n, s)}</i>`
  const hydrate = (root) =>
    $$('i[data-i]', root).forEach((i) => {
      if (!i.firstChild) i.innerHTML = svg(i.dataset.i, i.dataset.s)
    })
  const h = (html) => {
    const t = document.createElement('template')
    t.innerHTML = html.trim()
    return t.content.firstElementChild
  }

  // ---------- Virtual clock (the speed switch scales agent time) ----------
  const clock = { t: 0, speed: 1, waiters: [], tickers: new Set() }
  let lastTick = performance.now()
  setInterval(() => {
    const now = performance.now()
    clock.t += Math.min(now - lastTick, 1000) * clock.speed
    lastTick = now
    if (clock.waiters.length) {
      const due = clock.waiters.filter((w) => w.at <= clock.t)
      if (due.length) {
        clock.waiters = clock.waiters.filter((w) => w.at > clock.t)
        due.forEach((w) => w.resolve())
      }
    }
    clock.tickers.forEach((fn) => fn())
  }, 40)
  const CANCEL = Symbol('cancel')
  const sleep = (ms, run) =>
    new Promise((resolve, reject) => {
      clock.waiters.push({ at: clock.t + ms, resolve: () => (run.cancelled ? reject(CANCEL) : resolve()) })
    })
  const fmt = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000))
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  // ---------- State ----------
  const shell = $('#shell')
  const small = () => matchMedia('(max-width: 760px)').matches
  const S = {
    run: null,
    tab: 'overview',
    immersive: false,
    sidebarBefore: 'open',
    building: false,
    previewReady: false,
    planOpen: false,
    awaiting: null,
    files: {},
    code: { shown: null, follow: true, tabs: [] },
    env: {
      name: 'Default',
      script: 'pnpm install\npnpm db:seed',
      vars: [
        { k: 'NODE_ENV', v: 'development' },
        { k: 'DATABASE_URL', v: 'postgres://sandbox:5432/webhooks' },
      ],
      secrets: [{ k: 'RESEND_API_KEY', v: '', saved: true }],
      net: 'limited',
      domains: ['api.github.com', 'api.resend.com'],
      registries: true,
    },
  }

  // ---------- Toast ----------
  let toastTimer
  function toast(text) {
    const el = $('#toast')
    el.textContent = text
    el.classList.add('on')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('on'), 2400)
  }
  document.addEventListener('click', (e) => {
    const soon = e.target.closest('[data-soon]')
    if (soon) toast(`${soon.dataset.soon} is not part of this prototype.`)
  })

  // ======================================================================
  // Home
  // ======================================================================
  const homeInput = $('#homeInput')
  const homeSend = $('#homeSend')
  homeInput.addEventListener('input', () => {
    homeInput.style.height = 'auto'
    homeInput.style.height = Math.min(homeInput.scrollHeight, 220) + 'px'
    homeSend.disabled = !homeInput.value.trim()
  })
  homeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      $('#homeComposer').requestSubmit()
    }
  })
  $('#homeComposer').addEventListener('submit', (e) => {
    e.preventDefault()
    const text = homeInput.value.trim()
    if (text) startChat(text)
  })
  $('#promoClose').addEventListener('click', () => $('#promoWrap').classList.add('gone'))

  function goHome() {
    if (S.run) S.run.cancelled = true
    S.run = null
    S.awaiting = null
    clock.tickers.clear()
    shell.dataset.view = 'home'
    shell.dataset.pane = 'closed'
    shell.dataset.sidebar = small() ? 'closed' : 'open'
    $$('#recents .on').forEach((b) => b.classList.remove('on'))
    homeInput.value = ''
    homeInput.style.height = 'auto'
    homeSend.disabled = true
    homeInput.focus()
  }
  $('#newChat').addEventListener('click', goHome)

  // ---------- Sidebar and prototype speed ----------
  $('#sbClose').addEventListener('click', () => (shell.dataset.sidebar = 'closed'))
  $('#sbOpen').addEventListener('click', () => (shell.dataset.sidebar = 'open'))
  $('#speed').addEventListener('click', (e) => {
    const b = e.target.closest('[data-speed]')
    if (!b) return
    clock.speed = +b.dataset.speed
    $$('#speed button').forEach((x) => x.classList.toggle('on', x === b))
  })

  // ======================================================================
  // Chat thread
  // ======================================================================
  const thread = $('#thread')
  const threadInner = $('#threadInner')
  let atBottom = true
  thread.addEventListener('scroll', () => {
    atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80
  })
  new MutationObserver(() => {
    if (atBottom) thread.scrollTop = thread.scrollHeight
  }).observe(threadInner, { childList: true, subtree: true, characterData: true })
  const say = (el) => (threadInner.appendChild(typeof el === 'string' ? h(el) : el), el)
  const bubble = (text) => say(`<div class="bubble">${esc(text)}</div>`)
  const msg = (text, cls = '') => say(`<p class="msg ${cls}">${text}</p>`)

  const waitingEl = $('#waiting')
  const replyInput = $('#replyInput')
  function setAwaiting(a) {
    S.awaiting = a
    waitingEl.classList.toggle('on', !!a)
    replyInput.placeholder = a && a.placeholder ? a.placeholder : 'Reply to Revolte'
  }
  $('#reply').addEventListener('submit', (e) => {
    e.preventDefault()
    const text = replyInput.value.trim()
    if (!text) return
    replyInput.value = ''
    atBottom = true
    if (S.awaiting) return S.awaiting.onReply(text)
    bubble(text)
    msg(
      S.building || (S.run && !S.previewReady)
        ? 'Got it. Revolte reads this once the current step finishes.'
        : 'This prototype ends at the preview. Start a new chat to run it again.',
      'note'
    )
  })

  // ---------- Agent activity group ----------
  function group(label) {
    const el = say(
      h(`<div class="act open running">
        <button class="act-head" aria-expanded="true"><span class="act-mark"></span><span class="act-label">${esc(label)}</span><span class="act-time">0s</span>${ic('right', 12, 'act-chev')}</button>
        <div class="act-steps"><div></div></div>
      </div>`)
    )
    const head = $('.act-head', el)
    const list = $('.act-steps > div', el)
    const time = $('.act-time', el)
    const t0 = clock.t
    const tick = () => (time.textContent = fmt(clock.t - t0))
    clock.tickers.add(tick)
    head.addEventListener('click', () => head.setAttribute('aria-expanded', el.classList.toggle('open')))
    return {
      el,
      count: 0,
      setLabel: (t) => ($('.act-label', el).textContent = t),
      step(html, state = 'running') {
        const row = h(`<div class="step ${state}"><span class="step-ic"></span><span class="step-text">${html}</span><span class="step-time"></span></div>`)
        list.appendChild(row)
        const ic0 = $('.step-ic', row)
        const tm = $('.step-time', row)
        let s0 = clock.t
        const stick = () => (tm.textContent = fmt(clock.t - s0))
        const api = {
          start(html2) {
            s0 = clock.t
            row.className = 'step running'
            ic0.innerHTML = '<span class="spinner"></span>'
            if (html2) $('.step-text', row).innerHTML = html2
            clock.tickers.add(stick)
            return api
          },
          done(html2, st = 'done') {
            clock.tickers.delete(stick)
            stick()
            row.className = 'step ' + st
            ic0.innerHTML = svg(st === 'fail' ? 'close' : 'check', 12)
            if (html2) $('.step-text', row).innerHTML = html2
          },
        }
        this.count++
        return state === 'running' ? api.start() : api
      },
      finish(text, suffix = '') {
        clock.tickers.delete(tick)
        const ms = clock.t - t0
        time.textContent = fmt(ms) + suffix
        this.setLabel(text)
        el.classList.remove('running', 'open')
        head.setAttribute('aria-expanded', 'false')
        return ms
      },
    }
  }

  // ---------- Clarifying questions ----------
  function askQuestions() {
    return new Promise((resolve) => {
      const answers = QUESTIONS.map((q) => ({ pick: 0, own: '' }))
      let idx = 0
      const card = say(h(`<div class="card questions" tabindex="-1"></div>`))
      const finish = (skipped) => {
        setAwaiting(null)
        const out = QUESTIONS.map((q, i) => (skipped && i >= idx ? q.options[0] : answers[i].own.trim() || q.options[answers[i].pick]))
        const all = skipped && idx === 0
        const d = h(`<details class="card answers">
          <summary>${ic('checkCircle')}${all ? 'Used the recommended answers' : `Answered ${QUESTIONS.length} questions`}${ic('right', 12, 'act-chev')}</summary>
          <dl>${QUESTIONS.map((q, i) => `<div><dt>${esc(q.q)}</dt><dd>${esc(out[i])}</dd></div>`).join('')}</dl>
        </details>`)
        card.replaceWith(d)
        resolve({ answers: out, skipped: all })
      }
      const next = () => (idx < QUESTIONS.length - 1 ? (idx++, render(true)) : finish(false))
      function render(swap) {
        const q = QUESTIONS[idx]
        const a = answers[idx]
        card.innerHTML = `
          <div class="card-head">Question ${idx + 1} of ${QUESTIONS.length}
            <span class="q-dots">${QUESTIONS.map((_, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('')}</span>
          </div>
          <div class="q-body ${swap ? 'swap' : ''}">
            <p class="q-title">${esc(q.q)}</p>
            ${q.options
              .map(
                (o, i) => `<button class="opt ${!a.own && a.pick === i ? 'on' : ''}" data-i="${i}" role="radio" aria-checked="${!a.own && a.pick === i}">
                  <span class="radio"></span>${esc(o)}${i === 0 ? '<span class="rec">Recommended</span>' : ''}</button>`
              )
              .join('')}
            <input class="own" placeholder="Or type your own answer" value="${esc(a.own)}" aria-label="Your own answer" />
          </div>
          <div class="card-foot">
            <button class="btn ghost" data-act="skip">Skip, use recommended</button>
            <span class="grow"></span>
            ${idx > 0 ? '<button class="btn ghost" data-act="back">Back</button>' : ''}
            <button class="btn primary" data-act="next">${idx < QUESTIONS.length - 1 ? 'Continue' : 'Submit answers'}</button>
          </div>`
        setAwaiting({
          placeholder: 'Answer in your own words',
          onReply(text) {
            answers[idx].own = text
            next()
          },
        })
      }
      card.addEventListener('click', (e) => {
        const opt = e.target.closest('.opt')
        if (opt) {
          answers[idx].pick = +opt.dataset.i
          answers[idx].own = ''
          $('.own', card).value = ''
          $$('.opt', card).forEach((o) => {
            o.classList.toggle('on', o === opt)
            o.setAttribute('aria-checked', o === opt)
          })
          return
        }
        const act = e.target.closest('[data-act]')
        if (!act) return
        if (act.dataset.act === 'skip') finish(true)
        else if (act.dataset.act === 'back') idx--, render(true)
        else next()
      })
      card.addEventListener('input', (e) => {
        if (!e.target.classList.contains('own')) return
        answers[idx].own = e.target.value
        $$('.opt', card).forEach((o) => o.classList.toggle('on', !e.target.value && +o.dataset.i === answers[idx].pick))
      })
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('own')) e.preventDefault(), next()
      })
      render(false)
    })
  }

  // ---------- Plan ----------
  function showPlan(tasks, version) {
    return new Promise((resolve) => {
      const card = say(
        h(`<div class="card plan">
          <div class="card-head">${ic('doc')}Plan${version > 1 ? ` <em style="font-style:normal;color:var(--subtle-foreground);font-weight:400">v${version}</em>` : ''}<span class="meta">~ 2 mins</span></div>
          <ol class="plan-list">${tasks.map((t, i) => `<li><span class="num">${i + 1}</span>${esc(t.t)}</li>`).join('')}</ol>
          <div class="card-foot">
            <button class="btn primary" data-act="approve">Approve plan</button>
            <button class="btn secondary" data-act="change">Ask for changes</button>
            <span class="grow"></span>
            <button class="linkish" data-act="view">View plan</button>
          </div>
        </div>`)
      )
      const settle = (label, result) => {
        setAwaiting(null)
        card.classList.add('settled')
        $('.meta', card).textContent = label
        if (label !== 'Approved') $('.meta', card).style.color = 'var(--subtle-foreground)'
        resolve(result)
      }
      setAwaiting({
        placeholder: 'Give feedback on the plan',
        onReply: (text) => (bubble(text), settle('Revised', { change: text })),
      })
      card.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')
        if (!act) return
        if (act.dataset.act === 'approve') settle('Approved', { approved: true })
        else if (act.dataset.act === 'change') replyInput.focus()
        else openPlan()
      })
    })
  }

  function renderPlanDoc(answers, tasks, version) {
    const files = Object.keys(FILES)
    $('#planDoc').innerHTML = `
      <div class="doc-head">${ic('doc')}plan.md <em>v${version}</em><span class="grow"></span>
        <button class="icon-btn" id="planCopy" aria-label="Copy plan">${ic('copy')}</button>
        <button class="icon-btn" id="planClose" aria-label="Close plan">${ic('close')}</button></div>
      <h3>Summary</h3>
      <p>Build an internal dashboard that lists webhook deliveries from the last 24 hours, retries failed ones with exponential backoff and alerts on-call when the last attempt fails. ${tasks.length} tasks, about 2 minutes.</p>
      <h3>Decisions</h3>
      <table><tr><th>Question</th><th>Answer</th></tr>
        ${QUESTIONS.map((q, i) => `<tr><td>${esc(q.q)}</td><td>${esc(answers[i])}</td></tr>`).join('')}</table>
      <h3>Scope</h3>
      <table><tr><th>In scope</th><th>Out of scope</th></tr>
        <tr><td>Deliveries list with status and attempts</td><td>Editing webhook endpoints</td></tr>
        <tr><td>Retry with backoff, capped at 6 hours</td><td>Replaying delivered events</td></tr>
        <tr><td>On-call alert after the last attempt</td><td>Alert routing rules</td></tr></table>
      <h3>Tasks</h3>
      <table><tr><th>#</th><th>Task</th><th>Area</th><th>Effort</th><th>After</th></tr>
        ${tasks.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.t)}</td><td>${t.area}</td><td>${t.effort}</td><td>${t.after}</td></tr>`).join('')}</table>
      <h3>Proposed changes</h3>
      <table><tr><th>File</th><th>Action</th></tr>
        ${files.map((f) => `<tr><td class="mono">${f}</td><td>${FILES[f].some((l) => l.p === 0) ? 'Edit' : 'Create'}</td></tr>`).join('')}</table>`
    $('#planClose').onclick = closePlan
    $('#planCopy').onclick = () => toast('Plan copied')
  }
  function openPlan() {
    S.planOpen = true
    $('#planDoc').classList.add('on')
    applyPane()
  }
  function closePlan() {
    S.planOpen = false
    $('#planDoc').classList.remove('on')
    applyPane()
  }

  // ======================================================================
  // Right pane
  // ======================================================================
  const STAGES = [
    ['grill', 'Grill', 'Questions that change the build'],
    ['plan', 'Plan', 'Decisions and tasks'],
    ['tasks', 'Tasks', 'Split from your request'],
    ['build', 'Build', 'Retry scheduler with backoff'],
    ['verify', 'Verify', 'Tests, lint, Prettier'],
  ]
  function renderProgress() {
    $('#progress').innerHTML = STAGES.map(
      ([k, n, sub]) => `<li data-stage="${k}"><span class="pg-ic">${ic('check', 14)}</span><span class="pg-name">${n}</span><span class="pg-state"></span><span class="pg-sub">${sub}</span></li>`
    ).join('')
  }
  function stage(key, state, label, sub) {
    const li = $(`#progress [data-stage="${key}"]`)
    if (!li) return
    li.className = state
    $('.pg-state', li).textContent = label ?? (state === 'now' ? 'In progress' : '')
    if (sub) $('.pg-sub', li).textContent = sub
  }
  function envState(cls, text) {
    const el = $('#envState')
    el.className = 'env-state ' + cls
    el.textContent = text
  }

  const paneWidth = () => (S.planOpen ? (S.immersive ? 'wide' : 'split') : S.tab === 'sandbox' || S.tab === 'code' ? (S.immersive ? 'wide' : 'split') : 'narrow')
  function applyPane() {
    if (shell.dataset.pane !== 'closed' || S.planOpen) shell.dataset.pane = paneWidth()
  }
  function showTab(tab, { enter = false } = {}) {
    const leavingCode = S.tab === 'code' && tab !== 'code'
    S.tab = tab
    $$('.ptab').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === tab)
      b.setAttribute('aria-selected', b.dataset.tab === tab)
    })
    $$('.pview:not(.plan-doc)').forEach((v) => {
      v.classList.remove('leave', 'enter')
      v.classList.toggle('on', v.dataset.view === tab)
    })
    if (enter) {
      const v = $(`.pview[data-view="${tab}"]`)
      v.classList.add('enter')
      v.addEventListener('animationend', () => v.classList.remove('enter'), { once: true })
    }
    // Immersive code view: the sidebar gets out of the way while Revolte writes.
    if (S.building && tab === 'code' && !S.immersive) {
      S.immersive = true
      S.sidebarBefore = shell.dataset.sidebar
      shell.dataset.sidebar = 'closed'
      $('#coach').classList.remove('on')
    } else if (S.building && leavingCode && S.immersive) {
      S.immersive = false
      shell.dataset.sidebar = S.sidebarBefore
    }
    $('.ptab[data-tab="code"]').classList.toggle('live', S.building && tab !== 'code')
    shell.dataset.pane = paneWidth()
    if (tab === 'code') renderEditor(true)
  }
  $('#ptabs').addEventListener('click', (e) => {
    const b = e.target.closest('.ptab')
    if (!b) return
    if (S.planOpen) closePlan()
    showTab(b.dataset.tab)
  })
  $('#coach').addEventListener('click', () => showTab('code'))
  $('#paneToggle').addEventListener('click', () => {
    shell.dataset.pane = shell.dataset.pane === 'closed' ? paneWidth() : 'closed'
  })

  // ======================================================================
  // Code view: tree, editor, terminal
  // ======================================================================
  const treeEl = $('#tree')
  const ecode = $('#ecode')
  const seen = new Set()

  function resetFiles() {
    S.files = {}
    REPO_FILES.forEach((p) => (S.files[p] = { status: 'repo', lines: null }))
    Object.entries(FILES).forEach(([p, raw]) => {
      const lines = raw.map((l) => (typeof l === 'string' ? { t: l, p: 1 } : l))
      const exists = lines.some((l) => l.p === 0)
      S.files[p] = { status: exists ? 'repo' : 'hidden', lines, done: 0, active: null, frac: 0, planned: true }
    })
    S.code = { shown: null, follow: true, tabs: [] }
    seen.clear()
    $('#term').innerHTML = ''
  }
  const fileStat = (f, upTo) => {
    let a = 0
    let d = 0
    f.lines.forEach((l) => {
      if (l.p >= 1 && l.p <= upTo) a++
      if (l.del && l.del <= upTo) d++
    })
    return [a, d]
  }
  const statHtml = ([a, d]) => `<span class="add">+${a}</span>${d ? `<span class="del">−${d}</span>` : ''}`

  function renderTree() {
    const root = {}
    Object.keys(S.files)
      .filter((p) => S.files[p].status !== 'hidden')
      .forEach((p) => {
        const parts = p.split('/')
        let node = root
        parts.forEach((part, i) => {
          node[part] = node[part] || (i === parts.length - 1 ? p : {})
          node = node[part]
        })
      })
    let html = ''
    let fresh = 0
    const walk = (node, depth) => {
      const keys = Object.keys(node).sort((a, b) => (typeof node[a] === 'string') - (typeof node[b] === 'string') || a.localeCompare(b))
      keys.forEach((k) => {
        const v = node[k]
        if (typeof v !== 'string') {
          html += `<div class="trow dir" style="--d:${depth}">${ic('folderOpen', 14)}<span class="tname">${k}</span></div>`
          return walk(v, depth + 1)
        }
        const f = S.files[v]
        const isNew = !seen.has(v)
        seen.add(v)
        html += `<button class="trow file ${f.status} ${S.code.shown === v ? 'sel' : ''} ${isNew && f.planned ? 'new' : ''}" data-path="${v}" style="--d:${depth};--i:${isNew ? fresh++ : 0}">
          ${ic(f.lines ? 'codeFile' : 'file', 14)}<span class="tname">${k}</span>
          ${f.status === 'done' ? `<span class="tstat">${statHtml(fileStat(f, f.done))}</span>` : ''}</button>`
      })
    }
    walk(root, 0)
    treeEl.innerHTML = html
  }
  treeEl.addEventListener('click', (e) => {
    const row = e.target.closest('.file')
    if (!row) return
    const active = Object.keys(S.files).find((p) => S.files[p].status === 'active')
    S.code.follow = !S.building || row.dataset.path === active
    openFile(row.dataset.path)
  })
  $('#follow').addEventListener('click', () => {
    S.code.follow = true
    const active = Object.keys(S.files).find((p) => S.files[p].status === 'active')
    if (active) openFile(active)
    else renderEditor()
  })

  function openFile(path) {
    S.code.shown = path
    if (S.files[path].lines && !S.code.tabs.includes(path)) {
      S.code.tabs.push(path)
      if (S.code.tabs.length > 4) S.code.tabs.shift()
    }
    renderTree()
    renderEditor(true)
  }

  // Tiny TypeScript highlighter. Enough for a believable editor.
  const TOKEN = /(\/\/.*$)|(`(?:[^`\\]|\\.)*`?|'(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?)|\b(import|from|export|const|let|async|await|function|return|if|else|new|type|default|typeof)\b|\b(\d[\d_.]*)\b|\b([A-Z][A-Za-z0-9_]*)\b|\b([a-z_][A-Za-z0-9_]*)(?=\()/g
  function hl(text) {
    let out = ''
    let last = 0
    text.replace(TOKEN, (m, c, s, k, n, t, f, off) => {
      out += esc(text.slice(last, off))
      out += `<span class="tk-${c ? 'c' : s ? 's' : k ? 'k' : n ? 'n' : t ? 't' : 'f'}">${esc(m)}</span>`
      last = off + m.length
      return m
    })
    return out + esc(text.slice(last))
  }

  let lastKey = ''
  let lastTabs = ''
  function renderEditor(swap) {
    const path = S.code.shown
    const f = path && S.files[path]
    $('#follow').classList.toggle('on', S.building && !S.code.follow)
    const tabsKey = S.code.tabs.map((p) => p + (p === path) + S.files[p].status).join('|')
    if (tabsKey !== lastTabs) {
      lastTabs = tabsKey
      $('#etabs').innerHTML = S.code.tabs
        .map((p) => `<span class="etab ${p === path ? 'on' : ''}">${S.files[p].status === 'active' ? '<span class="dot"></span>' : ''}${p.split('/').pop()}</span>`)
        .join('')
    }
    if (!f || !f.lines || f.status === 'pending' || f.status === 'hidden') {
      lastKey = ''
      ecode.innerHTML = `<div class="ecode-empty">${
        !f ? (S.building ? 'Waiting for the first file.' : S.previewReady ? 'Pick a file to see what changed.' : 'Code changes show up here once the build starts.') : f.lines ? 'Revolte has not written this file yet.' : 'Unchanged in this build.'
      }</div>`
      return
    }
    const a = f.active
    const total = a ? f.lines.reduce((n, l) => n + (l.p === a ? l.t.length + 1 : 0), 0) : 0
    let budget = Math.floor(total * f.frac)
    const key = path + ':' + f.done + ':' + a + ':' + budget
    if (key === lastKey && !swap) return
    lastKey = key
    let html = ''
    let no = 0
    let caretPlaced = false
    for (const l of f.lines) {
      let text = l.t
      let cls = ''
      let sign = ' '
      if (l.del && l.del <= f.done) continue
      if (l.del && l.del === a) {
        if (l.p > f.done) continue
        cls = 'd'
        sign = '−'
      } else if (l.p <= f.done) {
        if (l.p >= 1) (cls = 'a'), (sign = '+')
      } else if (l.p === a) {
        if (budget <= 0) continue
        const take = Math.min(text.length + 1, budget)
        budget -= take
        sign = '+'
        if (take <= text.length || budget <= 0) {
          text = text.slice(0, take)
          cls = 'w'
          caretPlaced = true
        } else cls = 'a'
      } else continue
      no++
      html += `<div class="ln ${cls}"><span class="no">${no}</span><span class="sign">${sign}</span><span class="tx">${hl(text)}${cls === 'w' ? '<span class="caret"></span>' : ''}</span></div>`
    }
    ecode.innerHTML = html
    if (swap) {
      ecode.classList.remove('swap')
      void ecode.offsetWidth
      ecode.classList.add('swap')
      ecode.scrollTop = 0
    }
    if (caretPlaced && S.code.follow) {
      const w = $('.w', ecode)
      if (w.offsetTop > ecode.scrollTop + ecode.clientHeight - 64 || w.offsetTop < ecode.scrollTop) ecode.scrollTop = w.offsetTop - ecode.clientHeight * 0.55
    }
  }

  function codeTotals() {
    let a = 0
    let d = 0
    let n = 0
    Object.values(S.files).forEach((f) => {
      if (!f.lines || !f.done) return
      const [x, y] = fileStat(f, f.done)
      a += x
      d += y
      n++
    })
    $('#codeTotal').innerHTML = n ? `${n} file${n > 1 ? 's' : ''} changed &nbsp;<span class="add">+${a}</span> <span class="del">−${d}</span>` : ''
  }
  function termLine(text) {
    const cls = text.startsWith('$') ? 'cmd' : /✗|failed|expected/.test(text) ? 'bad' : /✓|passed|Preview/.test(text) ? 'ok' : ''
    const el = $('#term')
    el.insertAdjacentHTML('beforeend', `<div class="${cls}">${esc(text)}</div>`)
    el.scrollTop = el.scrollHeight
  }

  // ======================================================================
  // Sandbox preview
  // ======================================================================
  function renderPreview() {
    const page = $('#pvPage')
    if (!S.previewReady) {
      page.innerHTML = `<div class="pv-wait">${S.run ? '<span class="spinner"></span>' : ''}<p>The preview opens here once the build is verified.</p></div>`
      return
    }
    const rows = S.deliveries
    const stat = { delivered: 1284, retrying: 12, failed: 3 }
    rows.forEach((r) => r.retried && (stat.retrying++, stat.failed--))
    page.innerHTML = `
      <div class="pv-head"><h1>Webhook deliveries</h1><span>Last 24 hours</span></div>
      <div class="stats">
        <div class="stat" style="--i:1"><span>Delivered</span><b>${stat.delivered.toLocaleString('en-US')}</b></div>
        <div class="stat" style="--i:2"><span>Retrying</span><b>${stat.retrying}</b></div>
        <div class="stat" style="--i:3"><span>Failed</span><b>${stat.failed}</b></div>
      </div>
      <table class="dtable">
        <thead style="--i:4"><tr><th>Endpoint</th><th>Event</th><th>Attempts</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows
          .map(
            (r, i) => `<tr style="--i:${5 + i}"><td>${r.endpoint}</td><td>${r.event}</td><td>${r.attempts}${r.attempts > 1 || r.status !== 'delivered' ? ' of 8' : ''}</td>
            <td><span class="badge ${r.status}">${r.status[0].toUpperCase() + r.status.slice(1)}</span></td>
            <td>${r.status === 'failed' ? `<button class="retry-btn" data-row="${i}">Retry</button>` : ''}</td></tr>`
          )
          .join('')}</tbody>
      </table>`
  }
  function freshen() {
    const b = $('#browser')
    const u = $('#urlLoad')
    b.classList.remove('fresh')
    u.classList.remove('go')
    void b.offsetWidth
    b.classList.add('fresh')
    u.classList.add('go')
    setTimeout(() => b.classList.remove('fresh'), 1600)
  }
  $('#pvPage').addEventListener('click', (e) => {
    const b = e.target.closest('.retry-btn')
    if (!b) return
    const r = S.deliveries[+b.dataset.row]
    Object.assign(r, { status: 'retrying', attempts: 1, retried: true })
    renderPreview()
  })
  $('#pvReload').addEventListener('click', () => S.previewReady && (renderPreview(), freshen()))

  // The build is verified: the preview lands where the user is looking.
  function revealPreview() {
    S.previewReady = true
    if (S.planOpen) closePlan()
    renderPreview()
    const land = () => {
      if (shell.dataset.pane === 'closed') shell.dataset.pane = 'split'
      showTab('sandbox', { enter: true })
      freshen()
    }
    if (S.tab === 'code' && shell.dataset.pane !== 'closed') {
      const code = $('.pview[data-view="code"]')
      code.classList.add('leave')
      setTimeout(land, 230)
    } else land()
  }

  // ======================================================================
  // The scripted agent
  // ======================================================================
  const short = (p) => p.split('/').slice(-2).join('/')
  const LIVE = { Split: 'Splitting', Created: 'Writing', Edited: 'Editing', Ran: 'Running', Fixed: 'Fixing', Reran: 'Rerunning', Checked: 'Checking', Started: 'Starting' }
  function stepHtml(s, mode) {
    const verb = mode === 'live' ? `<span class="shimmer">${LIVE[s.verb]}</span>` : s.verb
    let out = `${verb}${s.text ? ' ' + s.text : ''}`
    if (s.file) {
      out += ` <code>${short(s.file)}</code>`
      if (mode === 'done') {
        const f = S.files[s.file]
        const a = f.lines.filter((l) => l.p === s.phase).length
        const d = f.lines.filter((l) => l.del === s.phase).length
        out += ` &nbsp;<span class="add">+${a}</span>${d ? ` <span class="del">−${d}</span>` : ''}`
      }
    }
    if (mode === 'done' && s.fail) out += ` &nbsp;<span class="del">${s.fail}</span>`
    if (mode === 'done' && s.pass) out += ` &nbsp;<span class="add">${s.pass}</span>`
    return out
  }

  async function agent(run) {
    let worked = 0
    let steps = 0
    const quick = async (g, text, ms) => {
      const s = g.step(text)
      await sleep(ms, run)
      s.done()
    }

    // -- Sandbox
    envState('boot', 'Starting')
    let g = group('Starting the sandbox')
    await quick(g, 'Creating a cloud sandbox from <code>' + esc(S.env.name) + '</code>', 3000)
    await quick(g, 'Cloning revolte/webhook-monitor', 2500)
    await quick(g, 'Running the start script', 3500)
    worked += g.finish('Sandbox ready')
    steps += g.count
    envState('up', 'Running')
    renderPreview()

    // -- Understand, then ask
    stage('grill', 'now')
    g = group('Understanding your request')
    await quick(g, 'Reading your request', 2000)
    await quick(g, 'Exploring the repository &nbsp;14 files', 5000)
    await quick(g, 'Checking how deliveries are stored', 3500)
    worked += g.finish('Understood the request')
    steps += g.count
    msg('Three details change what gets built. The recommended answers are selected, so you can skip straight through.')
    const { answers, skipped } = await askQuestions()
    if (run.cancelled) throw CANCEL
    stage('grill', 'done', skipped ? 'Skipped' : 'Answered', skipped ? 'Used recommended answers' : 'Answered 3 questions')

    // -- Plan, with a change loop
    stage('plan', 'now')
    let tasks = PLAN_TASKS.slice()
    let version = 1
    g = group('Planning')
    await quick(g, skipped ? 'Drafting the plan from the recommended answers' : 'Drafting the plan from your answers', 5500)
    await quick(g, 'Sizing the tasks', 2500)
    worked += g.finish('Planned')
    steps += g.count
    for (;;) {
      renderPlanDoc(answers, tasks, version)
      const res = await showPlan(tasks, version)
      if (run.cancelled) throw CANCEL
      if (res.approved) break
      version++
      g = group('Revising the plan')
      await quick(g, 'Working your feedback into the tasks', 4500)
      worked += g.finish('Revised the plan')
      steps += g.count
      const note = res.change.length > 64 ? res.change.slice(0, 61) + '…' : res.change
      tasks = [...tasks.filter((t) => !t.extra).slice(0, -1), { t: 'Your change: ' + note, area: 'Change', effort: 'S', after: '3', extra: true }, tasks[tasks.length - 1]]
    }
    if (S.planOpen) closePlan()
    stage('plan', 'done', 'Approved', `${tasks.length} tasks`)

    // -- Build (about two minutes at 1×)
    S.building = true
    S.code.follow = true
    g = group(BUILD[0].label)
    const rows = BUILD.map((s) => g.step(stepHtml(s, 'pending'), 'pending'))
    let coached = false
    for (let i = 0; i < BUILD.length; i++) {
      const s = BUILD[i]
      g.setLabel(s.label)
      stage(s.stage, 'now')
      if (s.stage !== 'tasks') stage('tasks', 'done', '', `${Object.keys(FILES).length} file changes`)
      if (s.stage === 'verify') stage('build', 'done', '', `${Object.keys(FILES).length} files changed`)
      rows[i].start(stepHtml(s, 'live'))
      const f = s.file && S.files[s.file]
      const t0 = clock.t
      let tick
      if (f) {
        f.status = 'active'
        f.active = s.phase
        f.frac = 0
        if (S.code.follow || !S.code.shown) openFile(s.file)
        else renderTree(), renderEditor()
        $('#codeStatus').textContent = `${LIVE[s.verb]} ${s.file}`
        $('.ptab[data-tab="code"]').classList.toggle('live', S.tab !== 'code')
        if (!coached && S.tab !== 'code') {
          coached = true
          $('#coach').classList.add('on')
          sleep(12000, run).then(() => $('#coach').classList.remove('on'), () => {})
        }
        tick = () => {
          // Type a little unevenly: quick bursts, short pauses.
          const x = Math.min(1, (clock.t - t0) / (s.dur * 1000 * 0.94))
          f.frac = Math.max(f.frac, Math.min(1, x + 0.012 * Math.sin(x * 60)))
          if (S.code.shown === s.file && S.tab === 'code') renderEditor()
        }
        clock.tickers.add(tick)
      } else if (s.term) {
        $('#codeStatus').textContent = s.term[0]
        s.term.forEach((line, n) => sleep((s.dur * 1000 * 0.9 * n) / s.term.length, run).then(() => termLine(line), () => {}))
      } else {
        $('#codeStatus').textContent = 'Planning tasks'
      }
      await sleep(s.dur * 1000, run)
      if (f) {
        clock.tickers.delete(tick)
        f.frac = 1
        f.done = s.phase
        f.active = null
        f.status = 'done'
        renderTree()
        renderEditor()
        codeTotals()
      }
      if (i === 0) {
        // Tasks are split: the planned files appear in the tree, waiting their turn.
        Object.values(S.files).forEach((x) => x.status === 'hidden' && (x.status = 'pending'))
        renderTree()
      }
      rows[i].done(stepHtml(s, 'done'), s.fail ? 'fail' : 'done')
    }
    steps += g.count
    worked += g.finish('Worked for')
    S.building = false
    stage('verify', 'done', '', '24 tests pass, lint clean')
    $('#codeStatus').textContent = ''
    $('.ptab[data-tab="code"]').classList.remove('live')
    $('#coach').classList.remove('on')
    S.code.follow = true
    renderEditor()
    $('.act-time', g.el).textContent = `${fmt(worked)} · ${steps} steps`

    msg('Built and verified in the sandbox. 24 tests pass, lint and Prettier are clean. The preview is open on the right.')
    say(`<div class="msg-actions">${['copy', 'refresh', 'share', 'dots']
      .map((n) => `<button class="icon-btn" data-soon="This action" aria-label="${n}">${ic(n)}</button>`)
      .join('')}</div>`)
    revealPreview()
  }

  function startChat(prompt) {
    if (S.run) S.run.cancelled = true
    clock.tickers.clear()
    const run = (S.run = { cancelled: false })
    Object.assign(S, { tab: 'overview', immersive: false, building: false, previewReady: false, planOpen: false, awaiting: null })
    S.deliveries = DELIVERIES.map((d) => ({ ...d }))
    const first = prompt.split(/[.\n]/)[0].trim() || prompt
    const title = first.length > 40 ? first.slice(0, 38).trimEnd() + '…' : first
    $('#chatTitle span').textContent = title[0].toUpperCase() + title.slice(1)
    $$('#recents .mine').forEach((b) => b.remove())
    $('#recents').prepend(h(`<button class="nav recent on mine">${esc(title[0].toUpperCase() + title.slice(1))}</button>`))

    threadInner.innerHTML = ''
    atBottom = true
    setAwaiting(null)
    resetFiles()
    renderTree()
    renderProgress()
    envState('', 'Not started')
    $('#planDoc').classList.remove('on')
    $('#codeTotal').innerHTML = ''
    $('#codeStatus').textContent = ''
    $('#coach').classList.remove('on')
    shell.dataset.view = 'chat'
    showTab('overview')
    shell.dataset.pane = small() ? 'closed' : 'narrow'
    if (small()) shell.dataset.sidebar = 'closed'
    renderPreview()
    bubble(prompt)
    replyInput.focus()
    agent(run).catch((e) => {
      if (e !== CANCEL) throw e
    })
  }

  // ======================================================================
  // Environment modal
  // ======================================================================
  const modal = $('#envModal')
  let draft = null
  let opener = null
  const NET_NOTE = {
    limited: 'Requests to any other host are blocked.',
    open: 'The sandbox can reach any public host. Use this only when you trust everything the start script installs.',
    none: 'No outbound requests. Installs in the start script fail unless the dependencies are already cached.',
  }
  function kvRow(kind, item, i) {
    const secret = kind === 'secrets'
    return `<div class="kv-row ${secret ? 'secret' : ''}" data-kind="${kind}" data-i="${i}">
      <input class="input mono" data-f="k" placeholder="${secret ? 'SECRET_NAME' : 'NAME'}" value="${esc(item.k)}" aria-label="Name" spellcheck="false" />
      <input class="input mono" data-f="v" ${secret ? 'type="password"' : ''} placeholder="${secret ? (item.saved ? 'Saved. Type to replace' : 'Value') : 'Value'}" value="${esc(item.v)}" aria-label="Value" spellcheck="false" autocomplete="off" />
      ${secret ? `<button type="button" class="icon-btn" data-eye aria-label="Show value while typing">${ic('eye')}</button>` : ''}
      <button type="button" class="icon-btn" data-remove aria-label="Remove">${ic('trash')}</button>
    </div>`
  }
  function renderEnv() {
    $('#envNameInput').value = draft.name
    $('#envScript').value = draft.script
    ;['vars', 'secrets'].forEach((kind) => {
      $(kind === 'vars' ? '#envVars' : '#envSecrets').innerHTML = draft[kind].length
        ? draft[kind].map((it, i) => kvRow(kind, it, i)).join('')
        : `<p class="kv-empty">${kind === 'vars' ? 'No variables yet.' : 'No secrets yet.'}</p>`
    })
    renderNet()
  }
  function renderNet() {
    $$('#envNet button').forEach((b) => b.setAttribute('aria-checked', b.dataset.net === draft.net))
    $('#netLimited').hidden = draft.net !== 'limited'
    $('#netNote').textContent = NET_NOTE[draft.net]
    $('#envRegistries').checked = draft.registries
    $$('#envDomains .domain').forEach((d) => d.remove())
    $('#domainInput').insertAdjacentHTML(
      'beforebegin',
      draft.domains.map((d, i) => `<span class="domain">${esc(d)}<button type="button" data-domain="${i}" aria-label="Remove ${esc(d)}">${svg('close', 10)}</button></span>`).join('')
    )
  }
  function openEnv(from) {
    opener = from
    draft = JSON.parse(JSON.stringify(S.env))
    renderEnv()
    modal.classList.add('open')
    modal.setAttribute('aria-hidden', 'false')
    $('#envNameInput').focus({ preventScroll: true })
  }
  function closeEnv() {
    modal.classList.remove('open')
    modal.setAttribute('aria-hidden', 'true')
    if (opener) opener.focus()
  }
  $('#envOpen').addEventListener('click', (e) => openEnv(e.currentTarget))
  $('#navEnv').addEventListener('click', (e) => openEnv(e.currentTarget))
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return closeEnv()
    const add = e.target.closest('[data-add]')
    if (add) {
      draft[add.dataset.add].push({ k: '', v: '' })
      renderEnv()
      const rows = $$(`.kv-row[data-kind="${add.dataset.add}"]`)
      return $('input', rows[rows.length - 1]).focus()
    }
    const row = e.target.closest('.kv-row')
    if (row && e.target.closest('[data-remove]')) {
      draft[row.dataset.kind].splice(+row.dataset.i, 1)
      return renderEnv()
    }
    if (row && e.target.closest('[data-eye]')) {
      const v = $('[data-f="v"]', row)
      v.type = v.type === 'password' ? 'text' : 'password'
      e.target.closest('[data-eye]').innerHTML = ic(v.type === 'password' ? 'eye' : 'eyeClosed')
      return
    }
    const net = e.target.closest('[data-net]')
    if (net) return (draft.net = net.dataset.net), renderNet()
    const dom = e.target.closest('[data-domain]')
    if (dom) return draft.domains.splice(+dom.dataset.domain, 1), renderNet()
  })
  modal.addEventListener('input', (e) => {
    const row = e.target.closest('.kv-row')
    if (row) {
      const item = draft[row.dataset.kind][+row.dataset.i]
      if (e.target.dataset.f === 'k') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      item[e.target.dataset.f] = e.target.value
      if (e.target.dataset.f === 'v') item.saved = false
    } else if (e.target.id === 'envNameInput') draft.name = e.target.value
    else if (e.target.id === 'envScript') draft.script = e.target.value
    else if (e.target.id === 'envRegistries') draft.registries = e.target.checked
  })
  $('#domainInput').addEventListener('keydown', (e) => {
    const input = e.target
    if (e.key === 'Backspace' && !input.value && draft.domains.length) return draft.domains.pop(), renderNet(), input.focus()
    if (e.key !== 'Enter' && e.key !== ',') return
    e.preventDefault()
    const host = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!host) return
    if (!/^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return toast('Enter a domain like api.example.com')
    if (!draft.domains.includes(host)) draft.domains.push(host)
    input.value = ''
    renderNet()
    input.focus()
  })
  $('#envForm').addEventListener('submit', (e) => {
    e.preventDefault()
    draft.name = draft.name.trim() || 'Default'
    draft.vars = draft.vars.filter((v) => v.k)
    draft.secrets = draft.secrets.filter((v) => v.k).map((s) => ({ k: s.k, v: '', saved: true }))
    S.env = draft
    $('#envName').textContent = S.env.name
    closeEnv()
    toast('Environment saved')
  })
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return
    if (e.key === 'Escape') return closeEnv()
    if (e.key !== 'Tab') return
    const items = $$('button, input, textarea', $('#envForm')).filter((el) => el.offsetParent)
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) e.preventDefault(), last.focus()
    else if (!e.shiftKey && document.activeElement === last) e.preventDefault(), first.focus()
  })

  // ---------- Boot ----------
  hydrate(document)
  if (small()) shell.dataset.sidebar = 'closed'
  renderProgress()
  homeInput.focus()
  // Review helpers: ?prompt=... starts a chat, ?speed=10 sets the speed.
  const qs = new URLSearchParams(location.search)
  if (qs.get('speed')) $(`#speed [data-speed="${qs.get('speed')}"]`)?.click()
  if (qs.get('prompt')) startChat(qs.get('prompt'))
  window.__proto = { S, clock, startChat, showTab }
})()
