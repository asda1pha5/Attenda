const MB = 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function safeBaseName(name) {
  return (name || 'image')
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'image';
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read. Please choose another file.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

/**
 * Keeps public image uploads reasonably small without asking guests to edit
 * photos themselves. Animated GIFs retain their animation but have a tighter cap.
 */
export async function optimizeImageUpload(file, {
  maxInputMB = 12,
  maxOutputMB = 1.5,
  maxDimension = 1920,
} = {}) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please choose a JPG, PNG, WebP, or GIF image.');
  }
  if (file.size > maxInputMB * MB) {
    throw new Error(`Please choose an image smaller than ${maxInputMB} MB.`);
  }
  if (file.type === 'image/gif') {
    if (file.size > maxOutputMB * MB) {
      throw new Error(`Animated GIFs must be ${maxOutputMB} MB or smaller. Use a Giphy link for larger GIFs.`);
    }
    return file;
  }

  const image = await loadImage(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const initialScale = Math.min(1, maxDimension / largestSide);
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, Math.max(0.62, 0.84 - attempt * 0.08));
    if (!blob) throw new Error('The image could not be prepared for upload.');
    if (blob.size <= maxOutputMB * MB || attempt === 3) {
      if (blob.size > maxOutputMB * MB) {
        throw new Error(`This image is still too large after compression. Please choose one under ${maxOutputMB} MB.`);
      }
      return new File([blob], `${safeBaseName(file.name)}.webp`, { type: 'image/webp' });
    }
    width = Math.max(1, Math.round(width * 0.8));
    height = Math.max(1, Math.round(height * 0.8));
  }

  throw new Error('The image could not be prepared for upload.');
}

export function validateAudioUpload(file, maxMB = 8) {
  if (!file.type.startsWith('audio/')) throw new Error('Please choose an audio file.');
  if (file.size > maxMB * MB) throw new Error(`Audio files must be ${maxMB} MB or smaller.`);
}
