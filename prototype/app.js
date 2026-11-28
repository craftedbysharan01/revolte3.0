/* Revolte chat prototype. Plain JS, no build step. Open index.html. */
;(function () {
  const { FILES, REPO_FILES, QUESTIONS, PLAN_TASKS, BUILD, DELIVERIES } = window.DATA
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  // ---------- Icons ----------
  const svg = (n, s) => {
    let x = ICONS[n] || ''
    if (x.includes('data-l=')) x = x.replace(/stroke-width="[\d.]+"/, `stroke-width="${(26 / (s || 16)).toFixed(2)}"`)
    return s ? x.replace(/width="[\d.]+" height="[\d.]+"/, `width="${s}" height="${s}"`) : x
  }
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

  // ---------- Virtual clock: the agent runs at 4x real time, so the build takes about 30 seconds ----------
  const clock = { t: 0, speed: 4, waiters: [], tickers: new Set() }
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
      region: 'us-east',
      size: 'small',
      vars: [
        { k: 'NODE_ENV', v: 'development' },
        { k: 'DATABASE_URL', v: 'postgres://sandbox:5432/webhooks' },
        { k: 'RESEND_API_KEY', v: '', secret: true, saved: true },
      ],
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
    undock()
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

  // ---------- Sidebar ----------
  $('#sbClose').addEventListener('click', () => (shell.dataset.sidebar = 'closed'))
  $('#sbOpen').addEventListener('click', () => (shell.dataset.sidebar = 'open'))

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

  // Home backdrop: the pointer carries a soft light across the dot grid.
  {
    // Lives on the whole centre column (top bar included) while the home view is showing.
    const col = $('.col')
    let raf = 0
    col.addEventListener('pointermove', (e) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = col.getBoundingClientRect()
        col.style.setProperty('--mx', e.clientX - r.left + 'px')
        col.style.setProperty('--my', e.clientY - r.top + 'px')
        col.classList.add('lit')
      })
    })
    col.addEventListener('pointerleave', () => col.classList.remove('lit'))
  }
  // Credits: Revolte's single unit of AI usage (revolte.ai/pricing). This account is on Free:
  // 20 credits a month, hard-capped, 4 already used in earlier chats. Each step of the run spends a little.
  const CREDITS = { plan: 20, earlier: 4, chat: 0 }
  function renderCredits(bump) {
    const used = CREDITS.earlier + CREDITS.chat
    $('#creditsChat').textContent = CREDITS.chat
    $('#creditsBtn em').textContent = CREDITS.chat === 1 ? 'credit' : 'credits'
    $('#cpChat').textContent = CREDITS.chat
    $('#cpMonth').textContent = used
    $('#cpBar').style.width = (CREDITS.earlier / CREDITS.plan) * 100 + '%'
    $('#cpBarChat').style.width = (Math.min(CREDITS.chat, CREDITS.plan - CREDITS.earlier) / CREDITS.plan) * 100 + '%'
    $('#credits').style.setProperty('--cp', Math.max(4, Math.min(100, (used / CREDITS.plan) * 100)))
    $('#credits').classList.toggle('warm', used >= CREDITS.plan * 0.8)
    $('#upsellUsed').textContent = used
    $('#upsellBar').style.width = Math.min(100, (used / CREDITS.plan) * 100) + '%'
    $('#upsell').classList.toggle('warm', used >= CREDITS.plan * 0.8)
    $('#creditsBtn').setAttribute('aria-label', `${CREDITS.chat} credits used in this chat, ${used} of ${CREDITS.plan} this month`)
    if (bump) {
      const b = $('#creditsBtn')
      b.classList.remove('bump')
      void b.offsetWidth
      b.classList.add('bump')
    }
  }
  function spend(n) {
    CREDITS.chat += n
    renderCredits(true)
  }
  function setCreditsPop(open) {
    $('#creditsPop').hidden = !open
    $('#creditsBtn').setAttribute('aria-expanded', open)
  }
  // Run mode: Auto runs end to end and only stops when it needs you; Manual checks in before each step.
  const MODES = [
    { id: 'auto', name: 'Auto', icon: 'f-auto', sub: 'Runs end to end, asks only if needed' },
    { id: 'manual', name: 'Manual', icon: 'f-manual', sub: 'Checks in before each step' },
  ]
  S.mode = 'auto'
  function renderModes() {
    const m = MODES.find((x) => x.id === S.mode)
    $$('[data-mode-btn]').forEach((b) => {
      $('.mode-l', b).textContent = m.name
      const i = $('i[data-i]', b)
      if (i.dataset.i !== m.icon) {
        i.dataset.i = m.icon
        i.innerHTML = ''
        hydrate(b)
        opticalIcons(b.parentElement.parentElement)
      }
    })
  }
  function modeMenu(btn, open) {
    const menu = btn.nextElementSibling
    open = open ?? menu.hidden
    if (open)
      menu.innerHTML =
        `<span class="menu-label">Run mode</span>` +
        MODES.map(
          (m) => `<button type="button" role="menuitemradio" aria-checked="${S.mode === m.id}" data-mode="${m.id}">${ic(m.icon, 14)}<span class="ag-t"><b>${m.name}</b><small>${m.sub}</small></span>${ic('check', 14, 'ag-check')}</button>`
        ).join('')
    menu.hidden = !open
    btn.setAttribute('aria-expanded', open)
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode-btn]')
    if (btn) return modeMenu(btn)
    const pick = e.target.closest('[data-mode]')
    if (pick) {
      S.mode = pick.dataset.mode
      renderModes()
      const b = pick.closest('.modepick').querySelector('[data-mode-btn]')
      modeMenu(b, false)
      return b.focus()
    }
    $$('[data-mode-btn]').forEach((b) => b.nextElementSibling.hidden || modeMenu(b, false))
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && $$('[data-mode-btn]').forEach((b) => b.nextElementSibling.hidden || modeMenu(b, false)))

  // Agent picker (home composer and the row under the reply box share one choice).
  // Icon only until an agent is picked; then the button names it: "Developer" or "QA".
  const AGENTS = [
    { id: 'developer', name: 'Developer', sub: 'Plans, writes and ships the code' },
    { id: 'qa', name: 'QA', sub: 'Tests it and reports what breaks' },
  ]
  S.agent = null
  // Once a chat starts, its agent is fixed: the reply row shows it as a plain label (or nothing if
  // no agent was picked) and the Overview pane names it. Only the home composer can change it.
  S.chatAgent = null
  function renderChatAgent() {
    const a = AGENTS.find((x) => x.id === S.chatAgent)
    const b = $('.reply-meta [data-agent-btn]')
    b.hidden = !a
    b.disabled = true
    b.classList.add('locked', 'picked')
    $('.agent-l', b).textContent = a ? a.name : ''
    b.setAttribute('aria-label', a ? `Agent for this chat: ${a.name}` : 'No agent')
    b.dataset.tip = a ? `${a.name} agent · set when the chat started` : ''
    $('#agentRow').hidden = !a
    if (a) $('#agentRowName').textContent = a.name
  }
  function renderAgents() {
    const a = AGENTS.find((x) => x.id === S.agent)
    $$('#homeComposer [data-agent-btn]').forEach((b) => {
      b.classList.toggle('picked', !!a)
      $('.agent-l', b).textContent = a ? a.name : ''
      b.setAttribute('aria-label', a ? `Agent: ${a.name}` : 'Choose agent')
      b.dataset.tip = a ? 'Change agent' : 'Choose agent'
    })
  }
  function agentMenu(btn, open) {
    const menu = btn.nextElementSibling
    $$('.agent-menu').forEach((m) => m !== menu && ((m.hidden = true), m.previousElementSibling.setAttribute('aria-expanded', 'false')))
    open = open ?? menu.hidden
    if (open)
      menu.innerHTML =
        `<span class="menu-label">Agent</span>` +
        AGENTS.map(
          (a) => `<button type="button" role="menuitemradio" aria-checked="${S.agent === a.id}" data-agent="${a.id}">${ic('f-agent', 14)}<span class="ag-t"><b>${a.name}</b><small>${a.sub}</small></span>${ic('check', 14, 'ag-check')}</button>`
        ).join('') +
        (S.agent ? `<div class="menu-sep"></div><button type="button" data-agent="">${ic('close', 14)}<span class="ag-t"><b>No agent</b></span></button>` : '')
    menu.hidden = !open
    btn.setAttribute('aria-expanded', open)
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-agent-btn]')
    if (btn) return btn.disabled ? undefined : agentMenu(btn)
    const pick = e.target.closest('[data-agent]')
    if (pick) {
      S.agent = pick.dataset.agent || null
      renderAgents()
      const b = pick.closest('.agentpick').querySelector('[data-agent-btn]')
      agentMenu(b, false)
      return b.focus()
    }
    if (!e.target.closest('.agent-menu')) $$('[data-agent-btn]').forEach((b) => b.nextElementSibling.hidden || agentMenu(b, false))
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && $$('[data-agent-btn]').forEach((b) => b.nextElementSibling.hidden || agentMenu(b, false)))

  $('#creditsBtn').addEventListener('click', () => setCreditsPop($('#creditsPop').hidden))
  document.addEventListener('click', (e) => {
    if (!$('#creditsPop').hidden && !e.composedPath().includes($('#credits'))) setCreditsPop(false)
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !$('#creditsPop').hidden && (setCreditsPop(false), $('#creditsBtn').focus()))
  renderCredits()

  const waitingEl = $('#waiting')
  const replyInput = $('#replyInput')
  // "Waiting for you" is a nudge, not a status: it only appears once the
  // user has left a question unanswered for a while (real time, not the
  // prototype clock), and any activity puts it away and restarts the wait.
  // It escalates gently while ignored: appears (20s), turns orange (40s), shimmers (60s), then hops every few seconds (80s+).
  const IDLE_NUDGE_MS = 20000
  let idleTimers = []
  function armIdleNudge() {
    idleTimers.forEach(clearTimeout)
    idleTimers = []
    waitingEl.classList.remove('on', 'warn', 'shine', 'hop')
    if (!S.awaiting) return
    const at = (ms, fn) => idleTimers.push(setTimeout(() => S.awaiting && fn(), ms))
    at(IDLE_NUDGE_MS, () => waitingEl.classList.add('on'))
    at(IDLE_NUDGE_MS * 2, () => waitingEl.classList.add('warn'))
    const hop = () => {
      waitingEl.classList.remove('hop')
      void waitingEl.offsetWidth
      waitingEl.classList.add('hop')
      at(4000, hop)
    }
    at(IDLE_NUDGE_MS * 3, () => waitingEl.classList.add('shine'))
    at(IDLE_NUDGE_MS * 4, hop)
  }
  ;['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, () => S.awaiting && armIdleNudge(), { passive: true, capture: true })
  )
  function setAwaiting(a) {
    S.awaiting = a
    armIdleNudge()
    replyInput.placeholder = a && a.placeholder ? a.placeholder : 'Reply to Revolte'
  }
  $('#reply').addEventListener('submit', (e) => {
    e.preventDefault()
    const text = replyInput.value.trim()
    if (!text) return S.awaiting && S.awaiting.onEmpty && S.awaiting.onEmpty()
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
      h(`<div class="act running">
        <button class="act-head" aria-expanded="false"><span class="act-mark"></span><span class="act-label">${esc(label)}</span><span class="act-time">0s</span>${ic('right', 12, 'act-chev')}</button>
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
  // The docked card lives outside the thread, so a new chat has to take it down explicitly.
  let undock = () => {}
  function askQuestions() {
    return new Promise((resolve) => {
      const answers = QUESTIONS.map((q) => ({ pick: 0, own: '' }))
      let idx = 0
      let advancing = 0
      // The questions dock at the bottom of the chat, right above the reply box, like a composer
      // takeover. Once answered, a compact summary is left in the thread.
      const card = h(`<div class="card questions docked" tabindex="-1"></div>`)
      undock()
      $('#reply').before(card)
      $('.chat-foot').classList.add('asking')
      undock = () => {
        clearTimeout(advancing)
        card.remove()
        $('.chat-foot').classList.remove('asking')
        document.removeEventListener('keydown', keys)
        undock = () => {}
      }
      const finish = (skipped) => {
        setAwaiting(null)
        const out = QUESTIONS.map((q, i) => (skipped && i >= idx ? q.options[0] : answers[i].own.trim() || q.options[answers[i].pick]))
        const all = skipped && idx === 0
        const d = h(`<details class="card answers">
          <summary>${ic('checkCircle')}${all ? 'Used the recommended answers' : `Answered ${QUESTIONS.length} questions`}${ic('right', 12, 'act-chev')}</summary>
          <dl>${QUESTIONS.map((q, i) => `<div><dt>${esc(q.q)}</dt><dd>${esc(out[i])}</dd></div>`).join('')}</dl>
        </details>`)
        undock()
        say(d)
        resolve({ answers: out, skipped: all })
      }
      // One click answers and moves on. The chip at the top right steps back (and forward again,
      // up to the furthest question reached) so any answer can be changed before the last one.
      let furthest = 0
      const go = (to, dir) => {
        idx = to
        furthest = Math.max(furthest, idx)
        render(dir)
      }
      const next = () => (idx < QUESTIONS.length - 1 ? go(idx + 1, 'fwd') : finish(false))
      function render(dir) {
        const q = QUESTIONS[idx]
        const a = answers[idx]
        card.innerHTML = `
          <div class="q-top">
            <span class="q-step">Question ${idx + 1} of ${QUESTIONS.length}</span>
            <span class="q-arrows">
              <button type="button" class="icon-btn sm" data-act="prev" aria-label="Previous question" data-tip="Previous question" ${idx === 0 ? 'disabled' : ''}>${ic('left', 14)}</button>
              <button type="button" class="icon-btn sm" data-act="fwd" aria-label="Next question" data-tip="Next question" ${idx >= furthest ? 'disabled' : ''}>${ic('right', 14)}</button>
            </span>
          </div>
          <p class="q-title">${esc(q.q)}</p>
          <div class="q-body ${dir ? 'swap ' + dir : ''}">
            <div class="q-opts" role="radiogroup" aria-label="${esc(q.q)}">${q.options
              .map(
                (o, i) => `<button class="opt ${!a.own && a.pick === i ? 'on' : ''}" data-i="${i}" role="radio" aria-checked="${!a.own && a.pick === i}">
                  <kbd>${i + 1}</kbd><span class="opt-t">${esc(o)}</span>${i === 0 ? `<span class="rec">${ic('star', 11)}Recommended</span>` : ''}${ic('check', 14, 'opt-check')}</button>`
              )
              .join('')}</div>
          </div>
          <div class="q-foot">
            <button class="q-link" data-act="skip">Skip all, use recommended</button>
          </div>`
        setAwaiting({
          placeholder: 'Or answer in your own words',
          onReply(text) {
            answers[idx].own = text
            next()
          },
          onEmpty: () => next(),
        })
      }
      const pick = (i) => {
        if (advancing) return
        answers[idx].pick = i
        answers[idx].own = ''
        $$('.opt', card).forEach((o) => {
          const on = +o.dataset.i === i
          o.classList.toggle('on', on)
          o.setAttribute('aria-checked', on)
        })
        // Let the choice register for a beat, then move on.
        advancing = setTimeout(() => ((advancing = 0), next()), 220)
      }
      function keys(e) {
        if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, [contenteditable]')) return
        const n = +e.key
        if (n >= 1 && n <= QUESTIONS[idx].options.length) return e.preventDefault(), pick(n - 1)
        if (e.key === 'ArrowLeft' && idx > 0) return e.preventDefault(), go(idx - 1, 'back')
        if (e.key === 'ArrowRight' && idx < furthest) return e.preventDefault(), go(idx + 1, 'fwd')
      }
      document.addEventListener('keydown', keys)
      card.addEventListener('click', (e) => {
        const opt = e.target.closest('.opt')
        if (opt) return pick(+opt.dataset.i)
        const act = e.target.closest('[data-act]')
        const step = e.target.closest('[data-step]')
        if (step) return go(+step.dataset.step, +step.dataset.step < idx ? 'back' : 'fwd')
        if (!act || act.disabled) return
        if (act.dataset.act === 'skip') finish(true)
        else if (act.dataset.act === 'prev') go(idx - 1, 'back')
        else if (act.dataset.act === 'fwd') go(idx + 1, 'fwd')
      })
      render('')
    })
  }

  // ---------- Plan ----------
  function showPlan(tasks, version) {
    return new Promise((resolve) => {
      const card = say(
        h(`<div class="card plan">
          <div class="card-head">${ic('doc')}Plan${version > 1 ? ` <em style="font-style:normal;color:var(--subtle-foreground);font-weight:400">v${version}</em>` : ''}<span class="meta">~ 2 mins</span></div>
          <ol class="plan-list${tasks.length > 3 ? ' clipped' : ''}">${tasks.map((t, i) => `<li><span class="num">${i + 1}</span>${esc(t.t)}</li>`).join('')}${
            tasks.length > 3 ? `<li class="plan-more"><button type="button" data-act="more" aria-expanded="false">View ${tasks.length - 3} more${ic('down', 12)}</button></li>` : ''
          }</ol>
          <div class="card-foot">
            <button class="btn primary" data-act="approve" data-tip="Approve plan" data-kbd="mod+enter">Approve plan</button>
            <button class="btn secondary" data-act="change">Ask for changes</button>
            <span class="grow"></span>
            <button class="linkish" data-act="view">View plan</button>
          </div>
        </div>`)
      )
      const settle = (label, result) => {
        setAwaiting(null)
        const approved = label === 'Approved'
        card.className = 'card plan compact ' + (approved ? 'approved' : 'superseded')
        card.innerHTML = `<button class="plan-row" data-act="view" data-tip="Open plan.md">${ic('doc')}<span class="plan-row-t">Plan${version > 1 ? ` v${version}` : ''}</span><span class="plan-row-m">${tasks.length} tasks · about 2 mins</span><span class="plan-row-s">${approved ? ic('check', 14) + 'Approved' : 'Revised'}</span>${ic('right', 14)}</button>`
        resolve(result)
      }
      setAwaiting({
        placeholder: 'Give feedback on the plan',
        onReply: (text) => (bubble(text), settle('Revised', { change: text })),
      })
      card.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')
        if (!act) return
        if (act.dataset.act === 'more') {
          const list = $('.plan-list', card)
          const open = list.classList.toggle('clipped') === false
          act.setAttribute('aria-expanded', open)
          act.innerHTML = (open ? 'Show less' : `View ${tasks.length - 3} more`) + ic(open ? 'up' : 'down', 12)
          return
        }
        if (act.dataset.act === 'approve') settle('Approved', { approved: true })
        else if (act.dataset.act === 'change') replyInput.focus()
        else openPlan()
      })
    })
  }

  function renderPlanDoc(answers, tasks, version) {
    const files = Object.keys(FILES)
    $('#planDoc').innerHTML = `
      <div class="doc-head"><span class="doc-name">${ic('doc', 14)}plan.md <em>v${version}</em></span><span class="grow"></span>
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
  // Progress tells the story of the run: what Revolte understood, what you decided, then the plan's own tasks.
  const STEPS = [
    ['understand', 'Understand the request', 'Reads your request and the repository'],
    ['grill', 'Answer a few questions', 'Only the ones that change the build'],
    ['plan', 'Agree on a plan', 'Its tasks become the steps below'],
    ['verify', 'Verify and preview', 'Tests, lint and a live preview'],
  ]
  let planTasks = []
  const since = {}
  const stepLi = (k, name, sub, extra = '') =>
    `<li data-stage="${k}"${extra}><span class="pg-ic">${ic('check', 12, 'pg-done')}${ic('pause', 14, 'pg-wait')}</span><span class="pg-name">${name}</span><span class="pg-state"></span><span class="pg-sub">${sub}</span></li>`
  function renderProgress() {
    charged.clear()
    planTasks = []
    for (const k in since) delete since[k]
    $('#progress').innerHTML = STEPS.map(([k, n, s]) => stepLi(k, n, s)).join('')
  }
  const STAGE_COST = { understand: 1, grill: 1, plan: 1, verify: 2 }
  const charged = new Set()
  function stage(key, state, label, sub) {
    const li = $(`#progress [data-stage="${key}"]`)
    if (!li) return
    if (state === 'done' && STAGE_COST[key] && !charged.has(key)) charged.add(key), spend(STAGE_COST[key])
    if ((state === 'now' || state === 'wait') && since[key] == null) since[key] = clock.t
    li.classList.remove('now', 'wait', 'done')
    li.classList.add(state)
    $('.pg-state', li).innerHTML =
      state === 'now' ? 'In progress' : state === 'wait' ? `<span class="needs">Needs you</span>` : state === 'done' && since[key] != null ? fmt(clock.t - since[key]) : ''
    if (sub != null) $('.pg-sub', li).innerHTML = sub
    renderChanges()
  }
  function setPlanTasks(tasks) {
    planTasks = tasks.map((t, i) => ({ ref: t, t: t.t, state: 'pending', key: 'task' + i }))
    $$('#progress .task').forEach((l) => l.remove())
    $('#progress [data-stage="plan"]').insertAdjacentHTML('afterend', planTasks.map((p, i) => stepLi(p.key, esc(p.t), '', ` class="task" style="--i:${i}"`)).join(''))
    renderChanges()
  }
  function setTask(ref, state) {
    planTasks.forEach((p) => {
      if (p.ref === ref || (ref === 'extra' && p.ref.extra)) {
        p.state = state
        stage(p.key, state)
      }
    })
  }
  $('#progress').addEventListener('click', (e) => e.target.closest('[data-open-plan]') && openPlan())
  function envState(cls, text) {
    const el = $('#envState')
    el.className = 'env-state ' + cls
    el.textContent = text
  }

  // GitHub: the repository row opens a dropdown menu; once connected, a pull request card follows the run.
  const REPOS = ['acme/webhook-monitor', 'acme/payments-api', 'acme/storefront']
  function renderRepo(open) {
    const el = $('#repo')
    el.innerHTML = `<button class="ov-row" data-repo-toggle aria-haspopup="menu" aria-expanded="${!!open}">${ic('f-github')}${
      S.repo ? `<span class="ov-name">${S.repo}</span><span class="repo-branch">main</span>` : '<span class="ov-name muted">Connect repository</span>'
    }<span class="push">${ic('down', 12, 'repo-chev')}</span></button>${
      open
        ? `<div class="menu" role="menu"><p class="menu-label">Your repositories</p>${REPOS.map(
            (r) => `<button role="menuitemradio" aria-checked="${r === S.repo}" data-repo="${r}">${ic('f-github', 14)}<span>${r}</span>${r === S.repo ? ic('check', 14, 'push') : ''}</button>`
          ).join('')}<div class="menu-sep"></div>${
            S.repo ? '<button role="menuitem" data-repo-off>Disconnect</button>' : '<button role="menuitem" data-soon="GitHub settings">Manage GitHub access</button>'
          }</div>`
        : ''
    }`
    el.classList.toggle('open', !!open)
  }
  $('#repo').addEventListener('click', (e) => {
    const pick = e.target.closest('[data-repo]')
    if (pick) {
      S.repo = pick.dataset.repo
      renderRepo(false)
      renderChanges(true)
      return toast('Repository connected')
    }
    if (e.target.closest('[data-repo-off]')) {
      S.repo = null
      renderRepo(false)
      return renderChanges()
    }
    if (e.target.closest('[data-repo-toggle]')) renderRepo(!$('#repo').classList.contains('open'))
  })
  document.addEventListener('click', (e) => {
    if ($('#repo').classList.contains('open') && !e.composedPath().includes($('#repo'))) renderRepo(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#repo').classList.contains('open')) renderRepo(false)
  })

  const SHAS = ['a3f9c1e', '7b21d04', 'e58c3a9', '1d0f6b2', '9c4e7a1', '42ab8de']
  function renderChanges(enter) {
    const el = $('#changes')
    if (!S.repo) return (el.hidden = true)
    el.hidden = false
    el.classList.toggle('enter', !!enter)
    const files = Object.values(S.files || {}).filter((f) => f.lines && f.done)
    const add = files.reduce((n, f) => n + fileStat(f, f.done)[0], 0)
    const del = files.reduce((n, f) => n + fileStat(f, f.done)[1], 0)
    const commits = planTasks.filter((p) => p.state === 'done')
    const current = planTasks.find((p) => p.state === 'now')
    const state = S.previewReady ? 'open' : S.building ? 'draft' : 'later'
    const chip = { open: '<span class="pr-chip open">Open · #412</span>', draft: '<span class="pr-chip">Draft</span>', later: '<span class="pr-chip">Not opened</span>' }[state]
    const rows = [`<li class="g-main">${ic('f-branch', 12)}<span class="g-mono">main</span></li>`, `<li class="g-branch"><span class="g-mono">revolte/webhook-dashboard</span></li>`]
    commits.forEach((p, i) => rows.push(`<li class="g-commit"><span class="g-msg">${esc(p.t)}</span><span class="g-sha">${SHAS[i % SHAS.length]}</span></li>`))
    if (current) rows.push(`<li class="g-commit next"><span class="g-msg">${esc(current.t)}</span></li>`)
    if (!commits.length && !current) rows.push('<li class="g-commit next"><span class="g-msg">Each finished task lands here as a commit</span></li>')
    rows.push(
      state === 'open'
        ? `<li class="g-pr">${ic('pr', 14)}<span><b>#412 into main</b> · ${files.length} files <span class="add">+${add}</span> <span class="del">−${del}</span></span></li>`
        : `<li class="g-pr pending">${ic('pr', 14)}<span>Opens into main once the build is verified</span></li>`
    )
    el.innerHTML = `<div class="pr-head"><span class="plabel">Pull request</span>${chip}</div><ol class="gitg">${rows.join('')}</ol>${
      state === 'open' ? `<button class="btn secondary pr-btn" data-soon="Opening GitHub">${ic('f-github', 14)}View on GitHub</button>` : ''
    }`
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
  $('#paneClose').addEventListener('click', () => (shell.dataset.pane = 'closed'))
  $('#paneOpen').addEventListener('click', () => (shell.dataset.pane = paneWidth()))

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
    const rows = S.deliveries.slice(0, 4)
    const stat = { delivered: 1284, retrying: 12, failed: 3 }
    rows.forEach((r) => r.retried && (stat.retrying++, stat.failed--))
    const [, retryPolicy, alertPolicy] = S.answers || []
    const policy = (retryPolicy || '8 attempts over 6 hours').toLowerCase()
    const alert = (alertPolicy || 'Email on-call').toLowerCase()
    const keep = page.scrollTop
    page.innerHTML = `
      <div class="site">
        <header class="s-nav" style="--i:0">
          <span class="s-logo"><i></i>Hookwatch</span>
          <nav><a>Deliveries</a><a>Alerts</a><a>Retry policy</a><a>Docs</a></nav>
          <a class="s-btn dark sm">Open dashboard</a>
        </header>
        <section class="s-hero">
          <span class="s-pill" style="--i:1"><b></b>99.7% delivered in the last 24 hours</span>
          <h1 style="--i:2">Every webhook lands. <em>Or you hear about it.</em></h1>
          <p style="--i:3">Hookwatch tracks each delivery, retries the failures with exponential backoff and tells on-call when the last attempt fails.</p>
          <div class="s-cta" style="--i:4"><a class="s-btn dark">View deliveries</a><a class="s-btn">Read the retry policy</a></div>
        </section>
        <section class="s-panel" style="--i:5">
          <div class="s-panel-head"><b>Deliveries</b><span>Last 24 hours</span><span class="s-live"><i></i>Live</span></div>
          <div class="s-stats">
            <div><span>Delivered</span><b>${stat.delivered.toLocaleString('en-US')}</b></div>
            <div><span>Retrying</span><b>${stat.retrying}</b></div>
            <div><span>Failed</span><b>${stat.failed}</b></div>
          </div>
          <table class="s-table">
            <thead><tr><th>Endpoint</th><th class="s-ev">Event</th><th>Attempts</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows
              .map(
                (r, i) => `<tr><td>${r.endpoint}</td><td class="s-ev">${r.event}</td><td>${r.attempts}${r.attempts > 1 || r.status !== 'delivered' ? ' of 8' : ''}</td>
                <td><span class="badge ${r.status}">${r.status[0].toUpperCase() + r.status.slice(1)}</span></td>
                <td>${r.status === 'failed' ? `<button class="retry-btn" data-row="${i}">Retry</button>` : ''}</td></tr>`
              )
              .join('')}</tbody>
          </table>
        </section>
        <section class="s-features">
          <div style="--i:7"><span class="s-ic">${svg('refresh', 18)}</span><b>Retries that back off</b><p>Failed deliveries retry on their own: ${esc(policy)}, with jitter so they never land together.</p></div>
          <div style="--i:8"><span class="s-ic">${svg('danger', 18)}</span><b>On-call hears first</b><p>When the last attempt fails, Hookwatch will ${esc(alert)} with the event and the last response.</p></div>
          <div style="--i:9"><span class="s-ic">${svg('clock', 18)}</span><b>A full delivery log</b><p>Every endpoint, event and attempt from the last 24 hours, with one-click retry.</p></div>
        </section>
        <footer class="s-foot"><span class="s-logo"><i></i>Hookwatch</span><span>Internal tool · Acme Corp</span></footer>
      </div>`
    page.scrollTop = keep
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
    renderChanges()
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
    stage('understand', 'now')
    g = group('Understanding your request')
    await quick(g, 'Reading your request', 2000)
    await quick(g, 'Exploring the repository &nbsp;14 files', 5000)
    await quick(g, 'Checking how deliveries are stored', 3500)
    worked += g.finish('Understood the request')
    steps += g.count
    stage('understand', 'done', '', 'Read your request and 14 files')
    stage('grill', 'wait', '', 'Three answers change what gets built')
    msg('Three details change what gets built. The recommended answers are selected, so you can skip straight through.')
    const { answers, skipped } = await askQuestions()
    if (run.cancelled) throw CANCEL
    S.answers = answers
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
      stage('plan', 'wait', '', 'Waiting for your approval')
      const res = await showPlan(tasks, version)
      if (run.cancelled) throw CANCEL
      if (res.approved) break
      version++
      stage('plan', 'now', '', 'Revising with your feedback')
      g = group('Revising the plan')
      await quick(g, 'Working your feedback into the tasks', 4500)
      worked += g.finish('Revised the plan')
      steps += g.count
      const note = res.change.length > 64 ? res.change.slice(0, 61) + '…' : res.change
      tasks = [...tasks.filter((t) => !t.extra).slice(0, -1), { t: 'Your change: ' + note, area: 'Change', effort: 'S', after: '3', extra: true }, tasks[tasks.length - 1]]
    }
    if (S.planOpen) closePlan()
    stage('plan', 'done', '', `Approved · ${tasks.length} tasks · <button class="pg-link" data-open-plan>View plan</button>`)
    setPlanTasks(tasks)

    // -- Build (about two minutes at 1×)
    S.building = true
    S.code.follow = true
    g = group(BUILD[0].label)
    const rows = []
    // Which plan task each build step belongs to (index into PLAN_TASKS).
    const STEP_TASK = [null, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3]
    const TASK_LAST = {}
    STEP_TASK.forEach((k, n) => k != null && (TASK_LAST[k] = n))
    for (let i = 0; i < BUILD.length; i++) {
      const s = BUILD[i]
      g.setLabel(s.label)
      stage(s.stage, 'now')
      if (s.stage !== 'tasks') stage('tasks', 'done', '', `${Object.keys(FILES).length} file changes`)
      if (s.stage === 'verify') stage('build', 'done', '', `${Object.keys(FILES).length} files changed`)
      if (STEP_TASK[i] != null && planTasks.find((p) => p.ref === PLAN_TASKS[STEP_TASK[i]]).state !== 'done') setTask(PLAN_TASKS[STEP_TASK[i]], 'now')
      rows[i] = g.step(stepHtml(s, 'live'))
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
      if (i % 2) spend(1)
      const k = STEP_TASK[i]
      if (k != null && TASK_LAST[k] === i) {
        setTask(PLAN_TASKS[k], 'done')
        if (k === 2) setTask('extra', 'done')
      }
    }
    planTasks.forEach((p) => p.state !== 'done' && setTask(p.ref, 'done'))
    steps += g.count
    worked += g.finish('Worked for')
    S.building = false
    stage('verify', 'done', '', '24 tests pass · preview is ready')
    $('#codeStatus').textContent = ''
    $('.ptab[data-tab="code"]').classList.remove('live')
    S.code.follow = true
    renderEditor()
    $('.act-time', g.el).textContent = `${fmt(worked)} · ${steps} steps`

    msg('Built and verified in the sandbox. 24 tests pass, lint and Prettier are clean. The preview is open on the right.')
    say(`<div class="msg-actions">${[['copy', 'Copy'], ['refresh', 'Retry'], ['share', 'Share'], ['dots', 'More']]
      .map(([n, l]) => `<button class="icon-btn" data-soon="This action" aria-label="${l}" data-tip="${l}">${ic(n, 14)}</button>`)
      .join('')}</div>`)
    revealPreview()
    await sleep(1800, run)
    showWorkflowCard()
  }

  // After the preview: offer to turn this chat into a workflow. Reuses the home page's animation.
  function showWorkflowCard() {
    const card = h(`<div class="wf-card">
      <div class="wf-canvas">
        <div class="glow glow-blue"></div><div class="glow glow-warm"></div>
        <span class="wf-label">Workflow studio</span>
        <button class="icon-btn wf-x" data-wf-close aria-label="Dismiss" data-tip="Dismiss">${ic('close', 14)}</button>
        <div class="wf-stage" aria-hidden="true"></div>
      </div>
      <div class="wf-body">
        <p class="wf-title"><span class="w1">Chat,</span> <span class="w2">build,</span> <span class="w3">test,</span> <span class="w4">PR</span></p>
        <div class="wf-actions">
          <button class="btn ghost" data-wf-close>Not now</button>
          <button class="btn primary" data-soon="Workflows">${ic('f-workflow', 14)}Try workflow</button>
        </div>
      </div>
    </div>`)
    const stage = $('.wf-stage', card)
    const flow = $('.promo-visual .flow').cloneNode(true)
    stage.appendChild(flow)
    // Scale the whole flow to fit the card at any width, so no node is ever cut off.
    const fit = () => {
      const k = Math.min(0.56, (stage.clientWidth - 24) / 1208, (stage.clientHeight - 8) / 192)
      if (k > 0) flow.style.setProperty('--k', k.toFixed(4))
    }
    new ResizeObserver(fit).observe(stage)
    card.addEventListener('click', (e) => {
      if (!e.target.closest('[data-wf-close]')) return
      card.classList.add('gone')
      card.addEventListener('animationend', () => card.remove(), { once: true })
    })
    atBottom = true
    say(card)
  }

  function startChat(prompt) {
    if (S.run) S.run.cancelled = true
    clock.tickers.clear()
    const run = (S.run = { cancelled: false })
    Object.assign(S, { tab: 'overview', immersive: false, building: false, previewReady: false, planOpen: false, awaiting: null })
    S.chatAgent = S.agent
    renderChatAgent()
    S.deliveries = DELIVERIES.map((d) => ({ ...d }))
    const first = prompt.split(/[.\n]/)[0].trim() || prompt
    const title = first.length > 40 ? first.slice(0, 38).trimEnd() + '…' : first
    $('#chatTitle span').textContent = title[0].toUpperCase() + title.slice(1)
    $$('#recents .mine').forEach((b) => b.remove())
    $('#recents').prepend(h(`<button class="nav recent on mine">${esc(title[0].toUpperCase() + title.slice(1))}</button>`))

    threadInner.innerHTML = ''
    undock()
    atBottom = true
    setAwaiting(null)
    CREDITS.earlier += CREDITS.chat
    CREDITS.chat = 0
    setCreditsPop(false)
    renderCredits()
    resetFiles()
    renderTree()
    renderProgress()
    envState('', 'Not started')
    $('#planDoc').classList.remove('on')
    $('#codeTotal').innerHTML = ''
    $('#codeStatus').textContent = ''
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
  const REGIONS = { 'us-east': 'US East', 'us-west': 'US West', eu: 'Europe', ap: 'Asia Pacific' }
  const SIZES = { small: '2 vCPU · 4 GB', medium: '4 vCPU · 8 GB', large: '8 vCPU · 16 GB' }
  const NET = { limited: 'Only listed domains', open: 'Any domain', none: 'No network' }
  const envMeta = (e) => `${REGIONS[e.region]} · ${SIZES[e.size].split(' · ')[0]}`

  function kvRow(item, i) {
    const locked = item.secret
    return `<div class="kv-row" data-i="${i}">
      <input class="input mono" data-f="k" placeholder="NAME" value="${esc(item.k)}" aria-label="Name" spellcheck="false" />
      <input class="input mono" data-f="v" type="${locked ? 'password' : 'text'}" placeholder="${locked && item.saved ? 'Saved secret · type to replace' : 'Value'}" value="${esc(item.v)}" aria-label="Value" spellcheck="false" autocomplete="off" />
      <button type="button" class="icon-btn lock ${locked ? 'on' : ''}" data-lock aria-pressed="${!!locked}" aria-label="${locked ? 'Secret. Click to store as plain text' : 'Plain text. Click to store as a secret'}" title="${locked ? 'Secret' : 'Make secret'}">${ic('lock', 14)}</button>
      <button type="button" class="icon-btn" data-remove aria-label="Remove">${ic('trash', 14)}</button>
    </div>`
  }
  function summaries() {
    const lines = draft.script.split('\n').map((l) => l.trim()).filter(Boolean)
    $('#sumScript').textContent = lines.length ? lines.join(' · ') : 'None'
    const sec = draft.vars.filter((v) => v.k && v.secret).length
    const vars = draft.vars.filter((v) => v.k && !v.secret).length
    $('#sumVars').textContent = `${vars} variable${vars === 1 ? '' : 's'} · ${sec} secret${sec === 1 ? '' : 's'}`
    $('#sumNet').textContent = draft.net === 'limited' ? `${draft.domains.length} domain${draft.domains.length === 1 ? '' : 's'}` : NET[draft.net]
  }
  function renderVars() {
    $('#envVars').innerHTML = draft.vars.length ? draft.vars.map(kvRow).join('') : '<p class="kv-empty">No variables yet.</p>'
    summaries()
  }
  function renderNet() {
    $('#envNet').value = draft.net
    $('#netLimited').hidden = draft.net !== 'limited'
    $('#envRegistries').checked = draft.registries
    $$('#envDomains .domain').forEach((d) => d.remove())
    $('#domainInput').insertAdjacentHTML(
      'beforebegin',
      draft.domains.map((d, i) => `<span class="domain">${esc(d)}<button type="button" data-domain="${i}" aria-label="Remove ${esc(d)}">${svg('close', 10)}</button></span>`).join('')
    )
    summaries()
  }
  const SIZE_NOTE = { small: 'Good for most apps', medium: 'Faster builds and tests', large: 'Heavy builds and monorepos' }
  function renderSize() {
    $$('#envSizes [data-size]').forEach((b) => b.setAttribute('aria-checked', b.dataset.size === draft.size))
    const cpu = +SIZES[draft.size].split(' ')[0]
    $$('#envCores i').forEach((c, i) => {
      c.style.transitionDelay = i * 30 + 'ms'
      c.classList.toggle('on', i < cpu)
    })
    $('#envSpec').textContent = SIZES[draft.size]
    $('#envSizeNote').textContent = SIZE_NOTE[draft.size]
  }
  const rselBtn = $('#envRegion [data-rsel]')
  const rselMenu = $('#envRegion .rsel-menu')
  function setRegionMenu(open) {
    rselMenu.hidden = !open
    rselBtn.setAttribute('aria-expanded', open)
  }
  function renderRegion() {
    $$('#envRegion [data-region]').forEach((b) => {
      const on = b.dataset.region === draft.region
      b.setAttribute('aria-selected', on)
      if (on) {
        $('#rselName').textContent = $('b', b).textContent
        $('#rselSub').textContent = $('span', b).textContent
      }
    })
  }
  document.addEventListener('click', (e) => {
    if (!rselMenu.hidden && !e.composedPath().includes($('#envRegion'))) setRegionMenu(false)
  })
  function renderEnv() {
    setRegionMenu(false)
    $('#envNameInput').value = draft.name
    renderRegion()
    $('#envScript').value = draft.script
    $$('#envForm details').forEach((d) => (d.open = false))
    renderSize()
    renderVars()
    renderNet()
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
  // Environment picker in the home composer: choose where the next chat runs.
  const ENVS = [
    S.env,
    { ...JSON.parse(JSON.stringify(S.env)), name: 'Staging', region: 'us-west', size: 'medium' },
    { ...JSON.parse(JSON.stringify(S.env)), name: 'EU data', region: 'eu', size: 'small', net: 'none' },
  ]
  const epBtn = $('#envPickBtn')
  const epMenu = $('#envPickMenu')
  function applyEnv() {
    $('#envName').textContent = S.env.name
    $('#envPickName').textContent = S.env.name
  }
  function renderEnvPick() {
    epMenu.innerHTML =
      `<p class="menu-label">Environment</p>` +
      ENVS.map(
        (e, i) => `<button type="button" role="menuitemradio" aria-checked="${e === S.env}" data-env="${i}">${ic('f-environments', 14)}<span class="ep-t"><b>${esc(e.name)}</b><small>${envMeta(e)}</small></span>${ic('check', 14, 'ep-check')}</button>`
      ).join('') +
      `<div class="menu-sep"></div><button type="button" class="ep-set" data-env-settings>${ic('f-gear', 14)}Environment settings</button>`
  }
  function setEnvPick(open) {
    if (open) renderEnvPick()
    epMenu.hidden = !open
    epBtn.setAttribute('aria-expanded', open)
  }
  epBtn.addEventListener('click', () => setEnvPick(epMenu.hidden))
  epMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-env]')
    if (item) {
      S.env = ENVS[+item.dataset.env]
      applyEnv()
      setEnvPick(false)
      return epBtn.focus()
    }
    if (e.target.closest('[data-env-settings]')) setEnvPick(false), openEnv(epBtn)
  })
  document.addEventListener('click', (e) => {
    if (!epMenu.hidden && !e.composedPath().includes($('#envPick'))) setEnvPick(false)
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !epMenu.hidden && (setEnvPick(false), epBtn.focus()))

  $('#envOpen').addEventListener('click', (e) => openEnv(e.currentTarget))
  $('#navEnv').addEventListener('click', (e) => openEnv(e.currentTarget))
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return closeEnv()
    if (e.target.closest('[data-add]')) {
      draft.vars.push({ k: '', v: '', secret: false })
      renderVars()
      const rows = $$('#envVars .kv-row')
      return $('input', rows[rows.length - 1]).focus()
    }
    if (e.target.closest('[data-rsel]')) return setRegionMenu(rselMenu.hidden)
    const size = e.target.closest('[data-size]')
    if (size) return (draft.size = size.dataset.size), renderSize()
    const region = e.target.closest('[data-region]')
    if (region) return (draft.region = region.dataset.region), renderRegion(), setRegionMenu(false), rselBtn.focus()
    const row = e.target.closest('.kv-row')
    if (row && e.target.closest('[data-remove]')) return draft.vars.splice(+row.dataset.i, 1), renderVars()
    if (row && e.target.closest('[data-lock]')) {
      const item = draft.vars[+row.dataset.i]
      item.secret = !item.secret
      if (!item.secret) item.saved = false
      return renderVars()
    }
    const dom = e.target.closest('[data-domain]')
    if (dom) return draft.domains.splice(+dom.dataset.domain, 1), renderNet()
  })
  modal.addEventListener('input', (e) => {
    const row = e.target.closest('.kv-row')
    if (row) {
      const item = draft.vars[+row.dataset.i]
      if (e.target.dataset.f === 'k') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
      item[e.target.dataset.f] = e.target.value
      if (e.target.dataset.f === 'v') item.saved = false
      return summaries()
    }
    if (e.target.id === 'envNameInput') draft.name = e.target.value
    else if (e.target.id === 'envScript') (draft.script = e.target.value), summaries()
    else if (e.target.id === 'envRegistries') draft.registries = e.target.checked
  })
  modal.addEventListener('change', (e) => {
    if (e.target.id === 'envNet') (draft.net = e.target.value), renderNet()
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
    draft.vars = draft.vars.filter((v) => v.k).map((v) => (v.secret ? { k: v.k, v: '', secret: true, saved: true } : v))
    const restart = (draft.size !== S.env.size || draft.region !== S.env.region) && $('#envState').classList.contains('up')
    ENVS[ENVS.indexOf(S.env)] = draft
    S.env = draft
    applyEnv()
    closeEnv()
    if (!restart) return toast('Environment saved')
    envState('boot', 'Restarting')
    toast(`Restarting the sandbox on ${SIZES[S.env.size]} in ${REGIONS[S.env.region]}`)
    setTimeout(() => envState('up', 'Running'), 2600)
  })
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return
    if (e.key === 'Escape') return rselMenu.hidden ? closeEnv() : (setRegionMenu(false), rselBtn.focus())
    if (e.key !== 'Tab') return
    const items = $$('button, input, textarea, select, summary', $('#envForm')).filter((el) => el.offsetParent)
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) e.preventDefault(), last.focus()
    else if (!e.shiftKey && document.activeElement === last) e.preventDefault(), first.focus()
  })

  // ======================================================================
  // Tooltips and keyboard shortcuts
  // ======================================================================
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  const keyLabel = (combo) =>
    combo
      .split('+')
      .map((k) => ({ mod: isMac ? '⌘' : 'Ctrl', shift: isMac ? '⇧' : 'Shift', enter: '↵' })[k] || k.toUpperCase())
      .join(isMac ? '' : '+')
  $$('kbd[data-k]').forEach((k) => (k.textContent = keyLabel(k.dataset.k)))
  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.setAttribute('role', 'tooltip')
  document.body.appendChild(tip)
  let tipTimer
  let tipLast = -1e9
  let tipFor = null
  function showTip(el) {
    if (!el.isConnected) return
    tipFor = el
    tip.innerHTML = esc(el.dataset.tip) + (el.dataset.kbd ? `<kbd class="k">${keyLabel(el.dataset.kbd)}</kbd>` : '')
    tip.classList.toggle('instant', performance.now() - tipLast < 600)
    const r = el.getBoundingClientRect()
    const x = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))
    const y = r.bottom + 6 + tip.offsetHeight > innerHeight - 8 ? r.top - tip.offsetHeight - 6 : r.bottom + 6
    tip.style.left = x + 'px'
    tip.style.top = y + 'px'
    tip.classList.add('on')
  }
  function hideTip() {
    clearTimeout(tipTimer)
    if (tip.classList.contains('on')) tipLast = performance.now()
    tip.classList.remove('on')
    tipFor = null
  }
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tip]')
      if (el === tipFor) return
      hideTip()
      if (el) tipTimer = setTimeout(() => showTip(el), performance.now() - tipLast < 600 ? 0 : 450)
    })
    document.addEventListener('pointerdown', hideTip)
  }
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tip]')
    if (el && el.matches(':focus-visible')) showTip(el)
  })
  document.addEventListener('focusout', hideTip)

  document.addEventListener('keydown', (e) => {
    if (!(isMac ? e.metaKey : e.ctrlKey) || modal.classList.contains('open')) return
    const k = e.key.toLowerCase()
    const inChat = shell.dataset.view === 'chat'
    if (k === 'b') shell.dataset.sidebar = shell.dataset.sidebar === 'closed' ? 'open' : 'closed'
    else if (k === 'o' && e.shiftKey) goHome()
    else if (k === 'k') toast('Search is not part of this prototype.')
    else if (k === '.' && inChat) shell.dataset.pane = shell.dataset.pane === 'closed' ? paneWidth() : 'closed'
    else if (/^[1-5]$/.test(k) && inChat) $$('.ptab')[+k - 1].click()
    else if (k === 'enter' && $('.plan:not(.compact) [data-act=approve]')) $('.plan:not(.compact) [data-act=approve]').click()
    else return
    e.preventDefault()
    hideTip()
  })

  // ---------- Optical icon sizing ----------
  // Icons in the composers are drawn to the same visual weight, whatever their shape. Each glyph is
  // measured once off-screen; its box is then scaled so the glyph's area matches (geometric mean of
  // width and height = OPTICAL px), so a squat icon like the bot isn't drawn smaller than a tall cube.
  // A cap keeps long, flat glyphs from getting too wide. svg() keeps the stroke weight constant.
  const OPTICAL = 11.5
  const OPTICAL_MAX = 13.5
  // Hand-tuned nudges for shapes that still read light after area matching (the bot's open head).
  const OPTICAL_ADJ = { 'f-agent': 1.07 }
  const glyphCache = {}
  const meter = document.createElement('div')
  meter.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden'
  document.body.appendChild(meter)
  function glyphBox(n) {
    if (!glyphCache[n]) {
      meter.innerHTML = svg(n, 24)
      const g = meter.firstChild.getBBox()
      glyphCache[n] = g.width && g.height ? [g.width, g.height] : [24, 24]
    }
    return glyphCache[n]
  }
  function opticalIcons(root) {
    $$('.composer-bar i[data-i], .reply i[data-i], .reply-meta i[data-i]', root).forEach((i) => {
      const n = i.dataset.i
      if (n === 'down' || n === 'f-claude' || !ICONS[n]) return
      const [w, h] = glyphBox(n)
      let size = (OPTICAL * 24) / Math.sqrt(w * h)
      size = Math.min(size, (OPTICAL_MAX * 24) / Math.max(w, h)) * (OPTICAL_ADJ[n] || 1)
      i.innerHTML = svg(n, Math.round(size * 2) / 2)
    })
  }

  // ---------- Filled icons on hover ----------
  // Outline icons turn solid while their control is hovered. The first time an icon is hovered,
  // its closed shapes are marked to fill (.fz). Detail lines that sit inside a filled shape
  // (the bot's eyes, the gear's hub) are marked .fk: on hover they are cut out of the fill with an
  // SVG mask, so the solid icon keeps its detail instead of turning into a blob.
  let fillMaskId = 0
  const NS = 'http://www.w3.org/2000/svg'
  const isClosed = (k) => ['rect', 'circle', 'ellipse', 'polygon'].includes(k.tagName) || (k.tagName === 'path' && /z\s*$/i.test(k.getAttribute('d') || ''))
  const within = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5
  function prepFill(el) {
    if (el.dataset.fp) return
    el.dataset.fp = '1'
    const sw = el.getAttribute('stroke-width') || '2'
    const fills = []
    ;[...el.children].forEach((k) => {
      if (k.tagName === 'defs') return
      let bb
      try { bb = k.getBBox() } catch (_) { return }
      const host = fills.find((f) => within(bb, f.bb))
      if (host) {
        k.classList.add('fk')
        host.knocks.push(k)
      } else if (isClosed(k)) {
        k.classList.add('fz')
        fills.push({ el: k, bb, knocks: [] })
      }
    })
    fills.forEach((f) => {
      if (!f.knocks.length) return
      const id = 'fm' + ++fillMaskId
      const defs = document.createElementNS(NS, 'defs')
      const mask = document.createElementNS(NS, 'mask')
      mask.setAttribute('id', id)
      mask.setAttribute('maskUnits', 'userSpaceOnUse')
      ;[['x', -4], ['y', -4], ['width', 32], ['height', 32]].forEach(([k, v]) => mask.setAttribute(k, v))
      const base = document.createElementNS(NS, 'rect')
      ;[['x', -4], ['y', -4], ['width', 32], ['height', 32], ['fill', 'white']].forEach(([k, v]) => base.setAttribute(k, v))
      mask.appendChild(base)
      f.knocks.forEach((k) => {
        const c = k.cloneNode(true)
        c.removeAttribute('class')
        c.setAttribute('stroke', 'black')
        c.setAttribute('stroke-width', sw)
        c.setAttribute('stroke-linecap', 'round')
        c.setAttribute('stroke-linejoin', 'round')
        c.setAttribute('fill', isClosed(k) ? 'black' : 'none')
        mask.appendChild(c)
      })
      defs.appendChild(mask)
      el.insertBefore(defs, el.firstChild)
      f.el.setAttribute('mask', `url(#${id})`)
    })
  }
  const FILL_HOST = 'button, a, summary, [role="tab"], .trow, .ov-row'
  document.addEventListener('pointerover', (e) => {
    const host = e.target.closest && e.target.closest(FILL_HOST)
    if (host) $$('svg[data-l]', host).forEach(prepFill)
  })

  // Dark only: clear any theme a previous version of the prototype remembered.
  try { localStorage.removeItem('revolte-theme') } catch (_) {}

  // ---------- Boot ----------
  hydrate(document)
  opticalIcons(document)
  renderRepo(false)
  if (small()) shell.dataset.sidebar = 'closed'
  renderProgress()
  homeInput.focus()
  // Review helpers: ?prompt=... starts a chat, ?speed=10 sets the speed.
  const qs = new URLSearchParams(location.search)
  if (+qs.get('speed') > 0) clock.speed = +qs.get('speed')
  if (qs.get('prompt')) startChat(qs.get('prompt'))
  window.__proto = { S, clock, startChat, showTab }
})()
