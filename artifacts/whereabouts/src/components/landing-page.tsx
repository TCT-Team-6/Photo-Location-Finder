import { useRef } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Camera, ListChecks, MessageSquareText, Phone } from 'lucide-react';
import { PhotoInstrument } from '@/components/photo-instrument';
import { useLandingMotion } from '@/hooks/use-landing-motion';
import { SiteFrame } from '@/components/site-chrome';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Photo investigations need an account; sign in then land directly on the photo desk. */
const photoFlowHref = `/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${basePath}/investigate`)}`;

const steps = [
  { icon: Camera, title: 'Add what you have', body: 'Upload a photo you are allowed to use, or describe what happened in your own words.' },
  { icon: ListChecks, title: 'Review the leads', body: 'See possible places with a confidence score and the clues behind each one. Nothing is treated as certain.' },
  { icon: MessageSquareText, title: 'Share a clear summary', body: 'Keep notes in one private record and prepare plain facts for responders or editors.' },
];

const audiences = [
  { title: 'Families and caregivers', body: 'Keep the timeline, care needs, and authorized photos together for responders. A recent photo is never used to match faces or track a person.' },
  { title: 'Search and rescue volunteers', body: 'Keep photos, links, and tips in one private case. Check each lead yourself before passing it on.' },
  { title: 'Journalists and travellers', body: 'Compare signs, terrain, and landmarks with possible places. Treat every suggestion as a starting point to check.' },
];

export function LandingPage() {
  const ref = useRef<HTMLDivElement>(null);
  useLandingMotion(ref);
  return (
    <div ref={ref} className="wa-landing">
      <SiteFrame>
        <main>
          <section className="wa-home-hero" aria-labelledby="home-title">
            <div className="wa-home-hero-copy">
              <span className="wa-mono wa-home-tag">Private notebook</span>
              <h1 id="home-title">Look closer.<br /><span>Find context.</span></h1>
              <p>Find out where a photo may have been taken, or organize an authorized missing-person report for responders. Everything stays private to your account.</p>
            </div>
            <div className="wa-home-hero-bench min-w-0"><PhotoInstrument /></div>
            <div className="wa-home-actions">
              <Link href={photoFlowHref} className="wa-home-action" data-testid="link-home-find-photo">
                <span>Find where a photo was taken</span><ArrowRight size={22} aria-hidden="true" />
              </Link>
              <Link href="/start" className="wa-home-action wa-home-action-alt" data-testid="link-home-report-missing">
                <span>Report a missing person</span><ArrowRight size={22} aria-hidden="true" />
              </Link>
              <p className="wa-home-emergency" data-testid="text-home-emergency"><Phone size={18} aria-hidden="true" />If someone is in danger, call 911 first. Results are leads to check, not proof.</p>
            </div>
          </section>

          <section className="wa-home-section" id="how-it-works" aria-labelledby="how-title">
            <h2 id="how-title">How it works</h2>
            <ol className="wa-home-steps">
              {steps.map((step, i) => (
                <li key={step.title} data-testid={`card-how-step-${i + 1}`}>
                  <span className="wa-home-step-number" aria-hidden="true">{i + 1}</span>
                  <step.icon size={26} aria-hidden="true" />
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="wa-home-section" aria-labelledby="who-title">
            <h2 id="who-title">Who it helps</h2>
            <div className="wa-home-audiences">
              {audiences.map((item, i) => (
                <article key={item.title} data-testid={`card-audience-${i + 1}`}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="wa-home-safety" aria-labelledby="safety-title" data-testid="section-home-safety">
            <div>
              <h2 id="safety-title">Safety comes first</h2>
              <p>Whereabouts looks at places in a photo, never at faces. It does not track people and it does not replace emergency services.</p>
            </div>
            <ul>
              <li><strong>Call for help first.</strong> If someone is in danger, contact 911 or your local emergency number before anything else.</li>
              <li><strong>Use only what you are allowed to share.</strong> Private cases are never matched against faces, searched online, or sent for location analysis on their own.</li>
              <li><strong>Check every lead.</strong> Scores and places are estimates. Confirm them with maps, people on the ground, or official sources.</li>
            </ul>
            <Link href="/about" className="wa-home-safety-link" data-testid="link-home-about">Read how it works in detail</Link>
          </section>
        </main>
      </SiteFrame>
    </div>
  );
}
