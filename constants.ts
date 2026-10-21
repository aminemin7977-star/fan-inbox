export const BUCKET = 'fan-media'
export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_BODY_CHARS = 2000
export const MAX_NICK_CHARS = 40

/** Allowed upload MIME types → stored file extension. */
export const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heic',
}

export const CREATOR_NAME = process.env.NEXT_PUBLIC_CREATOR_NAME || 'the creator'
