// aws-config.example.ts
const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'YOUR_USER_POOL_ID',
      userPoolClientId: 'YOUR_APP_CLIENT_ID',
      identityPoolId: 'YOUR_IDENTITY_POOL_ID',
    }
  },
  Storage: {
    S3: {
      bucket: 'YOUR_BUCKET_NAME',
      region: 'YOUR_AWS_REGION'
    }
  }
};

export default awsConfig;