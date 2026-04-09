(() => {
  const doc = document
  const html = doc.documentElement

  const byId = (id) => doc.getElementById(id)
  const addClass = (el, name) => el?.classList.add(name)
  const removeClass = (el, name) => el?.classList.remove(name)

  function setMenuOpenState(isOpen) {
    const toggle = byId('isToggle')
    const nav = byId('navigation')

    if (!nav) return

    toggle?.classList.toggle('open', isOpen)
    nav.classList.toggle('hidden', !isOpen)
    nav.classList.toggle('translate-x-0', isOpen)
    nav.classList.toggle('translate-x-full', !isOpen)
  }

  function toggleMenu() {
    const nav = byId('navigation')
    if (!nav) return
    setMenuOpenState(nav.classList.contains('hidden'))
  }

  function closeMenuOnAnchorClick() {
    const nav = byId('navigation')
    if (!nav) return

    nav.querySelectorAll('a[href]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.currentTarget.getAttribute('href') === 'javascript:void(0)') {
          const subMenu = event.currentTarget.nextElementSibling?.nextElementSibling
          subMenu?.classList.toggle('open')
          return
        }
        setMenuOpenState(false)
      })
    })
  }

  function handleStickyHeader() {
    const topNav = byId('topnavs')
    if (!topNav) return

    const isSticky = window.scrollY >= 50
    topNav.classList.toggle('nav-sticky', isSticky)
  }

  function handleBackToTop() {
    const button = byId('back-to-top')
    if (!button) return

    const show = window.scrollY > 500
    button.classList.toggle('hidden', !show)
    button.classList.toggle('flex', show)
  }

  function topFunction() {
    window.scrollTo({top: 0, behavior: 'smooth'})
  }

  function markActiveSidebarItem() {
    const currentPath = window.location.pathname.split('/').pop()
    if (!currentPath) return

    doc.querySelectorAll('.sidebar-nav a').forEach((link) => {
      if (link.getAttribute('href')?.includes(currentPath)) {
        addClass(link.parentElement, 'active')
      }
    })
  }

  function applyTheme(mode) {
    html.classList.remove('light', 'dark')
    html.classList.add(mode === 'dark' ? 'dark' : 'light')
    try {
      localStorage.setItem('theme', mode === 'dark' ? 'dark' : 'light')
    } catch (_) {
    }
  }

  function initThemeToggle() {
    const themeToggle = byId('theme-mode')
    const checkbox = byId('chk')

    let initialTheme = 'light'
    try {
      const storedTheme = localStorage.getItem('theme')
      if (storedTheme === 'dark' || storedTheme === 'light') {
        initialTheme = storedTheme
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark'
      }
    } catch (_) {
    }

    applyTheme(initialTheme)
    if (checkbox) checkbox.checked = initialTheme === 'dark'

    const toggleTheme = (event) => {
      event?.preventDefault?.()
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      applyTheme(next)
      if (checkbox) checkbox.checked = next === 'dark'
    }

    themeToggle?.addEventListener('click', toggleTheme)
    checkbox?.addEventListener('change', toggleTheme)
  }

  function init() {
    closeMenuOnAnchorClick()
    markActiveSidebarItem()
    initThemeToggle()
    handleStickyHeader()
    handleBackToTop()

    if (window.feather?.replace) {
      window.feather.replace()
    }

    window.addEventListener('scroll', () => {
      handleStickyHeader()
      handleBackToTop()
    }, {passive: true})
  }

  window.toggleMenu = toggleMenu
  window.topFunction = topFunction

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
