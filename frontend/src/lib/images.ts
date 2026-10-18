/** A photo made small enough to upload over a weak signal. */
export interface ShrunkImage {
  /** For an <img src>. */
  url: string
  media_type: 'image/jpeg'
  /** Base64 without the data: prefix, for the API. */
  data: string
}

// Claude reads images up to about 1568 px on the long side; larger ones are
// scaled down on its end anyway.
const MAX_SIDE = 1568
const QUALITY = 0.85

/** Downscale a camera photo to a JPEG (the browser applies its EXIF rotation). */
export async function shrinkImage(file: File): Promise<ShrunkImage> {
  const source = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = source
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', QUALITY)
    return { url, media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) }
  } finally {
    URL.revokeObjectURL(source)
  }
}
