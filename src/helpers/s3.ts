import aws from 'aws-sdk';
import { join, basename, dirname } from "path";
import { resultsExtensions } from '../constants/resultsExtensions';
import { ResponsePayload, S3Settings } from '../models';
import { log } from '../helpers/logger';

/** Initialize S3 bucket. */
export const initializeS3 = (): aws.S3 => {
  log('Initialize S3.');

  let s3Params: aws.S3.ClientConfiguration = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
  if (process.env.IS_OFFLINE) {
    s3Params = {
      ...s3Params,
      s3ForcePathStyle: true,
      endpoint: 'http://localhost:8000',
    };
  }

  return new aws.S3(s3Params);
};

export const uploadResults = async (s3: aws.S3, s3Settings: S3Settings, results: Partial<ResponsePayload>): Promise<any> => {
  const s3PutPromises = [];

  for (const key in results) {
    const dir = dirname(s3Settings.path);
    const fname = basename(s3Settings.path);
    const fullPath = join(dir, `${fname}${resultsExtensions[key]}`);

    let body = results[key];
    if (key !== 'screenshot') {
      if (key === 'externalRequests' || key === 'performanceMetrics') {
        body = JSON.stringify(results[key]);
      }

      body = Buffer.from(body, 'utf8');
    }

    // Setting up S3 upload parameters.
    const uploadParams = {
      Bucket: process.env.IS_OFFLINE ? 'test-bucket' : s3Settings.bucket,
      Key: fullPath,
      Body: body,
    };

    log(`Add file ${uploadParams.Key} to the upload queue.`);

    // Store upload files promises to the array.
    s3PutPromises.push(s3.putObject(uploadParams, (err: any) => {
      if (err) {
        throw err;
      }

      log(`File '${uploadParams.Key}' saved to the '${uploadParams.Bucket}'`);
    }).promise());
  }

  log(`Start uploading all files.`);

  await Promise.all(s3PutPromises);
};
