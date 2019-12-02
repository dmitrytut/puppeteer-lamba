/**
 * Interface defining proxy settings.
 */
export interface Proxy {
  /** Url. */
  url: string;

  /** Port. */
  port: string;

  /** Login to connect to the proxy. */
  login?: string;

  /** Password to connect to the proxy. */
  password?: string;
}
