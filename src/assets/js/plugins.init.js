(() => {
  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn)
      return
    }
    fn()
  }

  const safely = (fn) => {
    try {
      fn()
    } catch (_) {
    }
  }

  const parseClasses = (value) => (value || '').split(' ').filter(Boolean)

  const initTobii = () => {
    if (typeof Tobii !== 'function') return
    // eslint-disable-next-line no-new
    new Tobii()
  }

  const initCounters = () => {
    const counters = document.querySelectorAll('.counter-value')
    if (!counters.length) return

    const speed = 2500

    counters.forEach((counter) => {
      const target = Number(counter.getAttribute('data-target')) || 0
      if (target <= 0) return

      const tick = () => {
        const current = Number(counter.innerText) || 0
        if (current >= target) {
          counter.innerText = String(target)
          return
        }

        const increment = Math.max(1, target / speed)
        counter.innerText = String(Math.min(target, Math.floor(current + increment)))
        setTimeout(tick, 1)
      }

      tick()
    })
  }

  class Typewriter {
    constructor(element, words, period) {
      this.element = element
      this.words = words
      this.period = Number.parseInt(period, 10) || 2000
      this.loop = 0
      this.text = ''
      this.isDeleting = false
      this.tick()
    }

    tick() {
      const index = this.loop % this.words.length
      const fullWord = this.words[index]

      this.text = this.isDeleting
        ? fullWord.substring(0, this.text.length - 1)
        : fullWord.substring(0, this.text.length + 1)

      this.element.innerHTML = `<span class="wrap">${this.text}</span>`

      let delay = 200 - Math.random() * 100
      if (this.isDeleting) delay /= 2

      if (!this.isDeleting && this.text === fullWord) {
        delay = this.period
        this.isDeleting = true
      } else if (this.isDeleting && this.text === '') {
        this.isDeleting = false
        this.loop += 1
        delay = 500
      }

      setTimeout(() => this.tick(), delay)
    }
  }

  const initTypewriters = () => {
    const elements = document.querySelectorAll('.typewrite')
    if (!elements.length) return

    elements.forEach((element) => {
      const raw = element.getAttribute('data-type')
      if (!raw) return

      let words
      try {
        words = JSON.parse(raw)
      } catch (_) {
        return
      }

      if (!Array.isArray(words) || !words.length) return
      // eslint-disable-next-line no-new
      new Typewriter(element, words, element.getAttribute('data-period'))
    })

    const style = document.createElement('style')
    style.textContent = '.typewrite > .wrap { border-right: 0.08em solid transparent; }'
    document.head.appendChild(style)
  }

  const initBackButton = () => {
    const button = document.querySelector('.back-button')
    if (!button) return

    button.addEventListener('click', (event) => {
      if (!document.referrer) return
      event.preventDefault()
      window.location.href = document.referrer
    })
  }

  const initRangePrice = (sliderId, amountId, updateId, multiplier) => {
    const slider = document.getElementById(sliderId)
    const amount = document.getElementById(amountId)
    const update = document.getElementById(updateId)
    if (!slider || !amount || !update) return

    const render = () => {
      const value = Number(slider.value) || 0
      amount.textContent = String(value)
      update.textContent = String((value * multiplier).toFixed(1))
    }

    render()
    slider.addEventListener('input', render)
  }

  class Accordion {
    constructor(items = [], options = {}) {
      this.items = items
      this.options = {
        alwaysOpen: false,
        activeClasses: 'bg-white dark:bg-darkSub',
        inactiveClasses: 'bg-white dark:bg-darkSub',
        onOpen: () => {
        },
        onClose: () => {
        },
        onToggle: () => {
        },
        ...options
      }
      this.init()
    }

    init() {
      this.items.forEach((item) => {
        if (item.active) this.open(item.id)
        item.triggerEl?.addEventListener('click', () => this.toggle(item.id))
      })
    }

    getItem(id) {
      return this.items.find((item) => item.id === id)
    }

    open(id) {
      const item = this.getItem(id)
      if (!item || !item.targetEl) return

      if (!this.options.alwaysOpen) {
        this.items.forEach((current) => {
          if (current === item || !current.targetEl) return
          current.triggerEl?.classList.remove(...parseClasses(this.options.activeClasses))
          current.triggerEl?.classList.add(...parseClasses(this.options.inactiveClasses))
          current.targetEl.classList.add('hidden')
          current.triggerEl?.setAttribute('aria-expanded', 'false')
          current.iconEl?.classList.remove('rotate-180')
          current.active = false
        })
      }

      item.triggerEl?.classList.add(...parseClasses(this.options.activeClasses))
      item.triggerEl?.classList.remove(...parseClasses(this.options.inactiveClasses))
      item.triggerEl?.setAttribute('aria-expanded', 'true')
      item.targetEl.classList.remove('hidden')
      item.iconEl?.classList.add('rotate-180')
      item.active = true
      this.options.onOpen(this, item)
    }

    close(id) {
      const item = this.getItem(id)
      if (!item || !item.targetEl) return

      item.triggerEl?.classList.remove(...parseClasses(this.options.activeClasses))
      item.triggerEl?.classList.add(...parseClasses(this.options.inactiveClasses))
      item.targetEl.classList.add('hidden')
      item.triggerEl?.setAttribute('aria-expanded', 'false')
      item.iconEl?.classList.remove('rotate-180')
      item.active = false
      this.options.onClose(this, item)
    }

    toggle(id) {
      const item = this.getItem(id)
      if (!item) return
      if (item.active) this.close(id)
      else this.open(id)
      this.options.onToggle(this, item)
    }
  }

  class Tabs {
    constructor(items = [], options = {}) {
      this.items = items
      this.options = {
        defaultTabId: null,
        activeClasses: 'text-white bg-primary',
        inactiveClasses: 'hover:text-primary/40 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800',
        onShow: () => {
        },
        ...options
      }
      this.activeTab = this.getTab(this.options.defaultTabId) || this.items[0] || null
      this.init()
    }

    init() {
      if (!this.items.length || !this.activeTab) return
      this.show(this.activeTab.id, true)
      this.items.forEach((tab) => {
        tab.triggerEl?.addEventListener('click', () => this.show(tab.id))
      })
    }

    getTab(id) {
      return this.items.find((item) => item.id === id)
    }

    show(id, force = false) {
      const tab = this.getTab(id)
      if (!tab || !tab.targetEl) return
      if (!force && tab === this.activeTab) return

      this.items.forEach((current) => {
        if (current === tab || !current.targetEl) return
        current.triggerEl?.classList.remove(...parseClasses(this.options.activeClasses))
        current.triggerEl?.classList.add(...parseClasses(this.options.inactiveClasses))
        current.triggerEl?.setAttribute('aria-selected', 'false')
        current.targetEl.classList.add('hidden')
      })

      tab.triggerEl?.classList.add(...parseClasses(this.options.activeClasses))
      tab.triggerEl?.classList.remove(...parseClasses(this.options.inactiveClasses))
      tab.triggerEl?.setAttribute('aria-selected', 'true')
      tab.targetEl.classList.remove('hidden')

      this.activeTab = tab
      this.options.onShow(this, tab)
    }
  }

  const initAccordions = () => {
    document.querySelectorAll('[data-accordion]').forEach((accordionEl) => {
      const items = []
      accordionEl.querySelectorAll('[data-accordion-target]').forEach((triggerEl) => {
        const targetSelector = triggerEl.getAttribute('data-accordion-target')
        const targetEl = targetSelector ? document.querySelector(targetSelector) : null
        if (!targetEl) return

        items.push({
          id: targetSelector,
          triggerEl,
          targetEl,
          iconEl: triggerEl.querySelector('[data-accordion-icon]'),
          active: triggerEl.getAttribute('aria-expanded') === 'true'
        })
      })

      if (!items.length) return

      // eslint-disable-next-line no-new
      new Accordion(items, {
        alwaysOpen: accordionEl.getAttribute('data-accordion') === 'open',
        activeClasses: accordionEl.getAttribute('data-active-classes') || 'bg-white dark:bg-darkSub',
        inactiveClasses: accordionEl.getAttribute('data-inactive-classes') || 'bg-white dark:bg-darkSub'
      })
    })
  }

  const initTabs = () => {
    document.querySelectorAll('[data-tabs-toggle]').forEach((tabsEl) => {
      const items = []
      let defaultTabId = null

      tabsEl.querySelectorAll('[role="tab"]').forEach((triggerEl) => {
        const targetSelector = triggerEl.getAttribute('data-tabs-target')
        const targetEl = targetSelector ? document.querySelector(targetSelector) : null
        if (!targetEl) return

        const id = targetSelector
        items.push({id, triggerEl, targetEl})

        if (triggerEl.getAttribute('aria-selected') === 'true') {
          defaultTabId = id
        }
      })

      if (!items.length) return

      // eslint-disable-next-line no-new
      new Tabs(items, {defaultTabId})
    })
  }

  onReady(() => {
    safely(initTobii)
    safely(initCounters)
    safely(initTypewriters)
    safely(initBackButton)
    safely(() => initRangePrice('business-price', 'busi-amt', 'busi-update', 0.05))
    safely(() => initRangePrice('professional-price', 'pro-amt', 'pro-update', 0.025))
    safely(initAccordions)
    safely(initTabs)
  })

  window.Accordion = Accordion
  window.Tabs = Tabs
})()
