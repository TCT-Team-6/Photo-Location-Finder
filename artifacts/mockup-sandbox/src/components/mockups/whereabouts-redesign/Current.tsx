import type { ReactNode, AnchorHTMLAttributes } from 'react';
import {Crosshair, ArrowRight, ShieldCheck, MapPin} from 'lucide-react';
import './_group.css';
function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} onClick={e => e.preventDefault()} />; }
function Mark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-3 ${inverse ? 'text-[#f5f0e5]' : 'text-[#263d36]'}`} data-testid="link-brand-home">
      <span className={`grid h-10 w-10 place-items-center rounded-full ${inverse ? 'bg-[#d78b5a] text-[#243b34]' : 'bg-[#385e51] text-[#f5f0e5]'}`}>
        <Crosshair size={22} strokeWidth={1.7} />
      </span>
      <span className="font-editorial text-[25px] leading-none tracking-[-.04em]">whereabouts</span>
    </Link>
  );
}

function ActionLink({ href, children, secondary = false, testId }: { href: string; children: ReactNode; secondary?: boolean; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className={`inline-flex min-h-12 min-w-max items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${secondary ? 'border border-[#b9c4b5] bg-transparent text-[#385e51] hover:bg-[#e8e4d8]' : 'bg-[#d78b5a] text-[#233b35] hover:bg-[#e29b6d]'}`}>
      {children}
    </Link>
  );
}


function LandingHero() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f4f0e6] text-[#263d36]">
      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 md:px-12">
        <Mark />
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" data-testid="link-sign-in" className="hidden rounded-full px-5 py-3 text-sm font-semibold text-[#385e51] transition hover:bg-[#e8e4d8] sm:inline-flex">Sign in</Link>
          <ActionLink href="/start" testId="link-get-started">Start a search <ArrowRight size={16} /></ActionLink>
        </nav>
      </header>
      <section className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-6 pb-20 pt-10 md:grid-cols-[1.02fr_.98fr] md:px-12 md:pb-28 md:pt-16">
        <div className="fade-up relative z-10 max-w-[670px]">
          <p className="mb-7 inline-flex items-center gap-2 font-data text-[10px] uppercase tracking-[.2em] text-[#657d6f]"><span className="h-2 w-2 rounded-full bg-[#c8794d]" />A search tool for families and rescue teams</p>
          <h1 className="font-editorial text-[clamp(3.65rem,8.5vw,7.6rem)] leading-[.88] tracking-[-.065em]">Every hour matters.<br /><em className="font-normal text-[#c8794d]">Every photo is a clue.</em></h1>
          <p className="mt-8 max-w-[520px] text-lg leading-8 text-[#62756c] md:text-xl">When someone vulnerable goes missing, their last photo often holds the best clue to where they are. Whereabouts uses AI to read that photo and point searchers to the most likely places, in minutes instead of hours.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ActionLink href="/start" testId="link-start-search">Start a search <ArrowRight size={16} /></ActionLink>
            <ActionLink href="/demo" secondary testId="link-see-sample-case">See a sample case</ActionLink>
          </div>
          <div className="mt-8 flex items-center gap-4 border-t border-[#d8d1c2] pt-5">
            <ShieldCheck size={18} className="text-[#627d6d]" />
            <p className="text-sm text-[#6f7f76]">Private by default. Built for safety, never for tracking.</p>
          </div>
        </div>
        <div className="fade-up-delay relative mx-auto w-full max-w-[590px]">
          <div className="landing-map relative aspect-[.97] overflow-hidden rounded-[44%_44%_46%_44%] border border-[#d4cdbd] shadow-[0_34px_80px_rgba(42,58,48,.15)]">
            <div className="contour absolute inset-[-8%] opacity-75" />
            <svg className="absolute inset-0 h-full w-full opacity-65" viewBox="0 0 600 600" fill="none" aria-hidden="true">
              <path d="M-10 338C83 294 123 347 206 304s132-116 221-91 108 29 197-17" stroke="#728c76" strokeWidth="2" strokeDasharray="6 8" />
              <path d="M48 72c87 22 94 113 171 125 73 11 117-61 190-45s93 105 173 98" stroke="#b8835d" strokeWidth="1.6" />
              <path d="M49 514c63-73 126-38 188-79s86-108 165-87 95 72 170 22" stroke="#718a78" strokeWidth="2" strokeDasharray="3 7" />
              <path d="M320 0c-25 115-22 148 41 222s16 148-10 207 7 113 90 188" stroke="#8a9b81" strokeWidth="1.5" />
              <path d="M0 238c66-14 91-36 113-94s57-82 132-99" stroke="#8a9b81" strokeWidth="1.5" />
            </svg>
            <div className="absolute left-[18%] top-[19%] rotate-[-5deg] rounded-sm bg-[#faf7ee] p-2.5 pb-8 shadow-xl">
              <div className="h-[190px] w-[145px] bg-[#d3d0c2]">
                <div className="relative h-full overflow-hidden bg-[linear-gradient(155deg,#839687_0%,#c9c6ae_43%,#ba8c6d_44%,#d1aa80_56%,#8c9b82_57%)]">
                  <div className="absolute left-[45%] top-0 h-full w-2 rotate-[11deg] bg-[#e9dfc7]/80" />
                  <div className="absolute bottom-0 left-[-15%] h-[56%] w-[140%] rounded-[50%_50%_0_0] bg-[#728477]/70" />
                  <div className="absolute bottom-[18%] left-[18%] h-10 w-12 rotate-[-5deg] border-2 border-[#665f4b]/70" />
                  <div className="absolute right-[15%] top-[13%] h-9 w-9 rounded-full bg-[#e1ba7c]/75" />
                </div>
              </div>
            </div>
            <div className="absolute right-[8%] top-[18%] rounded-full border border-[#a4ad9a] bg-[#f5f0e4]/90 px-4 py-2 font-data text-[9px] uppercase tracking-[.14em] text-[#58705f]">Trail marker spotted</div>
            <div className="map-pin absolute left-[57%] top-[58%] grid h-12 w-12 place-items-center rounded-full bg-[#c8794d] text-[#fff7e9]"><MapPin size={22} /></div>
            <div className="absolute bottom-[16%] right-[9%] rotate-[4deg] rounded-sm border border-[#d6cfbf] bg-[#faf7ee]/95 px-5 py-4 shadow-lg">
              <p className="font-data text-[9px] uppercase tracking-[.18em] text-[#a36a47]">Urgency: High</p>
              <p className="mt-1 font-editorial text-xl text-[#334b3f]">Sunset in about 2 hours</p>
            </div>
          </div>
        </div>
      </section>

</main>); }
export function Current() {return <div data-app-theme="rescue" data-app-font="default" data-high-contrast="false"><LandingHero /></div>;}
