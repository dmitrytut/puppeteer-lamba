/**
 * Convert string to boolean.
 *
 * @param  {String}  string  - String to convert
 * @return {?}  Returns the results of the conversion.
 */
const parseBoolFromString = (string: string) => {
  if (string === 'true') {
    return true;
  }
  else if (string === 'false') {
    return false;
  }
  else {
    return string;
  }
};

/**
 * Parse query parameters to boolean.
 */
export const qsBoolParser = () => ({
    before: (handler: { event: any; }, next: () => any) => {
      const { event } = handler;

      if (event.queryStringParameters && Boolean(Object.keys(event.queryStringParameters))) {
        for (let key of Object.keys(event.queryStringParameters)) {
          let value = event.queryStringParameters[key];
          if (typeof value === 'string') {
            event.queryStringParameters[key] = parseBoolFromString(value);
          }
        }
      }

      return next()
    },
});
