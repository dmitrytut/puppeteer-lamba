import { ESourceType, Options, RequestBody, S3Settings, Storage } from '../models';

/** Check request parameters and data. */
export const checkRequestData = (
  type: ESourceType,
  store: boolean | undefined,
  storage: Partial<Storage>,
  options: Partial<Options>
) => {
  const { s3 = ({} as S3Settings) } = storage;
  const { viewPortHeight, viewPortWidth } = options;

  if ((viewPortHeight && !viewPortWidth) || (viewPortWidth && !viewPortHeight)) {
    throw new Error('Incorrect viewPort parameters. If one parameter defined, another can\'t be undefined.');
  }

  const availableSources = Object.values(ESourceType);
  if (!availableSources.includes(type)) {
    throw new Error(`Incorrect \'type\' parameter. Must be one of: ${availableSources}.`);
  }

  if (store && (!s3.bucket || !s3.path)) {
    throw new Error(`Missed or incorrect \'s3\' option. Must contain: bucket, path.`);
  }
};
