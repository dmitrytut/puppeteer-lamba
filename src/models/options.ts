/**
 * Interface defining crawl options.
 */
export interface Options {
  /** Check page loading speed. */
  checkSpeed?: boolean;

  /** Determine list of external calls. */
  trackCalls?: boolean;

  /** Viewport height to render page with. */
  viewPortHeight?: number;

  /** Viewport width to render page with. */
  viewPortWidth?: number;

  /** Make a full page screenshot. */
  fullPage?: boolean;

  /** Password to connect to the proxy. */
  userAgent?: string;
}
