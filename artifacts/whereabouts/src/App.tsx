import { ConfidenceMeter } from '@/components/results/ranked-places-list';
import { confidencePercent, confidenceTier } from '@/lib/result-insights';
import '@/styles/ranked-results.css';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isLegacyRecreationReport } from '@/lib/recreation-purpose';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Film, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, Circle, Compass, Crosshair, Ellipsis, FileImage, Globe2, ImagePlus, Layers3, LoaderCircle, LogOut, Menu, Newspaper, ScanSearch, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { coordinatesFromMapsUrl, LeadLocationMap } from '@/components/lead-location-map';
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
  useListInvestigations,
  useRequestUploadUrl,
  useRefreshInvestigationCandidates,
  useRetryInvestigationAnalysis,
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
import { AnalysisFailed, type AnalysisStage } from '@/components/analysis-status';
import { BestGuessCard } from '@/components/best-guess-card';
import { HealthUrgencyCard } from '@/components/health-urgency-card';
import { buildLeadSummary } from '@/lib/lead-summary';
import { readPhotoTakenDate } from '@/lib/photo-date';
import { OriginalMediaIntake } from '@/components/original-media-intake';
import { EmbeddedGpsNotice, KeyMoments, VideoAnalysisStatus, VideoPlayer } from '@/components/video-investigation';
import { DemoExperience } from '@/components/demo-experience';
import { LandingPage } from '@/components/landing-page';
import AboutPage from '@/pages/about-page';
import { SiteCursor } from '@/components/site-cursor';
import { ContactSheet, CropMarks, DeskHeadline, DeskRuler, FieldDeskFilingNotice, FieldIndex, FieldSheet, Odometer, PixelPrint, SpecimenTray } from '@/components/field-desk';
import { investigationMediaUrl, isAnalyzing, isVideoInvestigation, pollListWhileAnalyzing, pollWhileAnalyzing } from '@/lib/video-analysis';
import CasesPage from '@/features/cases/cases-page';
import NewCasePage from '@/features/cases/new-case-page';
import CaseDetailPage from '@/features/cases/case-detail-page';
import CaseReviewPage from '@/features/cases/case-review-page';
import { GuideCasePage, GuideStartPage } from '@/features/guide/guide-live-page';
import GuideDemoPage from '@/features/guide/guide-demo-page';
import { GuideEntry } from '@/features/guide/guide-entry';
import { GuideDraftProvider, useGuideDraft } from '@/features/guide/guide-ui';
import './index.css';
import './styles/field-desk.css';
import './styles/desk-refinements.css';
import {BatchPrints,DeskMargin,FlipChecklist,HelpNote} from '@/components/desk-controls';
import {OverviewClock,OverviewPhoto} from '@/components/overview-instruments';
import {FontSizeSlider} from '@/components/font-size-slider';
import {useTextSize} from '@/hooks/use-text-size';
import {defaultPreferences,readPreferences,writePreferences,type AppPreferences} from '@/lib/app-preferences';
import {ImageGeolocationReport} from '@/components/image-geolocation-report';
import {isImageGeolocationReport} from '@/lib/image-report-scope';
import {rankCandidates} from '@/lib/geographic-confidence';
import {DeskSelector} from '@/components/desk-selector';
import {advanceInvestigationStep,canSubmitInvestigation,type InvestigationStep} from '@/lib/investigation-steps';
import {deskSound,setSoundEnabled,soundEnabled} from '@/lib/desk-sound';
import type {SavedInvestigationPhoto} from '@/lib/investigation-photo-uploads';
import {PhysicalWorkspace} from '@/components/physical-workspace';
import {OperatorAvatar} from '@/components/operator-avatar';
import {SafeRequestError} from '@/components/safe-request-error';
import {DeskFilterKeys,PhysicalSwitch,ShutterButton,SwatchBook} from '@/components/physical-controls';
import {ReportChip,ReportOperationProvider,useReportOperation} from '@/components/report-operation';
import {deskMatchesFilter} from '@/lib/desk-filters';
import {constrainLibrarySearch,LIBRARY_SEARCH_MAX_LENGTH} from '@/lib/library-search';
import './styles/physical-desk.css';
import './styles/readability.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true, refetchOnMount: 'always' } },
});
const ApiKeyContext = createContext<{ apiKey: string; setApiKey: (value: string) => void }>({ apiKey: '', setApiKey: () => {} });
function useApiKey() { return useContext(ApiKeyContext); }
const PreferencesContext = createContext<{ preferences: AppPreferences; setPreferences: (next: AppPreferences) => void }>({
  preferences: defaultPreferences,
  setPreferences: () => {},
});
function usePreferences() { return useContext(PreferencesContext); }
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const supportedImageTypes = new Set<InvestigationInputContentType>([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
  'image/bmp', 'image/x-ms-bmp', 'image/tiff', 'image/x-tiff', 'image/heic', 'image/heif',
]);
const visualModelImageTypes = new Set<InvestigationInputContentType>([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
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
    label: 'Investigations',
    description: 'The image you want to investigate.',
  },
  {
    id: 'recreation',
    label: 'Recreation',
    description: 'A personal, travel, or leisure photo whose location you want to discover.',
  },
  {
    id: 'fake-news',
    label: 'Investigative journalism',
    description: 'A reporting image or visual lead to investigate.',
  },
];
const fieldDesks = [
  { id: 'original', label: 'Investigations', shortLabel: 'Investigations', icon: <FileImage size={16} />, subtitle: 'Original image investigations' },
  { id: 'recreation', label: 'Recreation', shortLabel: 'Recreation', icon: <Layers3 size={16} />, subtitle: 'Personal photos, travel, and leisure' },
  { id: 'fake-news', label: 'Investigative journalism', shortLabel: 'Journalism', icon: <Newspaper size={16} />, subtitle: 'Reporting images and visual leads' },
] satisfies { id: PhotoUploadSlotId; label: string; shortLabel: string; icon: ReactNode; subtitle: string }[];

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
    colorPrimary: 'hsl(var(--primary))',
    colorForeground: 'hsl(var(--foreground))',
    colorMutedForeground: 'hsl(var(--muted-foreground))',
    colorDanger: '#b6382e',
    colorBackground: 'hsl(var(--card))',
    colorInput: 'hsl(var(--card))',
    colorInputForeground: 'hsl(var(--foreground))',
    colorNeutral: 'hsl(var(--border))',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '2px',
  },
  elements: {
    rootBox: 'fd-clerk-root',
    cardBox: 'fd-clerk-card',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    header: 'fd-clerk-header',
    headerTitle: 'fd-clerk-heading font-semibold text-[#242723]',
    headerSubtitle: 'fd-clerk-subtitle text-[#5b5e58]',
    socialButtonsBlockButtonText: { color: '#000000', fontWeight: 500 },
    alternativeMethodsBlockButtonText: { color: '#000000' },
    identityPreviewText: { color: '#000000' },
    formFieldLabel: 'text-[#344b42] font-medium',
    footerActionLink: 'text-[#385e51] font-semibold',
    footerActionText: 'text-[#718078]',
    dividerText: 'text-[#718078]',
    identityPreviewEditButton: 'text-[#385e51]',
    formFieldSuccessText: 'text-[#385e51]',
    alertText: 'text-[#a64e43]',
    logoBox: 'fd-clerk-logo',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'fd-clerk-social',
    formButtonPrimary: 'fd-clerk-primary',
    formFieldInput: 'fd-clerk-input',
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
    <Link href="/" className={`wa-brand inline-flex items-center gap-3 ${inverse ? 'wa-brand-inverse' : ''}`} data-testid="link-brand-home">
      <span className="wa-brand-icon">
        <Crosshair size={22} strokeWidth={1.7} />
      </span>
      <span className="font-editorial text-[25px] leading-none tracking-[-.055em]">whereabouts</span>
    </Link>
  );
}

function ActionLink({ href, children, secondary = false, testId }: { href: string; children: ReactNode; secondary?: boolean; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className={`wa-action inline-flex min-w-max items-center justify-center gap-2 whitespace-nowrap px-6 text-sm font-semibold ${secondary ? 'wa-action-secondary' : ''}`}>
      {children}
    </Link>
  );
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/user-portal" /></Show><Show when="signed-out"><LandingPage /></Show></>;
}

function SignInPage() {
  return <div className="fd-auth clerk-frame min-h-[100dvh] px-4 py-7">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Mark /><Link href="/" className="text-sm text-[#62756c] hover:text-[#385e51]" data-testid="link-auth-back">Back to Whereabouts</Link></div>
    <DeskRuler/>
    <div className="fd-auth-layout mx-auto mt-10 max-w-6xl overflow-hidden md:grid md:grid-cols-[.92fr_1.08fr]">
      <div className="fd-auth-dark relative hidden min-h-[690px] overflow-hidden bg-[#263d36] p-12 text-[#f4f0e6] md:flex md:flex-col md:justify-between">
        <pre className="fd-auth-binary" aria-hidden="true">{'01001001 00101110 01000110 01001001 01000101 01001100 01000100\n'.repeat(100)}</pre>
        <div className="relative"><p className="font-data text-[13px] uppercase tracking-[.2em]">The private field notebook</p><DeskHeadline className="mt-7 text-6xl">Pick up the trail.</DeskHeadline><p className="mt-6 max-w-sm">Your saved photographs, observations, and likely places are waiting where you left them.</p></div>
        <div className="relative border-t border-[#5c7465] pt-5 font-data text-[13px] uppercase tracking-[.17em] text-[#a8b8a9]">INDEX 001 — personal archive</div>
      </div>
      <div className="flex min-h-[690px] items-center justify-center px-4 py-12 sm:px-10"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>
    </div>
    <p className="mt-6 text-center font-data text-[13px] uppercase tracking-[.14em] text-[#849087]">Private by default · your photographs stay yours</p>
  </div>;
}

