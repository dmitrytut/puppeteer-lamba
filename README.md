### Getting started

Install ```yarn```:

https://yarnpkg.com/lang/en/docs/install/

Install dependencies:
```
yarn
```

Install AWS CLI:

https://docs.aws.amazon.com/en_us/cli/latest/userguide/install-cliv2.html


Create AWS user with appropriate permissions
1. Go to https://console.aws.amazon.com/iam/.
2. Click on User -> Add user.
3. In "Select AWS access type" check "Programmatic access".
4. Select "Add user to group". Select "Create group" and add the following permissions from list:
    ```    
      AmazonRDSFullAccess
      AWSLambdaFullAccess
      IAMFullAccess
      AmazonS3FullAccess
      AmazonAPIGatewayAdministrator
      AWSCloudFormationFullAccess
    ```
5. Next -> Next -> Create User.
6. Save "Access key ID" and "Secret access key" for further use.
7. Setup named profile and enter "Access key ID", "Secret access key" and other info (substitute ```[PROFILE NAME]``` with some profile name):
    ```
    aws configure --profile [PROFILE NAME]
    ```
8. Open ```serverless.yaml``` and change ```[PROFILE NAME]``` to the profile name you've entered above.
9. Deploy lambda function to the AWS by running:
    ```
    yarn deploy
    ```
