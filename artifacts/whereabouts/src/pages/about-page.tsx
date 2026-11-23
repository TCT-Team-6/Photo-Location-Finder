import { useEffect } from 'react';
import { Crosshair, ShieldCheck } from 'lucide-react';
import { FiveStagePipeline, GeolocationMethods, TechnologyNotes } from '@/components/field-notes';
import { SiteFrame } from '@/components/site-chrome';

export default function AboutPage() {
  useEffect(() => { document.title = 'About Whereabouts'; }, []);
  return (
    <div className="wa-landing wa-about">
      <SiteFrame>
        <main>
          <section className="wa-about-intro" aria-labelledby="about-title">
            <span className="wa-mono wa-home-tag">About</span>
            <h1 id="about-title" data-testid="text-about-title">How Whereabouts works</h1>
            <p>Whereabouts has two separate workspaces. One studies the place shown in a photo. The other keeps an authorized missing-person report organized for responders. They never share data automatically.</p>
            <div className="wa-about-workspaces">
              <article><Crosshair size={24} aria-hidden="true" /><h2>Photo investigation</h2><p>For investigations, travel photos, and journalism. You see visual clues and possible places. A suggested place is a lead to review, not a confirmed location.</p></article>
              <article><ShieldCheck size={24} aria-hidden="true" /><h2>Missing-person report</h2><p>The AI Guide asks only for what is missing and helps you write a clear summary. Case photos are not used for location analysis or face matching.</p></article>
            </div>
          </section>
          <GeolocationMethods />
          <FiveStagePipeline />
          <TechnologyNotes />
          <section className="wa-about-intro" aria-labelledby="sample-notes-title">
            <h2 id="sample-notes-title">About the sample photo viewer</h2>
            <p>The forest photograph has a user-supplied possible match to Bachelor and Three Graces in Mariposa Grove, near 37.5039, −119.6043. This is not verified geolocation. The original photo contained no camera metadata; dates, confidence, and tree clues are supplied estimates.</p>
            <p>Other examples use prepared fictional records. Moving numbers in the lens are decoration, not changes to the photo. Hold still for a second to see clue notes. The viewer does not run live analysis or identify faces.</p>
          </section>
        </main>
      </SiteFrame>
    </div>
  );
}
