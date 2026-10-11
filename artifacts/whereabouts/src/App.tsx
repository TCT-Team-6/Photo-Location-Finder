import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Compass, Crosshair, FileImage, Globe2, ImagePlus, Layers3, LoaderCircle, LogOut, MapPin, Menu, Search, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import {
  getGetInvestigationQueryKey,
  getGetInvestigationPhotoQueryKey,
  getGetInvestigationSummaryQueryKey,
  getListInvestigationsQueryKey,
  useCreateInvestigation,
  useDeleteInvestigation,
  useGetInvestigation,
  useGetInvestigationPhoto,
  useGetInvestigationSummary,
  useHealthCheck,
  useListInvestigations,
  useRequestUploadUrl,
  useUpdateInvestigation,
} from '@workspace/api-client-react';
import type { Investigation, InvestigationInputContentType } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PhotoUploadSlot, type PhotoUploadSlotDefinition, type PhotoUploadSlotId } from '@/components/photo-upload-slot';
import {
  clearErrorsForSelectedPhotoSlots,
  processInvestigationPhotoUploads,
} from '@/lib/investigation-photo-uploads';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const supportedImageTypes = new Set<InvestigationInputContentType>([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
  'image/bmp', 'image/x-ms-bmp', 'image/tiff', 'image/x-tiff', 'image/heic', 'image/heif',
]);
const imageTypeByExtension: Record<string, InvestigationInputContentType> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp', tif: 'image/tiff',
  tiff: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
};

function imageContentType(file: File): InvestigationInputContentType | null {
  const declaredType = file.type.toLowerCase() as InvestigationInputContentType;
  if (supportedImageTypes.has(declaredType)) return declaredType;
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return extension ? imageTypeByExtension[extension] ?? null : null;
}

const investigationPhotoSlots: PhotoUploadSlotDefinition[] = [
  {
    id: 'original',
    label: 'Original photo',
    description: 'The image you want to investigate.',
  },
  {
    id: 'recreation',
    label: 'Recreation',
    description: 'A recreated or staged version of the scene.',
  },
  {
    id: 'fake-news',
    label: 'Fake News',
    description: 'An image associated with a news claim.',
  },
];

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#385e51',
    colorForeground: '#263d36',
    colorMutedForeground: '#718078',
    colorDanger: '#a64e43',
    colorBackground: '#f8f5ed',
    colorInput: '#fbf9f3',
    colorInputForeground: '#263d36',
    colorNeutral: '#d8d1c2',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#f8f5ed] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d8d1c2]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-semibold text-[#263d36]',
    headerSubtitle: 'text-[#718078]',
    socialButtonsBlockButtonText: 'text-[#263d36] font-medium',
    formFieldLabel: 'text-[#344b42] font-medium',
    footerActionLink: 'text-[#385e51] font-semibold',
    footerActionText: 'text-[#718078]',
    dividerText: 'text-[#718078]',
    identityPreviewEditButton: 'text-[#385e51]',
    formFieldSuccessText: 'text-[#385e51]',
    alertText: 'text-[#a64e43]',
    logoBox: 'rounded-lg',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'border-[#d8d1c2] bg-[#fbf9f3] hover:bg-[#f0ece2]',
    formButtonPrimary: 'bg-[#385e51] hover:bg-[#2d5045] text-[#fbf9f3] shadow-none',
    formFieldInput: 'bg-[#fbf9f3] border-[#d8d1c2] text-[#263d36]',
    footerAction: 'text-[#718078]',
    dividerLine: 'bg-[#d8d1c2]',
    alert: 'border-[#dbb6a8] bg-[#fbefeb]',
    otpCodeFieldInput: 'border-[#d8d1c2] bg-[#fbf9f3] text-[#263d36]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

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

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/user-portal" /></Show><Show when="signed-out"><LandingPage /></Show></>;
}

