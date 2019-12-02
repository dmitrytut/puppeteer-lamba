import { ESourceType } from '../models/enums';
import { Options } from '../models/options';
import { Storage } from '../models/storage';
import { Proxy } from '../models/proxy';

/**
 * Interface defining query parameters.
 */
export interface QueryParams {
  /** Type of the source. */
  type: ESourceType;

  /** Store data in a storage or return in JSON. */
  store?: boolean;

  /** Is proxy will be using to connect to the {@link type}. */
  proxy?: boolean;
}

/**
 * Interface defining request body payload.
 */
export interface RequestBody {
  /** Source. */
  src: string;

  /** Storage settings. */
  storage?: Storage;

  /** Proxy settings. */
  proxy?: Proxy;

  /** Crawler options. */
  options?: Options;
}
