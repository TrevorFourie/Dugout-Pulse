const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_OUTPUT_BYTES = 250 * 1024;
const MAX_LOGO_DIMENSION = 8_000;
const MAX_LOGO_PIXELS = 16_000_000;
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';
const matchesSignature = (bytes: Uint8Array, extension: string) => {
  if (extension === 'png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (extension === 'jpg' || extension === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === 'webp') return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
};
const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read that image file.'));
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read that image file.'));
  reader.readAsDataURL(file);
});
const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not resize this image.')), type, quality));
const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not encode this image.')); reader.onerror = () => reject(new Error('Could not encode this image.')); reader.readAsDataURL(blob); });

/** Resizes a logo while preserving alpha transparency and enforcing the 250 KB output ceiling. */
export async function processLogoImage(file: File, maxSize = 256): Promise<string> {
  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Unsupported image format. Choose PNG, JPG, JPEG, or WebP.');
  if (file.size <= 0 || file.size > MAX_LOGO_FILE_BYTES) throw new Error('The original logo must be 5 MB or smaller before resizing.');
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) throw new Error('Unsupported image type. Choose PNG, JPG, JPEG, or WebP.');
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesSignature(header, extension)) throw new Error('The file contents do not match a supported image format.');
  if (file.type) { const normalized = extension === 'jpg' ? 'jpeg' : extension; const expected = normalized === 'jpeg' ? 'image/jpeg' : `image/${normalized}`; if (file.type.toLowerCase() !== expected) throw new Error('The file extension and image type do not match.'); }
  const dataUrl = await readAsDataUrl(file); const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('The image is damaged or cannot be decoded.')); image.src = dataUrl; });
  const sw = image.naturalWidth, sh = image.naturalHeight;
  if (!sw || !sh || sw > MAX_LOGO_DIMENSION || sh > MAX_LOGO_DIMENSION || sw * sh > MAX_LOGO_PIXELS) throw new Error('This image has dimensions that are too large to process safely.');
  let dimension = Math.min(1024, Math.max(64, Math.floor(maxSize)));
  const preserveAlpha = extension === 'png' || extension === 'webp';
  while (dimension >= 64) {
    const scale = Math.min(1, dimension / Math.max(sw, sh)); const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image processing is not supported on this device.');
    // Do not paint a background: transparent pixels must remain transparent.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const candidates = preserveAlpha
      ? [{ type: 'image/webp', quality: 0.9 }, { type: 'image/webp', quality: 0.78 }, { type: 'image/webp', quality: 0.65 }, { type: 'image/png' }]
      : [{ type: 'image/jpeg', quality: 0.88 }, { type: 'image/jpeg', quality: 0.76 }, { type: 'image/jpeg', quality: 0.62 }, { type: 'image/jpeg', quality: 0.48 }];
    for (const candidate of candidates) {
      const blob = await canvasToBlob(canvas, candidate.type, candidate.quality);
      // Browsers may silently fall back to PNG for unsupported requested encoders.
      if (preserveAlpha && blob.type !== 'image/webp' && blob.type !== 'image/png') continue;
      if (blob.size <= MAX_LOGO_OUTPUT_BYTES) return blobToDataUrl(blob);
    }
    dimension = Math.floor(dimension * 0.75);
  }
  throw new Error('Could not reduce this logo below 250 KB while preserving its transparency. Please choose a simpler or smaller image.');
}
