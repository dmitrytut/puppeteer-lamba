import { ResponsePayload } from '../models';

/** Creates error response. */
export const createErrorResponse = (
  message: string,
  httpCode?: number,
  responseData: ResponsePayload = {} as ResponsePayload,
  statusCode: number = 200,
) => {
  const responseBody: ResponsePayload  = {
    ...responseData,
    error: {
      message,
      httpCode,
    }
  };
  if (httpCode && responseBody.error) {
    responseBody.error.httpCode = httpCode;
  }

  return {
    statusCode,
    headers: {
      "Content-type": "application/json"
    },
    body: JSON.stringify(responseBody),
  };
};
