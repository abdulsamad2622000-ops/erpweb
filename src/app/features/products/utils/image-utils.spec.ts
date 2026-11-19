import { describe, expect, it } from 'vitest';
import { ProductImage } from '../models';
import { MAX_IMAGE_BYTES, checkImageFile, ensureSinglePrimary, removeImageAt, setPrimaryAt } from './image-utils';

const img = (name: string, isPrimary = false): ProductImage => ({ url: `data:image/png;base64,${name}`, name, isPrimary });
const mains = (list: ProductImage[]) => list.filter((i) => i.isPrimary).map((i) => i.name);

describe('checkImageFile', () => {
  it('accepts jpg, png and webp within the size limit', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(checkImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkImageFile({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects other types and files that are too big', () => {
    expect(checkImageFile({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(checkImageFile({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(checkImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('size');
  });
});

describe('main image rules', () => {
  it('returns nothing for an empty list', () => {
    expect(ensureSinglePrimary([])).toEqual([]);
  });

  it('makes the first image main when none is', () => {
    expect(mains(ensureSinglePrimary([img('a'), img('b')]))).toEqual(['a']);
  });

  it('keeps only the first main when several are marked', () => {
    expect(mains(ensureSinglePrimary([img('a'), img('b', true), img('c', true)]))).toEqual(['b']);
  });

  it('setPrimaryAt moves the main image', () => {
    expect(mains(setPrimaryAt([img('a', true), img('b')], 1))).toEqual(['b']);
  });

  it('removing the main image promotes the first remaining one', () => {
    const out = removeImageAt([img('a', true), img('b'), img('c')], 0);
    expect(out.map((i) => i.name)).toEqual(['b', 'c']);
    expect(mains(out)).toEqual(['b']);
  });

  it('removing the last image leaves an empty list', () => {
    expect(removeImageAt([img('a', true)], 0)).toEqual([]);
  });
});