import { useEffect, type RefObject } from 'react';

/** Homepage-scoped scroll choreography. No app-shell/global smooth scrolling. */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let alive = true;
    let dispose = () => {};
    let rebuild = () => {};
    let refreshFrame = 0;
    // The bench-ready event follows setStatus; measure after React commits it.
    const refresh = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; if (alive) rebuild(); });
    };
    window.addEventListener('whereabouts:bench-ready', refresh);
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')]).then(([{ gsap }, { ScrollTrigger }, { default: Lenis }]) => {
      if (!alive || !rootRef.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const root = rootRef.current;
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        let active = true;
        ScrollTrigger.enable();
        const lenis = new Lenis({ duration: .85, smoothWheel: true, anchors: true, prevent: (node) => Boolean(node.closest('textarea,[role="dialog"],[data-lenis-prevent]')) });
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        lenis.on('scroll', ScrollTrigger.update);
        let context: ReturnType<typeof gsap.context> | null = null;
        let originals: Array<{ element: HTMLElement; html: string }> = [];
        let generated: HTMLElement[] = [];
        const restore = () => {
          context?.revert();
          originals.forEach(({ element, html }) => { element.innerHTML = html; });
          originals = [];
          generated.forEach((element) => element.remove());
          generated = [];
        };
        rebuild = () => {
          restore();
          context = gsap.context(() => {
            const headings = root.querySelectorAll<HTMLElement>('.wa-hero-title h1,.wa-section-heading h2,.wa-workflows h2,.wa-stack h2');
            headings.forEach((heading) => {
              originals.push({ element: heading, html: heading.innerHTML });
              const html = heading.innerHTML.split(/<br\s*\/?>/i);
              heading.innerHTML = html.map((line) => `<span class="wa-scroll-line"><span>${line}</span></span>`).join('');
              gsap.fromTo(heading.querySelectorAll('.wa-scroll-line > span'), { yPercent: 105, clipPath: 'inset(0 0 100% 0)' }, {
                yPercent: 0, clipPath: 'inset(0 0 0% 0)', stagger: .13, ease: 'none',
                scrollTrigger: { trigger: heading, start: 'top 95%', end: 'top 45%', scrub: .55 },
              });
            });
            root.querySelectorAll<HTMLElement>('.wa-methods,.wa-pipeline,.wa-stack,.wa-workflows').forEach((section) => {
              const labels = section.querySelectorAll('.wa-eyebrow,.wa-pipeline-tab > span,.wa-method-tab > span:first-child,.wa-workflow > span');
              gsap.fromTo(labels, { opacity: .2, y: 17 }, { opacity: 1, y: 0, stagger: .08, ease: 'none', scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 35%', scrub: .6 } });
              const title = section.querySelector('.wa-section-heading > div,.wa-stack-intro');
              const body = section.querySelector('.wa-method-grid,.wa-pipeline-detail,.wa-stack-row');
              if (title) gsap.fromTo(title, { y: 20 }, { y: -16, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: .7 } });
              if (body) gsap.fromTo(body, { y: 38 }, { y: -8, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: .85 } });
            });
            const stage = root.querySelector<HTMLElement>('[data-testid="stage-optical-loupe"]');
            const desktop = matchMedia('(min-width: 900px) and (pointer: fine)').matches;
            if (stage) {
              const photo = { scale: 1.055 };
              gsap.to(photo, { scale: 1, ease: 'none', onUpdate: () => stage.dispatchEvent(new CustomEvent('whereabouts:photo-scale', { detail: photo.scale })), scrollTrigger: {
                trigger: stage, start: 'top top', end: '+=65%', pin: desktop, pinSpacing: true, scrub: .7, anticipatePin: 0, refreshPriority: 1, invalidateOnRefresh: true,
                onUpdate: (self) => { const counter = stage.querySelector('[data-scroll-progress]'); if (counter) counter.textContent = `${String(Math.round(self.progress * 100)).padStart(3,'0')}%`; },
              } });
            }
            const pipeline = root.querySelector<HTMLElement>('.wa-pipeline');
            if (pipeline) {
              const meter = document.createElement('p');
              meter.className = 'wa-scroll-section-counter'; meter.textContent = 'SCROLL / 000%'; meter.setAttribute('aria-hidden', 'true');
              pipeline.appendChild(meter);
              generated.push(meter);
              const progress = { value: 0 };
              gsap.to(progress, { value: 100, ease: 'none', onUpdate: () => { meter.textContent = `SCROLL / ${String(Math.round(progress.value)).padStart(3,'0')}%`; }, scrollTrigger: {
                trigger: pipeline, start: 'top top+=24', end: '+=45%', pin: desktop && pipeline.offsetHeight < innerHeight - 48, scrub: .6,
              } });
            }
          }, root);
          ScrollTrigger.sort();
          ScrollTrigger.refresh();
        };
        rebuild();
        // Fonts can change the intro height after the photo first initializes.
        void document.fonts.ready.then(() => { if (active) { ScrollTrigger.sort(); ScrollTrigger.refresh(); } });
        return () => {
          active = false;
          rebuild = () => {};
          restore();
          root.querySelectorAll('.wa-scroll-section-counter').forEach((node) => node.remove());
          gsap.ticker.remove(tick);
          lenis.off('scroll', ScrollTrigger.update);
          lenis.destroy();
          root.querySelectorAll('[data-scroll-progress]').forEach((node) => { node.textContent = '000%'; });
          root.querySelectorAll('[data-testid="stage-optical-loupe"]').forEach((stage) => stage.dispatchEvent(new CustomEvent('whereabouts:photo-scale', { detail: 1 })));
          if (!ScrollTrigger.getAll().length) ScrollTrigger.disable();
        };
      }, root);
      dispose = () => { media.revert(); if (!ScrollTrigger.getAll().length) ScrollTrigger.disable(); };
    }).catch(() => { /* Native scroll and all content remain usable. */ });
    return () => { alive = false; cancelAnimationFrame(refreshFrame); window.removeEventListener('whereabouts:bench-ready', refresh); dispose(); };
  }, [rootRef]);
}
