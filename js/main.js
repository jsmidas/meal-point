/* ============================
   MEALPOINT — main.js v2
   GSAP ScrollTrigger, Interactions, FAB
   ============================ */

(function () {
  'use strict';

  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      setTimeout(init, 100);
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    initAll();
  }

  function initAll() {
    initHeader();
    initHeroReveal();
    initScrollReveal();
    initProductTabs();
    initTiltCards();
    initProcessLine();
    initFAB();
    initSmsLinks();
    initMobileMenu();
    initSmoothScroll();
    initDemoAnimation();
    initParallaxSections();
  }

  /* ---------- Header ---------- */
  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;

    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: function () {
        header.classList.toggle('scrolled', window.scrollY > 80);
      }
    });

    // Active nav
    var sections = document.querySelectorAll('.section[id]');
    var navLinks = document.querySelectorAll('.nav-link');

    sections.forEach(function (section) {
      ScrollTrigger.create({
        trigger: section,
        start: 'top center',
        end: 'bottom center',
        onEnter: function () { setActiveNav(section.id); },
        onEnterBack: function () { setActiveNav(section.id); }
      });
    });

    function setActiveNav(id) {
      navLinks.forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('href') === '#' + id);
      });
    }
  }

  /* ---------- Hero text reveal (sequenced) ---------- */
  function initHeroReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal-hero').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    var tl = gsap.timeline({ delay: 0.6 });
    var heroEls = document.querySelectorAll('.reveal-hero');

    heroEls.forEach(function (el, i) {
      tl.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out'
      }, i * 0.18);
    });

    // Scroll indicator fade
    var scrollInd = document.querySelector('.hero-scroll-indicator');
    if (scrollInd) {
      tl.from(scrollInd, { opacity: 0, duration: 1 }, 1.2);
    }
  }

  /* ---------- Scroll Reveal ---------- */
  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    gsap.utils.toArray('.reveal').forEach(function (el, i) {
      gsap.to(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true
        },
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power2.out',
        delay: el.closest('.why-cards, .contact-grid, .process-steps, .product-grid')
          ? (Array.prototype.indexOf.call(el.parentElement.children, el) % 4) * 0.1
          : 0
      });
    });
  }

  /* ---------- Product Tabs ---------- */
  function initProductTabs() {
    var tabsContainer = document.getElementById('productTabs');
    if (!tabsContainer) return;

    var tabs = tabsContainer.querySelectorAll('.tab-btn');
    var cards = document.querySelectorAll('.product-card');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var category = this.dataset.category;

        tabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');

        var delay = 0;
        cards.forEach(function (card) {
          if (category === 'all' || card.dataset.category === category) {
            card.classList.remove('hidden');
            gsap.fromTo(card,
              { opacity: 0, y: 24, scale: 0.96 },
              { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power2.out', delay: delay }
            );
            delay += 0.06;
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });
  }

  /* ---------- 3D Tilt ---------- */
  function initTiltCards() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if ('ontouchstart' in window) return;

    document.querySelectorAll('.tilt-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        var rotateX = (y - 0.5) * -10;
        var rotateY = (x - 0.5) * 10;

        gsap.to(card, {
          rotateX: rotateX,
          rotateY: rotateY,
          transformPerspective: 800,
          duration: 0.4,
          ease: 'power2.out'
        });
      });

      card.addEventListener('mouseleave', function () {
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.5)'
        });
      });
    });
  }

  /* ---------- Process Line ---------- */
  function initProcessLine() {
    var lineFill = document.getElementById('processLineFill');
    var steps = document.querySelectorAll('.process-step');
    if (!lineFill || steps.length === 0) return;

    if (window.innerWidth < 768) {
      steps.forEach(function (s) { s.classList.add('active'); });
      return;
    }

    ScrollTrigger.create({
      trigger: '.process-track',
      start: 'top 70%',
      end: 'bottom 50%',
      scrub: 0.5,
      onUpdate: function (self) {
        var p = self.progress;
        lineFill.style.width = (p * 100) + '%';
        steps.forEach(function (step, i) {
          step.classList.toggle('active', p >= i / (steps.length - 1) - 0.05);
        });
      }
    });
  }

  /* ---------- Demo Video Animation ---------- */
  function initDemoAnimation() {
    var videoWrap = document.querySelector('.demo-video-wrap');
    if (!videoWrap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.fromTo(videoWrap, { scale: 0.88, opacity: 0.3 }, {
      scale: 1,
      opacity: 1,
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: videoWrap,
        start: 'top 85%',
        end: 'top 35%',
        scrub: 1
      }
    });
  }

  /* ---------- Parallax sections (subtle depth) ---------- */
  function initParallaxSections() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.querySelectorAll('.section-header').forEach(function (header) {
      gsap.to(header, {
        y: -20,
        scrollTrigger: {
          trigger: header,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }
      });
    });
  }

  /* ---------- FAB ---------- */
  function initFAB() {
    var fabWrap = document.getElementById('fabWrap');
    var fabMain = document.getElementById('fabMain');
    var options = document.querySelectorAll('.fab-option');
    if (!fabMain) return;

    var isOpen = false;

    fabMain.addEventListener('click', function () {
      isOpen = !isOpen;
      fabWrap.classList.toggle('open', isOpen);

      if (isOpen) {
        options.forEach(function (opt, i) {
          opt.classList.add('visible');
          gsap.to(opt, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.45,
            delay: i * 0.08,
            ease: 'back.out(2)'
          });
        });
      } else {
        options.forEach(function (opt, i) {
          gsap.to(opt, {
            opacity: 0,
            scale: 0.5,
            y: 20,
            duration: 0.25,
            delay: (options.length - 1 - i) * 0.05,
            ease: 'power2.in',
            onComplete: function () {
              if (!isOpen) opt.classList.remove('visible');
            }
          });
        });
      }
    });

    document.addEventListener('click', function (e) {
      if (isOpen && !fabWrap.contains(e.target)) {
        fabMain.click();
      }
    });

    // Show FAB after scrolling a bit
    gsap.set(fabWrap, { opacity: 0, scale: 0.8 });
    ScrollTrigger.create({
      start: 'top -300',
      onEnter: function () {
        gsap.to(fabWrap, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' });
      },
      onLeaveBack: function () {
        gsap.to(fabWrap, { opacity: 0, scale: 0.8, duration: 0.3 });
      }
    });
  }

  /* ---------- SMS ---------- */
  function initSmsLinks() {
    var phone = '010-5678-1898';
    var body = '밀포인트 용기 문의드립니다.';
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var sep = isIOS ? '&' : '?';
    var href = 'sms:' + phone + sep + 'body=' + encodeURIComponent(body);

    var smsLink = document.getElementById('smsLink');
    if (smsLink) smsLink.href = href;
    var fabSms = document.getElementById('fabSms');
    if (fabSms) fabSms.href = href;
  }

  /* ---------- Mobile Menu ---------- */
  function initMobileMenu() {
    var btn = document.getElementById('mobileMenuBtn');
    var nav = document.getElementById('headerNav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      btn.classList.toggle('active');
      nav.classList.toggle('open');
      document.body.style.overflow = nav.classList.contains('open') ? 'hidden' : '';
    });

    nav.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        btn.classList.remove('active');
        nav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------- Smooth Scroll ---------- */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        var headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
        var top = target.getBoundingClientRect().top + window.pageYOffset - headerH;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