function LandingPage() {
  const health = useHealthCheck();
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f4f0e6] text-[#263d36]">
      <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 md:px-12">
        <Mark />
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" data-testid="link-sign-in" className="hidden rounded-full px-5 py-3 text-sm font-semibold text-[#385e51] transition hover:bg-[#e8e4d8] sm:inline-flex">Sign in</Link>
          <ActionLink href="/sign-up" testId="link-get-started"><span className="hidden sm:inline">Start an investigation</span><span className="sm:hidden">Investigate</span><ArrowRight size={16} /></ActionLink>
        </nav>
      </header>
      <section className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-6 pb-20 pt-10 md:grid-cols-[1.02fr_.98fr] md:px-12 md:pb-28 md:pt-16">
        <div className="fade-up relative z-10 max-w-[670px]">
          <p className="mb-7 inline-flex items-center gap-2 font-data text-[10px] uppercase tracking-[.2em] text-[#657d6f]"><span className="h-2 w-2 rounded-full bg-[#c8794d]" />A field notebook for image sleuths</p>
          <h1 className="font-editorial text-[clamp(3.65rem,8.5vw,7.6rem)] leading-[.88] tracking-[-.065em]">Every image<br />has a <em className="font-normal text-[#c8794d]">somewhere.</em></h1>
          <p className="mt-8 max-w-[520px] text-lg leading-8 text-[#62756c] md:text-xl">Follow the details hiding in a photograph. Gather the clues, compare likely places, and keep the trail somewhere private.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ActionLink href="/sign-up" testId="link-create-private-notebook">Open your notebook <ArrowRight size={16} /></ActionLink>
            <ActionLink href="/sign-in" secondary testId="link-returning-sleuth">I have an account</ActionLink>
          </div>
          <div className="mt-12 flex items-center gap-4 border-t border-[#d8d1c2] pt-5">
            <ShieldCheck size={18} className="text-[#627d6d]" />
            <p className="text-sm text-[#6f7f76]">Private by default. Your photos and findings stay yours.</p>
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
              <span className="absolute bottom-2 left-3 font-editorial text-sm italic text-[#59675c]">the original clue</span>
            </div>
            <div className="absolute right-[12%] top-[21%] rounded-full border border-[#a4ad9a] bg-[#f5f0e4]/90 px-4 py-2 font-data text-[9px] uppercase tracking-[.14em] text-[#58705f]">coastal light?</div>
            <div className="map-pin absolute left-[57%] top-[58%] grid h-12 w-12 place-items-center rounded-full bg-[#c8794d] text-[#fff7e9]"><MapPin size={22} /></div>
            <div className="absolute bottom-[16%] right-[9%] rotate-[4deg] rounded-sm border border-[#d6cfbf] bg-[#faf7ee]/95 px-5 py-4 shadow-lg">
              <p className="font-data text-[9px] uppercase tracking-[.18em] text-[#a36a47]">Field note 04</p>
              <p className="mt-1 font-editorial text-xl text-[#334b3f]">trace the horizon</p>
            </div>
            <div className="absolute bottom-[12%] left-[12%] rounded-full border border-[#9aa697] bg-[#eff0e5] px-4 py-2 text-xs text-[#4e6d5d]">3 visual clues</div>
          </div>
          <span className="absolute -right-2 top-[52%] hidden rotate-90 font-data text-[9px] uppercase tracking-[.23em] text-[#78897b] md:block">IMAGE / MEMORY / PLACE</span>
        </div>
        <div className="absolute bottom-8 left-12 hidden font-data text-[9px] uppercase tracking-[.18em] text-[#899589] md:block">N 37° 46′ 49″ &nbsp; / &nbsp; FIELD INDEX 01</div>
      </section>
      <section className="bg-[#263d36] px-6 py-20 text-[#f4f0e6] md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-[.75fr_1.25fr] md:gap-24">
          <div>
            <p className="font-data text-[10px] uppercase tracking-[.2em] text-[#d78b5a]">A slower kind of search</p>
            <h2 className="mt-5 font-editorial text-5xl leading-[.98] tracking-[-.04em] md:text-6xl">Look closer.<br /><em className="font-normal text-[#d78b5a]">Get somewhere.</em></h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <Feature number="01" icon={<ImagePlus size={18} />} title="Bring the image" text="Upload the photograph and add the fragments you already know." />
            <Feature number="02" icon={<Crosshair size={18} />} title="Read the scene" text="Turn architecture, terrain, and light into a trail of visual evidence." />
            <Feature number="03" icon={<BookOpen size={18} />} title="Keep the trail" text="Save likely places and notes in a personal, searchable archive." />
          </div>
        </div>
      </section>
      <section className="paper-grid px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-9 rounded-[28px] border border-[#d6cfbf] bg-[#f7f3e9]/85 p-8 md:flex-row md:items-center md:p-12">
          <div className="max-w-[650px]">
            <p className="font-data text-[10px] uppercase tracking-[.2em] text-[#9d6c4d]">Start with what you have</p>
            <h2 className="mt-4 font-editorial text-4xl leading-tight tracking-[-.04em] md:text-5xl">A corner of a roof. A certain kind of light. A feeling you can’t place.</h2>
            <p className="mt-4 max-w-[560px] leading-7 text-[#65766c]">Whereabouts gives your curiosity a place to begin—and a notebook to return to.</p>
          </div>
          <ActionLink href="/sign-up" testId="link-begin-field-notes">Begin your field notes <ArrowRight size={16} /></ActionLink>
        </div>
      </section>
      <footer className="flex flex-col items-center justify-between gap-4 bg-[#263d36] px-6 py-6 text-[#c1cbbd] md:flex-row md:px-12">
        <Mark inverse />
        <p className="font-data text-[9px] uppercase tracking-[.16em]">Private by nature · {health.isLoading ? 'checking field systems' : health.isError ? 'field systems unavailable' : 'field systems online'}</p>
        <Link href="/sign-in" data-testid="link-footer-sign-in" className="text-xs text-[#e4e8dc] hover:text-[#d78b5a]">Return to your notebook</Link>
      </footer>
    </main>
  );
}

function Feature({ number, icon, title, text }: { number: string; icon: ReactNode; title: string; text: string }) {
  return <article className="border-t border-[#597064] pt-5">
    <div className="flex items-center justify-between text-[#d78b5a]"><span className="font-data text-[10px] tracking-[.18em]">{number}</span>{icon}</div>
    <h3 className="mt-8 font-editorial text-2xl">{title}</h3>
    <p className="mt-3 text-sm leading-6 text-[#bdc9bd]">{text}</p>
  </article>;
}

