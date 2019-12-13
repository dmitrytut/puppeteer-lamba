import { PerformanceMetricsResult } from '../models/performance';
import { QueryParams } from '../models/request';

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

  /** Redirect urls chain .*/
  redirectChain: string[];

  [key:string]: any;
}
