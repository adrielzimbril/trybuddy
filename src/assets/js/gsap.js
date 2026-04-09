(function ($) {
    'use strict'

    const html = $('html')

    if (html.length > 0) {
        function updateBackgroundImage() {
            $('[data-background]').each(function () {
                if (html.hasClass('dark')) {
                    $(this).css('background-image', 'url(' + $(this).attr('data-background-dark') + ')')
                } else {
                    $(this).css('background-image', 'url(' + $(this).attr('data-background') + ')')
                }
            })

            if (html.attr('translate') !== 'no') {
                html.attr('translate', 'no')
            }
        }

        const observer = new MutationObserver(updateBackgroundImage)

        const observerOptions = {
            attributes: true,
            attributeFilter: ['class'],
        }

        observer.observe(html[0], observerOptions)

        updateBackgroundImage()
    }

    $('a[href^="#"]').on('click', function (event) {
        event.preventDefault()

        const target = $(this).attr('href')

        gsap.to(window, {
            scrollTo: {
                y: target,
                offsetY: 50,
            },
            duration: 0.5,
            ease: 'power3.inOut',
        })
    })
})(jQuery)