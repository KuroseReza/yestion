import { AwsClient } from 'aws4fetch'
import type { Env } from './index'

export async function getSignedUrl(env: Env, key: string, expiresInSeconds: number): Promise<string> {
  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
  
  const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/')
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${encodedKey}`)
  url.searchParams.set('X-Amz-Expires', expiresInSeconds.toString())
  
  const signed = await aws.sign(url, { method: 'GET', aws: { signQuery: true } })
  return signed.url
}