function SignUpPage() {
  return <div className="fd-auth clerk-frame min-h-[100dvh] px-4 py-7">
    <div className="mx-auto flex max-w-6xl items-center justify-between"><Mark /><Link href="/" className="text-sm text-[#62756c] hover:text-[#385e51]" data-testid="link-auth-home">Back to Whereabouts</Link></div>
    <DeskRuler/>
    <div className="fd-auth-layout mx-auto mt-10 max-w-6xl overflow-hidden md:grid md:grid-cols-[.92fr_1.08fr]">
      <div className="fd-auth-dark relative hidden min-h-[730px] overflow-hidden bg-[#263d36] p-12 text-[#f4f0e6] md:flex md:flex-col md:justify-between">
        <pre className="fd-auth-binary" aria-hidden="true">{'01001001 00101110 01000110 01001001 01000101 01001100 01000100\n'.repeat(100)}</pre>
        <div className="relative"><p className="font-data text-[13px] uppercase tracking-[.2em]">Open a new notebook</p><DeskHeadline className="mt-7 text-6xl">Start with a somewhere.</DeskHeadline><p className="mt-6 max-w-sm">One image can hold a whole journey. Make a private place for the clues you find along the way.</p></div>
        <div className="relative grid grid-cols-3 gap-3">
          {['Image', 'Clues', 'Places'].map((item, i) => <div key={item} className="border-t border-[#5c7465] pt-3"><span className="font-data text-[13px] text-[#d78b5a]">0{i + 1}</span><p className="mt-2 font-editorial text-lg">{item}</p></div>)}
        </div>
      </div>
      <div className="flex min-h-[730px] items-center justify-center px-4 py-12 sm:px-10"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>
    </div>
    <p className="mt-6 text-center font-data text-[13px] uppercase tracking-[.14em] text-[#849087]">A private archive for the places that stay with you</p>
  </div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const { setApiKey } = useApiKey();
  const { reset: resetGuideDraft } = useGuideDraft();
  const resetDraftRef = useRef(resetGuideDraft);
  const operation=useReportOperation(),resetOperation=useRef(operation.reset);resetOperation.current=operation.reset;
  resetDraftRef.current = resetGuideDraft;
  useEffect(() => {
    let prior: string | null | undefined;
    return addListener(({ user }) => {
      const current = user?.id ?? null;
      if (prior !== undefined && prior !== current) {
        client.clear();
        resetOperation.current();
        setApiKey('');
        // Keep an anonymous draft through sign-in; drop it on sign-out or account switch.
        if (prior !== null) resetDraftRef.current();
      }
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
    localization={{ formButtonPrimary:'Continue →', signIn: { start: { title: 'Welcome back', subtitle: 'Pick up the trail where you left it.' } }, signUp: { start: { title: 'Start your notebook', subtitle: 'Create a private place for your discoveries.' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <PersistentInvestigation />
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/about" component={AboutPage} />
      <Route path="/demo" component={DemoRoute} />
      <Route path="/start" component={StartSearchRoute} />
      <Route path="/guide" component={GuideStartRoute} />
      <Route path="/guide/:id" component={GuideCaseRoute} />
      <Route path="/guide-demo/:sample" component={GuideDemoPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/user-portal" component={PortalRoute} />
      <Route path="/investigate" component={InvestigateRoute} />
      <Route path="/library" component={LibraryRoute} />
      <Route path="/cases" component={CasesRoute} />
      <Route path="/cases/new" component={NewCaseRoute} />
      <Route path="/cases/:id/review" component={CaseReviewRoute} />
      <Route path="/cases/:id" component={CaseDetailRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/desk/:deskId" component={FieldDeskRoute} />
      <Route path="/investigation/:id/location/:index" component={LeadLocationRoute} />
      <Route path="/investigation/:id" component={DetailRoute} />
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function PortalRoute() { return <Protected><AppShell><DashboardPage /></AppShell></Protected>; }
function InvestigateRoute() { return <Protected>{null}</Protected>; }
/** Keep File objects and in-flight queue callbacks alive across workspace navigation. */
function PersistentInvestigation(){
  const[location]=useLocation();
  const{user}=useUser();
  return <Show when="signed-in"><div hidden={location!=='/investigate'} data-report-background><AppShell><InvestigatePage key={user?.id}/></AppShell></div></Show>;
}
function GuideStartRoute() { return <Protected><AppShell><GuideStartPage /></AppShell></Protected>; }
function GuideCaseRoute() { return <Protected><AppShell><GuideCasePage /></AppShell></Protected>; }
function CasesRoute() { return <Protected><AppShell><CasesPage /></AppShell></Protected>; }
function NewCaseRoute() { return <Protected><AppShell><NewCasePage /></AppShell></Protected>; }
function CaseDetailRoute() { return <Protected><AppShell><CaseDetailPage /></AppShell></Protected>; }
function CaseReviewRoute() { return <Protected><AppShell><CaseReviewPage /></AppShell></Protected>; }
function LibraryRoute() { return <Protected><AppShell><LibraryPage /></AppShell></Protected>; }
function SettingsRoute() { return <Protected><AppShell><SettingsPage /></AppShell></Protected>; }
function FieldDeskRoute() { return <Protected><AppShell><FieldDeskPage /></AppShell></Protected>; }
function DetailRoute() { return <Protected><AppShell><InvestigationPage /></AppShell></Protected>; }
function LeadLocationRoute() { return <Protected><AppShell><LeadLocationPage /></AppShell></Protected>; }

function StartSearchRoute() {
  return <><Show when="signed-in"><Protected><AppShell><div className="fd-guide-start max-w-3xl"><GuideEntry signedIn tone="panel" /></div></AppShell></Protected></Show><Show when="signed-out"><main className="fd-start min-h-[100dvh] px-5 py-6 md:px-12"><div className="mx-auto max-w-6xl"><header className="mb-6 flex items-center justify-between"><Mark /><Link href="/demo" className="inline-flex min-h-11 items-center text-sm font-semibold" data-testid="link-start-see-samples">See sample cases</Link></header><DeskRuler/><div className="py-10"><FieldSheet code="05 / AI GUIDE"><div className="max-w-3xl"><GuideEntry signedIn={false}/></div></FieldSheet></div></div></main></Show></>;
}

function DemoRoute() { return <DemoExperience />; }

function AppShell({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [profileName, setProfileName] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  useEffect(() => {
    const value = user?.unsafeMetadata?.whereaboutsDisplayName;
    setProfileName(typeof value === 'string' ? value : user?.firstName || '');
  }, [user?.id, user?.unsafeMetadata?.whereaboutsDisplayName, user?.firstName]);
  const firstName = profileName || user?.firstName || 'Field researcher';
  const initials = `${user?.firstName?.[0] || 'F'}${user?.lastName?.[0] || ''}`;
  const navLinks = [
    { href: '/user-portal', label: 'Overview', icon: <Compass size={17} /> },
    { href: '/investigate', label: 'New investigation', icon: <ImagePlus size={17} /> },
    { href: '/library', label: 'My library', icon: <BookOpen size={17} /> },
    { href: '/cases', label: 'Cases', icon: <ShieldCheck size={17} /> },
    { href: '/start', label: 'AI Guide', icon: <ScanSearch size={17} /> },
  ];
  const deskLinks = fieldDesks.map((desk) => ({ href: `/desk/${desk.id}`, ...desk }));
  return <div data-report-background className="wa-shell min-h-[100dvh] bg-[#f4f0e6] text-[#263d36] md:flex">
    <aside className="wa-sidebar hidden shrink-0 flex-col px-5 pb-5 pt-6 md:flex">
      <Mark inverse />
      <p className="wa-eyebrow mb-3 mt-10 px-3">Your workspace</p>
      <FieldIndex items={navLinks.map(item=>({...item,testId:`nav-${item.label.toLowerCase().replaceAll(' ','-')}`}))} location={location} label="Main navigation"/>
      <p className="mb-2 mt-7 px-3 font-data text-[13px] uppercase tracking-[.2em] text-[#9aaf9d]">Field desks</p>
      <FieldIndex items={deskLinks.map(item=>({...item,testId:`nav-desk-${item.id}`}))} location={location} start={6} label="Image investigation desks"/>
      <div className="mt-5"><FieldIndex items={[{href:'/settings',label:'Settings',testId:'nav-settings'}]} location={location} start={9}/></div>
      <div className="mt-auto">
        <details className="fd-id-tag relative mb-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5" data-testid="button-account-profile">
            <OperatorAvatar accountId={user?.id} imageUrl={user?.hasImage?user.imageUrl:undefined} name={firstName||initials}/>
            <span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{firstName}</span><span className="font-data text-[13px] uppercase tracking-[.1em]">OPERATOR 001</span></span>
          </summary>
          <form className="absolute bottom-14 left-0 z-30 w-[220px] rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-3 text-[#263d36] shadow-xl" onSubmit={async (event) => { event.preventDefault(); try { await user?.update({ unsafeMetadata: { ...user.unsafeMetadata, whereaboutsDisplayName: profileName.trim() } }); setProfileStatus('Profile saved.'); } catch { setProfileStatus('Could not save your profile.'); } }}>
            <label className="block text-[13px] font-semibold" htmlFor="in-app-username">In-app username</label>
            <input id="in-app-username" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={40} className="mt-1 h-9 w-full rounded-lg border border-[#d8d1c2] bg-white px-2 text-sm" />
            <label className="mt-3 block cursor-pointer rounded-lg border border-[#d8d1c2] px-3 py-2 text-center text-[13px] hover:bg-[#f0ece2]">Change profile picture<input type="file" accept="image/*" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { await user?.setProfileImage({ file }); setProfileStatus('Profile picture updated.'); } catch { setProfileStatus('Could not update the profile picture.'); } }} /></label>
            <button type="submit" className="mt-2 w-full rounded-lg bg-[#385e51] py-2 text-[13px] font-semibold text-white">Save username</button>
            {profileStatus && <p role="status" className="mt-2 text-[13px]">{profileStatus}</p>}
          </form>
        </details>
        <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c1cdbf] transition hover:bg-white/5 hover:text-white"><LogOut size={16} />Sign out</button>
      </div>
    </aside>
    <div className="wa-workspace min-w-0 flex-1">
      <header className="wa-topbar sticky top-0 z-20 flex items-center justify-between border-b border-[#d8d1c2] px-5 md:px-8">
        <div className="flex items-center gap-3 md:hidden"><button type="button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" aria-expanded={mobileNav} data-testid="button-toggle-navigation" className="grid h-11 w-11 place-items-center rounded-full border border-[#d8d1c2]"><Menu size={18} /></button><Mark /></div>
        <div className="wa-topbar-label hidden items-center gap-2 font-data text-[13px] uppercase md:flex"><Crosshair size={14} />WHEREABOUTS <span aria-hidden="true">/</span> {location==='/settings'?'SETTINGS':navLinks.find((item) => location === item.href)?.label ?? deskLinks.find((item) => location === item.href)?.label ?? 'Case workspace'}</div>
        <ReportChip/><span className="wa-topbar-label hidden items-center gap-2 font-data text-[13px] uppercase sm:inline-flex"><ShieldCheck size={13} />Private workspace</span>
      </header>
      <DeskRuler/>
      {mobileNav && <div className="fixed inset-0 z-30 bg-[#182b25]/35 md:hidden" onClick={() => setMobileNav(false)} onKeyDown={(event) => { if (event.key === 'Escape') setMobileNav(false); }}>
        <nav aria-label="Mobile navigation" className="fd-index-mobile max-h-[100dvh] w-[min(84vw,320px)] overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
          <div className="mb-9 flex items-center justify-between"><Mark inverse /><button type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} data-testid="button-close-navigation" className="grid h-11 w-11 place-items-center rounded-full bg-white/10"><X size={17} /></button></div>
          <FieldIndex items={navLinks.map(item=>({...item,testId:`mobile-nav-${item.label.toLowerCase().replaceAll(' ','-')}`}))} location={location} onNavigate={()=>setMobileNav(false)}/>
          <p className="mb-2 mt-6 px-3 font-data text-[13px] uppercase tracking-[.2em] text-[#9aaf9d]">Field desks</p>
          <FieldIndex items={deskLinks.map(item=>({...item,testId:`mobile-nav-desk-${item.id}`}))} location={location} start={6} onNavigate={()=>setMobileNav(false)}/>
          <FieldIndex items={[{href:'/settings',label:'Settings',testId:'mobile-nav-settings'}]} location={location} start={9} onNavigate={()=>setMobileNav(false)}/>
          <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="mobile-sign-out" className="mt-7 flex items-center gap-3 border-t border-[#52695d] px-3 pt-5 text-sm text-[#d0d9ce]"><LogOut size={16} />Sign out</button>
        </nav>
      </div>}
      <main className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 md:px-8 md:pt-9"><FieldSheet code={`${String([...navLinks,...deskLinks,{href:'/settings'}].findIndex(item=>item.href===location)+1||10).padStart(2,'0')} / FIELD DESK`}><ErrorBoundary resetKey={location}>{children}</ErrorBoundary></FieldSheet></main>
    </div>
  </div>;
}

function PageEyebrow({ children }: { children: ReactNode }) { return <p className="font-data text-[13px] uppercase tracking-[.2em] text-[#9c6d4e]">{children}</p>; }

function SkeletonBlock({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />; }

function QueryError({ retry, text = 'We could not reach your field notes.',error }: { retry: () => void; text?: string;error?:unknown }) {
  return <div role="alert" className="instrument-error rounded-2xl border p-7" data-testid="status-query-error">
    <span className="instrument-error-label">ERROR / 01</span><p className="font-editorial text-2xl">{text}</p><p className="mt-2 text-sm">Your work is safe. Give it another try.</p>
    {Boolean(error)&&<SafeRequestError error={error}/>}
    <button type="button" onClick={retry} data-testid="button-retry" className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#b98d6d] px-4 py-2 text-[13px] font-semibold"><LoaderCircle size={14} />Try again</button>
  </div>;
}

function DashboardPage() {
  const summary = useGetInvestigationSummary();
  const investigations = useListInvestigations(undefined, { query: { queryKey: getListInvestigationsQueryKey(), refetchInterval: pollListWhileAnalyzing } });
  const latest = summary.data?.latest;
  const rows = investigations.data ?? [];
  return <div className="wa-dashboard fade-up">
    <div className="wa-page-heading wa-dashboard-heading mb-7 gap-6">
      <div><PageEyebrow>Your private instrument / overview</PageEyebrow><DeskHeadline className="mt-3 text-5xl md:text-7xl">Back at the desk.</DeskHeadline><p className="mt-3 max-w-xl text-sm leading-6 text-[#718078]">Your photographs, possible places, and next questions. Pick up an investigation or open a separate private case.</p></div>
      <div className="wa-dashboard-actions"><Link href="/cases" data-testid="link-dashboard-cases" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d8d1c2] bg-[#fbf9f3] px-6 text-sm font-semibold text-[#385e51] transition hover:bg-[#e8e4d8]"><ShieldCheck size={16} />Private cases</Link>
      <Link href="/start" data-testid="link-dashboard-guide" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d8d1c2] bg-[#fbf9f3] px-6 text-sm font-semibold text-[#385e51] transition hover:bg-[#e8e4d8]"><ScanSearch size={16} />AI Guide</Link>
      {(rows.length>0||!investigations.isSuccess)&&<Link href="/investigate" data-testid="button-start-investigation" className="wa-action inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-semibold"><ImagePlus size={16} />Investigate an image <ArrowRight size={16} /></Link>}</div>
    </div>
    {summary.isLoading ? <div className="mb-8 grid gap-4 sm:grid-cols-3"><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /><SkeletonBlock className="h-32" /></div>
      : summary.isError ? <div className="mb-8"><QueryError retry={() => summary.refetch()} text="Your archive summary is taking a moment." /></div>
      : <div className="wa-stats wa-instrument-shelf mb-9">
        <OverviewClock label="Saved investigations" value={summary.data?.total ?? 0} caption="In your image archive" />
        <OverviewClock label="This month" value={summary.data?.thisMonth ?? 0} caption="Investigations opened" />
        <OverviewPhoto item={latest} title={latest ? displayTitle(latest.title) : 'Your first clue is waiting'} date={latest ? formatDate(latest.createdAt) : 'Begin with a photograph'}/>
      </div>}
    <DeskMargin/><div className="mb-5 flex items-end justify-between border-b border-[#d8d1c2] pb-4">
      <div><PageEyebrow>Recently opened</PageEyebrow><h2 className="mt-2 font-editorial text-3xl tracking-[-.03em]">Your latest trails</h2></div>
      <Link href="/library" data-testid="link-view-library" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#62776b] hover:text-[#c8794d]">View library <ArrowRight size={14} /></Link>
    </div>
    {investigations.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-56" />)}</div>
      : investigations.isError ? <QueryError retry={() => investigations.refetch()} />
      : rows.length === 0 ? <EmptyState icon={<Compass size={26} />} eyebrow="A new page" title="No investigations yet." text="Start with a photo that has been on your mind. We’ll help you follow its visual clues." action={<Link href="/investigate" data-testid="empty-start-investigation" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#385e51] px-5 py-3 text-[13px] font-semibold text-[#f4f0e6]">Investigate a photo <ArrowRight size={15} /></Link>} />
      : <ContactSheet>{rows.slice(0, 6).map((item,i) => <InvestigationCard key={item.id} item={item} frame={i+1}/>)}</ContactSheet>}
  </div>;
}

function EmptyState({ eyebrow, title, text, action }: { icon: ReactNode; eyebrow: string; title: string; text: string; action?: ReactNode }) {
  return <SpecimenTray label={`TRAY EMPTY / 00 ITEMS — ${eyebrow}`} title={title} text={text} action={action}/>;
}

function InvestigationCard({
  item,
  onDelete,
  onRename,
  selectable = false,
  selected = false,
  onToggleSelect,
  frame=1,
}: {
  item: Investigation;
  onDelete?: (item: Investigation) => void;
  onRename?: (item: Investigation) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (item: Investigation) => void;
  frame?:number;
}) {
  const[,navigate]=useLocation();
  const place = rankCandidates(item.candidates)[0];
  return <article className="wa-photo-card group relative" data-testid={`card-investigation-${item.id}`} data-selected={selected} data-cursor-crop="">
    {selected&&<CropMarks/>}
    <div className="relative aspect-[4/3] overflow-hidden bg-[#d9ddcf]" role={selectable?undefined:'link'} tabIndex={selectable?undefined:0} aria-label={selectable?undefined:`Open ${item.title}`} onClick={()=>selectable?onToggleSelect?.(item):navigate(`/investigation/${item.id}`)} onKeyDown={event=>{if(!selectable&&(event.key==='Enter'||event.key===' ')){event.preventDefault();navigate(`/investigation/${item.id}`);}}}>
      {isVideoInvestigation(item) ? <div className="flex h-full w-full items-center justify-center bg-[#2f4a40] text-[#d9e2d4]" data-testid={`placeholder-video-${item.id}`}><Film size={34} strokeWidth={1.4} aria-hidden="true" /></div> : <PixelPrint src={investigationMediaUrl(item.id)} alt={`Original photograph for ${item.title}`} className="h-full" testId={`img-investigation-${item.id}`}/>}
      <div className="absolute inset-0 bg-gradient-to-t from-[#1c3028]/55 to-transparent" />
      {selectable && <button type="button" onClick={(event) => { event.stopPropagation(); onToggleSelect?.(item); }} aria-label={`${selected ? 'Deselect' : 'Select'} ${item.title}`} aria-pressed={selected} data-testid={`button-select-investigation-${item.id}`} className={`absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full border-2 shadow-sm transition ${selected ? 'border-[#2e7047] bg-[#2e7047] text-white' : 'border-white bg-black/20 text-transparent hover:bg-black/40'}`}>{selected ? <Check size={18} strokeWidth={3} /> : <Circle size={20} className="text-white" />}</button>}
      <span className="absolute bottom-3 left-4 font-data text-[13px] uppercase tracking-[.14em] text-white">{place ? `${place.place}${place.country ? ` · ${place.country}` : ''}` : 'Place still unfolding'}</span>
      {isVideoInvestigation(item) && <span className="absolute bottom-3 right-4 rounded-full bg-[#263d36]/85 px-2.5 py-1 font-data text-[13px] uppercase tracking-[.12em] text-[#f4f0e6]" data-testid={`badge-video-${item.id}`}>Video</span>}
      {isAnalyzing(item) && <span className="absolute left-3 bottom-9 rounded-full bg-[#f6f2e6]/90 px-2.5 py-1 font-data text-[13px] text-[#a56743]" data-testid={`badge-analyzing-${item.id}`}>Analyzing…</span>}
      <span className="absolute right-3 top-3 rounded-full border border-white/40 bg-[#f6f2e6]/90 px-3 py-1 font-data text-[13px] text-[#385e51]">{item.candidates.length} {item.candidates.length === 1 ? 'lead' : 'leads'}</span>
    </div>
    <span className="fd-frame-number">{String(frame).padStart(2,'0')}A / {isVideoInvestigation(item)?'Motion file':'Source print'}</span>
    <div className="p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-data text-[13px] uppercase tracking-[.14em] text-[#9c6d4e]">{formatDate(item.createdAt)}</p><h3 className="mt-2 truncate font-editorial text-2xl tracking-[-.03em]" data-testid={`text-investigation-title-${item.id}`}>{displayTitle(item.title)}</h3></div>{(onDelete || onRename) && <details className="relative shrink-0"><summary aria-label={`Actions for ${item.title}`} data-testid={`button-investigation-menu-${item.id}`} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full text-[#68796e] hover:bg-[#ebe9de]"><Ellipsis size={17} /></summary><div className="absolute right-0 top-10 z-10 min-w-36 rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-1 shadow-lg">{onRename && <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onRename(item); }} className="w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-[#ebe9de]">Rename</button>}{onDelete && <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onDelete(item); }} className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#9d5846] hover:bg-[#f7eae4]">Delete</button>}</div></details>}</div>
      <p className="mt-2 line-clamp-2 min-h-[42px] text-[13px] leading-5 text-[#718078]">{item.desk === 'original' && place ? <>Best guess: <strong className="font-semibold text-[#263d36]">{place.place}</strong> · Confidence {candidateScore(place.confidence)}/100</> : item.summary || 'A collection of clues is ready to explore.'}</p>
      <Link href={`/investigation/${item.id}`} data-testid={`link-open-investigation-${item.id}`} className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[#385e51]">Open investigation <ArrowUpRight size={14} /></Link>
    </div>
  </article>;
}

function candidateScore(confidence: number) {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

function FieldDeskPage() {
  const [, params] = useRoute('/desk/:deskId');
  const desk = fieldDesks.find((item) => item.id === params?.deskId);
  const query = useListInvestigations(undefined, { query: { queryKey: getListInvestigationsQueryKey(), refetchInterval: pollListWhileAnalyzing } });
  if (!desk) return <NotFound />;
  const rows = (query.data ?? []).filter((item) => item.desk === desk.id);
  return <div className="wa-library fade-up">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><PageEyebrow>{`DESK ${desk.id==='original'?'A':desk.id==='recreation'?'B':'C'} / ${desk.id==='fake-news'?'JOURNALISM':desk.label.toUpperCase()}`}</PageEyebrow><DeskHeadline className="mt-3 text-5xl md:text-6xl">{`${desk.label}.`}</DeskHeadline><p className="mt-3 text-sm text-[#718078]">{desk.subtitle}.</p></div>
      <Link href="/investigate" data-testid={`button-new-from-desk-${desk.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6]"><ImagePlus size={15} />Add a photo</Link>
    </div>
    {query.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-[340px]" />)}</div>
      : query.isError ? <QueryError retry={() => query.refetch()} text={`The ${desk.label} desk is unavailable just now.`} />
      : rows.length === 0 ? <EmptyState icon={desk.icon} eyebrow="Desk is ready" title="No investigations here yet." text={`Photos submitted in the ${desk.label} upload spot will be filed here.`} action={<Link href="/investigate" data-testid={`empty-desk-start-${desk.id}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#385e51] px-5 py-3 text-[13px] font-semibold text-[#f4f0e6]">Add a photo <ArrowRight size={15} /></Link>} />
      : <ContactSheet>{rows.map((item,i) => <InvestigationCard key={item.id} item={item} frame={i+1}/>)}</ContactSheet>}
  </div>;
}

function InvestigatePage() {
  const operation=useReportOperation(),operationRef=useRef(operation);operationRef.current=operation;
  const [activeSlotId, setActiveSlotId] = useState<PhotoUploadSlotId>('original');
  const [files, setFiles] = useState<Record<PhotoUploadSlotId, File | null>>({
    original: null,
    recreation: null,
    'fake-news': null,
  });
  const [requestIds, setRequestIds] = useState<
    Record<PhotoUploadSlotId, string | null>
  >({
    original: null,
    recreation: null,
    'fake-news': null,
  });
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [journalismQuestion, setJournalismQuestion] = useState('');
  const [shotAt, setShotAt] = useState('');
  const [localError, setLocalError] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const [progress, setProgress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<AnalysisStage>('uploading');
  const [analysisDesk, setAnalysisDesk] = useState<PhotoUploadSlotId>('original');
  const [startedAt, setStartedAt] = useState(0);
  const [failureMessage, setFailureMessage] = useState('');
  const [dateFromPhoto, setDateFromPhoto] = useState(false);
  const [slotErrors, setSlotErrors] = useState<
    Partial<Record<PhotoUploadSlotId, string>>
  >({});
  const [savedInvestigations, setSavedInvestigations] = useState<
    Array<{ id: string; title: string; slotLabel: string }>
  >([]);
  const uploadUrl = useRequestUploadUrl();
  const create = useCreateInvestigation();
  const client = useQueryClient();
  const { apiKey } = useApiKey();
  const selectedCount = investigationPhotoSlots.filter(
    (slot) => files[slot.id],
  ).length;
  const activeSlot = investigationPhotoSlots.find((slot) => slot.id === activeSlotId)!;
  const activeDeskIndex = fieldDesks.findIndex((desk) => desk.id === activeSlotId);
  const [originalRunning, setOriginalRunning] = useState(false);
  const [originalCount,setOriginalCount]=useState(0);
  const[flowStep,setFlowStep]=useState<InvestigationStep>(1),[questionTab,setQuestionTab]=useState(false);
  useEffect(()=>{if(flowStep===2)document.getElementById('investigation-title')?.focus({preventScroll:true});else if(flowStep===3)document.querySelector<HTMLButtonElement>('[data-testid="button-analyze-photo-desks"]')?.focus({preventScroll:true});},[flowStep]);
  const[extraFileErrors,setExtraFileErrors]=useState<Record<string,string>>({});
  const originalRunner=useRef<(()=>Promise<boolean>)|null>(null),originalDestination=useRef('/library');
  const[extraFiles,setExtraFiles]=useState<{id:string;desk:PhotoUploadSlotId;file:File}[]>([]),[printOrder,setPrintOrder]=useState<string[]>([]);
  const totalCount=originalCount+selectedCount+extraFiles.length;
  const printEntries=[...investigationPhotoSlots.flatMap(slot=>files[slot.id]?[{id:`slot:${slot.id}`,file:files[slot.id]!,label:slot.label}]:[]),...extraFiles.map(row=>({id:row.id,file:row.file,label:investigationPhotoSlots.find(slot=>slot.id===row.desk)!.label}))].sort((a,b)=>(printOrder.includes(a.id)?printOrder.indexOf(a.id):999)-(printOrder.includes(b.id)?printOrder.indexOf(b.id):999));
  const addDeskFiles=(list:FileList|File[]|null)=>{let available=6-totalCount,main=Boolean(files[activeSlotId]);const additions:typeof extraFiles=[];for(const file of Array.from(list??[])){const contentType=imageContentType(file);if(available<=0){setLocalError('Up to six selected files. Existing selections were kept.');break;}if(!contentType||!visualModelImageTypes.has(contentType)||file.size>25*1024*1024){setLocalError('For this desk, use a supported JPEG, PNG, WebP or GIF image up to 25 MB.');continue;}if(!main){setSelectedFile(activeSlotId,file);main=true;}else additions.push({id:crypto.randomUUID(),desk:activeSlotId,file});available--;}if(additions.length)setExtraFiles(current=>[...current,...additions]);};
  useEffect(()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const pane=document.querySelector('[data-active-desk]');const animation=pane?.animate([{transform:'translateX(12px)',opacity:.5},{transform:'translateX(0)',opacity:1}],{duration:250,easing:'ease-out'});return()=>animation?.cancel();},[activeSlotId]);
  const pending = submitting || uploadUrl.isPending || create.isPending;
  const setSelectedFile = (slotId: PhotoUploadSlotId, selected: File) => {
    if(!files[slotId]&&totalCount>=6){setLocalError('Up to six selected media items. Remove a print before adding another.');return;}
    setLocalError('');
    setBatchStatus('');
    setSlotErrors((current) => ({ ...current, [slotId]: undefined }));
    const contentType = imageContentType(selected);
    if (!contentType) {
      setFiles((current) => ({ ...current, [slotId]: null }));
      setRequestIds((current) => ({ ...current, [slotId]: null }));
      setSlotErrors((current) => ({
        ...current,
        [slotId]:
          'Choose a JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF, HEIC, or HEIF image.',
      }));
      return;
    }
    if (slotId !== 'original' && !visualModelImageTypes.has(contentType)) {
      setFiles((current) => ({ ...current, [slotId]: null }));
      setRequestIds((current) => ({ ...current, [slotId]: null }));
      setSlotErrors((current) => ({
        ...current,
        [slotId]: 'For this desk, use a JPEG, PNG, WebP, or non-animated GIF image.',
      }));
      return;
    }
    if (selected.size > 25 * 1024 * 1024) {
      setFiles((current) => ({ ...current, [slotId]: null }));
      setRequestIds((current) => ({ ...current, [slotId]: null }));
      setSlotErrors((current) => ({
        ...current,
        [slotId]: 'This image is larger than 25 MB. Choose a smaller file.',
      }));
      return;
    }
    setFiles((current) => ({ ...current, [slotId]: selected }));
    setRequestIds((current) => ({ ...current, [slotId]: crypto.randomUUID() }));
    setFailureMessage('');
    if (!shotAt || dateFromPhoto) {
      void readPhotoTakenDate(selected).then((taken) => {
        if (taken) { setShotAt(taken); setDateFromPhoto(true); }
      });
    }
  };
  const removeSelectedFile = (slotId: PhotoUploadSlotId) => {
    setFiles((current) => ({ ...current, [slotId]: null }));
    setRequestIds((current) => ({ ...current, [slotId]: null }));
    setSlotErrors((current) => ({ ...current, [slotId]: undefined }));
    setBatchStatus('');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(flowStep!==3){setFlowStep(advanceInvestigationStep(flowStep,totalCount));return;}
    if(!canSubmitInvestigation(flowStep,totalCount,submitting||originalRunning))return;
    deskSound('shutter');
    operation.begin(title,totalCount,printEntries[0]?.file);
    operation.setRetry(()=>{(document.getElementById('investigate-form') as HTMLFormElement|null)?.requestSubmit();});
    setExtraFileErrors({});
    setLocalError('');
    setBatchStatus('');
    setFailureMessage('');
    setSavedInvestigations([]);
    const selected:Array<{slot:PhotoUploadSlotDefinition;file:File;requestId:string;extraId?:string}> = investigationPhotoSlots.flatMap((slot) => {
      const file = files[slot.id];
      const requestId = requestIds[slot.id];
      return file && requestId ? [{ slot, file, requestId }] : [];
    });
    selected.push(...extraFiles.map(row=>({slot:investigationPhotoSlots.find(slot=>slot.id===row.desk)!,file:row.file,requestId:row.id,extraId:row.id})));
    selected.sort((a,b)=>{const ai=a.extraId??`slot:${a.slot.id}`,bi=b.extraId??`slot:${b.slot.id}`;return(printOrder.includes(ai)?printOrder.indexOf(ai):999)-(printOrder.includes(bi)?printOrder.indexOf(bi):999);});
    if(originalCount){
      setSubmitting(true);setStage('uploading');setStartedAt(Date.now());
      try{const complete=await originalRunner.current?.();if(!complete){const message='Some Investigations files need attention. Return to step 01 to review or retry them.';setLocalError(message);operation.fail(message);return;}}
      catch(error){const message=error instanceof Error?error.message:'The upload could not finish. Your selected files remain available to retry.';setLocalError(message);operation.fail(message);return;}
      finally{setSubmitting(false);}
      if(!selected.length){operation.complete(originalDestination.current);return;}
    }
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
    setStage('uploading');
    setStartedAt(Date.now());
    let reportIdToOpen: string | null = null;
    try {
      const created:SavedInvestigationPhoto[]=[],failed:Partial<Record<PhotoUploadSlotId,string>>={};let failedFileCount=0;
      for(const [queueIndex,queued] of selected.entries()){if(operation.stopped())break;operation.item(queued.file,originalCount+queueIndex+1);const result = await processInvestigationPhotoUploads({
        selected:[queued],
        title,
        context,
        journalismQuestion,
        apiKey,
        shotAt,
        signal:operation.signal(),
        getContentType: imageContentType,
        requestUploadUrl: (variables) => uploadUrl.mutateAsync(variables),
        uploadFile: async (uploadURL, file, contentType) => {
          const response = await fetch(uploadURL, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
            signal:operation.signal(),
          });
          if (!response.ok) {
            const error = new Error('The photograph could not be stored. Please try again.') as Error & { status: number };
            error.status = response.status;
            throw error;
          }
        },
        createInvestigation: (variables) => create.mutateAsync(variables),
        onProgress: (message, slotId) => {
          setAnalysisDesk(slotId);
          setProgress(`${message.startsWith('Analyzing')?'ANALYZE':'UPLOAD'} / ${queued.file.name}`);
          setStage(message.startsWith('Analyzing') ? 'analyzing' : 'uploading');
          operation.phase(message.startsWith('Analyzing')?'analyzing':'uploading');
        },
        onSaved: (slotId) => {
          if(queued.extraId){setExtraFiles(current=>current.filter(row=>row.id!==queued.extraId));return;}
          setFiles((current) => ({ ...current, [slotId]: null }));
          setRequestIds((current) => ({ ...current, [slotId]: null }));
        },
      });created.push(...result.created);Object.assign(failed,result.failed);if(Object.keys(result.failed).length){failedFileCount++;if(queued.extraId){const id=queued.extraId;setExtraFileErrors(current=>({...current,[id]:Object.values(result.failed).join(' ')}));}}}

      if (created.length) {
        setSavedInvestigations((current) => [...current, ...created]);
        await Promise.all([
          client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }),
          client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() }),
        ]);
      }
      setSlotErrors((current) => ({ ...current, ...failed }));
      if (created.length) {
        const failedCount = failedFileCount;
        if (failedCount === 0) {
          reportIdToOpen = totalCount>1?'__batch__':created[0].id;
        } else {
          setBatchStatus(
            `Saved ${created.length} separate investigation${created.length === 1 ? '' : 's'}. ${failedCount} photo${failedCount === 1 ? '' : 's'} could not be processed; retry the remaining upload${failedCount === 1 ? '' : 's'} below.`,
          );
        }
      } else {
        const reasons = [...new Set(Object.values(failed).filter(Boolean))];
        setFailureMessage(reasons.join(' ') || 'The location service could not finish. This is usually temporary.');
      }
    } finally {
      setSubmitting(false);
      setProgress('');
      operation.settled();
    }
    if(operation.stopped())return;
    if (reportIdToOpen) operation.complete(reportIdToOpen==='__batch__'?'/library':`/investigation/${encodeURIComponent(reportIdToOpen)}`);
    else operation.fail('Some files could not be processed. Your remaining files and context are retained. Review the upload errors or try again.');
  };
  useEffect(()=>{operationRef.current.setRetry(()=>{(document.getElementById('investigate-form') as HTMLFormElement|null)?.requestSubmit();});},[]);

  return <div className="wa-intake fade-up investigation-theme mx-auto" data-desk-theme={activeSlotId}>
    <Link href="/user-portal" data-testid="link-back-to-overview" className="mb-7 inline-flex items-center gap-2 text-[13px] font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to overview</Link>
     <div className="wa-page-heading mb-7"><p className="desk-theme-eyebrow font-data text-[13px] uppercase tracking-[.12em]">Image investigation / new frame</p><DeskHeadline className="mt-3 text-5xl md:text-6xl">Start with what you see.</DeskHeadline></div>
    <p className="wa-mode-note mb-6 text-[13px]">Image analysis · <Link href="/cases" data-testid="link-intake-private-cases" className="font-semibold underline underline-offset-4">Private cases</Link> · <Link href="/start" data-testid="link-intake-guide" className="font-semibold underline underline-offset-4">AI Guide</Link><HelpNote>This is image analysis, not the private missing-person evidence workspace. Private cases organize authorized evidence without automatic image analysis. Each selected image stays assigned to its desk.</HelpNote></p>
    <form id="investigate-form" onSubmit={submit} className="fd-wizard space-y-6" data-drag-region={flowStep===1?'new-investigation':undefined} onKeyDown={event=>{const target=event.target as HTMLInputElement;if(event.key==='Enter'&&flowStep!==3&&target.tagName!=='TEXTAREA'&&target.tagName!=='BUTTON'&&target.type!=='file'){event.preventDefault();setFlowStep(advanceInvestigationStep(flowStep,totalCount));}}}>
      <nav className="fd-step-count" aria-label="Investigation steps">{([1,2,3] as InvestigationStep[]).map(step=><button type="button" key={step} aria-current={flowStep===step?'step':undefined} disabled={pending||originalRunning||step>flowStep} onClick={()=>setFlowStep(step)}>0{step}</button>)}</nav>
      <section hidden={flowStep!==1} className="fd-wizard-step desk-theme-panel">
        <div className="mb-5" hidden>
          <p className="desk-theme-eyebrow font-data text-[13px] uppercase tracking-[.2em]">01 / Choose a field desk &amp; source</p>
          <p className="mt-2 text-[13px] leading-5 text-[#718078]">Switch desks to add another photo. Photos you’ve selected remain in their desk; shared details below apply to each one.</p>
        </div>
        <div className="fd-source-desk"><DeskSelector value={activeDeskIndex} onChange={index=>setActiveSlotId(fieldDesks[index].id)} disabled={pending||originalRunning}/>
        <div role="region" className="fd-desk-page" aria-label={`${activeSlot.label} photo upload`} data-active-desk={activeSlotId}>
          <div data-desk-panel="original" data-active={activeSlot.id==='original'} inert={activeSlot.id!=='original'} aria-hidden={activeSlot.id !== 'original'}><OriginalMediaIntake controlsRef={originalRunner} onStageChange={setStage} maxItems={6-selectedCount-extraFiles.length} onSelectionCountChange={setOriginalCount} onRunningChange={setOriginalRunning} title={title} context={context} shotAt={shotAt} apiKey={apiKey} onOpen={(path) => {originalDestination.current=path;}} onImageSelected={(file) => { if (!shotAt || dateFromPhoto) void readPhotoTakenDate(file).then((taken) => { if (taken) { setShotAt(taken); setDateFromPhoto(true); } }); }} /></div>
          {investigationPhotoSlots.filter(slot=>slot.id!=='original').map(slot=><div key={slot.id} data-desk-panel={slot.id} data-active={activeSlot.id===slot.id} inert={activeSlot.id!==slot.id} aria-hidden={activeSlot.id!==slot.id}><PhotoUploadSlot
            slot={slot}
              trayOnly onSelectFiles={list=>{setLocalError('');addDeskFiles(list);}}
              trayFiles={printEntries.filter(item=>item.label===slot.label)}
              onRemoveTrayFile={id=>{if(id.startsWith('slot:'))removeSelectedFile(id.slice(5) as PhotoUploadSlotId);else setExtraFiles(current=>current.filter(row=>row.id!==id));}}
            file={files[slot.id]}
            error={slotErrors[slot.id]}
            disabled={pending || originalRunning}
            onSelectFile={(file) => setSelectedFile(slot.id, file)}
            onRemoveFile={() => removeSelectedFile(slot.id)}
          /></div>)}
        </div>
        </div>
        <ul className="fd-desk-descriptions" data-testid="list-new-investigation-types">{fieldDesks.map(desk=><li key={desk.id} data-active={activeSlot.id===desk.id} data-testid={`text-new-investigation-type-${desk.id}`}><strong>{desk.shortLabel}</strong><span>{desk.subtitle}</span></li>)}</ul>
        <div className="desk-batch-reserve" data-active={activeSlot.id!=='original'} inert={activeSlot.id==='original'} aria-hidden={activeSlot.id==='original'}><BatchPrints items={printEntries} errors={extraFileErrors} onOrder={setPrintOrder} onRemove={id=>{if(id.startsWith('slot:'))removeSelectedFile(id.slice(5) as PhotoUploadSlotId);else setExtraFiles(current=>current.filter(row=>row.id!==id));}}/></div>
        {localError&&<p role="alert" className="mt-4 text-[13px]">{localError}</p>}
        {totalCount>0&&<footer><button type="button" className="fd-next fd-primary px-6 py-3" data-testid="button-investigation-next-photo" onClick={()=>setFlowStep(2)}>Next →</button><span className="font-data text-[13px]">{totalCount} media item{totalCount===1?'':'s'} across selected desks</span></footer>}
      </section>
      <div hidden={flowStep!==2} className="fd-wizard-step desk-theme-panel max-w-[720px]">
        <details open className="optional-details group" data-testid="details-optional-fields">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl" data-testid="toggle-optional-fields">
          <span className="min-w-0">
            <span className="desk-theme-eyebrow block font-data text-[13px] uppercase tracking-[.2em]">02 / Record context <span className="normal-case tracking-normal">· optional</span></span>
            <span className="mt-1 block truncate text-[13px] text-[#718078]">{[title.trim() && 'Case name', context.trim() && 'Notes', activeSlotId === 'fake-news' && journalismQuestion.trim() && 'Question', shotAt && (dateFromPhoto ? 'Date (from photo)' : 'Date')].filter(Boolean).join(' · ') || 'Case name, what you already know, date taken'}</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[#718078] transition-transform group-open:rotate-180" />
        </summary>
        <label className="mt-5 block text-[13px] font-semibold text-[#465c50]" htmlFor="investigation-title">Case name <span className="font-normal text-[#97a095]">optional</span><HelpNote>Each title includes its desk label. Without a case name, the photo filename is used.</HelpNote></label>
        <input id="investigation-title" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Rocky Mountain trip" data-testid="input-investigation-title" className="mt-2 h-12 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 text-sm outline-none transition focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        <label className="mt-5 block text-[13px] font-semibold text-[#465c50]" htmlFor="investigation-context">What do you already know? <span className="font-normal text-[#97a095]">optional</span><HelpNote>Context stays in your private report. The location finder receives only the image. Journalism's optional analyst question is sent for that desk's image analysis.</HelpNote></label>
        {activeSlotId==='fake-news'&&<div className="flex gap-5 text-[13px] my-3" role="group" aria-label="Context editor"><button type="button" aria-pressed={!questionTab} onClick={()=>setQuestionTab(false)}>Record notes</button><button type="button" aria-pressed={questionTab} onClick={()=>setQuestionTab(true)}>Analyst question · optional</button></div>}
        <textarea hidden={activeSlotId==='fake-news'&&questionTab} id="investigation-context" value={context} maxLength={3000} onChange={(event) => setContext(event.target.value)} rows={5} placeholder="A trip, a season, a friend's comment, the direction of the light…" data-testid="input-investigation-context" className="mt-2 w-full resize-y rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[#a0a69c] focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        <p className="mt-1 text-right font-data text-[13px] text-[#a1a79d]">{context.length} / 3000</p>
        {activeSlotId === 'fake-news' && questionTab&&<textarea aria-label="Journalism analyst question optional" id="journalism-question" value={journalismQuestion} maxLength={1000} onChange={(event) => setJournalismQuestion(event.target.value)} rows={5} placeholder="What detail in this photo could reveal when it was taken?" data-testid="input-journalism-question" className="mt-2 w-full resize-y px-4 py-3 text-sm" />}
        <label className="mt-4 block text-[13px] font-semibold text-[#465c50]" htmlFor="investigation-shot-at">When was it taken? <span className="font-normal text-[#97a095]">optional</span><HelpNote>Use a date you know, or leave it blank. A supplied date stays in the report, not the image-model request. A real camera date is prefilled only when the selected image contains it.</HelpNote></label>
        <input type="date" id="investigation-shot-at" value={shotAt} onChange={(event) => { setShotAt(event.target.value); setDateFromPhoto(false); }} data-testid="input-shot-date" className="mt-2 h-12 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 text-sm text-[#53685d] outline-none focus:border-[#668675] focus:ring-2 focus:ring-[#385e51]/10" />
        {dateFromPhoto && shotAt && <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#385e51]" data-testid="status-date-from-photo"><Check size={13} />Filled in from the photo</p>}
        </details>
        <footer><button type="button" onClick={()=>setFlowStep(3)}>Skip</button><button type="button" className="fd-primary px-6 py-3" onClick={()=>setFlowStep(3)}>Next →</button></footer>
      </div>
      <div hidden={flowStep!==3} className="fd-wizard-step desk-theme-panel">
        <dl className="fd-summary"><dt>PHOTOS</dt><dd>{String(totalCount).padStart(2,'0')}</dd><dt>DESK</dt><dd>{['A · INVESTIGATIONS','B · RECREATION','C · JOURNALISM'][activeDeskIndex]}</dd><dt>CASE</dt><dd>{title.trim()||'Untitled (uses file names)'}</dd></dl><HelpNote>All selected desks are processed; videos retain their existing workflow. Each media item keeps its assigned desk.</HelpNote>
        <FlipChecklist/>
        {localError && <p role="alert" className="mt-4 rounded-xl border border-[#dfc6b6] bg-[#f9eee6] px-4 py-3 text-[13px] leading-5 text-[#875545]" data-testid="status-upload-error">{localError}</p>}
        {(pending||originalRunning) && <div className="fd-live-stage" role="status">{progress||(stage==='uploading'?'UPLOAD / transferring selected media…':'PROCESSING / waiting for the saved report…')}<span className="block text-[13px] mt-2">Indeterminate · {analysisDesk} · started {new Date(startedAt).toLocaleTimeString()}</span></div>}
        {!pending && failureMessage && <AnalysisFailed message={failureMessage} onRetry={() => (document.getElementById('investigate-form') as HTMLFormElement | null)?.requestSubmit()} />}
        <div className="fd-shutter-wrap"><ShutterButton type="submit" aria-label="Analyze selected media" onKeyDown={event=>{if(event.repeat&&(event.key==='Enter'||event.key===' '))event.preventDefault();}} disabled={pending||originalRunning||totalCount===0} data-testid="button-analyze-photo-desks"/><span>ANALYZE</span></div>
        <p className="fd-model-reference" aria-label="Illustrative pipeline, not live stage progress">ILLUSTRATIVE MODEL, NOT LIVE PROGRESS<br/>UPLOAD → READ SCENE → COMPARE CLUES → RANK FINDINGS → SAVE REPORT</p>
        <p className="text-[13px] text-center">Selected media goes to its desk's analysis provider.<HelpNote>Image Locator handles location estimates. OpenAI handles Journalism image analysis. Shared case names, notes and dates stay in the private record; an optional Journalism question is sent for that desk. No new private missing-person analysis is enabled.</HelpNote></p>
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
                      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#385e51] underline decoration-[#9aaf9d] underline-offset-4 hover:text-[#a56743]"
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
  const[deskFilter,setDeskFilter]=useState(0);
  const [search, setSearch] = useState('');
  const query = useListInvestigations(search.trim() ? { query: search.trim() } : undefined, { query: { queryKey: getListInvestigationsQueryKey(search.trim() ? { query: search.trim() } : undefined), refetchInterval: pollListWhileAnalyzing,placeholderData:previous=>previous } });
  const remove = useDeleteInvestigation();
  const update = useUpdateInvestigation();
  const client = useQueryClient();
  const [deleteError, setDeleteError] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState('');
  const rows = useMemo(()=>{const term=search.trim().toLocaleLowerCase(),matches=(item:Investigation)=>JSON.stringify([item.title,item.context,item.summary,item.candidates]).toLocaleLowerCase().includes(term);return [...(query.data??[])].filter(item=>deskMatchesFilter(item.desk,deskFilter)).sort((a,b)=>Number(matches(b))-Number(matches(a)));},[query.data,search,deskFilter]);
  const selectedRows = rows.filter((item) => selectedIds.has(item.id));
  const toggleSelect = (item: Investigation) => setSelectedIds((current) => {
    const next = new Set(current);
    next.has(item.id) ? next.delete(item.id) : next.add(item.id);
    return next;
  });
  const deleteItem = async (item: Investigation) => {
    if (!window.confirm(`Remove “${item.title}” and its saved investigation from your library?`)) return;
    setDeleteError('');
    try {
      await remove.mutateAsync({ id: item.id });
      await Promise.all([client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }), client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() })]);
    } catch { setDeleteError('That investigation could not be removed. Please try again.'); }
  };
  const renameItem = async (item: Investigation) => {
    const nextTitle = window.prompt('Rename this investigation', item.title)?.trim();
    if (!nextTitle || nextTitle === item.title) return;
    if (nextTitle.length > 120) {
      setDeleteError('Investigation names can be at most 120 characters.');
      return;
    }
    try {
      await update.mutateAsync({ id: item.id, data: { title: nextTitle } });
      await Promise.all([
        client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }),
        client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() }),
      ]);
      setActionMessage('Investigation renamed.');
    } catch {
      setDeleteError('That investigation could not be renamed. Please try again.');
    }
  };
  const deleteSelected = async () => {
    if (!selectedRows.length) return;
    if (!window.confirm(`Permanently delete ${selectedRows.length} selected investigation${selectedRows.length === 1 ? '' : 's'} and their saved photos?`)) return;
    const results = await Promise.allSettled(selectedRows.map((item) => remove.mutateAsync({ id: item.id })));
    const deletedIds = selectedRows.filter((_, index) => results[index].status === 'fulfilled').map((item) => item.id);
    setSelectedIds((current) => new Set([...current].filter((id) => !deletedIds.includes(id))));
    await Promise.all([
      client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetInvestigationSummaryQueryKey() }),
    ]);
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    setDeleteError(failedCount ? `${deletedIds.length} deleted; ${failedCount} could not be deleted. Try those again.` : '');
    setActionMessage(failedCount ? '' : `${deletedIds.length} investigation${deletedIds.length === 1 ? '' : 's'} deleted.`);
  };
  return <div className="wa-library fade-up">
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><PageEyebrow>Personal archive / index</PageEyebrow><DeskHeadline className="mt-3 text-5xl md:text-6xl">Your library.</DeskHeadline><p className="mt-3 text-sm text-[#718078]">Every photograph, clue, and possible place you’ve kept.</p></div>
    </div>
    <div className="mb-7 library-instruments">
      <label className="fd-search-ruler relative block max-w-[560px] flex-1"><span className="sr-only">Search your library</span><input type="search" value={search} maxLength={LIBRARY_SEARCH_MAX_LENGTH} onChange={(event) => { setSearch(constrainLibrarySearch(event.target.value)); setSelectedIds(new Set()); }} placeholder="Search by title, place, or clue…" data-testid="input-library-search" className="h-12 w-full pr-4 text-sm" /></label>
      <DeskFilterKeys value={deskFilter} onChange={value=>{setDeskFilter(value);setSelectedIds(new Set());}}/>
      <div className="flex items-center gap-2 self-start px-4 py-3 font-data text-[13px] uppercase tracking-[.12em] sm:self-auto" aria-live="polite">{query.data?<Odometer value={rows.length}/>: '—'} saved <span style={{visibility:query.isFetching?'visible':'hidden'}}> / UPDATING INDEX</span></div>
      <button type="button" onClick={() => { setSelectMode((current) => !current); setSelectedIds(new Set()); }} data-testid="button-toggle-library-select" className="rounded-full border border-[#c9c7b7] px-5 py-3 text-[13px] font-semibold text-[#53695d] hover:bg-[#ebe9de]">{selectMode ? 'Cancel selection' : 'Select'}</button>
      {selectMode && <button type="button" onClick={deleteSelected} disabled={!selectedRows.length || remove.isPending} data-testid="button-delete-selected-investigations" className="rounded-full bg-[#a65044] px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-45">Delete selected ({selectedRows.length})</button>}
    </div>
    {deleteError && <p role="alert" className="mb-5 rounded-xl border border-[#dfc6b6] bg-[#f9eee6] px-4 py-3 text-sm text-[#875545]" data-testid="status-delete-error">{deleteError}</p>}
    {actionMessage && <p role="status" className="mb-5 text-sm text-[#476450]" data-testid="status-library-action">{actionMessage}</p>}
    {query.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <SkeletonBlock key={item} className="h-[340px]" />)}</div>
      : query.isError ? <QueryError retry={() => query.refetch()} text="Your library is unavailable just now." error={query.error}/>
      : rows.length === 0 ? <EmptyState icon={<Search size={24} />} eyebrow={search||deskFilter ? 'No matching notes' : 'The index is open'} title={search||deskFilter ? 'Nothing found here.' : 'Your library is still empty.'} text={search||deskFilter ? 'Try another desk, place name, title, or clue.' : 'Investigations you save will be gathered here, ready to search and revisit.'} action={search||deskFilter ? <button type="button" onClick={() => {setSearch('');setDeskFilter(0);}} data-testid="button-clear-search" className="mt-5 text-[13px] font-semibold text-[#385e51] underline underline-offset-4">Clear filters</button> : <Link href="/investigate" data-testid="empty-library-start" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#385e51] px-5 py-3 text-[13px] font-semibold text-[#f4f0e6]">Add your first photograph <ArrowRight size={15} /></Link>} />
      : <ContactSheet orderKey={`${search}:${rows.map(row=>row.id).join(',')}`}>{rows.map((item,i) => <InvestigationCard key={item.id} item={item} frame={i+1} onDelete={deleteItem} onRename={renameItem} selectable={selectMode} selected={selectedIds.has(item.id)} onToggleSelect={toggleSelect} />)}</ContactSheet>}
  </div>;
}

function InvestigationPage() {
  const [, params] = useRoute('/investigation/:id');
  const id = params?.id ?? '';
  const query = useGetInvestigation(id, { query: { enabled: Boolean(id), queryKey: getGetInvestigationQueryKey(id), refetchInterval: pollWhileAnalyzing } });
  const isVideo = isVideoInvestigation(query.data);
  const photo = useGetInvestigationPhoto(id, { query: { enabled: Boolean(id) && Boolean(query.data) && !isVideo, queryKey: getGetInvestigationPhotoQueryKey(id) } });
  const retryAnalysis = useRetryInvestigationAnalysis();
  const [retryError, setRetryError] = useState('');
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const seekTo = (seconds: number) => { const player = playerRef.current; if (!player) return; player.currentTime = seconds; void player.play().catch(() => {}); player.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); };
  const retryVideo = async () => {
    setRetryError('');
    try {
      const saved = await retryAnalysis.mutateAsync({ id });
      client.setQueryData(getGetInvestigationQueryKey(id), saved);
      await client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() });
    } catch (error) { setRetryError(error instanceof Error ? error.message : 'The analysis could not be restarted. Please try again.'); }
  };
  const update = useUpdateInvestigation();
  const remove = useDeleteInvestigation();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState('');
  const refreshCandidates = useRefreshInvestigationCandidates();
  const item = query.data;
  const legacySourceReport = isLegacyRecreationReport(item);
  useEffect(() => {
    if (refreshMessage !== 'Checking key moments in the video… this can take a few minutes.') return;
    if (item?.status === 'done') setRefreshMessage('New location leads are ready to review.');
    if (item?.status === 'failed') setRefreshMessage('The video could not be re-checked. Use Try again above.');
  }, [item?.status, refreshMessage]);
  const rankedLeads = useMemo(() => rankCandidates(item?.candidates ?? []), [item?.candidates]);
  useEffect(() => {
    if (item) { setTitle(item.title); setContext(item.context ?? ''); setSelectedCandidateIndex(0); }
  }, [item?.id]);
  const photoUrl = useMemo(() => photo.data instanceof Blob ? URL.createObjectURL(photo.data) : '', [photo.data]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  const refreshLocations = async () => {
    if (!item) return;
    setRefreshMessage('Looking for different location leads…');
    try {
      const saved = await refreshCandidates.mutateAsync({
        id: item.id,
        data: { excludePlaces: item.candidates.map((candidate) => candidate.place) },
      }) as Investigation | undefined;
      if (saved && typeof saved === 'object' && 'id' in saved) client.setQueryData(getGetInvestigationQueryKey(item.id), saved);
      await client.invalidateQueries({ queryKey: getGetInvestigationQueryKey(item.id) });
      await client.invalidateQueries({ queryKey: getListInvestigationsQueryKey() });
      setSelectedCandidateIndex(0);
      setRefreshMessage(saved?.status === 'analyzing' ? 'Checking key moments in the video… this can take a few minutes.' : saved?.status === 'failed' ? 'The video could not be re-checked. Use Try again above.' : 'New location leads are ready to review.');
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : 'Different location leads could not be found. Your current report is unchanged.');
    }
  };
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
  const selectedLead = rankedLeads[selectedCandidateIndex] ?? rankedLeads[0];
  const imageGeolocation=isImageGeolocationReport(item);
  const summaryMentionsLowerLead = rankedLeads.slice(1).some((lead) =>
    item.summary.toLocaleLowerCase().includes(lead.place.toLocaleLowerCase()),
  );
  const sceneSummary = item.desk === 'fake-news'
    ? item.summary
    : summaryMentionsLowerLead
    ? `The Image Locator service ranked ${rankedLeads[0].place} as the strongest location lead.`
    : humanizeClueText(item.summary);
  return <div className="wa-result fade-up">
    <Link href="/library" data-testid="link-back-to-library" className="mb-7 inline-flex items-center gap-2 text-[13px] font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to library</Link>
    <div className={imageGeolocation?'mb-4 flex w-full flex-wrap items-end justify-between gap-3':'mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'}>
      <div className="min-w-0"><PageEyebrow>Investigation / {formatDate(item.createdAt)}</PageEyebrow><DeskHeadline className={imageGeolocation?'mt-1 text-2xl md:text-3xl break-words':'mt-3 max-w-4xl text-5xl md:text-6xl'} testId="text-detail-title">{displayTitle(item.title)}</DeskHeadline>{!imageGeolocation&&<p className="mt-3 text-sm text-[#738078]">{item.originalName}{item.shotAt ? ` · photographed ${formatDate(item.shotAt)}` : ''}</p>}{imageGeolocation&&item.shotAt&&<p className="mt-1 text-[13px] text-[#738078]">Photographed {formatDate(item.shotAt)}</p>}</div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditing(!editing)} data-testid="button-edit-investigation" className="whitespace-nowrap rounded-full border border-[#c9c7b7] px-4 py-2.5 text-[13px] font-semibold text-[#53695d] hover:bg-[#ebe9de]">{editing ? 'Cancel editing' : 'Edit notes'}</button><button type="button" onClick={deleteCurrent} disabled={remove.isPending} data-testid="button-delete-current-investigation" className="inline-flex whitespace-nowrap items-center gap-2 rounded-full border border-[#ddc4b5] px-4 py-2.5 text-[13px] font-semibold text-[#9d5846] hover:bg-[#f7eae4]"><Trash2 size={14} />Remove</button></div>
    </div>
    {message && <p role="status" data-testid="status-investigation-update" className="mb-5 rounded-xl border border-[#c8d4c4] bg-[#edf2e9] px-4 py-3 text-sm text-[#476450]">{message}</p>}
    {editing && <form onSubmit={saveDetails} className="mb-7 grid gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 md:grid-cols-[.8fr_1.2fr_auto] md:items-end">
      <label className="block text-[13px] font-semibold text-[#465c50]">Investigation name<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} data-testid="input-edit-title" className="mt-2 h-11 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-3 text-sm outline-none focus:border-[#668675]" /></label>
      <label className="block text-[13px] font-semibold text-[#465c50]">Background notes<textarea value={context} maxLength={3000} onChange={(event) => setContext(event.target.value)} rows={2} data-testid="input-edit-context" className="mt-2 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-3 py-2 text-sm outline-none focus:border-[#668675]" /></label>
      <button type="submit" disabled={update.isPending} data-testid="button-save-investigation" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-[13px] font-semibold text-[#f4f0e6] disabled:opacity-60">{update.isPending ? 'Saving…' : <><Check size={14} />Save changes</>}</button>
    </form>}
    {imageGeolocation?<ImageGeolocationReport item={item} leads={rankedLeads} sceneSummary={sceneSummary} photoURL={photoUrl} photoLoading={photo.isLoading} photoError={photo.isError} onRetryPhoto={()=>{void photo.refetch();}} selectedIndex={selectedCandidateIndex} onSelect={setSelectedCandidateIndex} onRefresh={()=>{void refreshLocations();}} refreshing={refreshCandidates.isPending} refreshMessage={refreshMessage} onRetryAnalysis={()=>{void retryVideo();}} retrying={retryAnalysis.isPending} retryError={retryError}/>:<>
    <HealthUrgencyCard investigation={item} />
    {isVideo && <><EmbeddedGpsNotice analysis={item.analysis} /><VideoAnalysisStatus item={item} retrying={retryAnalysis.isPending} retryError={retryError} onRetry={() => void retryVideo()} /></>}
    {item.desk !== 'fake-news' && !legacySourceReport && rankedLeads[0] && <div className="lg:hidden"><BestGuessCard lead={rankedLeads[0]} summaryText={buildLeadSummary(item, rankedLeads)} /></div>}
    <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_.95fr]">
      <div>
        <div className="photo-frame relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-[#d8d1c2] bg-[#e5e3d6] p-4 md:min-h-[490px]">
          {isVideo ? <VideoPlayer id={item.id} name={item.originalName} playerRef={playerRef} /> : photo.isLoading ? <SkeletonBlock className="absolute inset-4" /> : photo.isError ? <div className="px-6 text-center text-sm text-[#7c8378]" data-testid="status-photo-error"><FileImage size={26} className="mx-auto mb-3 text-[#a06d4b]" />The saved photograph is temporarily unavailable.</div> : <img src={photoUrl || `/api/investigations/${encodeURIComponent(item.id)}/photo`} alt={`Original photograph: ${item.originalName}`} className="max-h-[620px] w-full rounded-2xl object-contain" data-testid="img-original-investigation-photo" />}
          <span className="absolute bottom-7 left-7 rounded-full border border-white/50 bg-[#f4f0e6]/90 px-3 py-1.5 font-data text-[13px] uppercase tracking-[.13em] text-[#52695d]">{isVideo ? 'Saved video' : 'Original photograph'}</span>
        </div>
        {isVideo && <KeyMoments analysis={item.analysis} onSeek={seekTo} />}
        <section className="mt-7 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6 md:p-7">
          <PageEyebrow>{item.desk === 'fake-news' ? 'Image integrity review' : legacySourceReport ? 'Legacy source-image report' : 'Scene notes'}</PageEyebrow>
          {item.desk !== 'fake-news' && !legacySourceReport && rankedLeads[0] && <p className="mt-4 text-sm font-semibold text-[#385e51]">Strongest location lead: {rankedLeads[0].place}</p>}
          <p className={`mt-2 ${item.desk === 'fake-news' ? 'whitespace-pre-wrap text-sm leading-7' : 'font-editorial text-2xl leading-[1.25]'} text-[#344b42]`} data-testid="text-investigation-summary">{sceneSummary}</p>
          <div className="mt-6 border-t border-[#e1dbce] pt-4"><p className="font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">Your notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#718078]" data-testid="text-investigation-context">{item.context?.trim() || 'No notes added yet.'}</p></div>
        </section>
        <details className="mt-7 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
          <summary className="cursor-pointer list-none"><PageEyebrow>Visual evidence</PageEyebrow><h2 className="mt-2 font-editorial text-3xl">Details in the frame</h2><span className="mt-2 block font-data text-[13px] uppercase tracking-[.13em] text-[#929b90]">{item.clues.length} clues · expand</span></summary>
          {item.clues.length ? <div className="mt-5 space-y-3">{item.clues.map((clue, index) => <article key={`${clue.label}-${index}`} data-testid={`card-clue-${index}`} className="relative rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 pl-[68px]"><span className="absolute left-5 top-5 font-data text-[13px] text-[#c8794d]">0{index + 1}</span><h3 className="font-editorial text-xl">{humanizeClueText(clue.label)}</h3><p className="mt-2 text-sm leading-6 text-[#66796e]">{humanizeClueText(clue.observation)}</p><p className="mt-3 border-t border-[#e4dfd2] pt-3 text-[13px] leading-5 text-[#89948a]">{humanizeClueText(clue.significance)}</p></article>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[#c9c3b4] p-6 text-sm text-[#718078]" data-testid="content-no-clues">No visual clues were returned for this investigation.</div>}
        </details>
      </div>
      <div>
        {legacySourceReport ? <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
          <PageEyebrow>Legacy source-image report</PageEyebrow>
          <p className="mt-3 text-[13px] leading-5 text-[#859187]">This report was created before Recreation was corrected to personal-photo location discovery. Its saved matches are not location findings.</p>
          <p className="mt-2 text-[13px] leading-5 text-[#859187]">Re-analyzing will replace these older source matches only if new location leads are returned.</p>
          <button type="button" disabled={refreshCandidates.isPending} onClick={refreshLocations} data-testid="button-analyze-legacy-recreation" className="mt-4 rounded-full border border-[#c9c7b7] px-4 py-2 text-[13px] font-semibold text-[#53695d] disabled:opacity-50">{refreshCandidates.isPending ? 'Analyzing location…' : 'Find this photo’s location'}</button>
          {refreshMessage && <p role="status" className="mt-3 text-[13px] leading-5 text-[#718078]">{refreshMessage}</p>}
          <h2 className="mt-2 font-editorial text-3xl">Possible original images</h2>
          <p className="mt-3 text-[13px] leading-5 text-[#859187]">The image analyst searched public image pages for possible source matches. These are leads, not confirmed originals.</p>
          {rankedLeads.length ? <div className="mt-4 space-y-3">{rankedLeads.map((candidate, index) => {
            const reference = candidate.photoReferences?.[0];
            return <article key={`${candidate.mapsUrl}-${index}`} className="overflow-hidden rounded-xl border border-[#d8d1c2] bg-[#fbf9f3]">
              {reference && <img src={reference.thumbnailUrl ?? reference.imageUrl} alt={candidate.place} loading="lazy" referrerPolicy="no-referrer" className="max-h-56 w-full object-contain" />}
              <div className="p-4"><p className="font-editorial text-lg">{candidate.place}</p>{candidate.rationale && <p className="mt-2 text-[13px] leading-5 text-[#718078]">{candidate.rationale}</p>}<a href={candidate.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#385e51]">Open source page <ArrowUpRight size={13} /></a></div>
            </article>;
          })}</div> : <p className="mt-4 rounded-xl border border-dashed border-[#c9c3b4] p-5 text-sm leading-6 text-[#718078]" data-testid="content-no-source-images">No plausible original source image was found in the public search. Private, removed, or unindexed images may not appear.</p>}
        </section> : item.desk === 'fake-news' ? <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
          <PageEyebrow>What this review can tell you</PageEyebrow>
          <h2 className="mt-2 font-editorial text-3xl">Visual assessment, not proof</h2>
          <p className="mt-3 text-sm leading-6 text-[#596d61]">The model assesses visible signs of editing, CGI, or AI generation. It cannot authenticate a photograph from pixels alone; check the original file, provenance, and independent sources.</p>
        </section> : <>
        {rankedLeads[0] && <div className="hidden lg:block"><BestGuessCard lead={rankedLeads[0]} summaryText={buildLeadSummary(item, rankedLeads)} /></div>}
        <div className="mb-4 flex items-end justify-between gap-3"><div><PageEyebrow>Possible whereabouts</PageEyebrow><h2 className="mt-2 font-editorial text-3xl">Follow the leads</h2></div><button type="button" disabled={refreshCandidates.isPending} onClick={refreshLocations} data-testid="button-refresh-location-leads" className="shrink-0 rounded-full border border-[#c9c7b7] px-3 py-2 text-[13px] font-semibold text-[#53695d] disabled:opacity-50">{refreshCandidates.isPending ? 'Searching…' : 'Try different leads'}</button></div>
        {refreshMessage && <p role="status" className="mb-3 text-[13px] leading-5 text-[#718078]" data-testid="status-refresh-leads">{refreshMessage}</p>}
        <p className="mb-4 text-[13px] leading-5 text-[#859187]">The separate search for public reference photos uses location names only; it never receives the original photo or your notes.</p>
        {rankedLeads.length ? <>
          <p className="mb-4 rounded-xl border border-[#d8d1c2] bg-[#f8f5ec] px-4 py-3 text-[13px] leading-5 text-[#718078]">Confidence = how well the clues in the photo match this place. It ranks the suggestions; it is not a probability that a place is correct or an independent verification.</p>
          <LeadLocationMap candidates={rankedLeads.slice(0, 3)} selectedIndex={selectedCandidateIndex} onSelect={setSelectedCandidateIndex} onOpenLead={(index) => setLocation(`/investigation/${encodeURIComponent(item.id)}/location/${index}`)} />
          <div className="mt-4 space-y-2" data-testid="list-ranked-location-leads">
            {rankedLeads.map((candidate, index) => <button key={`${candidate.place}-${index}`} type="button" aria-pressed={selectedCandidateIndex === index} onClick={() => setSelectedCandidateIndex(index)} data-testid={`button-select-lead-${index}`} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selectedCandidateIndex === index ? 'border-[#9eaf9f] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#f8f5ec] hover:border-[#b8c4b5]'}`}>
              <span className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-[#fbf9f3]" style={{ background: confidenceTier(confidencePercent(candidate.confidence)).color }}>{index + 1}</span><span className="min-w-0"><span className="block truncate font-editorial text-lg text-[#263d36]">{candidate.place}</span><span className="block truncate text-[13px] text-[#718078]">{[candidate.region, candidate.country].filter(Boolean).join(', ') || 'Region not specified'}</span></span></span>
              <span className="w-[150px] shrink-0"><ConfidenceMeter percent={confidencePercent(candidate.confidence)} size="sm" testId={`text-lead-confidence-${index}`} /></span>
            </button>)}
          </div>
          {selectedLead && <article className="mt-4 rounded-2xl border border-[#b8c4b5] bg-[#e9ede3] p-5" data-testid="panel-selected-location-lead">
            <PageEyebrow>{selectedCandidateIndex === 0 ? 'Highest Confidence' : 'Selected location lead'}</PageEyebrow>
            <h3 className="mt-2 font-editorial text-2xl text-[#263d36]">{selectedLead.place}</h3>
            <p className="mt-1 text-[13px] text-[#718078]">{[selectedLead.region, selectedLead.country].filter(Boolean).join(', ') || 'Region not specified'}</p>
            <div className="mt-4 border-t border-[#c9d0c2] pt-4"><p className="font-data text-[13px] uppercase tracking-[.13em] text-[#758477]">Why it was suggested</p><p className="mt-2 text-sm leading-6 text-[#596d61]">{selectedLead.rationale}</p></div>
             {selectedLead.clues.length > 0 && <div className="mt-4"><p className="font-data text-[13px] uppercase tracking-[.13em] text-[#758477]">Related scene clues</p><div className="mt-2 flex flex-wrap gap-2">{selectedLead.clues.map((clue, clueIndex) => <span key={`${clue}-${clueIndex}`} className="rounded-full border border-[#c7d0c1] bg-[#f8f5ec] px-3 py-1.5 text-[13px] text-[#627569]">{humanizeClueText(clue)}</span>)}</div></div>}
            {(selectedLead.photoReferences ?? []).length > 0 ? <details className="mt-5 border-t border-[#c9d0c2] pt-4" data-testid={`section-photo-references-${selectedCandidateIndex}`}>
              <summary className="cursor-pointer font-data text-[13px] uppercase tracking-[.13em] text-[#758477]">Public photo references ({selectedLead.photoReferences!.length})</summary>
              <div className="mt-3 grid grid-cols-3 gap-2">{(selectedLead.photoReferences ?? []).map((reference, referenceIndex) => <a key={`${reference.imageUrl}-${referenceIndex}`} href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-photo-reference-${selectedCandidateIndex}-${referenceIndex}`} className="group min-w-0 overflow-hidden rounded-xl border border-[#d8d1c2] bg-[#f8f5ec] transition hover:-translate-y-0.5 hover:shadow-sm">
                <div className="aspect-[4/3] overflow-hidden bg-[#e5e3d6]"><img src={reference.thumbnailUrl ?? reference.imageUrl} alt={reference.caption ?? `Public photo reference for ${selectedLead.place}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" /></div>
                <span className="block line-clamp-2 px-2 pt-2 text-[13px] leading-4 text-[#596d61]">{reference.caption ?? `Photos of ${selectedLead.place}`}</span>
                <span className="block truncate px-2 pb-2 pt-1 text-[13px] text-[#929b90]">{photoReferenceHost(reference.sourceUrl)} <ArrowUpRight size={10} className="ml-0.5 inline" /></span>
              </a>)}</div>
            </details> : <p className="mt-4 text-[13px] leading-5 text-[#859187]" data-testid={`status-photo-search-${selectedCandidateIndex}`}>{item.analysis?.source === 'Replit AI vision fallback' ? 'Public photo references were not searched for these unverified fallback guesses.' : selectedLead.photoSearchStatus === 'unavailable' ? 'Web photo search is temporarily unavailable for this lead.' : selectedLead.photoSearchStatus === 'no_results' ? 'No public photo references were found for this place.' : 'Photo references were not collected for this investigation.'}</p>}
            <a href={selectedLead.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-map-candidate-${selectedCandidateIndex}`} className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#385e51] hover:text-[#b36e48]">Explore this location <ArrowUpRight size={14} /></a>
            <Link href={`/investigation/${encodeURIComponent(item.id)}/location/${selectedCandidateIndex}`} data-testid={`link-location-report-${selectedCandidateIndex}`} className="mt-3 block text-[13px] font-semibold text-[#385e51] underline underline-offset-4">Open full in-app location report</Link>
          </article>}
        </> : <div className="rounded-2xl border border-dashed border-[#c9c3b4] p-6 text-sm text-[#718078]" data-testid="content-no-candidates">No likely places were returned. Keep the image in your library and revisit as new clues surface.</div>}
        <div className="mt-5 rounded-2xl bg-[#263d36] p-5 text-[#f4f0e6]"><div className="flex items-center gap-2 text-[#d78b5a]"><Globe2 size={16} /><p className="font-data text-[13px] uppercase tracking-[.16em]">Read the map, not the answer</p></div><p className="mt-3 text-[13px] leading-5 text-[#c1cdbf]">These are leads to explore, not certainties. Compare the landmarks with what you remember.</p></div>
        </>}
      </div>
    </div>
    </>}
  </div>;
}

function LeadLocationPage() {
  const [, params] = useRoute('/investigation/:id/location/:index');
  const id = params?.id ?? '';
  const query = useGetInvestigation(id, { query: { enabled: Boolean(id), queryKey: getGetInvestigationQueryKey(id) } });
  if (query.isLoading) return <SkeletonBlock className="h-96" />;
  if (query.isError || !query.data) return <QueryError retry={() => query.refetch()} text="This location report could not be opened." />;
  const leads = rankCandidates(query.data.candidates);
  const index = Number(params?.index);
  const lead = Number.isInteger(index) ? leads[index] : undefined;
  if (!lead) return <QueryError retry={() => query.refetch()} text="This location lead is no longer available." />;
  const coordinates = coordinatesFromMapsUrl(lead.mapsUrl);
  const legacySourceReport = isLegacyRecreationReport(query.data);
  return <article className="fade-up mx-auto max-w-3xl">
    <Link href={`/investigation/${encodeURIComponent(id)}`} className="mb-7 inline-flex items-center gap-2 text-[13px] font-semibold text-[#718078]"><ArrowLeft size={14} />Back to investigation</Link>
    <PageEyebrow>{legacySourceReport ? `Legacy source-image report / Result ${index + 1}` : `Location report / Lead ${index + 1}`}</PageEyebrow>
    <DeskHeadline className="mt-3 text-5xl">{lead.place}</DeskHeadline>
    {!legacySourceReport && <p className="mt-2 text-sm text-[#718078]">{[lead.region, lead.country].filter(Boolean).join(', ') || 'Region not specified'}</p>}
    <HealthUrgencyCard investigation={query.data} />
    <section className="mt-7 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6">
      <p className="font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">{legacySourceReport ? 'Why this source image was surfaced' : 'Why this location was suggested'}</p>
      <p className="mt-3 text-sm leading-7 text-[#596d61]">{lead.rationale}</p>
      {!legacySourceReport && <><p className="mt-5 font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">Confidence</p>
      <p className="mt-1 text-lg font-semibold text-[#385e51]">{candidateScore(lead.confidence)} / 100 · ranked lead {index + 1}</p>
      {coordinates && <p className="mt-5 text-sm text-[#596d61]"><strong>Coordinates</strong><br />Latitude {coordinates[0].toFixed(5)} · Longitude {coordinates[1].toFixed(5)}</p>}</>}
    </section>
    {legacySourceReport ? <section className="mt-5 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6">
      <p className="font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">Possible source match</p>
      <p className="mt-3 text-sm leading-7 text-[#596d61]">This older report contains source-image matches, not location findings. Return to the report to analyze the photo’s location with the corrected Recreation workflow.</p>
      {lead.photoReferences?.[0] && <a href={lead.photoReferences[0].sourceUrl} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-[#d8d1c2]">
        <img src={lead.photoReferences[0].thumbnailUrl ?? lead.photoReferences[0].imageUrl} alt={lead.photoReferences[0].caption ?? lead.place} referrerPolicy="no-referrer" className="max-h-[480px] w-full object-contain" />
        <span className="block p-3 text-[13px] text-[#385e51]">Open image source: {photoReferenceHost(lead.photoReferences[0].sourceUrl)} <ArrowUpRight size={13} className="inline" /></span>
      </a>}
    </section> : <section className="mt-5 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6">
      <p className="font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">How the photograph informed this lead</p>
      <p className="mt-3 text-sm leading-7 text-[#596d61]">The suggestion combines the analyzer’s location rationale with the visible scene details below. These details explain what can be compared in the image; they are clues, not confirmation that this is the photographed place.</p>
      {query.data.clues.length > 0
        ? <div className="mt-5 space-y-4">{query.data.clues.map((clue, clueIndex) => {
          const linkedLeadClues = lead.clues.filter((candidateClue) => visualCluesOverlap(clue, candidateClue));
          return <article key={`${clue.label}-${clueIndex}`} className="rounded-xl border border-[#e1dbce] bg-[#fbf9f3] p-4">
            <p className="font-editorial text-xl text-[#344b42]">{humanizeClueText(clue.label)}</p>
            <p className="mt-2 text-sm leading-6 text-[#596d61]"><strong>Seen in the frame:</strong> {humanizeClueText(clue.observation)}</p>
            <p className="mt-2 text-sm leading-6 text-[#718078]"><strong>Why it may help:</strong> {humanizeClueText(clue.significance)}</p>
            <p className="mt-3 border-t border-[#e4dfd2] pt-3 text-[13px] leading-5 text-[#718078]">{linkedLeadClues.length
              ? <>The analyzer also named <strong>{linkedLeadClues.map(humanizeClueText).join('; ')}</strong> for {lead.place}, connecting this visual detail to the suggested location.</>
              : <>The analyzer did not explicitly link this scene detail to {lead.place}; treat it as comparison context, not direct support for this lead.</>}</p>
          </article>;
        })}</div>
        : <p className="mt-4 rounded-xl border border-dashed border-[#c9c3b4] p-4 text-sm leading-6 text-[#718078]">No structured visual details were saved for this photograph, so the report cannot connect specific features in the frame to this lead.</p>}
      {lead.clues.length > 0 && <div className="mt-5 border-t border-[#e1dbce] pt-4"><p className="font-data text-[13px] uppercase tracking-[.15em] text-[#9c6d4e]">Location-specific clues named by the analyzer</p><ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-[#596d61]">{lead.clues.map((clue) => <li key={clue}>{humanizeClueText(clue)}</li>)}</ul></div>}
    </section>}
    {!legacySourceReport && lead.photoReferences?.length ? <details className="mt-5 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5"><summary className="cursor-pointer text-sm font-semibold">Public reference photos ({lead.photoReferences.length})</summary><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{lead.photoReferences.map((reference, i) => <a key={`${reference.sourceUrl}-${i}`} href={reference.sourceUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#d8d1c2]"><img src={reference.thumbnailUrl ?? reference.imageUrl} alt={reference.caption ?? `Reference for ${lead.place}`} className="aspect-[4/3] w-full object-cover" /><span className="block p-2 text-[13px]">{reference.caption ?? 'View source'}</span></a>)}</div></details> : null}
  </article>;
}

/** Hides the desk name the upload code puts in front of every title ("Investigations — My trip" → "My trip"). */
function displayTitle(title: string) {
  return title.replace(/^(Investigations|Recreation|Investigative journalism) — /, '') || title;
}

function humanizeClueText(value: string) {
  const readable = value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
  return readable ? readable[0].toLocaleUpperCase() + readable.slice(1) : readable;
}

function visualCluesOverlap(clue: { label: string; observation: string; significance: string }, candidateClue: string) {
  const normalize = (value: string) => value.toLocaleLowerCase().replaceAll('_', ' ').replace(/[^a-z0-9\s]/g, ' ');
  const candidate = normalize(candidateClue).trim();
  if (!candidate) return false;
  const text = normalize(`${clue.label} ${clue.observation} ${clue.significance}`);
  return text.includes(candidate) || candidate.split(/\s+/).filter((word) => word.length > 3 && text.includes(word)).length >= Math.max(1, Math.ceil(candidate.split(/\s+/).filter((word) => word.length > 3).length * 0.6));
}

function SettingsPage() {
  const { preferences, setPreferences } = usePreferences();
  const { apiKey, setApiKey } = useApiKey();
  const [draftKey, setDraftKey] = useState(apiKey);
  const [keyStatus, setKeyStatus] = useState('');
  const[sound,setSound]=useState(soundEnabled);
  const update = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) =>
    setPreferences({ ...preferences, [key]: value });
  return <div className="wa-settings fade-up mx-auto max-w-3xl">
    <PageEyebrow>PREFERENCES</PageEyebrow>
    <DeskHeadline className="mt-3 text-5xl">Settings</DeskHeadline>
    <p className="mt-3 text-sm text-[#718078]">Make the desk your own.<HelpNote>Adjust how Whereabouts looks and reads on this device.</HelpNote></p>
    <section className="fd-preference-section mt-8">
      <h2 className="font-editorial text-2xl">Color theme</h2>
      <SwatchBook themes={[
        {id:'rescue',label:'Instrument',colors:['#f4f4f2','#242723','#b6382e']},
        {id:'field',label:'Field notebook',colors:['#e4eadc','#27352d','#a23e34']},
        {id:'ocean',label:'Coastal graphite',colors:['#e0e8ee','#293039','#9f3e39']},
        {id:'sunset',label:'Warm graphite',colors:['#efe2d7','#352c28','#aa3b30']},
        {id:'mono',label:'Monochrome',colors:['#e6e6e6','#171917','#a1322b']},
      ]} selected={preferences.theme} onSelect={id=>update('theme',id as AppPreferences['theme'])}/>
      <div className="fd-lever mt-6"><span className="physical-switch-state" data-testid="status-high-contrast">High contrast · {preferences.highContrast?'ON':'OFF'}</span><PhysicalSwitch kind="lever" value={preferences.highContrast} onChange={value=>update('highContrast',value)} label="High contrast" testId="toggle-high-contrast"/></div>
    </section>
    <section className="fd-preference-section mt-5">
      <h2 className="font-editorial text-2xl">Text font</h2>
      <div className="fd-type-options" role="group" aria-label="Text font">{([['default','Bricolage + DM Sans','"Bricolage Grotesque",sans-serif'],['sans','DM Sans','"DM Sans",sans-serif'],['dyslexic','Atkinson Hyperlegible','"Atkinson Hyperlegible",sans-serif']] as const).map(([value,label,font])=><button type="button" key={value} className="fd-type-card" style={{'--specimen':font} as React.CSSProperties} aria-pressed={preferences.font===value} data-testid={`font-${value}`} onClick={()=>update('font',value)}><strong>Aa</strong><span>{label}</span></button>)}</div>
      <FontSizeSlider value={preferences.textSize} onChange={value=>update('textSize',value)}/>
      <p className="mt-3 text-[13px] leading-5 text-[#718078]">Saved on this device.<HelpNote>Your choices are saved in this browser and apply across the app.</HelpNote></p>
    </section>
    <section className="fd-preference-section mt-5"><h2 className="font-editorial text-2xl">Sound &amp; haptics</h2><div className="fd-lever"><span className="physical-switch-state" data-testid="status-desk-sound">Sound · {sound?'ON':'OFF'}</span><PhysicalSwitch kind="rocker" value={sound} label="Sound" testId="toggle-desk-sound" onChange={value=>{setSound(value);setSoundEnabled(value);if(value)deskSound('switch');}}/></div><p className="text-[13px]">Quiet mechanical feedback, off by default.<HelpNote>Enables short local clicks and a 10 ms vibration where supported. The Sound switch never requests microphone access.</HelpNote></p></section>
    <section className="fd-preference-section mt-5">
      <h2 className="font-editorial text-xl">Your analysis API key</h2>
      <p className="mt-1 text-[13px] text-[#718078]">Optional · session memory only.<HelpNote>Your key is kept in memory for this session only, never saved in browser storage.</HelpNote></p>
      <div className="mt-3 flex gap-2">
        <input type="password" autoComplete="off" value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="Paste your API key" aria-label="Your analysis API key" data-testid="input-personal-api-key" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d8d1c2] bg-[#fbf9f3] px-3 text-sm" />
        <button type="button" onClick={() => { setApiKey(draftKey.trim()); setKeyStatus(draftKey.trim() ? 'Key set for this session.' : 'Session key cleared.'); }} data-testid="button-save-personal-api-key" className="rounded-lg bg-[#385e51] px-3 text-[13px] font-semibold text-white">Use key</button>
      </div>
      {keyStatus && <p role="status" className="mt-2 text-[13px] text-[#476450]">{keyStatus}</p>}
    </section>
  </div>;
}

function formatDate(value: string) {
  // "2007-06-03" (a date with no time) must stay on that day in every time zone.
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
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
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    try { return readPreferences(localStorage); } catch { return {...defaultPreferences}; }
  });
  useTextSize(preferences.textSize);
  const [apiKey, setApiKey] = useState('');
  useEffect(() => {
    try{writePreferences(localStorage,preferences);}catch{/* Storage can be unavailable; session preferences still apply. */}
    const root=document.documentElement;root.dataset.appTheme=preferences.theme;root.dataset.highContrast=String(preferences.highContrast);root.dataset.appFont=preferences.font;
    return()=>{delete root.dataset.appTheme;delete root.dataset.highContrast;delete root.dataset.appFont;};
  }, [preferences]);
  return <ApiKeyContext.Provider value={{ apiKey, setApiKey }}><PreferencesContext.Provider value={{ preferences, setPreferences }}>
    <div data-app-theme={preferences.theme} data-high-contrast={preferences.highContrast} data-app-font={preferences.font}>
      <SiteCursor />
      <QueryClientProvider client={queryClient}>
        <FieldDeskFilingNotice/>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <PhysicalWorkspace><ReportOperationProvider><GuideDraftProvider><RoutedErrorBoundary><ClerkProviderWithRoutes /></RoutedErrorBoundary></GuideDraftProvider></ReportOperationProvider></PhysicalWorkspace>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  </PreferencesContext.Provider></ApiKeyContext.Provider>;
}

export default App;