function SignInPage() {
  return <div className="clerk-frame min-h-[100dvh] px-4 py-7">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Mark /><Link href="/" className="text-sm text-[#62756c] hover:text-[#385e51]" data-testid="link-auth-back">Back to Whereabouts</Link></div>
    <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[30px] border border-[#d8d1c2] bg-[#eee9dc] md:grid md:grid-cols-[.92fr_1.08fr]">
      <div className="relative hidden min-h-[690px] overflow-hidden bg-[#263d36] p-12 text-[#f4f0e6] md:flex md:flex-col md:justify-between">
        <div className="contour absolute inset-0 opacity-35" />
        <div className="relative"><p className="font-data text-[10px] uppercase tracking-[.2em] text-[#d78b5a]">The private field notebook</p><h1 className="mt-7 font-editorial text-6xl leading-[.94] tracking-[-.05em]">Pick up<br />the trail.</h1><p className="mt-6 max-w-sm text-[#c4d0c2]">Your saved photographs, observations, and likely places are waiting where you left them.</p></div>
        <div className="relative border-t border-[#5c7465] pt-5 font-data text-[9px] uppercase tracking-[.17em] text-[#a8b8a9]">INDEX 001 — personal archive</div>
      </div>
      <div className="flex min-h-[690px] items-center justify-center px-4 py-12 sm:px-10"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>
    </div>
    <p className="mt-6 text-center font-data text-[9px] uppercase tracking-[.14em] text-[#849087]">Private by default · your photographs stay yours</p>
  </div>;
}

function SignUpPage() {
  return <div className="clerk-frame min-h-[100dvh] px-4 py-7">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Mark /><Link href="/" className="text-sm text-[#62756c] hover:text-[#385e51]" data-testid="link-auth-home">Back to Whereabouts</Link></div>
    <div className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-[30px] border border-[#d8d1c2] bg-[#eee9dc] md:grid md:grid-cols-[.92fr_1.08fr]">
      <div className="relative hidden min-h-[730px] overflow-hidden bg-[#263d36] p-12 text-[#f4f0e6] md:flex md:flex-col md:justify-between">
        <div className="contour absolute inset-0 opacity-35" />
        <div className="relative"><p className="font-data text-[10px] uppercase tracking-[.2em] text-[#d78b5a]">Open a new notebook</p><h1 className="mt-7 font-editorial text-6xl leading-[.94] tracking-[-.05em]">Start with<br />a somewhere.</h1><p className="mt-6 max-w-sm text-[#c4d0c2]">One image can hold a whole journey. Make a private place for the clues you find along the way.</p></div>
        <div className="relative grid grid-cols-3 gap-3">
          {['Image', 'Clues', 'Places'].map((item, i) => <div key={item} className="border-t border-[#5c7465] pt-3"><span className="font-data text-[9px] text-[#d78b5a]">0{i + 1}</span><p className="mt-2 font-editorial text-lg">{item}</p></div>)}
        </div>
      </div>
      <div className="flex min-h-[730px] items-center justify-center px-4 py-12 sm:px-10"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>
    </div>
    <p className="mt-6 text-center font-data text-[9px] uppercase tracking-[.14em] text-[#849087]">A private archive for the places that stay with you</p>
  </div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => {
    let prior: string | null | undefined;
    return addListener(({ user }) => {
      const current = user?.id ?? null;
      if (prior !== undefined && prior !== current) client.clear();
      prior = current;
    });
  }, [addListener, client]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up the trail where you left it.' } }, signUp: { start: { title: 'Start your notebook', subtitle: 'Create a private place for your discoveries.' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/user-portal" component={PortalRoute} />
      <Route path="/investigate" component={InvestigateRoute} />
      <Route path="/library" component={LibraryRoute} />
      <Route path="/investigation/:id" component={DetailRoute} />
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function PortalRoute() { return <Protected><AppShell><DashboardPage /></AppShell></Protected>; }
function InvestigateRoute() { return <Protected><AppShell><InvestigatePage /></AppShell></Protected>; }
function LibraryRoute() { return <Protected><AppShell><LibraryPage /></AppShell></Protected>; }
function DetailRoute() { return <Protected><AppShell><InvestigationPage /></AppShell></Protected>; }

function AppShell({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const firstName = user?.firstName || 'Field researcher';
  const initials = `${user?.firstName?.[0] || 'F'}${user?.lastName?.[0] || ''}`;
  const navLinks = [
    { href: '/user-portal', label: 'Overview', icon: <Compass size={17} /> },
    { href: '/investigate', label: 'New investigation', icon: <ImagePlus size={17} /> },
    { href: '/library', label: 'My library', icon: <BookOpen size={17} /> },
  ];
  return <div className="min-h-[100dvh] bg-[#f4f0e6] text-[#263d36] md:flex">
    <aside className="hidden w-[252px] shrink-0 flex-col bg-[#263d36] px-5 pb-5 pt-6 text-[#f4f0e6] md:flex">
      <Mark inverse />
      <p className="mb-3 mt-12 px-3 font-data text-[9px] uppercase tracking-[.2em] text-[#9aaf9d]">Your field desk</p>
      <nav className="space-y-1">
        {navLinks.map((item) => <Link key={item.href} href={item.href} data-testid={`nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${location === item.href ? 'bg-[#3b5d50] text-[#f5f0e5]' : 'text-[#c1cdbf] hover:bg-white/5 hover:text-white'}`}>{item.icon}{item.label}{item.href === '/investigate' && <span className="ml-auto text-[#d78b5a]">+</span>}</Link>)}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 flex items-center gap-3 border-t border-[#52695d] pt-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d78b5a] text-xs font-semibold text-[#263d36]" data-testid="avatar-initials">{initials}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{firstName}</p><p className="font-data text-[9px] uppercase tracking-[.1em] text-[#a9b8aa]">Private archive</p></div>
        </div>
        <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c1cdbf] transition hover:bg-white/5 hover:text-white"><LogOut size={16} />Sign out</button>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#d8d1c2] bg-[#f4f0e6]/95 px-5 backdrop-blur md:px-10">
        <div className="flex items-center gap-3 md:hidden"><button type="button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" data-testid="button-toggle-navigation" className="grid h-10 w-10 place-items-center rounded-full border border-[#d8d1c2]"><Menu size={18} /></button><Mark /></div>
        <div className="hidden items-center gap-2 font-data text-[9px] uppercase tracking-[.16em] text-[#829087] md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#c8794d]" />Personal field notes <span className="text-[#b2b7a9]">/</span> Anywhere, remembered</div>
        <Link href="/investigate" data-testid="header-new-investigation" className="inline-flex items-center gap-2 rounded-full bg-[#385e51] px-4 py-2.5 text-xs font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044]"><ImagePlus size={15} /><span className="hidden sm:inline">New investigation</span><span className="sm:hidden">New</span></Link>
      </header>
      {mobileNav && <div className="fixed inset-0 z-30 bg-[#182b25]/35 md:hidden" onClick={() => setMobileNav(false)}>
        <nav className="w-[min(84vw,320px)] bg-[#263d36] p-5 text-[#f4f0e6]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-9 flex items-center justify-between"><Mark inverse /><button type="button" onClick={() => setMobileNav(false)} data-testid="button-close-navigation" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={17} /></button></div>
          {navLinks.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} data-testid={`mobile-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#d0d9ce] hover:bg-white/10">{item.icon}{item.label}</Link>)}
          <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="mobile-sign-out" className="mt-7 flex items-center gap-3 border-t border-[#52695d] px-3 pt-5 text-sm text-[#d0d9ce]"><LogOut size={16} />Sign out</button>
        </nav>
      </div>}
      <main className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 md:px-10 md:pt-10">{children}</main>
    </div>
  </div>;
}

function PageEyebrow({ children }: { children: ReactNode }) { return <p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">{children}</p>; }

function SkeletonBlock({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />; }

function QueryError({ retry, text = 'We could not reach your field notes.' }: { retry: () => void; text?: string }) {
  return <div role="alert" className="rounded-2xl border border-[#dfc6b6] bg-[#f9eee6] p-7 text-[#704f3d]" data-testid="status-query-error">
    <p className="font-editorial text-2xl">{text}</p><p className="mt-2 text-sm text-[#886d5a]">Your work is safe. Give it another try.</p>
    <button type="button" onClick={retry} data-testid="button-retry" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#b98d6d] px-4 py-2 text-xs font-semibold"><LoaderCircle size={14} />Try again</button>
  </div>;
}

function DashboardPage() {
  const summary = useGetInvestigationSummary();
  const investigations = useListInvestigations();
  const latest = summary.data?.latest;
  const rows = investigations.data ?? [];
  return <div className="fade-up">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><PageEyebrow>Personal archive / overview</PageEyebrow><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">Your field desk.</h1><p className="mt-3 text-sm text-[#718078]">A little further along the trail.</p></div>
      <Link href="/investigate" data-testid="button-start-investigation" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#385e51] px-6 text-sm font-semibold text-[#f4f0e6] transition hover:-translate-y-0.5 hover:bg-[#2e5044]"><ImagePlus size={16} />Start an investigation <ArrowRight size={16} /></Link>
    </div>
    {summary.isLoading ? <div className="mb-8 grid gap-4 sm:grid-cols-3"><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /></div>
      : summary.isError ? <div className="mb-8"><QueryError retry={() => summary.refetch()} text="Your archive summary is taking a moment." /></div>
      : <div className="mb-9 grid gap-4 sm:grid-cols-3">
        <Stat label="Saved investigations" value={summary.data?.total ?? 0} caption="Places worth remembering" icon={<Layers3 size={18} />} />
        <Stat label="This month" value={summary.data?.thisMonth ?? 0} caption="New trails opened" icon={<Crosshair size={18} />} />
        <div className="relative overflow-hidden rounded-2xl bg-[#263d36] p-5 text-[#f4f0e6]"><div className="contour absolute inset-0 opacity-35" /><div className="relative"><p className="font-data text-[9px] uppercase tracking-[.17em] text-[#d78b5a]">Most recent</p><p className="mt-4 line-clamp-1 font-editorial text-2xl">{latest?.title ?? 'Your first clue is waiting'}</p><p className="mt-1 text-xs text-[#c1cdbf]">{latest ? formatDate(latest.createdAt) : 'Begin with a photograph'}</p>{latest && <Link href={`/investigation/${latest.id}`} data-testid="link-latest-investigation" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#e3a274]">Open trail <ArrowRight size={14} /></Link>}</div></div>
      </div>}
    <div className="mb-5 flex items-end justify-between border-b border-[#d8d1c2] pb-4">
      <div><PageEyebrow>Recently opened</PageEyebrow><h2 className="mt-2 font-editorial text-3xl tracking-[-.03em]">Your latest trails</h2></div>
      <Link href="/library" data-testid="link-view-library" className="inline-flex items-center gap-2 text-xs font-semibold text-[#62776b] hover:text-[#c8794d]">View library <ArrowRight size={14} /></Link>
    </div>
    {investigations.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-56" />)}</div>
      : investigations.isError ? <QueryError retry={() => investigations.refetch()} />
      : rows.length === 0 ? <EmptyState icon={<Compass size={26} />} eyebrow="A new page" title="No investigations yet." text="Start with a photo that has been on your mind. We’ll help you follow its visual clues." action={<Link href="/investigate" data-testid="empty-start-investigation" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#385e51] px-5 py-3 text-xs font-semibold text-[#f4f0e6]">Investigate a photo <ArrowRight size={15} /></Link>} />
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.slice(0, 6).map((item) => <InvestigationCard key={item.id} item={item} />)}</div>}
  </div>;
}

function Stat({ label, value, caption, icon }: { label: string; value: number; caption: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
    <div className="flex items-center justify-between"><p className="text-xs text-[#738078]">{label}</p><span className="text-[#b47751]">{icon}</span></div>
    <p className="mt-5 font-editorial text-4xl tracking-[-.04em]" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p><p className="mt-1 font-data text-[9px] uppercase tracking-[.12em] text-[#96a095]">{caption}</p>
  </div>;
}

function EmptyState({ icon, eyebrow, title, text, action }: { icon: ReactNode; eyebrow: string; title: string; text: string; action?: ReactNode }) {
  return <div className="paper-grid flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#c9c3b4] px-6 py-12 text-center" data-testid="content-empty-state">
    <span className="grid h-14 w-14 place-items-center rounded-full border border-[#b5c1b1] bg-[#e8e9df] text-[#557363]">{icon}</span>
    <p className="mt-5 font-data text-[9px] uppercase tracking-[.19em] text-[#9c6d4e]">{eyebrow}</p><h3 className="mt-2 font-editorial text-3xl">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#738078]">{text}</p>{action}
  </div>;
}

function InvestigationCard({ item, onDelete }: { item: Investigation; onDelete?: (item: Investigation) => void }) {
  const place = item.candidates[0];
  return <article className="group relative overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(43,58,48,.09)]" data-testid={`card-investigation-${item.id}`}>
    <div className="relative h-[148px] overflow-hidden bg-[#d9ddcf]">
      <img src={`/api/investigations/${encodeURIComponent(item.id)}/photo`} alt={`Original photograph for ${item.title}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" onError={(event) => { event.currentTarget.style.opacity = '0'; }} data-testid={`img-investigation-${item.id}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1c3028]/55 to-transparent" />
      <span className="absolute bottom-3 left-4 font-data text-[9px] uppercase tracking-[.14em] text-white">{place ? `${place.place}${place.country ? ` · ${place.country}` : ''}` : 'Place still unfolding'}</span>
      <span className="absolute right-3 top-3 rounded-full border border-white/40 bg-[#f6f2e6]/90 px-3 py-1 font-data text-[9px] text-[#385e51]">{item.candidates.length} {item.candidates.length === 1 ? 'lead' : 'leads'}</span>
    </div>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{formatDate(item.createdAt)}</p><h3 className="mt-2 truncate font-editorial text-2xl tracking-[-.03em]" data-testid={`text-investigation-title-${item.id}`}>{item.title}</h3></div>{onDelete && <button type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.title}`} data-testid={`button-delete-investigation-${item.id}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#9b7d68] transition hover:bg-[#f4e6df] hover:text-[#a64e43]"><Trash2 size={15} /></button>}</div>
      <p className="mt-2 line-clamp-2 min-h-[42px] text-xs leading-5 text-[#718078]">{item.summary || 'A collection of clues is ready to explore.'}</p>
      <Link href={`/investigation/${item.id}`} data-testid={`link-open-investigation-${item.id}`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#385e51]">Open investigation <ArrowUpRight size={14} /></Link>
    </div>
  </article>;
}

function InvestigatePage() {
  const [files, setFiles] = useState<Record<PhotoUploadSlotId, File | null>>({
    original: null,
    recreation: null,
    'fake-news': null,
  });
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [shotAt, setShotAt] = useState('');
  const [localError, setLocalError] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slotErrors, setSlotErrors] = useState<
    Partial<Record<PhotoUploadSlotId, string>>
  >({});
  const [savedInvestigations, setSavedInvestigations] = useState<
    Array<{ id: string; title: string; slotLabel: string }>
  >([]);
  const uploadUrl = useRequestUploadUrl();
  const create = useCreateInvestigation();
  const client = useQueryClient();
  const selectedCount = investigationPhotoSlots.filter(
    (slot) => files[slot.id],
  ).length;
  const pending = submitting || uploadUrl.isPending || create.isPending;
  const setSelectedFile = (slotId: PhotoUploadSlotId, selected: File) => {
    setLocalError('');
    setBatchStatus('');
    setSlotErrors((current) => ({ ...current, [slotId]: undefined }));
    if (!imageContentType(selected)) {
      setFiles((current) => ({ ...current, [slotId]: null }));
      setSlotErrors((current) => ({
        ...current,
        [slotId]:
          'Choose a JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC, or HEIF image.',
      }));
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setFiles((current) => ({ ...current, [slotId]: null }));
      setSlotErrors((current) => ({
        ...current,
        [slotId]: 'This image is larger than 25 MB. Choose a smaller file.',
      }));
      return;
    }
    setFiles((current) => ({ ...current, [slotId]: selected }));
  };
  const removeSelectedFile = (slotId: PhotoUploadSlotId) => {
    setFiles((current) => ({ ...current, [slotId]: null }));
    setSlotErrors((current) => ({ ...current, [slotId]: undefined }));
    setBatchStatus('');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');
    setBatchStatus('');
    setSavedInvestigations([]);
    const selected = investigationPhotoSlots.flatMap((slot) => {
      const file = files[slot.id];
      return file ? [{ slot, file }] : [];
    });
    setSlotErrors((current) =>
      clearErrorsForSelectedPhotoSlots(
        current,
        selected.map(({ slot }) => slot.id),
      ),
    );
    if (!selected.length) {
      setLocalError('Choose at least one photograph before starting the investigations.');
      return;
    }

    setSubmitting(true);
    try {
      const { created, failed } = await processInvestigationPhotoUploads({
        selected,
        title,
        context,
        shotAt,
        getContentType: imageContentType,
        requestUploadUrl: (variables) => uploadUrl.mutateAsync(variables),
        uploadFile: async (uploadURL, file, contentType) => {
          const response = await fetch(uploadURL, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
          });
          if (!response.ok) {
            throw new Error('The photograph could not be stored. Please try again.');
          }
        },
        createInvestigation: (variables) => create.mutateAsync(variables),
        onProgress: setProgress,
        onSaved: (slotId) =>
          setFiles((current) => ({ ...current, [slotId]: null })),
      });

      if (created.length) {
        setSavedInvestigations((current) => [...current, ...created]);
        await Promise.all([
          client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }),
          client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() }),
        ]);
      }
      setSlotErrors((current) => ({ ...current, ...failed }));
      if (created.length) {
        const failedCount = Object.keys(failed).length;
        setBatchStatus(
          failedCount
            ? `Saved ${created.length} separate investigation${created.length === 1 ? '' : 's'}. ${failedCount} photo${failedCount === 1 ? '' : 's'} could not be processed; retry the remaining upload${failedCount === 1 ? '' : 's'} below.`
            : `Saved ${created.length} separate investigation${created.length === 1 ? '' : 's'}. Open one below or find them in your library.`,
        );
      } else {
        setLocalError('No investigations were saved. Review the highlighted upload and try again.');
      }
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  return <div className="fade-up mx-auto max-w-[960px]">
    <Link href="/user-portal" data-testid="link-back-to-overview" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to overview</Link>
    <div className="mb-8"><PageEyebrow>Open new case files / 01–03</PageEyebrow><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">What’s the somewhere?</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#718078]">Choose one or more images. Each selected photo is analyzed separately and saved as its own investigation. Recreation and Fake News are labels only; this service estimates photo locations and does not fact-check claims.</p></div>
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-3xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 md:p-6">
        <div className="mb-5">
          <PageEyebrow>Three separate photo investigations</PageEyebrow>
          <p className="mt-2 text-xs leading-5 text-[#718078]">Select any combination. The shared name, notes, and capture date below apply to each photo you submit.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {investigationPhotoSlots.map((slot) => (
            <PhotoUploadSlot
              key={slot.id}
              slot={slot}
              file={files[slot.id]}
              error={slotErrors[slot.id]}
              disabled={pending}
              onSelectFile={(file) => setSelectedFile(slot.id, file)}
              onRemoveFile={() => removeSelectedFile(slot.id)}
            />
          ))}
        </div>
      </section>
      <div className="mx-auto max-w-[720px] rounded-3xl border border-[#d8d1c2] bg-[#f8f5ec] p-6 md:p-7">
        <PageEyebrow>Set the scene</PageEyebrow>
        <label className="mt-5 block text-xs font-semibold text-[#465c50]" htmlFor="investigation-title">Shared case name <span className="font-normal text-[#97a095]">optional</span></label>
        <input id="investigation-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Rocky Mountain trip" data-testid="input-investigation-title" className="mt-2 h-12 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 text-sm outline-none transition focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        <p className="mt-1 text-xs text-[#87938a]">Each title also includes its upload label; without a name, the photo filename is used.</p>
        <label className="mt-5 block text-xs font-semibold text-[#465c50]" htmlFor="investigation-context">What do you already know?</label>
        <textarea id="investigation-context" value={context} maxLength={3000} onChange={(event) => setContext(event.target.value)} rows={5} placeholder="A trip, a season, a friend's comment, the direction of the light…" data-testid="input-investigation-context" className="mt-2 w-full resize-y rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[#a0a69c] focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        <p className="mt-1 text-right font-data text-[9px] text-[#a1a79d]">{context.length} / 3000</p>
        <label className="mt-4 block text-xs font-semibold text-[#465c50]" htmlFor="investigation-shot-at">When was it taken? <span className="font-normal text-[#97a095]">optional</span></label>
        <input type="date" id="investigation-shot-at" value={shotAt} onChange={(event) => setShotAt(event.target.value)} data-testid="input-shot-date" className="mt-2 h-12 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 text-sm text-[#53685d] outline-none focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        {localError && <p role="alert" className="mt-4 rounded-xl border border-[#dfc6b6] bg-[#f9eee6] px-4 py-3 text-xs leading-5 text-[#875545]" data-testid="status-upload-error">{localError}</p>}
        <button type="submit" disabled={pending} data-testid="button-analyze-photo" className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044] disabled:cursor-wait disabled:opacity-70">
          {pending ? <><LoaderCircle size={17} className="animate-spin" />{progress || 'Preparing photo analysis…'}</> : <>{selectedCount ? `Analyze ${selectedCount} photo${selectedCount === 1 ? '' : 's'}` : 'Select photos to analyze'} <Sparkles size={16} /></>}
        </button>
        <p className="mt-3 text-center text-[10px] leading-5 text-[#718078]">Only the selected images are sent to Image Locator. Your shared name, notes, and date stay in each private record.</p>
        {batchStatus && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-[#b9c9b8] bg-[#edf1e7] p-4"
            data-testid="status-created-investigations"
          >
            <p className="text-sm font-semibold text-[#385e51]">{batchStatus}</p>
            {savedInvestigations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {savedInvestigations.map((saved) => (
                  <li key={saved.id}>
                    <Link
                      href={`/investigation/${saved.id}`}
                      data-testid={`link-created-investigation-${saved.id}`}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-[#385e51] underline decoration-[#9aaf9d] underline-offset-4 hover:text-[#a56743]"
                    >
                      {saved.slotLabel}: {saved.title}
                      <ArrowUpRight size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </form>
  </div>;
}

function LibraryPage() {
  const [search, setSearch] = useState('');
  const query = useListInvestigations(search.trim() ? { query: search.trim() } : undefined);
  const remove = useDeleteInvestigation();
  const client = useQueryClient();
  const [deleteError, setDeleteError] = useState('');
  const deleteItem = async (item: Investigation) => {
    if (!window.confirm(`Remove “${item.title}” and its saved investigation from your library?`)) return;
    setDeleteError('');
    try {
      await remove.mutateAsync({ id: item.id });
      await Promise.all([client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }), client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() })]);
    } catch { setDeleteError('That investigation could not be removed. Please try again.'); }
  };
  return <div className="fade-up">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><PageEyebrow>Personal archive / index</PageEyebrow><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">Your library.</h1><p className="mt-3 text-sm text-[#718078]">Every photograph, clue, and possible place you’ve kept.</p></div>
      <Link href="/investigate" data-testid="button-library-new-investigation" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6]"><ImagePlus size={15} />New investigation</Link>
    </div>
    <div className="mb-7 flex flex-col gap-3 sm:flex-row">
      <label className="relative block max-w-[560px] flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d998d]" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title, place, or clue…" data-testid="input-library-search" className="h-12 w-full rounded-full border border-[#d8d1c2] bg-[#f8f5ec] pl-11 pr-4 text-sm outline-none transition focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" /></label>
      <div className="flex items-center gap-2 self-start rounded-full border border-[#d8d1c2] bg-[#f8f5ec] px-4 py-3 font-data text-[9px] uppercase tracking-[.12em] text-[#76857a] sm:self-auto"><BookOpen size={14} className="text-[#a56e4b]" />{query.data?.length ?? '—'} saved</div>
    </div>
    {deleteError && <p role="alert" className="mb-5 rounded-xl border border-[#dfc6b6] bg-[#f9eee6] px-4 py-3 text-sm text-[#875545]" data-testid="status-delete-error">{deleteError}</p>}
    {query.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <SkeletonBlock key={item} className="h-[340px]" />)}</div>
      : query.isError ? <QueryError retry={() => query.refetch()} text="Your library is unavailable just now." />
      : (query.data ?? []).length === 0 ? <EmptyState icon={<Search size={24} />} eyebrow={search ? 'No matching notes' : 'The index is open'} title={search ? 'Nothing found here.' : 'Your library is still empty.'} text={search ? 'Try another place name, title, or clue.' : 'Investigations you save will be gathered here, ready to search and revisit.'} action={search ? <button type="button" onClick={() => setSearch('')} data-testid="button-clear-search" className="mt-5 text-xs font-semibold text-[#385e51] underline underline-offset-4">Clear search</button> : <Link href="/investigate" data-testid="empty-library-start" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#385e51] px-5 py-3 text-xs font-semibold text-[#f4f0e6]">Add your first photograph <ArrowRight size={15} /></Link>} />
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data?.map((item) => <InvestigationCard key={item.id} item={item} onDelete={deleteItem} />)}</div>}
  </div>;
}

function InvestigationPage() {
  const [, params] = useRoute('/investigation/:id');
  const id = params?.id ?? '';
  const query = useGetInvestigation(id, { query: { enabled: Boolean(id), queryKey: getGetInvestigationQueryKey(id) } });
  const photo = useGetInvestigationPhoto(id, { query: { enabled: Boolean(id), queryKey: getGetInvestigationPhotoQueryKey(id) } });
  const update = useUpdateInvestigation();
  const remove = useDeleteInvestigation();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');
  const item = query.data;
  useEffect(() => {
    if (item) { setTitle(item.title); setContext(item.context ?? ''); }
  }, [item?.id]);
  const photoUrl = useMemo(() => photo.data instanceof Blob ? URL.createObjectURL(photo.data) : '', [photo.data]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    setMessage('');
    try {
      await update.mutateAsync({ id: item.id, data: { title: title.trim() || item.title, context: context.trim() || null } });
      await client.invalidateQueries({ queryKey: getGetInvestigationQueryKey(item.id) });
      await client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() });
      setEditing(false);
      setMessage('Your field notes have been updated.');
    } catch { setMessage('The changes could not be saved. Please try again.'); }
  };
  const deleteCurrent = async () => {
    if (!item || !window.confirm(`Remove “${item.title}” from your library?`)) return;
    try {
      await remove.mutateAsync({ id: item.id });
      await Promise.all([client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }), client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() })]);
      setLocation('/library');
    } catch { setMessage('This investigation could not be removed. Please try again.'); }
  };
  if (query.isLoading) return <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]"><SkeletonBlock className="h-[440px]" /><div className="space-y-4"><SkeletonBlock className="h-20" /><SkeletonBlock className="h-64" /><SkeletonBlock className="h-36" /></div></div>;
  if (query.isError || !item) return <QueryError retry={() => query.refetch()} text="This investigation could not be opened." />;
  const mainCandidate = item.candidates[0];
  return <div className="fade-up">
    <Link href="/library" data-testid="link-back-to-library" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to library</Link>
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><PageEyebrow>Investigation / {formatDate(item.createdAt)}</PageEyebrow><h1 className="mt-3 max-w-4xl font-editorial text-5xl tracking-[-.05em] md:text-6xl" data-testid="text-detail-title">{item.title}</h1><p className="mt-3 text-sm text-[#738078]">{item.originalName}{item.shotAt ? ` · photographed ${formatDate(item.shotAt)}` : ''}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setEditing(!editing)} data-testid="button-edit-investigation" className="rounded-full border border-[#c9c7b7] px-4 py-2.5 text-xs font-semibold text-[#53695d] hover:bg-[#ebe9de]">{editing ? 'Cancel editing' : 'Edit notes'}</button><button type="button" onClick={deleteCurrent} disabled={remove.isPending} data-testid="button-delete-current-investigation" className="inline-flex items-center gap-2 rounded-full border border-[#ddc4b5] px-4 py-2.5 text-xs font-semibold text-[#9d5846] hover:bg-[#f7eae4]"><Trash2 size={14} />Remove</button></div>
    </div>
    {message && <p role="status" data-testid="status-investigation-update" className="mb-5 rounded-xl border border-[#c8d4c4] bg-[#edf2e9] px-4 py-3 text-sm text-[#476450]">{message}</p>}
    {editing && <form onSubmit={saveDetails} className="mb-7 grid gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 md:grid-cols-[.8fr_1.2fr_auto] md:items-end">
      <label className="block text-xs font-semibold text-[#465c50]">Investigation name<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} data-testid="input-edit-title" className="mt-2 h-11 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-3 text-sm outline-none focus:border-[#668675]" /></label>
      <label className="block text-xs font-semibold text-[#465c50]">Background notes<textarea value={context} maxLength={3000} onChange={(event) => setContext(event.target.value)} rows={2} data-testid="input-edit-context" className="mt-2 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-3 py-2 text-sm outline-none focus:border-[#668675]" /></label>
      <button type="submit" disabled={update.isPending} data-testid="button-save-investigation" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-xs font-semibold text-[#f4f0e6] disabled:opacity-60">{update.isPending ? 'Saving…' : <><Check size={14} />Save changes</>}</button>
    </form>}
    <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_.95fr]">
      <div>
        <div className="photo-frame relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-[#d8d1c2] bg-[#e5e3d6] p-4 md:min-h-[490px]">
          {photo.isLoading ? <SkeletonBlock className="absolute inset-4" /> : photo.isError ? <div className="px-6 text-center text-sm text-[#7c8378]" data-testid="status-photo-error"><FileImage size={26} className="mx-auto mb-3 text-[#a06d4b]" />The saved photograph is temporarily unavailable.</div> : <img src={photoUrl || `/api/investigations/${encodeURIComponent(item.id)}/photo`} alt={`Original photograph: ${item.originalName}`} className="max-h-[620px] w-full rounded-2xl object-contain" data-testid="img-original-investigation-photo" />}
          <span className="absolute bottom-7 left-7 rounded-full border border-white/50 bg-[#f4f0e6]/90 px-3 py-1.5 font-data text-[9px] uppercase tracking-[.13em] text-[#52695d]">Original photograph</span>
        </div>
        <section className="mt-7 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6 md:p-7">
          <PageEyebrow>Scene notes</PageEyebrow><p className="mt-4 font-editorial text-2xl leading-[1.25] text-[#344b42]" data-testid="text-investigation-summary">{item.summary}</p>
          {item.context && <div className="mt-6 border-t border-[#e1dbce] pt-4"><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">What you knew</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#718078]" data-testid="text-investigation-context">{item.context}</p></div>}
        </section>
        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between"><div><PageEyebrow>Visual evidence</PageEyebrow><h2 className="mt-2 font-editorial text-3xl">Details in the frame</h2></div><span className="font-data text-[9px] uppercase tracking-[.13em] text-[#929b90]">{item.clues.length} clues</span></div>
          {item.clues.length ? <div className="space-y-3">{item.clues.map((clue, index) => <article key={`${clue.label}-${index}`} data-testid={`card-clue-${index}`} className="relative rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 pl-[68px]"><span className="absolute left-5 top-5 font-data text-[10px] text-[#c8794d]">0{index + 1}</span><h3 className="font-editorial text-xl">{clue.label}</h3><p className="mt-2 text-sm leading-6 text-[#66796e]">{clue.observation}</p><p className="mt-3 border-t border-[#e4dfd2] pt-3 text-xs leading-5 text-[#89948a]">{clue.significance}</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-[#c9c3b4] p-6 text-sm text-[#718078]" data-testid="content-no-clues">No visual clues were returned for this investigation.</div>}
        </section>
      </div>
      <div>
        <div className="mb-4 flex items-end justify-between"><div><PageEyebrow>Possible whereabouts</PageEyebrow><h2 className="mt-2 font-editorial text-3xl">Follow the leads</h2></div><span className="font-data text-[9px] uppercase tracking-[.13em] text-[#929b90]">{item.candidates.length} leads</span></div>
        <p className="mb-4 text-xs leading-5 text-[#859187]">The separate search for public reference photos uses location names only; it never receives the original photo or your notes.</p>
        {item.candidates.length ? <div className="space-y-4">{item.candidates.map((candidate, index) => <article key={`${candidate.place}-${index}`} className={`relative overflow-hidden rounded-2xl border p-5 ${index === 0 ? 'border-[#b8c4b5] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#f8f5ec]'}`} data-testid={`card-candidate-${index}`}>
          {index === 0 && <span className="absolute right-4 top-4 rounded-full bg-[#385e51] px-3 py-1 font-data text-[8px] uppercase tracking-[.12em] text-[#f4f0e6]">Strongest lead</span>}
          <div className="flex items-start gap-3 pr-24"><span className={`map-pin mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${index === 0 ? 'bg-[#c8794d] text-white' : 'bg-[#e2e4d9] text-[#607a68]'}`}><MapPin size={17} /></span><div><h3 className="font-editorial text-2xl tracking-[-.02em]">{candidate.place}</h3><p className="mt-1 text-xs text-[#718078]">{[candidate.region, candidate.country].filter(Boolean).join(', ') || 'Region not specified'}</p></div></div>
          <div className="mt-5 flex items-center justify-between border-y border-[#c9d0c2] py-3"><span className="font-data text-[9px] uppercase tracking-[.13em] text-[#758477]">Confidence</span><span className="font-data text-sm text-[#385e51]">{Math.round(candidate.confidence * 100)}%</span></div>
          <p className="mt-4 text-sm leading-6 text-[#596d61]">{candidate.rationale}</p>
          {candidate.clues.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{candidate.clues.map((clue) => <span key={clue} className="rounded-full border border-[#c7d0c1] px-3 py-1.5 text-[10px] text-[#627569]">{clue}</span>)}</div>}
          {(candidate.photoReferences ?? []).length > 0 ? <div className="mt-5 border-t border-[#c9d0c2] pt-4" data-testid={`section-photo-references-${index}`}>
            <p className="font-data text-[9px] uppercase tracking-[.13em] text-[#758477]">Public photo references</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(candidate.photoReferences ?? []).map((reference, referenceIndex) => <a key={`${reference.imageUrl}-${referenceIndex}`} href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-photo-reference-${index}-${referenceIndex}`} className="group min-w-0 overflow-hidden rounded-xl border border-[#d8d1c2] bg-[#f8f5ec] transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="aspect-[4/3] overflow-hidden bg-[#e5e3d6]">
                  <img src={reference.thumbnailUrl ?? reference.imageUrl} alt={reference.caption ?? `Public photo reference for ${candidate.place}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                </div>
                <span className="block line-clamp-2 px-2 pt-2 text-[10px] leading-4 text-[#596d61]">{reference.caption ?? `Photos of ${candidate.place}`}</span>
                <span className="block truncate px-2 pb-2 pt-1 text-[8px] text-[#929b90]">{photoReferenceHost(reference.sourceUrl)} <ArrowUpRight size={10} className="ml-0.5 inline" /></span>
              </a>)}
            </div>
          </div> : <p className="mt-4 text-xs leading-5 text-[#859187]" data-testid={`status-photo-search-${index}`}>{candidate.photoSearchStatus === 'unavailable' ? 'Web photo search is temporarily unavailable for this lead.' : candidate.photoSearchStatus === 'no_results' ? 'No public photo references were found for this place.' : 'Photo references were not collected for this investigation.'}</p>}
          <a href={candidate.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-map-candidate-${index}`} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#385e51] hover:text-[#b36e48]">Explore on map <ArrowUpRight size={14} /></a>
        </article>)}</div> : <div className="rounded-2xl border border-dashed border-[#c9c3b4] p-6 text-sm text-[#718078]" data-testid="content-no-candidates">No likely places were returned. Keep the image in your library and revisit as new clues surface.</div>}
        <div className="mt-5 rounded-2xl bg-[#263d36] p-5 text-[#f4f0e6]"><div className="flex items-center gap-2 text-[#d78b5a]"><Globe2 size={16} /><p className="font-data text-[9px] uppercase tracking-[.16em]">Read the map, not the answer</p></div><p className="mt-3 text-xs leading-5 text-[#c1cdbf]">These are leads to explore, not certainties. Compare the landmarks with what you remember.</p></div>
      </div>
    </div>
  </div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function photoReferenceHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <RoutedErrorBoundary><ClerkProviderWithRoutes /></RoutedErrorBoundary>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}

export default App;