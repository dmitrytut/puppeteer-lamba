import { ResponsePayload } from '../models';

/** Result to extension mapping. */
export const resultsExtensions: { [key in keyof ResponsePayload]: string } = {
  html: '.html',
  screenshot: '.png',
  externalRequests: '-calls.json',
  performanceMetrics: '-performance.json',
};

