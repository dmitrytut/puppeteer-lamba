/**
 * Interface defining storage settings.
 */
export interface Storage {
  /** S3 storage settings. */
  s3?: S3Settings;
}

/**
 * Interface defining S3 storage settings.
 */
export interface S3Settings {
  /** Bucket identifier. */
  bucket: string;

  /** Path where to store files in the bucket. */
  path: string;
}
