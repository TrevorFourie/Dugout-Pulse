const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_DIMENSION = 12_000;
const MAX_LOGO_PIXELS = 40_000_000;

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const getExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';

const matchesSignature = (bytes: Uint8Array, extension: string) => {
  if (extension === 'png') {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (extension === 'jpg' || extension === 'jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === 'webp') {
    return bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
};

const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('Could not read that image file.'));
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('Could not read that image file.'));
  reader.readAsDataURL(file);
});

/**
 * Validates the selected file's extension, declared MIME type, and binary signature,
 * decodes it, rejects excessive dimensions, and re-encodes it as a clean PNG.
 * The returned data URL is suitable for the app's existing local-only logo storage.
 */
export async function processLogoImage(file: File, maxSize = 256): Promise<string> {
  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported image format. Choose PNG, JPG, JPEG, or WebP.');
  }
  if (file.size <= 0 || file.size > MAX_LOGO_FILE_BYTES) {
    throw new Error('Logo files must be smaller than 5 MB.');
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Unsupported image type. Choose PNG, JPG, JPEG, or WebP.');
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const normalizedExtension = extension === 'jpg' ? 'jpeg' : extension;
  if (!matchesSignature(header, extension)) {
    throw new Error('The file contents do not match a supported image format.');
  }
  if (file.type) {
    const expectedType = normalizedExtension === 'jpeg' ? 'image/jpeg' : `image/${normalizedExtension}`;
    if (file.type.toLowerCase() !== expectedType) {
      throw new Error('The file extension and image type do not match.');
    }
  }

  const dataUrl = await readAsDataUrl(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The image is damaged or cannot be decoded.'));
    image.src = dataUrl;
  });

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight || sourceWidth > MAX_LOGO_DIMENSION || sourceHeight > MAX_LOGO_DIMENSION
    || sourceWidth * sourceHeight > MAX_LOGO_PIXELS) {
    throw new Error('This image has dimensions that are too large to process safely.');
  }

  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is not supported on this device.');
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
