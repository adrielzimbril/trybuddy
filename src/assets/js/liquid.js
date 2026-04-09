'use strict'

// [LIQUID CORE] Shared DOM references and helpers used by all Liquid plugins.
window.liquidElements = $ => {
    window.$liquidWindow = $(window)
    window.$liquidHtml = $('html')
    window.$liquidBody = $('body')
    window.$liquidContents = $('main')
    window.$liquidMainFooter = $('footer')
    window.$liquidSections = $liquidContents.add($liquidMainFooter).find('.redo-section')
    window.liquidBodyBg = window.$liquidBody.css('backgroundColor')
    window.liquidContentsBg = window.$liquidContents.css('backgroundColor')
    window.liquidMainFooterBg = window.$liquidMainFooter.css('backgroundColor')
}
liquidElements(jQuery)
window.liquidCheckedFonts = []
window.liquidIsMobile = function () {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 0 || navigator.platform === 'iPad'
}

window.liquidWindowWidth = function () {
    return window.innerWidth
}

// Debounce utility exposed on window because multiple legacy plugins depend on it.
window.liquidDebounce = function (func, wait, immediate) {
    let timeout = null
    let result
    const debounced = function () {
        const context = this
        const args = arguments
        const callNow = immediate && !timeout
        clearTimeout(timeout)
        timeout = setTimeout(function () {
            timeout = null
            if (!immediate) {
                result = func.apply(context, args)
            }
        }, wait)
        if (callNow) {
            result = func.apply(context, args)
        }
        return result
    }
    debounced.cancel = function () {
        clearTimeout(timeout)
        timeout = null
    }
    return debounced
}
window.liquidSlugify = function (str) {
    return String(str).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
}

// [LIQUID] Transition Delay plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidTransitionDelay'
    const DEFAULT_OPTIONS = {
        elements: null,
        startDelay: 0,
        delayBetween: 250,
        random: false,
        reverse: false,
        delayType: 'transition'
    }

    class TransitionDelayPlugin {
        constructor(element, options) {
            this.element = element
            this.$element = $(element)
            this.options = $.extend({}, DEFAULT_OPTIONS, options)
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            const splitTextEls = this.$element.find('[data-split-text]').get()
            const promises = []
            if (this.element.hasAttribute('data-split-text')) {
                splitTextEls.push(this.element)
            }
            splitTextEls.forEach(el => {
                const elData = $(el).data('plugin_liquidSplitText')
                if (elData) {
                    promises.push(elData.splitDonePromise)
                }
            })
            if (promises.length) {
                Promise.all(promises).then(this.init.bind(this))
            } else {
                this.init()
            }
        }

        init() {
            this.addDelays()
        }

        addDelays() {
            const {
                elements,
                delayBetween,
                startDelay,
                delayType,
                reverse
            } = this.options
            if (elements) {
                const $elements = !reverse ? $(elements, this.element) : $(elements, this.element).get().reverse()
                $.each($elements, (i, element) => {
                    const delay = i * delayBetween + startDelay
                    $(element).css({
                        [`-webkit-${delayType}-delay`]: `${delay}ms`,
                        [`${delayType}-delay`]: `${delay}ms`
                    })
                })
            }
        }
    }

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const pluginOptions = $(this).data('delay-options') || options
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new TransitionDelayPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery)
// [LIQUID INIT] Liquid Transition Delay
jQuery(document).ready(function ($) {
    $('[data-transition-delay=true]').liquidTransitionDelay()
});
// [LIQUID] Split Text plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidSplitText'
    const DEFAULT_OPTIONS = {
        type: 'words',
        forceApply: false
    }

    class SplitTextPlugin {
        constructor(element, options) {
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            this.options = {
                ...DEFAULT_OPTIONS,
                ...options
            }
            this.splittedTextList = {
                lines: [],
                words: [],
                chars: []
            }
            this.splitTextInstance = null
            this.element = element
            this.$element = $(element)
            this.prevWindowWidth = window.innerWidth
            this.fontInfo = {}
            this.splitDonePromise = new Promise(resolve => {
                this.$element.on('lqdsplittext', resolve.bind(this, this))
            })
            // Backward compatibility for older plugin calls that still reference this typo.
            this.splitDonePormise = this.splitDonePromise
            if (!this.options.forceApply) {
                new IntersectionObserver(([entry], observer) => {
                    if (entry.isIntersecting) {
                        observer.disconnect()
                        this.init()
                    }
                }, {
                    rootMargin: '20%'
                }).observe(this.element)
            } else {
                this.init()
            }
        }

        async init() {
            await this._measure()
            await this._onFontsLoad()
            this._windowResize()
        }

        _measure() {
            return fastdomPromised.measure(() => {
                const styles = getComputedStyle(this.element)
                this.fontInfo.elementFontFamily = styles.fontFamily.replace(/"/g, '').replace(/'/g, '').split(',')[0]
                this.fontInfo.elementFontWeight = styles.fontWeight
                this.fontInfo.elementFontStyle = styles.fontStyle
                this.fontInfo.fontFamilySlug = window.liquidSlugify(this.fontInfo.elementFontFamily)
            })
        }

        _onFontsLoad() {
            return fastdomPromised.measure(() => {
                if (window.liquidCheckedFonts.find(ff => ff === this.fontInfo.fontFamilySlug)) {
                    return this._doSplit()
                }
                const font = new FontFaceObserver(this.fontInfo.elementFontFamily, {
                    weight: this.fontInfo.elementFontWeight,
                    style: this.fontInfo.elementFontStyle
                })
                return font.load().finally(() => {
                    window.liquidCheckedFonts.push(this.fontInfo.fontFamilySlug)
                    this._doSplit()
                })
            })
        }

        getSplitTypeArray() {
            const {
                type
            } = this.options
            return type.split(',').map(item => item.replace(' ', ''))
        }

        async _doSplit() {
            await this._split()
            await this._unitsOp()
            await this._onSplittingDone()
        }

        _split() {
            const splitType = this.getSplitTypeArray()
            const fancyHeadingInner = this.element.classList.contains('ld-fh-txt') && this.element.querySelector('.ld-fh-txt-inner') != null
            const el = fancyHeadingInner ? this.element.querySelector('.ld-fh-txt-inner') : this.element
            let splittedText
            return fastdomPromised.mutate(() => {
                splittedText = new SplitText(el, {
                    type: splitType,
                    charsClass: 'split-unit lqd-chars',
                    linesClass: 'split-unit lqd-lines',
                    wordsClass: 'split-unit lqd-words'
                })
                splitType.forEach(type => {
                    splittedText[type].forEach(element => {
                        this.splittedTextList[type].push(element)
                    })
                })
                this.element.classList.add('split-text-applied')
                this.splitTextInstance = splittedText
            })
        }

        _unitsOp() {
            return fastdomPromised.mutate(() => {
                for (const [splitType, splittedTextArray] of Object.entries(this.splittedTextList)) {
                    if (splittedTextArray && splittedTextArray.length > 0) {
                        splittedTextArray.forEach((splitElement, i) => {
                            splitElement.style.setProperty(`--${splitType}-index`, i)
                            splitElement.style.setProperty(`--${splitType}-last-index`, splittedTextArray.length - 1 - i)
                            $(splitElement).wrapInner(`<span class="split-inner" />`)
                        })
                    }
                }
            })
        }

        _onSplittingDone() {
            return fastdomPromised.mutate(() => {
                this.element.dispatchEvent(new CustomEvent('lqdsplittext'))
            })
        }

        _windowResize() {
            $(window).on('resize.lqdSplitText', this._onWindowResize.bind(this))
        }

        _onWindowResize() {
            if (this.prevWindowWidth === window.innerWidth) return
            if (this.splitTextInstance) {
                this.splitTextInstance.revert()
                this.element.classList.remove('split-text-applied')
            }
            this._onAfterWindowResize()
            this.prevWindowWidth = window.innerWidth
        }

        _onAfterWindowResize() {
            this._doSplit()
            this._onSplittingDone()
            this.$element.find('.split-unit').addClass('lqd-unit-animation-done')
        }

        destroy() {
            $(window).off('resize.lqdSplitText')
        }
    }

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const pluginOptions = {
                ...$(this).data('split-options'),
                ...options
            }
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new SplitTextPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery)
// [LIQUID INIT] Split Text
jQuery(document).ready(function ($) {
    const $elements = $('[data-split-text=true]').filter((i, el) => {
        const $el = $(el)
        const isCustomAnimation = el.hasAttribute('data-custom-animations')
        const hasCustomAnimationParent = $el.closest('[data-custom-animations]').length
        const hasAccordionParent = $el.closest('.accordion-content').length
        const hasTabParent = $el.closest('.lqd-tabs-pane').length
        const webglSlideshowParent = $el.closest('[data-lqd-webgl-slideshow]').length
        return !isCustomAnimation && !hasCustomAnimationParent && !hasAccordionParent && !hasTabParent && !webglSlideshowParent
    })
    $elements.liquidSplitText()
});

