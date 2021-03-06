import chromium from 'chrome-aws-lambda';
import { getStatusText } from 'http-status-codes';
import middy from 'middy';
import {
  cors, doNotWaitForEmptyEventLoop, httpErrorHandler, httpHeaderNormalizer, jsonBodyParser,
} from 'middy/middlewares';
import puppeteer, { DirectNavigationOptions, ScreenshotOptions, Response as PuppeteerResponse } from 'puppeteer-core';

import { qsBoolParser } from '../middlewares/qsBoolParser';
import { initializeCDPClient } from '../helpers/performance';
import {
  ESourceType, QueryParams, RequestBody, ResponsePayload, S3Settings, Metric, PerformanceMetricsResult, Proxy,
} from '../models';
import { initializeS3, uploadResults } from '../helpers/s3';
import { checkRequestData } from '../helpers/request';
import { log } from '../helpers/logger';
import { createErrorResponse } from '../helpers/response';
import { isBase64 } from '../helpers/encoding';
import { storeFields } from '../constants/storeFields';

const handler = async (event: any) => {
  const { type = ESourceType.URL, store, proxy } = event.queryStringParameters as QueryParams;
  const { src, storage = {}, proxy: proxySettings = {}, options = {} } = event.body as RequestBody;
  const { s3: s3Settings = ({} as S3Settings) } = storage;
  const { url, port, login, password } = proxySettings as Proxy;
  let {
    checkSpeed = true,
    trackCalls = true,
    fullPage = true,
    skipScreenshot,
    justHtml,
    viewPortHeight,
    viewPortWidth,
    userAgent,
    script,
  } = options;

  // In case of rendering only html & js, don't check loading speed and skip screenshot taking.
  if (justHtml) {
    checkSpeed = false;
    skipScreenshot = true;
  }

  // We can't use networkidle0, because in this case we can't crawl sites with websockets.
  const puppeteerOptions: DirectNavigationOptions = { timeout: 120000, waitUntil: ["networkidle0", "load", "domcontentloaded"] };
  const isOffline = process.env.IS_OFFLINE;
  let results: ResponsePayload = {} as ResponsePayload;
  let externalRequests: string[] = [];
  // Determined by url changing, not 3xx response.
  let heuristicRedirectChain: string[] = [];
  // Final url after all redirects.
  let finalUrl: string = '';

  log('Executed with event: ', event);

  try {
    // Check request parameters and data.
    checkRequestData(type, store, { s3: s3Settings }, { viewPortWidth, viewPortHeight });
  } catch (e) {
    return createErrorResponse(e.message, undefined, results, 400)
  }

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
    log('Try to authenticate at the proxy server.');

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
  let previousUrlObject: URL;
  page.on('request', request => {
    const url = request.url();
    externalRequests.push(url);

    if (justHtml && request.resourceType() !== 'document' && request.resourceType() !== 'script') {
      // In case of 'justHtml' skip all resources instead of html and scripts.
      request.abort();
    } else {
      request.continue();
    }
  });
  page.on('response', response => {
    const request = response.request();
    const url = request.url();
    const status = response.status();
    const message = response.statusText();

    log("Response url:", url, "Status:", status, "Message:", message);

    // Determine redirects by url changing (only for requests with 200 status codes).
    // Get origin (scheme://hostname) from the url.
    const urlObject = new URL(url);
    // To skip all resources calls, take only calls for 'document' resources.
    if (request.resourceType() === 'document' &&
      request.isNavigationRequest() &&
      response.status() === 200 &&
      previousUrlObject &&
      urlObject.origin !== previousUrlObject.origin
    ) {
      if (!heuristicRedirectChain.length) {
        // Add original source of redirection into the chain.
        heuristicRedirectChain.push(previousUrlObject.href);
      }
      heuristicRedirectChain.push(url);
    }
    previousUrlObject = urlObject;
  });
  page.on('error', err => {
    console.error('error', err);
  });
  page.on('load', () => {
    log('Try to determine final url.');

    finalUrl = page.url();
  });

  // Set viewport.
  if (viewPortWidth && viewPortHeight) {
    log('Setting viewport.');
    await page.setViewport({
      width: viewPortWidth,
      height: viewPortHeight,
    });
  }

  // Initiate page execution.
  if (type === ESourceType.URL) {
    log('Try to open URL: ', src);
    let response: PuppeteerResponse;
    try {
      response = await page.goto(src, puppeteerOptions) as PuppeteerResponse;
    } catch (e) {
      log('Error while request processing.');
      // If we have an exception, there was a fatal error and request even couldn't reach or process by web-server,
      // so at this level we don't have any http status code, only message.
      return createErrorResponse(e.message, undefined, results);
    }

    const statusCode = response.status();
    results = {
      ...results,
      responseCode: statusCode,
    };

    // Check if error.
    if (statusCode > 400) {
      return createErrorResponse(getStatusText(statusCode), statusCode, results);
    }

    //#region Redirect chain
    log('Try to determine redirect chain.');
    const redirectChain = response.request().redirectChain() || [];
    results = {
      ...results,
      redirectChain: redirectChain.map(r => r.url()),
    };
    if (Boolean(heuristicRedirectChain.length)) {
      log('Try to merge redirect chain with heuristic redirect chain.');
      // Add only unique values to the redirect chain.
      heuristicRedirectChain.forEach(url =>
        !results.redirectChain.includes(url) && results.redirectChain.push(url)
      );
    }
    //#endregion
  } else if (type === ESourceType.HTML) {
    log('Try to open render passed html.');
    await page.setContent(src, puppeteerOptions);
  }

  // Wait for browser to finish executing JS.
  await page.waitFor(1000);

  //#region Script evaluation
  if (script) {
    log('Try to execute script.');
    const encoded = isBase64(script);

    log(
      Boolean(encoded)
        ? 'Decoded script from Base64.'
        : 'Script is in plain text.'
    );

    await Promise.resolve(
      eval(encoded || script)
    );
  }
  //#endregion

  //#region Performance metrics
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
  //#endregion

  //#region External requests
  if (trackCalls) {
    log('Try to get track calls.');

    results = {
      ...results,
      externalRequests
    };
  }
  //#endregion

  //#region Final url
  results = {
    ...results,
    finalUrl,
  };
  //#endregion

  //#region Html loading
  const html = await page.content();

  results = {
    ...results,
    html,
  };
  //#endregion

  //#region Screenshot
  if (!skipScreenshot) {
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
      screenshot,
    };
  }
  //#endregion

  //#region Store results
  if (store) {
    log('Try to upload files to the S3.');

    // Initialize S3.
    const s3 = initializeS3();

    try {
      // Upload files to the S3.
      const dataToStore = Object.keys(results)
        .filter(key => storeFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = results[key];
          return obj;
        }, {});

      await uploadResults(s3, s3Settings, dataToStore);
    } catch (e) {
      log('Error while uploading to the S3. Error: ', e);
      return createErrorResponse(e.message, undefined, results, 500)
    }
  }
  //#endregion

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
        redirectChain: results.redirectChain,
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
  .use(httpErrorHandler())
  .use(qsBoolParser());
