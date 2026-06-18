import type { BusinessMedia } from '../types/business';

export function splitInputList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isLocalOnlyMediaUrl(url: string) {
  return /^(file|blob|content|ph):/i.test(url);
}

export function buildBusinessMedia(params: {
  baseId: string;
  coverImage: string;
  galleryImages: string;
  galleryVideos: string;
  fallbackImage: string;
}): BusinessMedia[] {
  const imageUrls = [params.coverImage, ...splitInputList(params.galleryImages)];
  const uniqueImageUrls = Array.from(new Set(imageUrls.filter(Boolean)));
  const primaryImage = uniqueImageUrls[0] ?? params.fallbackImage;

  const imageMedia = uniqueImageUrls.map((url, index) => ({
    id: `${params.baseId}-image-${index + 1}`,
    type: 'image' as const,
    url,
    label: index === 0 ? 'Cover image' : `Gallery image ${index + 1}`,
  }));

  const videoMedia = splitInputList(params.galleryVideos).map((url, index) => ({
    id: `${params.baseId}-video-${index + 1}`,
    type: 'video' as const,
    url,
    label: `Video ${index + 1}`,
    thumbnailUrl: primaryImage,
  }));

  if (imageMedia.length === 0 && videoMedia.length === 0) {
    return [
      {
        id: `${params.baseId}-image-1`,
        type: 'image',
        url: params.fallbackImage,
        label: 'Cover image',
      },
    ];
  }

  if (imageMedia.length === 0) {
    return [
      {
        id: `${params.baseId}-image-1`,
        type: 'image',
        url: primaryImage,
        label: 'Cover image',
      },
      ...videoMedia,
    ];
  }

  return [...imageMedia, ...videoMedia];
}
