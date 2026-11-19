import { ProductImage } from '../models';

export const IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES = 8;

export type ImageProblem = 'type' | 'size';

export function checkImageFile(file: Pick<File, 'type' | 'size'>): ImageProblem | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'type';
  if (file.size > MAX_IMAGE_BYTES) return 'size';
  return null;
}

/** Agar images hain to bilkul ek hi main hoti hai (pehli primary, warna pehli image). */
export function ensureSinglePrimary(images: readonly ProductImage[]): ProductImage[] {
  if (images.length === 0) return [];
  const found = images.findIndex((i) => i.isPrimary);
  const keep = found === -1 ? 0 : found;
  return images.map((img, idx) => ({ ...img, isPrimary: idx === keep }));
}

export function setPrimaryAt(images: readonly ProductImage[], index: number): ProductImage[] {
  return images.map((img, i) => ({ ...img, isPrimary: i === index }));
}

export function removeImageAt(images: readonly ProductImage[], index: number): ProductImage[] {
  return ensureSinglePrimary(images.filter((_, i) => i !== index));
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}