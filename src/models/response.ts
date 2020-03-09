import { PerformanceMetricsResult } from '../models/performance';
import { QueryParams } from '../models/request';
import { ErrorObject } from '../models/error';

/**
 * Interface defining response payload if {@link QueryParams.storeData} set.
 */
export interface ResponsePayload {
  /** Fully rendered html. */
  html: string;

  /** Png screenshot of the page encoded in base64. */
  screenshot: string | Buffer;

  /** List of external resources requests. */
  externalRequests?: string[];

  /** Performance metrics. */
  performanceMetrics?: PerformanceMetricsResult;

  /** Error. */
  error?: ErrorObject;

  /** Redirect urls chain. */
  redirectChain: string[];

  /** Response code. */
  responseCode?: number;

  /** Final url. */
  finalUrl?: string;

  [key:string]: any;
}
