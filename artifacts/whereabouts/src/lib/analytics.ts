type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void | Promise<unknown>;
    };
  }
}

/**
 * Replit injects this tracker at publishing time when analytics is enabled;
 * do not install a second script or configure an app-owned collector.
 * https://docs.replit.com/features/publishing/project-analytics
 * Missing scripts and failed requests never block the UI.
 */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    void Promise.resolve(window.umami?.track(name, data)).catch(() => {
      // Analytics must never break the app, including asynchronous failures.
    });
  } catch {
    // Analytics must never break the app.
  }
}
