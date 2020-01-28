/**
 * Interface defining crawl options.
 */
export interface Options {
  /** Check page loading speed. */
  checkSpeed?: boolean;

  /** Determine list of external calls. */
  trackCalls?: boolean;

  /** Skip taking screenshot. */
  skipScreenshot?: boolean;

  /** Load only html and js skipping loading another resources. */
  justHtml?: boolean;

  /** Viewport height to render page with. */
  viewPortHeight?: number;

  /** Viewport width to render page with. */
  viewPortWidth?: number;

  /** Make a full page screenshot. */
  fullPage?: boolean;

  /** UserAgent to set to the request. */
  userAgent?: string;
}
