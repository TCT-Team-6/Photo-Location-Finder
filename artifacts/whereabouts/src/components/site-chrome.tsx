import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Crosshair } from 'lucide-react';

export function SiteBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`wa-brand inline-flex items-center gap-3 ${inverse ? 'wa-brand-inverse' : ''}`} data-testid="link-brand-home">
      <span className="wa-brand-icon"><Crosshair size={22} strokeWidth={1.7} /></span>
      <span className="font-editorial text-[25px] leading-none tracking-[-.055em]">whereabouts</span>
    </Link>
  );
}

/** Public top navigation. Sign in lives here, never as a floating prompt. */
export function SiteHeader() {
  const [location] = useLocation();
  return (
    <header className="wa-site-header">
      <SiteBrand />
      <nav className="wa-site-nav" aria-label="Main navigation">
        <Link href="/" aria-current={location === '/' ? 'page' : undefined} data-testid="link-nav-home">Home</Link>
        <Link href="/about" aria-current={location === '/about' ? 'page' : undefined} data-testid="link-nav-about">About</Link>
        <Link href="/demo" data-testid="link-nav-samples">Samples</Link>
        <Link href="/sign-in" className="wa-site-signin" data-testid="link-sign-in">Sign in</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="wa-site-footer">
      <SiteBrand inverse />
      <p>Private by default. Results are leads to check, not proof.</p>
      <div className="wa-site-footer-links">
        <Link href="/about" data-testid="link-footer-about">About</Link>
        <Link href="/sign-in" data-testid="link-footer-sign-in">Sign in</Link>
      </div>
    </footer>
  );
}

export function SiteFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`wa-site min-h-[100dvh] ${className}`}><SiteHeader />{children}<SiteFooter /></div>;
}
