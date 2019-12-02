import { Page } from 'puppeteer-core';
import { Metric, PerformanceMetricsResult } from '../models/performance';

export const getTimeFromPerformanceMetrics = (metrics: Metric[], name: string): number => {
  const metric = metrics.find(x => x.name === name);
  return metric ? metric.value === 0 ? 0 : metric.value * 1000 : 0;
};

export const extractDataFromPerformanceMetrics = (metrics: Metric[], ...dataNames: string[]): PerformanceMetricsResult => {
  const navigationStart = getTimeFromPerformanceMetrics(metrics, 'NavigationStart');

  const extractedData: PerformanceMetricsResult = {};
  dataNames.forEach(name => {
    const metric = getTimeFromPerformanceMetrics(metrics, name);
    extractedData[name] = metric === 0 ? metric : metric - navigationStart;
  });

  return extractedData;
};

export const initializeCDPClient = async (page: Page) => {
  // Get CDP session.
  const client = await page.target().createCDPSession();
  await client.send('Performance.enable');

  return client;
};