// [LIQUID] Custom Animations plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidCustomAnimations'
    const DEFAULT_OPTIONS = {
        delay: 160,
        startDelay: 0,
        direction: 'forward',
        duration: 1600,
        ease: 'power4.out',
        animationTarget: 'this',
        addPerspective: true,
        perspectiveVal: 1400,
        initValues: {
            x: 0,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 1,
            scaleY: 1,
            skewX: 0,
            skewY: 0,
            opacity: 1,
            transformOriginX: 50,
            transformOriginY: 50,
            transformOriginZ: '0px'
        },
        animations: {
            transformOriginX: 50,
            transformOriginY: 50,
            transformOriginZ: '0px'
        },
        randomizeInitValues: false,
        randomizeTargets: false,
        clearProps: 'transform,opacity,transform-origin'
    }

    class CustomAnimationsPlugin {
        constructor(element, options) {
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            this.options = {
                ...DEFAULT_OPTIONS,
                ...options
            }
            this.options.duration = this.options.duration / 1000
            this.options.offDuration = this.options.offDuration / 1000
            this.options.offDelay = this.options.offDelay / 1000
            this.options.delay = this.options.delay / 1000
            this.options.startDelay = this.options.startDelay / 1000
            this.element = element
            this.$element = $(element)
            this.animationTargets = []
            this.animationsTimeline = null
            this.animationsStarted = false
            this.needPerspective = this.options.addPerspective && this._needPerspective()
            this.animationsInitiatedPromise = new Promise(resolve => {
                this.$element.on('lqdanimationsinitiated', resolve.bind(this, this))
            })
            this.animationsDonePromise = new Promise(resolve => {
                this.$element.on('lqdanimationsdone', resolve.bind(this, this))
            })
            new IntersectionObserver(([entry], observer) => {
                if (entry.isIntersecting) {
                    observer.disconnect()
                    this._build()
                }
            }, {
                rootMargin: '8%'
            }).observe(this.element)
        }

        _build() {
            const promises = []
            const $splitTextEls = this.$element.find('[data-split-text]')
            if (this.element.hasAttribute('data-split-text')) {
                $splitTextEls.push(this.element)
            }
            if ($splitTextEls.length) {
                $splitTextEls.each((i, el) => {
                    const $el = $(el)
                    $el.liquidSplitText({
                        forceApply: true
                    })
                    const prom = $el.data('plugin_liquidSplitText')
                    prom && promises.push(prom.splitDonePromise)
                })
            }
            if (promises.length > 0) {
                Promise.all(promises).then(() => {
                    this._init()
                })
            } else {
                this._init()
            }
        }

        _init() {
            this._getAnimationTargets()
            this._createTimeline()
            this._initValues()
            this._runAnimations()
        }

        _getAnimationTargets() {
            const {
                animationTarget
            } = this.options
            let targets = null
            switch (animationTarget) {
                case 'this':
                    targets = this.element
                    break
                case 'all-childs':
                    targets = this._getChildElments()
                    break
                default:
                    targets = this.element.querySelectorAll(animationTarget)
                    break
            }
            this.animationTargets = Array.from(targets)
        }

        _getChildElments() {
            let $childs = this.$element.children()
            return this._getInnerChildElements($childs)
        }

        _getInnerChildElements(elements) {
            const elementsArray = []
            let $elements = $(elements).map((i, element) => {
                const $element = $(element)
                return $element.not('style, .lqd-exclude-parent-ca').get()
            })
            $.each($elements, (i, element) => {
                const $element = $(element)
                if (element.hasAttribute('data-custom-animations')) {
                    return elementsArray.push(element)
                }
                if (element.querySelector('[data-custom-animations]')) {
                    return element.querySelectorAll('[data-custom-animations]').forEach(el => {
                        elementsArray.push(el)
                    })
                }
                if ($element.find('[data-split-text]').length || element.hasAttribute('data-split-text')) {
                    if (element.classList.contains('btn')) {
                        return elementsArray.push($element[0])
                    } else {
                        return $.each($element.find('.split-inner'), (i, splitInner) => {
                            const $innerSplitInner = $(splitInner).find('.split-inner')
                            if ($innerSplitInner.length) {
                                elementsArray.push($innerSplitInner[0])
                            } else {
                                elementsArray.push(splitInner)
                            }
                        })
                    }
                }
                if (!element.hasAttribute('data-split-text') && element.tagName !== 'STYLE') {
                    return elementsArray.push($element[0])
                }
            })
            return elementsArray
        }

        _needPerspective() {
            const initValues = this.options.initValues
            const valuesNeedPerspective = ['z', 'rotationX', 'rotationY']
            let needPerspective = false
            for (let prop in initValues) {
                for (let i = 0; i <= valuesNeedPerspective.length - 1; i++) {
                    const val = valuesNeedPerspective[i]
                    if (prop === val) {
                        needPerspective = true
                        break
                    }
                }
            }
            return needPerspective
        }

        _generateRandomValues(valuesObject) {
            const obj = {
                ...valuesObject
            }
            for (const ky in valuesObject) {
                if (ky.search('transformOrigin') < 0 && ky.search('opacity') < 0) {
                    obj[ky] = () => gsap.utils.random(0, valuesObject[ky])
                }
            }
            return obj
        }

        _createTimeline() {
            const {
                ease,
                duration,
                clearProps
            } = this.options
            this.animationsTimeline = gsap.timeline({
                defaults: {
                    duration,
                    ease,
                    clearProps
                },
                onComplete: this._onTimelineAnimationComplete.bind(this)
            })
        }

        _initValues() {
            const {
                options
            } = this
            const {
                randomizeInitValues,
                initValues
            } = options
            const $animationTargets = $(this.animationTargets)
            const initProps = !randomizeInitValues ? initValues : this._generateRandomValues(initValues)
            $animationTargets.css({
                transition: 'none',
                transitionDelay: 0
            }).addClass('will-change')
            if (this.needPerspective) {
                $animationTargets.parent().parent().addClass('perspective')
                $animationTargets.each((i, animTarget) => {
                    const $animTarget = $(animTarget)
                    if (!$animTarget.hasClass('lqd-imggrp-single')) {
                        $animTarget.parent().addClass('transform-style-3d')
                    }
                })
            }
            gsap.set(this.animationTargets, {
                ...initProps
            })
            this.element.classList.add('ca-initvalues-applied')
            this.$element.trigger('lqdanimationsinitiated', this)
        }

        async _runAnimations() {
            const {
                delay,
                startDelay,
                animations,
                direction
            } = this.options
            const stagger = {
                from: direction,
                each: delay
            }
            if (direction === 'forward') {
                stagger['from'] = 'start'
            } else if (direction === 'backward') {
                stagger['from'] = 'end'
            }
            this.animationsTimeline.to(this.animationTargets, {
                ...animations,
                stagger,
                delay: startDelay,
                onStart: () => {
                    this.animationsStarted = true
                },
                onComplete: this._onUnitsAnimationsComplete,
                onCompleteParams: [this.animationTargets]
            })
        }

        _onTimelineAnimationComplete() {
            if (this.needPerspective) {
                $(this.animationTargets).parent().parent().removeClass('perspective')
                $(this.animationTargets).parent().removeClass('transform-style-3d')
            }
            this.$element.addClass('lqd-animations-done')
            this.$element.trigger('lqdanimationsdone', this)
        }

        _onUnitsAnimationsComplete(animationTargets) {
            animationTargets.forEach(element => {
                element.style.transition = ''
                element.style.transitionDelay = ''
                element.classList.remove('will-change')
                if (element.classList.contains('split-inner')) {
                    element.parentElement.classList.add('lqd-unit-animation-done')
                } else {
                    element.classList.add('lqd-unit-animation-done')
                }
            })
        }

        destroy() {
            this.element.classList.remove('ca-initvalues-applied', 'lqd-animations-done', 'transform-style-3d')
            this.animationTargets.forEach(target => {
                if (!target.vars) {
                    target.classList.remove('will-change')
                    if (target.classList.contains('split-inner')) {
                        target.parentElement.classList.remove('lqd-unit-animation-done')
                    } else {
                        target.classList.remove('lqd-unit-animation-done')
                    }
                    gsap.set(target, {
                        clearProps: 'all'
                    })
                } else {
                    this.animationsTimeline.killTweensOf(target)
                }
            })
            if (this.animationsTimeline) {
                this.animationsTimeline.kill()
                this.animationsTimeline.clear()
            }
            $.data(this.element, 'plugin_' + pluginName, null)
        }
    }

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const $this = $(this)
            const plugin = `plugin_${pluginName}`
            const pluginOptions = {
                ...$this.data('ca-options'),
                ...options
            }
            let {
                initValues,
                animations
            } = pluginOptions

            function handleTransformOrigins(opts) {
                if (!opts) return
                const {
                    transformOriginX,
                    transformOriginY,
                    transformOriginZ
                } = opts
                if (transformOriginX && typeof transformOriginX === 'number') {
                    opts.transformOriginX = transformOriginX + '%'
                }
                if (transformOriginY && typeof transformOriginY === 'number') {
                    opts.transformOriginY = transformOriginY + '%'
                }
                if (transformOriginZ && typeof transformOriginZ === 'number') {
                    opts.transformOriginZ = transformOriginZ + '%'
                }
                if (transformOriginX && transformOriginY && transformOriginZ) {
                    opts.transformOrigin = `${opts.transformOriginX} ${opts.transformOriginY} ${opts.transformOriginZ}`
                    delete opts.transformOriginX
                    delete opts.transformOriginY
                    delete opts.transformOriginZ
                }
                return opts
            }

            initValues = handleTransformOrigins(initValues)
            animations = handleTransformOrigins(animations)
            if (!$.data(this, plugin)) {
                $.data(this, `plugin_${pluginName}`, new CustomAnimationsPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery);
// [LIQUID] Text Rotator plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidTextRotator'
    const DEFAULT_OPTIONS = {
        delay: 2,
        duration: 0.8,
        easing: 'power4.inOut',
        animationType: 'slide',
        marquee: false
    }

    class TextRotatorPlugin {
        constructor(element, options) {
            this.element = element
            this.$element = $(element)
            this.options = $.extend({}, DEFAULT_OPTIONS, options)
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            this.activeKeywordIndex = 0
            this.nextKeywordIndex = 1
            this.isFirstIteration = true
            this.basicAnimationTimeline = null
            this.basicAnimationsResetTimeout = null
            this.$keywordsContainer = null
            this.keywordsContainer = null
            this.$keywords = null
            this.keywordsLength = 0
            this.keywordsDimensions = []
            this.slideInTimeout = null
            this.slideOutTimeout = null
            this.prevWindowWidth = window.innerWidth
            this.build()
        }

        async init() {
            await this._measure()
            await this._onFontsLoad()
        }

        _measure() {
            return fastdomPromised.measure(() => {
                const styles = getComputedStyle(this.element)
                this.fontInfo.elementFontFamily = styles.fontFamily.replace(/"/g, '').replace(/'/g, '').split(',')[0]
                this.fontInfo.elementFontWeight = styles.fontWeight
                this.fontInfo.elementFontStyle = styles.fontStyle
                this.fontInfo.fontFamilySlug = window.liquidSlugify(this.fontInfo.elementFontFamily)
            })
        }

        _onFontsLoad() {
            return fastdomPromised.measure(() => {
                if (window.liquidCheckedFonts.find(ff => ff === this.fontInfo.fontFamilySlug)) {
                    return this.build()
                }
                const font = new FontFaceObserver(this.fontInfo.elementFontFamily, {
                    weight: this.fontInfo.elementFontWeight,
                    style: this.fontInfo.elementFontStyle
                })
                font.load().finally(() => {
                    window.liquidCheckedFonts.push(this.fontInfo.fontFamilySlug)
                    this.build()
                })
            })
        }

        build() {
            const promises = []
            const $customAnimationParent = this.$element.closest('[data-custom-animations]')
            const $customAnimationChild = this.$element.children('[data-custom-animations]')
            const $splitTextChild = this.$element.children('[data-split-text]')
            if (this.element.hasAttribute('data-split-text')) {
                const data = this.$element.data('plugin_liquidSplitText')
                data && promises.push(data.splitDonePromise)
            }
            if ($splitTextChild.length) {
                const data = $splitTextChild.data('plugin_liquidSplitText')
                data && promises.push(data.splitDonePromise)
            }
            if ($customAnimationParent.length) {
                const data = $customAnimationParent.data('plugin_liquidCustomAnimations')
                data && promises.push(data.animationsDonePromise)
            }
            if ($customAnimationChild.length) {
                const data = $customAnimationChild.data('plugin_liquidCustomAnimations')
                data && promises.push(data.animationsDonePromise)
            }
            if (this.element.hasAttribute('data-custom-animations')) {
                const data = this.$element.data('plugin_liquidCustomAnimations')
                data && promises.push(data.animationsDonePromise)
            }
            if (promises.length) {
                Promise.all(promises).finally(() => {
                    this.init()
                })
            } else {
                this.init()
            }
        }

        async init() {
            this._handleWindowResize = liquidDebounce(this._handleWindowResize.bind(this), 350)
            this.$keywordsContainer = $('.txt-rotate-keywords', this.element)
            if (!this.$keywordsContainer.length) {
                return
            }

            this.keywordsContainer = this.$keywordsContainer[0]
            this.keywordsInner = this.keywordsContainer.querySelector('.txt-rotate-keywords-inner')
            this.$keywords = $('.txt-rotate-keyword', this.$keywordsContainer)
            this.$keywords.attr('class', 'txt-rotate-keyword').eq(0).addClass('active')
            this.keywordsLength = this.$keywords.length - 1
            this.keywordsDimensions = await this.getKeywordsDimensions()
            this.setContainerWidth(0)
            this.initAnimations()
            this._windowResize()
            this.$element.addClass('text-rotator-activated')
        }

        async getKeywordsDimensions() {
            const promises = []
            this.$keywords.each((i, keyword) => {
                const promise = new Promise(resolve => {
                    new IntersectionObserver(([entry], observer) => {
                        observer.disconnect()
                        const {
                            boundingClientRect: {
                                width,
                                height
                            }
                        } = entry
                        resolve({
                            width,
                            height
                        })
                    }).observe(keyword)
                })
                promises.push(promise)
            })
            return await Promise.all(promises)
        }

        updateActiveIndex() {
            this.activeKeywordIndex = this.activeKeywordIndex + 1 > this.keywordsLength ? 0 : this.activeKeywordIndex + 1
        }

        updateNextIndex() {
            this.nextKeywordIndex = this.nextKeywordIndex + 1 > this.keywordsLength ? 0 : this.nextKeywordIndex + 1
        }

        setActiveClass() {
            this.$keywords.removeClass('active')
            this.$keywords.eq(this.activeKeywordIndex).addClass('active')
        }

        setNextClass() {
            this.$keywords.removeClass('is-next')
            this.$keywords.eq(this.nextKeywordIndex).addClass('is-next')
        }

        setContainerWidth(index) {
            const keywordContainer = this.$keywordsContainer[0]
            if (this.options.animationType === 'list') {
                return keywordContainer.style.width = `${Math.max(...this.keywordsDimensions.map(dim => parseInt(dim.width, 10)))}px`
            }
            keywordContainer.style.width = `${this.keywordsDimensions[index].width}px`
        }

        slideInNextKeyword() {
            const $nextKeyword = this.$keywords.eq(this.nextKeywordIndex)
            const delay = this.isFirstIteration ? this.options.delay / 2 : this.options.delay
            this.slideInTimeout = setTimeout(() => {
                this.setContainerWidth(this.nextKeywordIndex)
                $nextKeyword.removeClass('lqd-keyword-slide-out').addClass('lqd-keyword-slide-in')
                this.isFirstIteration = false
                this.updateNextIndex()
                this.setNextClass()
                this.slideOutAciveKeyword()
                clearTimeout(this.slideInTimeout)
            }, delay * 1000)
        }

        slideOutAciveKeyword() {
            const $activeKeyword = this.$keywords.eq(this.activeKeywordIndex)
            const delay = this.isFirstIteration ? this.options.delay / 2 : this.options.delay
            $activeKeyword.removeClass('lqd-keyword-slide-in').addClass('lqd-keyword-slide-out')
            this.updateActiveIndex()
            this.setActiveClass()
            this.slideOutTimeout = setTimeout(() => {
                this.slideInNextKeyword()
                clearTimeout(this.slideOutTimeout)
            }, delay * 1000)
        }

        buildBaiscAnimation() {
            this.$element.addClass('txt-rotator-basic')
            this.basicAnimationTimeline = gsap.timeline({
                easing: 'power2.inOut',
                onStart: () => {
                    this.isFirstIteration = false
                    if (this.basicAnimationsResetTimeout) {
                        clearTimeout(this.basicAnimationsResetTimeout)
                    }
                    this.setContainerWidth(this.nextKeywordIndex)
                },
                onComplete: () => {
                    this.updateActiveIndex()
                    this.updateNextIndex()
                    this.setActiveClass()
                    this.setNextClass()
                    this.basicAnimationsResetTimeout = setTimeout(() => this.basicAnimationTimeline && this.basicAnimationTimeline.restart(), this.options.delay * 1000)
                }
            })
            this.$keywords.each((i, keyword) => {
                this.basicAnimationTimeline.to(keyword, {
                    duration: 0.125,
                    opacity: 1,
                    onStart: () => {
                        const $keyword = $(keyword)
                        this.$keywords.not($keyword).removeClass('active')
                        $keyword.addClass('active')
                    }
                })
            })
        }

        buildListAnimation() {
            const duration = 2
            const visibleWords = parseInt(getComputedStyle(this.keywordsContainer).getPropertyValue('--visible-words'), 10)
            const totalHeight = this.keywordsDimensions.map(dim => dim.height).reduce((prevVal, newVal) => prevVal + newVal, 0)
            const listHeight = this.keywordsDimensions.slice(0, visibleWords).map(dim => dim.height).reduce((prevVal, newVal) => prevVal + newVal, 0)
            const totalKeywords = this.$keywords.length
            const timer = gsap.delayedCall(this.options.delay, animateTo.bind(this))
            let currentKeyword = 1
            let nextKeyword = currentKeyword + 1
            let offset = 0
            let wrapping = false
            const mainTimeline = gsap.timeline({
                defaults: {
                    repeat: -1,
                    duration,
                    ease: 'none'
                },
                paused: true
            })
            this.keywordsInnerClone = this.keywordsInner.cloneNode(true)
            this.keywordsInnerClone.classList.add('txt-rotate-keywords-inner-clone', 'lqd-overlay', 'flex-column')
            this.keywordsContainer.append(this.keywordsInnerClone)
            this.keywordsContainer.style.height = `${listHeight}px`
            this.keywordsContainer.style.overflow = `hidden`
            this.$keywords.add($(this.keywordsInnerClone).children()).each((i, keyword) => {
                i = i % totalKeywords
                const keywordHeight = this.keywordsDimensions[i].height
                const wrap = gsap.utils.wrap(keywordHeight * -1, totalHeight - keywordHeight)
                gsap.set(keyword, {
                    position: 'absolute',
                    y: offset
                })
                mainTimeline.to(keyword, {
                    y: `-=${totalHeight}`,
                    modifiers: {
                        y: gsap.utils.unitize(wrap)
                    }
                }, 0).add(`keyword-${i + 1}`, gsap.utils.mapRange(0, totalKeywords, 0, duration)(i))
                offset += keywordHeight
            })
            const slideKeywordsInner = () => {
                gsap.set([this.keywordsInner, this.keywordsInnerClone], {
                    '--current-keyword-height': `${this.keywordsDimensions[currentKeyword - 1].height / 2 * -1}px`
                })
            }
            slideKeywordsInner()
            const scrubTimeline = (from, to) => {
                if (wrapping) {
                    return new gsap.timeline().add(mainTimeline.tweenFromTo(from, duration, {
                        duration: this.options.duration,
                        ease: this.options.easing
                    })).add(mainTimeline.tweenFromTo(0, to, {
                        duration: this.options.duration,
                        ease: this.options.easing,
                        immediateRender: false
                    }))
                }
                return mainTimeline.tweenFromTo(from, to, {
                    duration: this.options.duration,
                    ease: this.options.easing
                })
            }

            function animateTo() {
                timer && timer.restart(true)
                currentKeyword === totalKeywords ? wrapping = true : wrapping = false
                if (!wrapping) {
                    scrubTimeline(`keyword-${currentKeyword}`, `keyword-${nextKeyword}`)
                } else {
                    scrubTimeline(`keyword-${totalKeywords}`, `keyword-${1}`)
                }
                slideKeywordsInner()
                currentKeyword = currentKeyword >= totalKeywords ? 1 : currentKeyword + 1
                nextKeyword = currentKeyword === totalKeywords ? 1 : currentKeyword + 1
            }

            animateTo()
        }

        initAnimations() {
            const {
                animationType
            } = this.options
            switch (animationType) {
                case 'basic':
                    this.buildBaiscAnimation()
                    break
                case 'list':
                    this.buildListAnimation()
                    break
                default:
                    this.slideInNextKeyword()
            }
        }

        _windowResize() {
            $(window).on('resize.lqdTextRotator', this._handleWindowResize.bind(this))
        }

        _handleWindowResize() {
            if (this.prevWindowWidth === window.innerWidth) return
            gsap.killTweensOf(this.$keywordsContainer[0])
            this.keywordsInner && gsap.killTweensOf(this.keywordsInner)
            this.$keywords.each((i, keyword) => {
                gsap.killTweensOf(keyword)
            })
            if (this.keywordsInnerClone) {
                gsap.killTweensOf(this.keywordsInnerClone)
                $(this.keywordsInnerClone).children().each((i, keyword) => {
                    gsap.killTweensOf(keyword)
                })
            }
            this.destroy()
            this._onWindowResize()
            this.prevWindowWidth = window.innerWidth
        }

        _onWindowResize() {
            this.activeKeywordIndex = 0
            this.nextKeywordIndex = 1
            this.isFirstIteration = true
            this.basicAnimationTimeline = null
            this.basicAnimationsResetTimeout = null
            this.slideInTimeout && clearTimeout(this.slideInTimeout)
            this.slideOutTimeout && clearTimeout(this.slideOutTimeout)
            this.build()
        }

        destroy() {
            $(window).off('resize.lqdTextRotator')
            this.keywordsInnerClone && this.keywordsInnerClone.remove()
        }
    }

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const pluginOptions = {
                ...$(this).data('text-rotator-options'),
                ...options
            }
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new TextRotatorPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery)
// [LIQUID INIT] Text Rotator
jQuery(document).ready(function ($) {
    $('[data-text-rotator=true]').liquidTextRotator()
});
// [LIQUID] Parallax plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidParallax'
    const DEFAULT_OPTIONS = {
        start: 'top bottom',
        end: 'bottom top',
        ease: 'linear',
        scrub: 0.55,
        parallaxBG: false,
        scaleBG: true,
        overflowHidden: false,
        startTrigger: null,
        parallaxTargets: null,
        skipWillChange: false
    }
    let defaultParallaxFrom = {}
    let defaultParallaxTo = {}

    class ParallaxPlugin {
        constructor(element, options, parallaxFrom, parallaxTo) {
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            this.options = {
                ...DEFAULT_OPTIONS,
                ...options
            }
            this.element = element
            this.$element = $(element)
            this.parallaxFromOptions = {
                ...defaultParallaxFrom,
                ...parallaxFrom
            }
            this.parallaxToOptions = {
                ...defaultParallaxTo,
                ...parallaxTo
            }
            this.ST = null
            this.parallaxTimeline = null
            this.parallaxElements = []
            this.isRowBg = this.element.getAttribute('data-row-bg')
            this.rect = {}
            this.bgImg = null
            this.sentinel = null
            this.parallaxFigure = null
            this.parallaxMarkupExists = this.element.classList.contains('lqd-parallax-markup-exists')
            const promises = []
            if (this.$element.hasClass('lqd-css-sticky') && this.$element.data('plugin_liquidStickyRow')) {
                const data = this.$element.data('plugin_liquidStickyRow')
                const promise = data.rowStickyInitPromise
                promise && promises.push(promise)
            }
            if (this.element.hasAttribute('data-split-text')) {
                this.$element.liquidSplitText({
                    forceApply: true
                })
                const prom = this.$element.data('plugin_liquidSplitText')
                prom && promises.push(prom.splitDonePromise)
            }
            if (promises.length > 0) {
                Promise.all(promises).then(this.build.bind(this))
            } else {
                this.build()
            }
        }

        async build() {
            await this.handleSentinel()
            await this.buildParallaxMarkups()
            this.parallaxElements = this.getParallaxElements()
            new IntersectionObserver(([entry], observer) => {
                if (entry.isIntersecting) {
                    observer.disconnect()
                    this.init()
                }
            }, {
                rootMargin: '50%'
            }).observe(this.element)
        }

        getParallaxElements() {
            if (this.options.parallaxTargets) {
                return [...this.element.querySelectorAll(this.options.parallaxTargets)]
            } else if (this.element.classList.contains('vc_column_container')) {
                return [this.element.querySelector('.vc_column-inner')]
            } else if (this.options.parallaxBG) {
                return [this.parallaxFigure]
            } else {
                return [this.element]
            }
        }

        measure() {
            return new Promise(resolve => {
                new IntersectionObserver(([entry], observer) => {
                    observer.disconnect()
                    const {
                        boundingClientRect
                    } = entry
                    this.rect.width = boundingClientRect.width
                    this.rect.height = boundingClientRect.height
                    this.rect.top = boundingClientRect.top + window.scrollY
                    this.rect.left = boundingClientRect.left
                    resolve()
                }).observe(this.element)
            })
        }

        getBgInfo() {
            return fastdomPromised.measure(() => {
                if (!this.bgImg) {
                    if (this.isRowBg) {
                        return this.bgImg = `url(${this.isRowBg})`
                    }
                    const styles = getComputedStyle(this.element)
                    this.bgImg = styles.backgroundImage
                }
            })
        }

        async handleSentinel() {
            this.onWindowResize = liquidDebounce(this.onWindowResize, 500)
            await this.createSentinel()
            this.handleResize()
        }

        createSentinel() {
            return fastdomPromised.mutate(() => {
                this.sentinel = document.createElement('div')
                this.sentinel.setAttribute('class', 'lqd-parallax-sentinel pointer-events-none pos-abs z-index--1 invisible absolute -z-1')
                document.body.appendChild(this.sentinel)
            })
        }

        positionSentinel() {
            return fastdomPromised.mutate(() => {
                this.sentinel.style.width = `${this.rect.width}px`
                this.sentinel.style.height = `${this.rect.height}px`
                this.sentinel.style.top = `${this.rect.top}px`
                this.sentinel.style.left = `${this.rect.left}px`
            })
        }

        buildParallaxMarkups() {
            return new Promise(async resolve => {
                if (!this.options.parallaxBG) {
                    this.initParallax()
                    resolve()
                } else {
                    await this.getBgInfo()
                    this.initParallaxBG()
                    this.element.classList.add('lqd-parallax-bg')
                    resolve()
                }
            })
        }

        initParallax() {
            const {
                overflowHidden
            } = this.options
            if (!this.element.classList.contains('vc_column_container') && !this.element.classList.contains('ld-fancy-heading') && (overflowHidden || this.options.forceWrap)) {
                const overflow = overflowHidden ? 'overflow-hidden' : ''
                const wrapper = document.createElement('div')
                wrapper.setAttribute('class', `ld-parallax-wrap ${overflow}`)
                this.element.parentNode.insertBefore(wrapper, this.element)
                wrapper.appendChild(this.element)
            }
        }

        initParallaxBG() {
            const isSlideshowBg = this.element.hasAttribute('data-slideshow-bg')
            const videoBg = this.element.querySelector(':scope > .lqd-vbg-wrap')
            const slideshowBgPlugin = this.$element.data('plugin_liquidSlideshowBG')
            const rowBgPlugin = this.$element.data('plugin_liquidRowBG')
            if ((!isSlideshowBg && !this.isRowBg || this.isRowBg && !rowBgPlugin || isSlideshowBg && !slideshowBgPlugin) && !videoBg) {
                if (!this.parallaxMarkupExists) {
                    this.createParallaxBgMarkup()
                }
                this.parallaxFigure = this.element.querySelector('.lqd-parallax-figure')
                this.updateParallaxBgOptions()
                this.setParallaxBgImg()
            }
            if (isSlideshowBg) {
                return slideshowBgPlugin.slideshowBgInitPromise.then(slideshowPlugin => {
                    const slideshowInner = slideshowPlugin.slideshowInner
                    this.updateParallaxBgOptions()
                    return slideshowInner
                })
            }
            if (this.isRowBg) {
                return rowBgPlugin.rowBgInitPromise.then(rowBgPlugin => {
                    const {
                        rowBg
                    } = rowBgPlugin
                    this.updateParallaxBgOptions()
                    return rowBg
                })
            }
            if (videoBg) {
                this.updateParallaxBgOptions()
                return videoBg.children
            }
        }

        createParallaxBgMarkup() {
            const parallaxContainer = document.createElement('div')
            parallaxContainer.setAttribute('class', 'lqd-parallax-container lqd-overlay overflow-hidden')
            parallaxContainer.setAttribute('style', 'border-radius: inherit; background-size: inherit; background-attachment: inherit; background-repeat: inherit; background-position: inherit;')
            const parallaxFigure = document.createElement('figure')
            parallaxFigure.setAttribute('class', 'lqd-parallax-figure lqd-overlay')
            parallaxFigure.setAttribute('style', 'border-radius: inherit; background-size: inherit; background-attachment: inherit; background-repeat: inherit; background-position: inherit;')
            parallaxContainer.appendChild(parallaxFigure)
            this.$element.prepend(parallaxContainer)
        }

        setParallaxBgImg() {
            if (this.bgImg && this.bgImg !== 'none' && this.options.parallaxBG) {
                this.parallaxFigure.style.backgroundImage = this.bgImg
                this.element.classList.add('bg-none')
            }
        }

        updateParallaxBgOptions() {
            if (typeof this.parallaxFromOptions.yPercent === typeof undefined) {
                this.parallaxFromOptions.yPercent = -15
            }
            if (typeof this.parallaxToOptions.yPercent === typeof undefined) {
                this.parallaxToOptions.yPercent = 0
            }
        }

        init() {
            fastdomPromised.measure(async () => {
                await this.measure()
                await this.positionSentinel()
            }).then(() => {
                fastdomPromised.mutate(() => {
                    const isParallaxBg = this.options.parallaxBG
                    let {
                        start,
                        end,
                        scrub,
                        ease,
                        startTrigger
                    } = this.options
                    let trigger = this.sentinel
                    if (startTrigger) {
                        if (typeof startTrigger === 'string') {
                            trigger = document.querySelector(startTrigger)
                        } else {
                            trigger = startTrigger
                        }
                    }
                    this.parallaxTimeline = gsap.timeline()
                    this.parallaxTimeline.fromTo(this.parallaxElements, {
                        ...this.parallaxFromOptions
                    }, {
                        ease,
                        ...this.parallaxToOptions
                    })
                    this.ST = ScrollTrigger.create({
                        animation: this.parallaxTimeline,
                        trigger,
                        start: () => start,
                        end: () => end,
                        scrub: isParallaxBg ? 0.35 : scrub,
                        onRefresh: () => {
                            start = this.options.start
                            end = this.options.end
                            this.ST.update()
                        },
                        onUpdate: () => {
                            gsap.set(this.parallaxElements, {
                                transition: 'none'
                            })
                        },
                        onScrubComplete: () => {
                            gsap.set(this.parallaxElements, {
                                transition: ''
                            })
                        }
                    })
                    !this.options.skipWillChange && this.addWillChange()
                    if (isParallaxBg) {
                        gsap.to(this.parallaxElements, {
                            opacity: 1
                        })
                    }
                    this.element.dispatchEvent(new CustomEvent('lqd-parallax-initiated'))
                })
            })
        }

        addWillChange() {
            const willChangeProps = ['transform']
            if (this.parallaxFromOptions.opacity && this.parallaxToOptions.opacity && this.parallaxFromOptions.opacity !== this.parallaxToOptions.opacity) {
                willChangeProps.push('opacity')
            }
            const props = willChangeProps.join(', ')
            new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    this.element.style.willChange = props
                } else {
                    this.element.style.willChange = 'auto'
                }
            }).observe(this.sentinel)
        }

        handleResize() {
            $(window).on('resize.lqdParallax', this.onWindowResize.bind(this))
        }

        async onWindowResize() {
            await this.measure()
            this.positionSentinel()
        }

        destroy() {
            if (this.sentinel) {
                this.sentinel.remove()
            }
            if (this.parallaxTimeline) {
                gsap.killTweensOf(this.parallaxTimeline)
                this.parallaxTimeline.scrollTrigger.kill()
                this.parallaxTimeline.kill()
                gsap.set(this.parallaxElements, {
                    clearProps: 'all'
                })
                this.parallaxTimeline.clear()
            }
            $.data(this.element, 'plugin_' + pluginName, null)
            $(window).off('resize.lqdParallax')
        }
    }

    $.fn[pluginName] = function (options, fromOpts, toOpts) {
        return this.each(function () {
            const pluginOptions = {
                disableOnMobile: true,
                ...$(this).data('parallax-options'),
                ...options
            }
            const parallaxFrom = {
                ...$(this).data('parallax-from'),
                ...fromOpts
            }
            const parallaxTo = {
                ...$(this).data('parallax-to'),
                ...toOpts
            }
            if (!$.data(this, 'plugin_' + pluginName)) {
                if (pluginOptions.disableOnMobile && liquidIsMobile()) return
                $.data(this, 'plugin_' + pluginName, new ParallaxPlugin(this, pluginOptions, parallaxFrom, parallaxTo))
            }
        })
    }
})(jQuery)
// [LIQUID INIT] Parallax
jQuery(document).ready(function ($) {
    $('[data-parallax=true]').liquidParallax()
});
// [LIQUID] Flickity Carousel
(function ($) {
    'use strict'

    const pluginName = 'liquidCarousel'
    const DEFAULT_OPTIONS = {
        bypassCheck: false,
        carouselEl: null,
        contain: false,
        imagesLoaded: true,
        percentPosition: true,
        prevNextButtons: false,
        pageDots: true,
        adaptiveHeight: false,
        cellAlign: 'left',
        groupCells: true,
        dragThreshold: 0,
        wrapAround: false,
        autoplay: false,
        fullwidthSide: false,
        navArrow: 1,
        filters: false,
        filtersCounter: false,
        doSomethingCrazyWithFilters: false,
        equalHeightCells: false,
        middleAlignContent: false,
        randomVerOffset: false,
        parallax: false,
        parallaxEl: 'img',
        dotsIndicator: 'classic',
        numbersStyle: 'circle',
        addSlideNumbersToArrows: false,
        marquee: false,
        marqueeTickerSpeed: 1,
        fade: false,
        prevNextButtonsOnlyOnMobile: false,
        columnsAutoWidth: false,
        watchCSS: false,
        forceApply: false,
        skipWrapItems: false,
        forceEnableOnMobile: false
    }

    function CarouselPlugin(element, options) {
        this._defaults = DEFAULT_OPTIONS
        this._name = pluginName
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        }
        this.flickityData = null
        if (liquidIsMobile()) {
            this.options.dragThreshold = 5
        }
        this.element = element
        this.$element = $(element)
        this.$carouselContainer = this.$element.closest('.carousel-container').length ? this.$element.closest('.carousel-container') : this.$element.parent()
        this.carouselNavElement = null
        this.carouselDotsElement = null
        this.carouselMobileDotsElement = null
        this.$carouselCurrentSlide = null
        this.$carouselCurrentSlideInner = null
        this.$carouselTotalSlides = null
        this.$carouselSlidesShape = null
        this.carouselSlidesPathLength = this.options.numbersStyle === 'circle' ? 471 : 200
        this.windowWidth = liquidWindowWidth()
        this.$carouselEl = this.options.carouselEl ? $(this.options.carouselEl, this.element) : this.$element
        this.carouselEl = this.$carouselEl[0]
        this.carouselInitPromise = new Promise(resolve => {
            this.$element.on('lqd-carousel-initialized', resolve.bind(this, this))
        })
        if (this.options.marquee) {
            this.options.wrapAround = true
        }
        this.init()
    }

    CarouselPlugin.prototype = {
        init() {
            if (this.options.asNavFor) {
                const $targetEl = $(this.options.asNavFor)
                if ($targetEl.length) {
                    $targetEl.liquidCarousel({
                        forceApply: true
                    })
                    $targetEl.data('plugin_liquidCarousel').carouselInitPromise.then(() => {
                        this.initFlicky()
                    })
                }
            } else {
                if (this.options.forceApply) {
                    this.initFlicky()
                } else {
                    this.setIO()
                }
            }
        },
        setIO() {
            new IntersectionObserver(([entry], observer) => {
                if (entry.isIntersecting) {
                    this.initFlicky()
                    observer.unobserve(entry.target)
                }
            }, {
                rootMargin: '35%'
            }).observe(this.element)
        },
        initFlicky() {
            const options = {
                ...this.options,
            }
            const {
                equalHeightCells
            } = this.options
            imagesLoaded(this.element, () => {
                this.columnsAutoWidth()
                this.wrapItems()
                this.setEqualHeightCells()
                this.$carouselEl.flickity(options)
                this.flickityData = this.$carouselEl.data('flickity')
                options.adaptiveHeight && $('.flickity-viewport', this.element).css('transition', 'height 0.3s')
                this.onImagesLoaded()
                this.$element.addClass('lqd-carousel-ready')
                const resize = this.flickityData.resize
                const self = this
                const {
                    carouselEl
                } = this
                this.flickityData.resize = function () {
                    if (self.windowWidth === liquidWindowWidth()) return
                    if (equalHeightCells) {
                        carouselEl.classList.remove('flickity-equal-cells')
                    }
                    resize.call(this)
                    if (equalHeightCells) {
                        carouselEl.classList.add('flickity-equal-cells')
                    }
                    self.windowWidth = liquidWindowWidth()
                }
            })
        },
        onImagesLoaded() {
            if (!this.flickityData) return
            this.sliderElement = this.element.querySelector('.flickity-slider')
            this.initPlugins()
            this.setElementNavArrow()
            this.carouselNav()
            this.navOffsets()
            this.carouselDots()
            this.carouselMobileDots()
            this.carouselDotsNumbers()
            this.addSlideNumbersToArrows()
            this.addSlidesCurrentNumbers()
            this.randomVerOffset()
            this.fullwidthSide()
            this.controllingCarousels()
            this.marquee()
            this.filtersInit()
            this.windowResize()
            this.events()
            this.dispatchEvents()
            if (this.options.columnsAutoWidth) {
                this.$element.find('.carousel-item-content').css('width', '')
                this.flickityData.reposition()
            }
        },
        initPlugins() {
            this.element.hasAttribute('data-custom-animations') && this.$element.liquidCustomAnimations()
        },
        dispatchEvents() {
            const e = new CustomEvent('lqd-carousel-initialized', {
                detail: {
                    carouselData: this
                }
            })
            document.dispatchEvent(e)
            this.$element.trigger('lqd-carousel-initialized', this.element)
        },
        windowResize() {
            const onResize = liquidDebounce(this.doOnWindowResize.bind(this), 200)
            $(window).on('resize.lqdCarousel', onResize)
        },
        doOnWindowResize() {
            if (this.windowWidth === window.innerWidth) return
            this.windowWidth = window.innerWidth
            this.fullwidthSide()
            this.columnsAutoWidth()
            if (this.options.columnsAutoWidth) {
                this.$element.find('.carousel-item-content').css('width', '')
                this.flickityData.reposition()
            }
        },
        events() {
            this.flickityData.on('pointerDown', () => {
                $liquidHtml.addClass('lqd-carousel-pointer-down')
            })
            this.flickityData.on('pointerUp', () => {
                $liquidHtml.removeClass('lqd-carousel-pointer-down')
            })
            this.flickityData.on('dragStart', () => {
                $('[data-column-clickable]', this.element).css('pointer-events', 'none')
            })
            this.flickityData.on('dragEnd', () => {
                $('[data-column-clickable]', this.element).css('pointer-events', '')
            })
            if (this.options.marquee) return
            this.flickityData.on('settle', () => {
                this.sliderElement.style.willChange = 'auto'
            })
            this.flickityData.on('scroll', () => {
                this.sliderElement.style.willChange = 'transform'
                this.doSomethingCrazyWithFilter()
                this.parallax()
                this.changeSlidesShape()
            })
            this.flickityData.on('change', () => {
                this.changeSlidesNumbers()
            })
        },
        wrapItems() {
            const {
                middleAlignContent,
                equalHeightCells,
                randomVerOffset,
                skipWrapItems
            } = this.options
            if (skipWrapItems) return
            const $firstChild = this.$carouselEl.children().first()
            if ($firstChild.hasClass('flickity-viewport') || $firstChild.hasClass('flickity-viewport-wrap')) {
                const $cells = $firstChild.find('.flickity-slider').children()
                $cells.each((i, cell) => {
                    const $cell = $(cell)
                    const $cellContent = $cell.find('.carousel-item-content').first()
                    const hasOneChild = $cellContent.children().not('style').length === 1
                    if (hasOneChild) {
                        $cell.addClass('has-one-child')
                    }
                })
                return
            }

            this.$carouselEl.children('p, style').insertBefore(this.$carouselEl)
            const $cells = this.$carouselEl.children()
            $cells.each((i, cell) => {
                const $cell = $(cell)
                if ($cell.hasClass('vc_ld_carousel_section') || $cell.hasClass('vc_ld_carousel_marquee_section') || $cell.hasClass('vc_container-anchor') || $cell.hasClass('lqd-sticky-stack-nav') || $cell.is('pre')) return
                const cellHasInner = $cell.children().hasClass('carousel-item-inner')
                const $cellToSearch = cellHasInner ? $cell.find('.carousel-item-content') : $cell
                const hasOneChild = $cellToSearch.children().not('style, .vc_controls-container').length === 1
                let classnames
                if ($cell.attr('class')) {
                    if ($cell.hasClass('lqd-prod-item')) {
                        classnames = $cell.attr('class').split(' ').filter(classname => classname !== 'lqd-prod-item' && classname !== 'product')
                    } else {
                        classnames = $cell.attr('class').split(' ').filter(classname => classname.includes('vc_hidden-') || classname.includes('hidden-') || classname.includes('col-') || classname.includes('vc_col-'))
                    }
                }
                if ($cell.hasClass('carousel-item')) {
                    middleAlignContent && equalHeightCells && !randomVerOffset && $cell.addClass('align-items-center')
                    hasOneChild && $cell.addClass('has-one-child')
                    if (!$cell.children('.carousel-item-inner').length) {
                        $cell.wrapInner('<div class="carousel-item-inner" />')
                    }
                    if (!$cell.children('.carousel-item-inner').children('.carousel-item-content').length) {
                        $cell.children().wrapInner('<div class="carousel-item-content" />')
                    }
                } else {
                    $cell.wrap(`<div class="carousel-item ${hasOneChild ? 'has-one-child' : ''} ${classnames && classnames.join(' ')} ${middleAlignContent && equalHeightCells && !randomVerOffset ? 'align-items-center' : ''}" />`).wrap(`<div class="carousel-item-inner" />`).wrap(`<div class="carousel-item-content" />`)
                }
            })
        },
        columnsAutoWidth() {
            if (!this.options.columnsAutoWidth) return
            let $cells = this.$carouselEl.children()
            const $firstChild = $cells.first()
            if ($firstChild.hasClass('flickity-viewport') || $firstChild.hasClass('flickity-viewport-wrap')) {
                $cells = $firstChild.find('.flickity-slider').children()
            }
            $cells.each((i, cell) => {
                const $cell = $(cell)
                if ($cell.hasClass('width-is-set')) return
                const $cellContentWrapper = $cell.find('.carousel-item-content')
                let $cellChildren = $cellContentWrapper.children().not('style').first()
                if ($cellChildren.hasClass('ld-fancy-heading')) {
                    $cellChildren = $cellChildren.children()
                }
                this.setColumnWidth($cell, $cellChildren, $cellContentWrapper)
            })
        },
        setColumnWidth($cell, $cellChildren, $cellContentWrapper) {
            const width = $cellChildren.length ? $cellChildren.outerWidth() : $cellContentWrapper.outerWidth()
            $cellContentWrapper.css('width', width)
            $cell.css('width', 'auto')
        },
        carouselNav() {
            if (!this.options.prevNextButtons || !this.flickityData.prevButton || !this.flickityData.nextButton) return
            let appendingSelector = this.options.buttonsAppendTo
            if (appendingSelector === 'parent_row') {
                appendingSelector = this.$element.closest('.vc_row')
            }
            if (appendingSelector === 'parent_el') {
                appendingSelector = this.$element.parent()
            }
            if (appendingSelector === 'self') {
                appendingSelector = this.$carouselContainer
            }
            const $prevBtn = $(this.flickityData.prevButton.element)
            const $nextBtn = $(this.flickityData.nextButton.element)
            const $appendingSelector = $(appendingSelector)
            const $carouselNav = $(`<div class="carousel-nav"></div>`)
            const carouselNavClassnames = []
            let carouselId = this.options.carouselEl ? this.$element.attr('id') : this.$carouselContainer.attr('id')
            $.each($(this.$carouselContainer[0].classList), (i, className) => {
                if (className.indexOf('carousel-nav-') >= 0) carouselNavClassnames.push(className)
            })
            $carouselNav.addClass([...carouselNavClassnames, carouselId].join(' '))
            this.$carouselContainer.removeClass(carouselNavClassnames.join(' '))
            $carouselNav.append([$prevBtn, $nextBtn])
            if (appendingSelector != null) {
                if (this.options.appendingBtnRel) {
                    $carouselNav.appendTo(this.$carouselEl[this.options.appendingBtnRel](appendingSelector))
                } else {
                    $carouselNav.appendTo(appendingSelector)
                }
                $appendingSelector.addClass('carousel-nav-appended')
            } else {
                $carouselNav.appendTo(this.$carouselContainer)
            }
            this.carouselNavElement = $carouselNav[0]
            this.options.prevNextButtonsOnlyOnMobile && this.carouselNavElement.classList.add('visible-xs', 'visible-sm')
        },
        carouselDots() {
        },
        carouselMobileDots(force = false) {
            if ((!this.options.pageDots || this.options.marquee) && !force) return
            const {
                carouselEl
            } = this.options
            const carouselId = carouselEl ? this.$carouselEl.attr('id') : this.$carouselContainer.attr('id')
            const mobileDotsClassnames = [carouselId]
            $.each($(this.$carouselContainer[0].classList), (i, className) => {
                if (className.indexOf('carousel-dots-mobile-') >= 0) mobileDotsClassnames.push(className)
            })
            const $dotsHolder = $(this.flickityData.pageDots.holder).clone(true)
            const $carouselMobileDots = $(`<div class="carousel-dots-mobile carousel-dots-style4 ${mobileDotsClassnames.join(' ')}"></div>`)
            $carouselMobileDots.append($dotsHolder)
            if (this.carouselDotsElement && this.$carouselEl.has(this.carouselDotsElement).length) {
                $carouselMobileDots.insertBefore(this.carouselDotsElement)
            } else {
                $carouselMobileDots.appendTo(this.$carouselContainer)
                $(this.carouselDotsElement).addClass('hidden-xs hidden-sm md:hidden')
            }
            this.carouselMobileDotsElement = $carouselMobileDots[0]
            const dots = this.carouselMobileDotsElement.querySelectorAll('.dot')
            dots.forEach((dot, i) => {
                dot.addEventListener('click', () => {
                    this.flickityData.select(i)
                    this.carouselMobileDotsClasslist(dot, i)
                })
            })
            this.flickityData.on('select', i => this.carouselMobileDotsClasslist.call(this, dots[i], i))
        },
        carouselMobileDotsClasslist(activeItem, activeItemIndex) {
            if (!activeItem) return
            activeItem.classList.add('is-selected')
            const inActives = [...this.carouselMobileDotsElement.querySelectorAll('.dot')].filter((inactiveItem, inactiveIndex) => activeItemIndex !== inactiveIndex)
            inActives.forEach(inactiveItem => {
                inactiveItem.classList.remove('is-selected')
            })
        },
        carouselDotsNumbers() {
            if (!this.options.pageDots || this.options.dotsIndicator !== 'numbers') return
            const {
                flickityData
            } = this
            const {
                numbersStyle
            } = this.options
            const $dotsHolder = $(flickityData.pageDots.holder)
            let $svgMarkup
            if (numbersStyle === 'circle') {
                const $numbers = this.createSlideNumbers(false)
                $svgMarkup = $('<div class="lqd-carousel-slides-numbers d-inline-flex pos-rel inline-flex relative">' + '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="152" viewBox="-2 0 154 150" class="w-100 h-100 w-full h-full">' + '<circle fill="none" cx="75" cy="75" r="74.5"/>' + '<path fill="none" stroke-dashoffset="' + this.carouselSlidesPathLength + '" stroke-dasharray="' + this.carouselSlidesPathLength + '" stroke-width="3" x="2" d="M75,150 C116.421356,150 150,116.421356 150,75 C150,33.5786438 116.421356,0 75,0 C33.5786438,0 0,33.5786438 0,75 C0,116.421356 33.5786438,150 75,150 Z"/>' + '</svg>' + '</div>')
                $numbers.prependTo($svgMarkup)
            } else if (numbersStyle === 'line') {
                const $numbers = this.createSlideNumbers(true)
                $svgMarkup = $('<div class="lqd-carousel-slides-numbers d-inline-flex pos-rel inline-flex relative lqd-carousel-numbers-line">' + '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-width="2" width="200" height="1" viewBox="0 0 200 1" class="w-100 h-100 w-full h-full">' + '<path opacity="0.15" d="M1 1 201 1 201 2 1 2z"></path>' + '<path stroke-dashoffset="' + this.carouselSlidesPathLength + '" stroke-dasharray="' + this.carouselSlidesPathLength + '" d="M1 1 201 1 201 2 1 2z"></path>' + '</svg>' + '</div>')
                $numbers.prependTo($svgMarkup)
            }
            $dotsHolder.appendTo($svgMarkup)
            $svgMarkup.appendTo(this.carouselDotsElement)
            this.$carouselTotalSlides = $('.lqd-carousel-slides-total', $svgMarkup)
            this.$carouselCurrentSlide = $('.lqd-carousel-slides-current', $svgMarkup)
            this.$carouselSlidesShape = $('svg', $svgMarkup)
        },
        addSlideNumbersToArrows() {
            if (!this.options.prevNextButtons || !this.options.addSlideNumbersToArrows) return
            const {
                prevButton
            } = this.flickityData
            const prevButtonEl = prevButton.element
            const $numbers = this.createSlideNumbers()
            $numbers.insertAfter(prevButtonEl)
            this.$carouselTotalSlides = $('.lqd-carousel-slides-total', $(prevButtonEl).next('.lqd-carousel-slides'))
            this.$carouselCurrentSlide = $('.lqd-carousel-slides-current', $(prevButtonEl).next('.lqd-carousel-slides'))
        },
        createSlideNumbers(isZeroBased) {
            const totalSlides = (this.flickityData.slides.length < 10 && isZeroBased ? '0' : '') + this.flickityData.slides.length
            const $markup = $(`<div class="lqd-carousel-slides d-flex align-items-center justify-content-center flex items-center justify-center lqd-overlay">
				<div class="lqd-carousel-slides-current d-inline-block overflow-hidden ws-nowrap text-center inline-block whitespace-nowrap"></div>
				<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="width: 1em; height: 1em;"><path fill="currentColor" d="M6 15.77a1 1 0 0 1 1-1h18.05a1 1 0 1 1 0 2h-18.04a1 1 0 0 1-1.01-1z"></path></svg>
				<div class="lqd-carousel-slides-total">${totalSlides}</div>
			</div>`)
            return $markup
        },
        addSlidesCurrentNumbers() {
            if (this.options.dotsIndicator !== 'numbers' && !this.options.addSlideNumbersToArrows) {
                return false
            }
            const {
                flickityData
            } = this
            const {
                numbersStyle
            } = this.options
            const isZeroBased = numbersStyle === 'line'
            const $currentInner = $('<div class="lqd-carousel-slides-current-inner d-inline-block pos-rel inline-block relative" />')
            for (let i = 1; i <= flickityData.slides.length; i++) {
                $currentInner.append(`<span class="d-inline-block inline-block" style="text-indent: 0;">${i < 10 && isZeroBased ? '0' : ''}${i}</span>`)
            }
            setTimeout(() => {
                const $spanEls = $currentInner.children('span')
                const widths = $spanEls.map((i, el) => $(el).outerWidth(true))
                const maxWidth = Math.ceil(Math.max(...widths))
                this.$carouselCurrentSlide.add($spanEls).css('width', maxWidth)
            }, 0)
            $currentInner.appendTo(this.$carouselCurrentSlide)
            this.$carouselCurrentSlideInner = $currentInner
        },
        changeSlidesNumbers() {
            if (this.options.dotsIndicator !== 'numbers' && !this.options.addSlideNumbersToArrows) {
                return false
            }
            const {
                flickityData
            } = this
            const {
                selectedIndex
            } = flickityData
            const selectedNum = this.$carouselCurrentSlideInner.children('span').eq(selectedIndex)[0]
            this.$carouselCurrentSlideInner.css({
                transition: 'transform 0.5s',
                transform: `translateX(${selectedNum.offsetLeft * -1}px)`
            })
        },
        changeSlidesShape() {
            if (this.options.pageDots && this.options.dotsIndicator !== 'numbers') {
                return false
            }
            const {
                flickityData
            } = this
            const $pathElement = this.$carouselSlidesShape.find('path').last()
            const pathLength = this.carouselSlidesPathLength
            const slidesPercentage = Math.floor(Math.abs(Math.floor(flickityData.x + flickityData.cursorPosition)) / Math.abs(Math.floor(flickityData.slidesWidth)) * 100)
            const dashOffset = pathLength - slidesPercentage / 100 * pathLength
            $pathElement.css('stroke-dashoffset', Math.abs(dashOffset))
        },
        fullwidthSide() {
            if (!this.options.fullwidthSide) return
            const viewportEl = $(this.flickityData.viewport)
            const elementWidth = this.flickityData.size.width - parseInt(this.$element.css('padding-left'), 10)
            const viewportElOffset = viewportEl.offset()
            const viewportElOffsetRight = this.windowWidth - (elementWidth + viewportElOffset.left)
            const margin = 'marginRight'
            const padding = 'paddingRight'
            let existingViewportWrap = viewportEl.parent('.flickity-viewport-wrap')
            let viewportElWrap = existingViewportWrap.length ? existingViewportWrap : $('<div class="flickity-viewport-wrap overflow-hidden" />')
            if (!existingViewportWrap.length) {
                viewportEl.wrap(viewportElWrap)
                viewportEl.removeClass('overflow-hidden')
                viewportElWrap = viewportEl.parent()
                viewportEl.css('overflow', 'visible')
            }
            viewportElWrap.css({
                [margin]: '',
                [padding]: ''
            })
            viewportElWrap.css({
                [margin]: viewportElOffsetRight >= 0 ? (viewportElOffsetRight - 1) * -1 : viewportElOffsetRight - 1,
                [padding]: Math.abs(viewportElOffsetRight - 1)
            })
            this.flickityData.resize()
        },
        randomVerOffset() {
            if (this.options.randomVerOffset) {
                const cellsArray = this.flickityData.cells
                let maxHeight = 0
                for (let i = 0; i < cellsArray.length; i++) {
                    const $cell = $(cellsArray[i].element)
                    const itemHeight = cellsArray[i].size.height
                    if (itemHeight > maxHeight) {
                        maxHeight = itemHeight
                    }
                    const maxOffset = maxHeight - itemHeight
                    const offset = (Math.random() * maxOffset).toFixed()
                    $cell.children('.carousel-item-inner').css('top', offset + 'px')
                }
            }
        },
        navOffsets() {
            const {
                options
            } = this
            const {
                navOffsets
            } = options
            const $carouselNavElement = $(this.carouselNavElement)
            if (navOffsets && $carouselNavElement && this.flickityData.options.prevNextButtons) {
                const prevButton = $(this.flickityData.prevButton.element)
                const nextButton = $(this.flickityData.nextButton.element)
                if (navOffsets.nav) {
                    for (const offset in navOffsets.nav) {
                        let val = navOffsets.nav[offset].trim()
                        val.match(/^-?\d*(\.\d+)?(%|in|cm|mm|em|rem|ex|pt|pc|px|vw|vh|vmin|vmax)$/) || (val = isNaN(parseFloat(val)) ? '' : parseFloat(val) + 'px')
                        $carouselNavElement.css(offset.trim(), val)
                    }
                }
                prevButton.css({
                    left: navOffsets.prev
                })
                nextButton.css({
                    right: navOffsets.next
                })
            }
        },
        setElementNavArrow() {
            if (!this.options.prevNextButtons) {
                return false
            }
            const navArrowsArray = this.navArrows
            const prevButton = this.flickityData.prevButton ? this.flickityData.prevButton.element : null
            const nextButton = this.flickityData.nextButton ? this.flickityData.nextButton.element : null
            let elementNavArrow = this.options.navArrow
            let prevIcon
            let nextIcon
            if (typeof elementNavArrow !== 'object') {
                elementNavArrow = elementNavArrow - 1
                prevIcon = $(navArrowsArray[elementNavArrow].prev)
                nextIcon = $(navArrowsArray[elementNavArrow].next)
            } else {
                prevIcon = $(this.options.navArrow.prev)
                nextIcon = $(this.options.navArrow.next)
            }
            if (prevButton || nextButton) {
                $(prevButton).find('svg').remove().end().append(prevIcon)
                $(nextButton).find('svg').remove().end().append(nextIcon)
            }
        },
        navArrows: [{
            prev: '<svg width="27" height="16" viewBox="0 0 27 16" xmlns="http://www.w3.org/2000/svg"> <path d="M2.5 7.75H27V9H2.5L9 15L8 16L0 8.5L8 0L9 1L2.5 7.75Z" /> </svg>',
            next: '<svg width="27" height="16" viewBox="0 0 27 16" xmlns="http://www.w3.org/2000/svg"> <path d="M24.5 7.75H0V9H24.5L18 15L19 16L27 8.5L19 0L18 1L24.5 7.75Z"/> </svg>'
        }, {
            prev: '<svg width="32" height="18" viewBox="0 0 32 18" xmlns="http://www.w3.org/2000/svg"> <path d="M8.77638 0.223663L10.2018 1.64911L3.85885 7.99209H32V10.008H3.85885L10.2018 16.3509L8.77638 17.7763L1.71102e-06 8.99997L8.77638 0.223663Z"/> </svg> ',
            next: '<svg width="32" height="18" viewBox="0 0 32 18" xmlns="http://www.w3.org/2000/svg"> <path d="M23.2236 0.223663L21.7982 1.64911L28.1412 7.99209H0V10.008H28.1412L21.7982 16.3509L23.2236 17.7763L32 8.99997L23.2236 0.223663Z"/> </svg>'
        }, {
            prev: '<svg width="20" height="18" viewBox="0 0 32 28" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M12.9881 0.478424L0.377096 13.0899C-0.12566 13.5922 -0.12566 14.4072 0.377096 14.91L12.9881 27.5214C13.2395 27.7728 13.5685 27.8985 13.8979 27.8985C14.2274 27.8985 14.5564 27.7728 14.8077 27.5214C15.3105 27.0191 15.3105 26.2041 14.8077 25.7018L4.39347 15.2871H30.7132C31.424 15.2871 32.0001 14.7105 32.0001 14.0002C32.0001 13.2898 31.4239 12.7133 30.7132 12.7133H4.39338L14.8077 2.29851C15.3105 1.79619 15.3105 0.981181 14.8077 0.478424C14.305 -0.0238953 13.4909 -0.0238953 12.9881 0.478424Z"/> </svg>',
            next: '<svg width="20" height="18" viewBox="0 0 32 28" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M19.012 0.478424L31.623 13.0899C32.1257 13.5921 32.1257 14.4072 31.623 14.9099L19.012 27.5214C18.7606 27.7728 18.4316 27.8985 18.1021 27.8985C17.7727 27.8985 17.4437 27.7728 17.1923 27.5214C16.6896 27.0191 16.6896 26.2041 17.1923 25.7018L27.6066 15.287H1.28687C0.57605 15.287 0 14.7105 0 14.0002C0 13.2898 0.576111 12.7132 1.28687 12.7132H27.6067L17.1923 2.29849C16.6896 1.79617 16.6896 0.981171 17.1923 0.478424C17.6951 -0.0238953 18.5092 -0.0238953 19.012 0.478424Z"/> </svg>'
        }, {
            prev: '<svg width="10" height="19" viewBox="0 0 33 60" xmlns="http://www.w3.org/2000/svg"> <path d="M1.41739 28L28.823 0.670159C29.7209 -0.224745 31.1747 -0.22324 32.0711 0.674788C32.9668 1.5727 32.9645 3.02725 32.0664 3.92285L6.29209 29.626L32.0674 55.3291C32.9653 56.2248 32.9676 57.6784 32.072 58.5765C31.6226 59.0266 31.0339 59.2517 30.4452 59.2517C29.8581 59.2517 29.2717 59.0281 28.8231 58.5811L1.41739 31.252C0.984926 30.8217 0.742248 30.2361 0.742248 29.626C0.742248 29.0159 0.98562 28.4311 1.41739 28Z"/> </svg>',
            next: '<svg width="10" height="19" viewBox="0 0 33 60" xmlns="http://www.w3.org/2000/svg"> <path d="M32.0671 28L4.66149 0.670159C3.76358 -0.224745 2.30984 -0.22324 1.41343 0.674788C0.517715 1.5727 0.52003 3.02725 1.41806 3.92285L27.1924 29.626L1.41713 55.3291C0.519219 56.2248 0.516905 57.6784 1.4125 58.5765C1.86186 59.0266 2.45056 59.2517 3.03926 59.2517C3.62645 59.2517 4.21283 59.0281 4.66138 58.5811L32.0671 31.252C32.4996 30.8217 32.7422 30.2361 32.7422 29.626C32.7422 29.0159 32.4989 28.4311 32.0671 28Z"/> </svg>'
        }, {
            prev: '<svg width="16" height="17" viewBox="0 0 16 17" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M15.612 16.0721C15.6116 16.2693 15.4515 16.4289 15.2542 16.4286C15.1593 16.4286 15.0684 16.3908 15.0014 16.3236L7.14431 8.46655C7.00489 8.32706 7.00489 8.101 7.14431 7.96154L15.0014 0.104495C15.141 -0.0351572 15.3674 -0.0351572 15.5071 0.104495C15.6467 0.244147 15.6467 0.47055 15.5071 0.610202L7.90217 8.21436L15.5071 15.8186C15.5744 15.8857 15.6122 15.977 15.612 16.0721ZM9.18351 16.0721C9.18314 16.2693 9.02297 16.4289 8.82573 16.4286C8.73118 16.4286 8.64051 16.3911 8.57358 16.3243L0.716562 8.46727C0.577143 8.32778 0.577143 8.10171 0.716562 7.96226L8.57361 0.105214C8.71199 -0.0284448 8.9314 -0.0284448 9.06981 0.105214C9.21167 0.242255 9.21562 0.468357 9.07858 0.610219L1.47368 8.21438L9.07858 15.8186C9.14591 15.8857 9.18368 15.977 9.18351 16.0721Z"/> </svg>',
            next: '<svg width="16" height="17" viewBox="0 0 16 17" xmlns="http://www.w3.org/2000/svg"> <path d="M0.612 16.0721C0.61237 16.2693 0.772547 16.4289 0.969787 16.4286C1.06467 16.4286 1.15564 16.3908 1.22264 16.3236L9.07969 8.46655C9.21911 8.32706 9.21911 8.101 9.07969 7.96154L1.22264 0.104495C1.08299 -0.0351572 0.856586 -0.0351572 0.716933 0.104495C0.577281 0.244147 0.577281 0.47055 0.716933 0.610202L8.32183 8.21436L0.716933 15.8186C0.649602 15.8857 0.611834 15.977 0.612 16.0721Z"/> <path d="M7.04049 16.0721C7.04085 16.2693 7.20103 16.4289 7.39827 16.4286C7.49282 16.4286 7.58349 16.3911 7.65042 16.3243L15.5074 8.46727C15.6469 8.32778 15.6469 8.10171 15.5074 7.96226L7.65039 0.105214C7.51201 -0.0284448 7.2926 -0.0284448 7.15419 0.105214C7.01233 0.242255 7.00838 0.468357 7.14542 0.610219L14.7503 8.21438L7.14542 15.8186C7.07809 15.8857 7.04032 15.977 7.04049 16.0721Z"/> </svg>'
        }, {
            prev: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="13.4" viewBox="0 0 16 13.4"><path d="M9.3,1.3,7.9,2.7,12.2,7H0V9H12.2L7.9,13.3l1.4,1.4L16,8Z" transform="translate(16 14.7) rotate(180)"/></svg>',
            next: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="13.4" viewBox="0 0 16 13.4"><path d="M9.3,13.4,7.9,12l4.3-4.3H0v-2H12.2L7.9,1.4,9.3,0,16,6.7Z"/></svg>'
        }],
        setEqualHeightCells() {
            if (!this.options.equalHeightCells || this.element.classList.contains('flickity-equal-cells')) return
            const {
                carouselEl
            } = this
            Flickity.prototype._createResizeClass = function () {
                carouselEl.classList.add('flickity-equal-cells')
            }
            Flickity.createMethods.push('_createResizeClass')
        },
        parallax() {
            if (!this.options.parallax || liquidIsMobile()) {
                return false
            }
            this.flickityData.cells.forEach((cell, i) => {
                const multiply = -1
                const x = (cell.target + this.flickityData.x) * multiply / 3
                const $cellElement = $(cell.element)
                const $cellImage = $cellElement.find(this.options.parallaxEl)
                if (!$cellImage.parent('.ld-carousel-parallax-wrap').length) {
                    $cellImage.wrap('<div class="ld-carousel-parallax-wrap overflow-hidden"></div>')
                }
                if ($cellImage.is(':only-child')) {
                    $cellImage.css({
                        willChange: 'transform',
                        '-webkit-transform': `translateX(${x}px)`,
                        'transform': `translateX(${x}px)`
                    })
                }
            })
        },
        controllingCarousels() {
            const {
                options
            } = this
            const {
                controllingCarousels
            } = options
            if (typeof controllingCarousels !== typeof undefined && controllingCarousels !== null && controllingCarousels.length) {
                const $controlledCarousels = $(controllingCarousels.map(carousel => $(carousel).children('[data-lqd-flickity]')))
                $.each($controlledCarousels, (i, controlledCarousel) => {
                    const $controlledCarousel = $(controlledCarousel)
                    $controlledCarousel.imagesLoaded(() => {
                        const controlledCarouselData = $controlledCarousel.data('plugin_liquidCarousel')
                        if (controlledCarouselData) {
                            controlledCarouselData.carouselInitPromise.then(() => {
                                $controlledCarousel.parent().addClass('is-controlled-carousel')
                                controlledCarouselData.carouselMobileDotsElement && controlledCarouselData.carouselMobileDotsElement.classList.add('hidden')
                                this.flickityData.on('change', i => {
                                    controlledCarouselData.flickityData.select(i)
                                })
                                controlledCarouselData.flickityData.on('change', i => {
                                    this.flickityData.select(i)
                                })
                            })
                        }
                    })
                })
            }
        },
        getCellsArray() {
            return this.flickityData.cells.map(cell => cell.element)
        },
        doSomethingCrazyWithFilter() {
            if (!this.options.doSomethingCrazyWithFilters || liquidIsMobile() || this.windowWidth <= 992) return false
            const header = $('.lqd-pf-carousel-header', this.$carouselContainer)[0]
            if (!header) return false
            const {
                x
            } = this.flickityData
            const firstVisibleCell = this.flickityData.cells.filter(cell => $(cell.element).is(':visible'))[0]
            const firstCellWidth = firstVisibleCell.size.width
            const opacityVal = gsap.utils.normalize(-firstCellWidth, 0, x)
            const rotationVal = gsap.utils.mapRange(0, -firstCellWidth, 0, -100, x)
            const zVal = gsap.utils.mapRange(0, -firstCellWidth, 0, -300, x)
            $(header).parent().addClass('perspective')
            gsap.to(header, {
                opacity: opacityVal,
                z: zVal,
                rotationY: rotationVal,
                duration: 0.6,
                ease: 'expo.out'
            })
        },
        filtersInit() {
            if (!this.options.filters) return
            const {
                filtersCounter,
                filters
            } = this.options
            const $filters = $(filters)
            const $filterItems = $('[data-filter]', $filters)
            const $filterDropdown = $filters.siblings('.lqd-filter-dropdown')
            $filterItems.each((i, filterItem) => {
                const $filterItem = $(filterItem)
                const filterValue = $filterItem.attr('data-filter')
                filtersCounter && this.addFilterCounts($filterItem, filterValue)
                $filterItem.off('click')
                $filterItem.on('click.lqdCarouselFilter', () => {
                    if (!$filterItem.hasClass('active')) {
                        $filterItem.addClass('active').siblings().removeClass('active')
                        this.filterAnimateStart(filterValue)
                    }
                })
            })
            if ($filterDropdown.length) {
                $('select', $filterDropdown).on('selectmenuchange', (event, ui) => {
                    const filterVal = ui.item.value
                    this.filterAnimateStart(filterVal)
                })
            }
        },
        addFilterCounts($filterItem, filterValue) {
            const count = filterValue === '*' ? this.flickityData.cells.length : $(filterValue, this.element).length
            const $counter = $(`
				<sup class="lqd-filter-counter">
					<span>${count}</span>
				</sup>`)
            $counter.appendTo($filterItem)
        },
        filterAnimateStart(filterValue) {
            const visibleCells = this.getCellsArray().filter(element => !element.classList.contains('hidden'))
            gsap.to(visibleCells, {
                x: '-=10%',
                opacity: 0,
                ease: 'power4.inOut',
                duration: 0.6,
                stagger: 0.1,
                clearProps: 'x',
                onStart: () => {
                    if (this.options.equalHeightCells) {
                        const $cells = $(this.flickityData.cells)
                        const currentHeight = this.flickityData.size.height
                        $cells.css('minHeight', currentHeight)
                    }
                    $(visibleCells).css({
                        transition: 'none'
                    })
                },
                onComplete: this.filterItems.bind(this, filterValue)
            })
        },
        filterItems(filterValue) {
            const $cells = $(this.getCellsArray())
            this.$element.find('.hidden').removeClass('hidden')
            if (filterValue !== '*') {
                $cells.not(filterValue).addClass('hidden')
            }
            if (this.options.equalHeightCells) {
                $cells.css('minHeight', '')
            }
            this.flickityData.resize()
            this.flickityData.reposition()
            this.flickityData.options.draggable = this.flickityData.slides.length > 1
            this.flickityData.updateDraggable()
            this.filterAnimateComplete()
        },
        filterAnimateComplete() {
            const visibleCells = this.getCellsArray().filter(element => !element.classList.contains('hidden'))
            const timeline = gsap.timeline({
                defaults: {
                    duration: 0.6,
                    ease: 'power4.out'
                },
                onComplete: () => {
                    $(visibleCells).css({
                        transition: '',
                        opacity: ''
                    })
                }
            })
            visibleCells.forEach(cell => {
                const currentX = gsap.getProperty(cell, 'x', '%')
                timeline.fromTo(cell, {
                    x: '+=10%'
                }, {
                    x: currentX,
                    opacity: 1
                }, '<+=0.1')
            })
            if (this.carouselMobileDotsElement) {
                this.carouselMobileDotsElement.remove()
                this.carouselMobileDots(true)
            }
        },
        marquee() {
            if (!this.options.marquee) return
            this.marqueeIsPaused = true
            this.flickityData.x = 0
            const IO = () => {
                new IntersectionObserver(([entry]) => {
                    if (entry.isIntersecting) {
                        this.sliderElement.style.willChange = 'transform'
                        this.marqueePlay()
                    } else {
                        this.sliderElement.style.willChange = ''
                        this.marqueePause()
                    }
                }, {
                    rootMargin: '50%'
                }).observe(this.element)
            }
            if (this.options.pauseAutoPlayOnHover) {
                this.element.addEventListener('mouseenter', this.marqueePause.bind(this), false)
                this.element.addEventListener('focusin', this.marqueePause.bind(this), false)
                this.element.addEventListener('mouseleave', this.marqueePlay.bind(this), false)
                this.element.addEventListener('focusout', this.marqueePlay.bind(this), false)
            }
            this.flickityData.on('dragStart', this.marqueePause.bind(this))
            this.flickityData.on('dragEnd', !this.options.pauseAutoPlayOnHover && this.marqueePlay.bind(this))
            IO()
        },
        marqueePlay() {
            if (!this.marqueeIsPaused) return
            this.marqueeIsPaused = false
            this.marqueeUpdate()
        },
        marqueePause() {
            this.marqueeIsPaused = true
            this.marqueeRAF && cancelAnimationFrame(this.marqueeRAF)
        },
        marqueeUpdate() {
            if (this.marqueeIsPaused || !this.flickityData.slides) return
            this.flickityData.x = (this.flickityData.x - this.options.marqueeTickerSpeed) % this.flickityData.slideableWidth
            this.flickityData.settle(this.flickityData.x)
            this.marqueeRAF = window.requestAnimationFrame(this.marqueeUpdate.bind(this))
        },
        destroy() {
            $(window).off('resize.lqdCarousel')
        }
    }
    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const $carouselElement = $(this)
            const pluginOptions = {
                ...$carouselElement.data('lqd-flickity'),
                ...options
            }
            const globalDisabledOnMobile = document.body.hasAttribute('data-disable-carousel-onmobile')
            if (liquidIsMobile() && globalDisabledOnMobile && !pluginOptions.forceEnableOnMobile) {
                $carouselElement.find('.flickity-viewport').css('overflow-x', 'auto')
                return
            }

            pluginOptions.hasPageDotsFromOptions = !!pluginOptions.pageDots
            if (!pluginOptions.forceDisablePageDots) {
                pluginOptions.pageDots = true
            }
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new CarouselPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery)
// [LIQUID] Flickity Carousel
jQuery(document).ready(function ($) {
    $('[data-lqd-flickity]').liquidCarousel()
});
// [LIQUID] Carousel Stack plugin
(function ($) {
    'use strict'

    const pluginName = 'liquidCarouselStack'
    const DEFAULT_OPTIONS = {
        autoplay: false,
        distDragBack: 150,
        distDragMax: 450,
        isRandom: false,
        onUpdateStack: function (current) {
            return false
        }
    }

    class CarouselStackPlugin {
        constructor(element, options) {
            this.element = element
            this.$element = $(element)
            this.$container = $('.carousel-items', this.element)
            this.$prevBtn = $('.lqd-carousel-stack-prev', this.element)
            this.$nextBtn = $('.lqd-carousel-stack-next', this.element)
            this.items = this.$container.children('.carousel-item').get()
            this.options = $.extend({}, DEFAULT_OPTIONS, options)
            this._defaults = DEFAULT_OPTIONS
            this._name = pluginName
            this.isInit = false
            this.moveVector = {}
            this.draggie = null
            this._init()
            if (this.options.autoplay) {
                this.autoplay()
            }
        }

        autoplay() {
            if (isNaN(this.options.autoplay) || this.options.autoplay <= 0) return
            this.autoplayTimeout = setTimeout(() => {
                this._moveAway('next')
            }, this.options.autoplay)
        }

        shuffle(array) {
            let m = array.length
            let t
            let i
            while (m) {
                i = Math.floor(Math.random() * m--)
                t = array[m]
                array[m] = array[i]
                array[i] = t
            }
            return array
        }

        setTransformStyle(el, tval) {
            el.style.WebkitTransform = tval
            el.style.msTransform = tval
            el.style.transform = tval
        }

        initSetting() {
            this.itemsCount = this.items.length
            this._setContainerHeight()
            this._setStackStyle()
            if (this.itemsCount <= 1) return
            if (!this.isInit) {
                this._initEvents()
            }
            this.isInit = true
        }

        _init() {
            if (this.options.isRandom) {
                this.shuffle(this.items)
            }
            this.current = 0
            this.initSetting()
        }

        _initEvents() {
            const onResize = liquidDebounce(this.onResize.bind(this), 750)
            this.$prevBtn.on('click', this.goToPrev.bind(this))
            this.$nextBtn.on('click', this.goToNext.bind(this))
            $liquidWindow.on('resize.lqdCarouselStack', onResize)
        }

        _setContainerHeight() {
            this.element.style.transition = `height 0.3s`
            this.element.style.height = `${$(this._firstItem()).outerHeight()}px`
        }

        _setStackStyle(direction) {
            const item1 = this._firstItem(),
                item2 = this._secondItem(),
                item3 = this._thirdItem()
            this.items.forEach(item => item.classList.remove('is-first', 'is-second', 'is-third'))
            if (item1) {
                item1.style.zIndex = 4
                item1.classList.add('is-first')
                gsap.to(item1, {
                    ease: 'power4.out',
                    duration: 0.6,
                    x: 0,
                    y: 0,
                    z: 0
                })
            }
            if (item2) {
                item2.style.zIndex = 3
                item2.classList.add('is-second')
                gsap.to(item2, {
                    startAt: {
                        x: 0,
                        y: 0,
                        z: () => {
                            if (!direction || direction === 'next') {
                                return -180
                            } else {
                                return 0
                            }
                        }
                    },
                    x: 0,
                    y: 0,
                    z: () => {
                        if (!direction || direction === 'next') {
                            return -80
                        } else {
                            return -80
                        }
                    },
                    ease: 'power4.out',
                    duration: 0.6
                })
            }
            if (item3) {
                item3.style.zIndex = 2
                item3.classList.add('is-third')
                gsap.to(item3, {
                    startAt: {
                        x: 0,
                        y: 0,
                        z: () => {
                            if (!direction || direction === 'next') {
                                return -280
                            } else {
                                return 0
                            }
                        }
                    },
                    x: 0,
                    y: 0,
                    z: () => {
                        if (!direction || direction === 'next') {
                            return -180
                        } else {
                            return -180
                        }
                    },
                    duration: 0.6,
                    ease: 'power4.out'
                })
            }
        }

        _moveAway(direction) {
            if (this.animating) return
            const tVal = this._getTranslateVal(direction)
            let item1
            let initiated = false
            this.animating = true
            if (!direction || direction === 'next') {
            } else {
                item1 = this.items[this.itemsCount - 1]
                item1.style.zIndex = 4
            }
            gsap.killTweensOf(item1)
            const item1Tween = gsap.to(item1, {
                startAt: {
                    z: tVal.z[0],
                    opacity: () => {
                        if (direction !== 'prev') {
                            return 1
                        } else {
                            return 0
                        }
                    }
                },
                duration: 0.6,
                ease: 'power4.out',
                x: tVal.x,
                y: tVal.y || 0,
                z: tVal.z[1],
                opacity: () => {
                    if (direction !== 'prev') {
                        return 0
                    } else {
                        return 1
                    }
                },
                onUpdate: () => {
                    if (item1Tween.progress() >= 0.5 && !initiated) {
                        initiated = true
                        this.onEndTransFn(direction)
                    }
                },
                onComplete: () => {
                    this.onCompleteTransFn(item1)
                }
            })
            const item2 = this._secondItem()
            const item3 = this._thirdItem()
            if (item2) {
                gsap.to(item2, {
                    ease: 'power4.out',
                    duration: 0.6,
                    x: 0,
                    y: 0,
                    z: -80
                })
            }
            if (item3) {
                gsap.to(item3, {
                    ease: 'power4.out',
                    duration: 0.6,
                    x: 0,
                    y: 0,
                    z: -180
                })
            }
        }

        onEndTransFn(direction) {
            if (!direction || direction === 'next') {
                this.current = this.current < this.itemsCount - 1 ? this.current + 1 : 0
            } else {
                this.current = this.current > 0 ? this.current - 1 : this.itemsCount - 1
            }
            this._setStackStyle(direction)
            this._initEvents()
            this.options.onUpdateStack(this.current)
            this._setContainerHeight()
        }

        onCompleteTransFn(animatedTarget) {
            this.animating = false
            if (this.autoplayTimeout) {
                clearTimeout(this.autoplayTimeout)
            }
            if (this.options.autoplay) {
                this.autoplay()
            }
        }

        _moveBack() {
            const item2 = this._secondItem()
            const item3 = this._thirdItem()
            if (item2) {
                gsap.to(item2, {
                    ease: 'power4.out',
                    duration: 0.6,
                    x: 0,
                    y: 0,
                    z: -80
                })
            }
            if (item3) {
                gsap.to(item3, {
                    ease: 'power4.out',
                    duration: 0.6,
                    x: 0,
                    y: 0,
                    z: -180
                })
            }
        }

        _outOfBounds() {
            return Math.abs(this.moveVector.x) > this.options.distDragMax || Math.abs(this.moveVector.y) > this.options.distDragMax
        }

        _outOfSight() {
            return Math.abs(this.moveVector.x) > this.options.distDragBack || Math.abs(this.moveVector.y) > this.options.distDragBack
        }

        _getTranslateVal(direction) {
            const h = Math.sqrt(Math.pow(this.moveVector.x, 2) + Math.pow(this.moveVector.y, 2)),
                a = Math.asin(Math.abs(this.moveVector.y) / h) / (Math.PI / 180),
                hL = h + this.options.distDragBack,
                dx = Math.cos(a * (Math.PI / 180)) * hL,
                dy = Math.sin(a * (Math.PI / 180)) * hL,
                tx = dx - Math.abs(this.moveVector.x),
                ty = dy - Math.abs(this.moveVector.y)
            if (!direction) {
                return {
                    x: this.moveVector.x > 0 ? tx : tx * -1,
                    y: this.moveVector.y > 0 ? ty : ty * -1,
                    z: [0, 0]
                }
            } else if (direction === 'prev') {
                return {
                    x: 0,
                    y: 0,
                    z: [80, 0]
                }
            } else if (direction === 'next') {
                return {
                    x: 0,
                    y: 0,
                    z: [0, 80]
                }
            }
        }

        _firstItem() {
            return this.items[this.current]
        }

        _secondItem() {
            if (this.itemsCount >= 2) {
                return this.current + 1 < this.itemsCount ? this.items[this.current + 1] : this.items[Math.abs(this.itemsCount - (this.current + 1))]
            }
        }

        _thirdItem() {
            if (this.itemsCount >= 3) {
                return this.current + 2 < this.itemsCount ? this.items[this.current + 2] : this.items[Math.abs(this.itemsCount - (this.current + 2))]
            }
        }

        _lastItem() {
            if (this.itemsCount >= 3) {
                return this._thirdItem()
            } else {
                return this._secondItem()
            }
        }

        goToPrev() {
            this._moveAway('prev')
        }

        goToNext() {
            this._moveAway('next')
        }

        add(el) {
            this.$container.appendChild(el)
            this.items.push(el)
            this.initSetting()
        }

        getSize() {
            return this.itemsCount
        }

        getCurrent() {
            return this.current
        }

        getCurrentItem() {
            return this.items[this.current]
        }

        insert(el, index) {
            this.$container.insertBefore(el, this.$container.childNodes[index])
            this.items.splice(index, 0, el)
            this.initSetting()
        }

        remove(index) {
            if (this.items.length === 0) {
                return
            }
            if (this.current >= index) {
                this.current--
            }
            this.$container.removeChild(this.$container.childNodes[index])
            this.items.splice(index, 1)
            if (this.current >= this.items.length) {
                this.current = 0
            }
            this.initSetting()
        }

        onResize() {
            this._setContainerHeight()
        }

        destroy() {
            $(window).off('resize.lqdCarouselStack')
            this.$prevBtn.off('click')
            this.$nextBtn.off('click')
        }
    }

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            const pluginOptions = {
                ...$(this).data('carousel-options'),
                ...options
            }
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new CarouselStackPlugin(this, pluginOptions))
            }
        })
    }
})(jQuery)
// [LIQUID INIT] Carousel Stack
jQuery(document).ready(function ($) {
    if (liquidWindowWidth() <= 768) return
    $('.lqd-carousel-stack').liquidCarouselStack()
})
