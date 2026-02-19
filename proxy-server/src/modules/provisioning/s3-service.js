function createProvisioningS3Service({ env }) {
  let s3Client = null;

  function getS3Client() {
    if (s3Client) return s3Client;

    const endpoint = String(env.s3Endpoint || '').trim();
    const accessKeyId = String(env.s3AccessKeyId || '').trim();
    const secretAccessKey = String(env.s3SecretAccessKey || '').trim();
    const region = String(env.s3Region || 'us-east-1').trim();

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      return null;
    }

    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: Boolean(env.s3ForcePathStyle),
    });
    return s3Client;
  }

  function getBucket() {
    return String(env.s3BucketProvisioning || env.s3BucketArtifacts || '').trim();
  }

  async function getPresignedUrl(objectKey, expiresIn) {
    const client = getS3Client();
    if (!client) return null;

    const bucket = getBucket();
    if (!bucket) return null;

    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: String(objectKey),
    });

    const ttl = Number(expiresIn) || Number(env.s3PresignTtlSeconds) || 300;
    return getSignedUrl(client, command, { expiresIn: ttl });
  }

  async function getBootstrapUrls() {
    const downloaderUrl = await getPresignedUrl('bootstrap/downloader.exe');
    return { downloaderUrl };
  }

  async function getAppUrls() {
    const setupAppUrl = await getPresignedUrl('apps/winsible-setup.exe');
    const setupAppSha256Url = await getPresignedUrl('apps/winsible-setup.sha256');
    return { setupAppUrl, setupAppSha256Url };
  }

  async function getSoftwareUrl(module, version) {
    const key = version ? `software/${module}/${version}` : `software/${module}`;
    const url = await getPresignedUrl(key);
    return { url };
  }

  return {
    getPresignedUrl,
    getBootstrapUrls,
    getAppUrls,
    getSoftwareUrl,
  };
}

module.exports = {
  createProvisioningS3Service,
};
