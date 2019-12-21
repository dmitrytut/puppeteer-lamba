import chromium from "chrome-aws-lambda";
import { getStatusText } from 'http-status-codes';
import middy from "middy";
import {
  cors, doNotWaitForEmptyEventLoop, httpErrorHandler, httpHeaderNormalizer, jsonBodyParser,
} from "middy/middlewares";
import puppeteer, { DirectNavigationOptions, ScreenshotOptions, Response as PuppeteerResponse } from "puppeteer-core";

import { initializeCDPClient } from '../helpers/performance';
import {
  ESourceType, QueryParams, RequestBody, ResponsePayload, S3Settings, Metric, PerformanceMetricsResult, Proxy,
} from '../models';
import { initializeS3, uploadResults } from '../helpers/s3';
import { checkRequestData } from '../helpers/request';
import { log } from '../helpers/logger';
import { createErrorResponse } from '../helpers/response';

const handler = async (event: any) => {
  const { type = ESourceType.URL, store, proxy } = event.queryStringParameters as QueryParams;
  const { src, storage = {}, proxy: proxySettings = {}, options = {} } = event.body as RequestBody;
  const { s3: s3Settings = ({} as S3Settings) } = storage;
  const { url, port, login, password } = proxySettings as Proxy;
  const {
    checkSpeed = true,
    trackCalls = true,
    fullPage = true,
    viewPortHeight,
    viewPortWidth,
    userAgent,
  } = options;
  // We can't use networkidle0, because in this case we can't crawl sites with websockets.
  const puppeteerOptions: DirectNavigationOptions = { waitUntil: ["networkidle0", "load", "domcontentloaded"] };
  const isOffline = process.env.IS_OFFLINE;
  let results: ResponsePayload = {} as ResponsePayload;
  let externalRequests: string[] = [];

  log('Executed with event: ', event);

  // Check request parameters and data.
  checkRequestData(type, store, { s3: s3Settings }, { viewPortWidth, viewPortHeight });

  log('Request params successfully checked.');

  // Get Chromium path.
  const executablePath = isOffline
    ? "./node_modules/puppeteer/.local-chromium/mac-706915/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
    : await chromium.executablePath;

  log('Chromium executable path: ', executablePath);

  let args = chromium.args;
  if (proxy) {
    log(`Use proxy '${url}:${port}'`);
    if (login && password) {
      log(`Credentials for proxy is set up. Login: ${login}`);
    }

    args = [
      ...args,
      `--proxy-server=${url}:${port}`,
    ];
  }

  const browser = await puppeteer.launch({
    args,
    executablePath
  });

  const page = await browser.newPage();

  if (proxy && login && password) {
    log('Try to authenticate at proxy server.');

    await page.authenticate({
      username: login,
      password,
    });
  }

  // Initialize CDP client to get extended information about performance metrics.
  const client = await initializeCDPClient(page);

  // Set user-agent.
  if (userAgent) {
    await page.setUserAgent(userAgent);
  }

  // Collect external requests.
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    externalRequests.push(url);
    request.continue();
  });
  page.on("response", response => {
    const request = response.request();
    const url = request.url();
    const status = response.status();
    const message = response.statusText();
    if (src === ESourceType.URL && url === src) {
      log("Response url:", url, "Status:", status, "Message:", message);
      // TODO: Put loading status processing here.
    }
  });
  page.on("error", err => {
    console.error("error", err);
  });

  // Set viewport.
  if (viewPortWidth && viewPortHeight) {
    await page.setViewport({
      width: viewPortWidth,
      height: viewPortHeight,
    });
  }

  // Initiate page execution.
  if (type === ESourceType.URL) {
    log('Try to open URL: ', src);
    try {
      const response: PuppeteerResponse = await page.goto(src, puppeteerOptions) as PuppeteerResponse;
      const statusCode = response.status();
      if (statusCode > 400) {
        return createErrorResponse(getStatusText(statusCode), statusCode, results);
      }
    } catch (error) {
      // If we have an exception, there was a fatal error and request even couldn't reach or process by web-server,
      // so at this level we don't have any http status code, only message.
      return createErrorResponse(error.message, undefined, results);
    }
  } else if (type === ESourceType.HTML) {
    log('Try to open render passed html.');
    await page.setContent(src, puppeteerOptions);
  }

  // Wait for browser to finish executing JS.
  await page.waitFor(1000);

  // Get performance metrics.
  if (checkSpeed) {
    log('Try to get performance metrics.');

    const { metrics } = await client.send('Performance.getMetrics') as { metrics: Metric[] };

    results = {
      ...results,
      performanceMetrics: metrics.reduce((acc: PerformanceMetricsResult, curr: Metric) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {}),
    };
  }

  // Get external requests.
  if (trackCalls) {
    log('Try to get track calls.');

    results = {
      ...results,
      externalRequests
    };
  }

  // Get html.
  const html = await page.content();

  // Generate screenshot.
  let screenshotOptions: ScreenshotOptions = {
    fullPage,
    encoding: 'binary',
  };
  if (!store) {
    screenshotOptions = {
      ...screenshotOptions,
      encoding: 'base64',
    }
  }

  log(`Try to get page screenshot and store it as '${screenshotOptions.encoding}'`);

  const screenshot = await page.screenshot(screenshotOptions);

  results = {
    ...results,
    html,
    screenshot,
  };

  if (store) {
    log('Try to upload files to the S3.');

    // Initialize S3.
    const s3 = initializeS3();

    // Upload files to the S3.
    await uploadResults(s3, s3Settings, results);
  }

  // Close browser, we don't need it anymore.
  await browser.close();

  return store
    ? {
      statusCode: 201,
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify({
        performanceMetrics: results.performanceMetrics,
        externalRequests: results.externalRequests,
        html: results.html,
      }),
    }
    : {
      statusCode: 200,
      headers: {
        "Content-type": "application/json"
      },
      body: JSON.stringify(results),
    };
};

export const crawl = middy(handler)
  .use(httpHeaderNormalizer())
  .use(jsonBodyParser())
  .use(cors())
  .use(doNotWaitForEmptyEventLoop())
  .use(httpErrorHandler());