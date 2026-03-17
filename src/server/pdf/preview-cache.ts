import { createHash } from "node:crypto";

import type { ResumeSvgPreview } from "./build";

const PREVIEW_CACHE_TTL_MS = 60_000;
const PREVIEW_CACHE_MAX_ENTRIES = 24;

type CacheEntry = {
  createdAt: number;
  value: ResumeSvgPreview;
};

const previewCache = new Map<string, CacheEntry>();
const inFlightPreviewMap = new Map<string, Promise<ResumeSvgPreview>>();

function now() {
  return Date.now();
}

function isExpired(entry: CacheEntry, currentTime = now()) {
  return currentTime - entry.createdAt > PREVIEW_CACHE_TTL_MS;
}

function pruneExpiredEntries(currentTime = now()) {
  for (const [key, entry] of previewCache.entries()) {
    if (isExpired(entry, currentTime)) {
      previewCache.delete(key);
    }
  }
}

function pruneOverflowEntries() {
  while (previewCache.size > PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) {
      return;
    }

    previewCache.delete(oldestKey);
  }
}

export function createPdfPreviewCacheKey(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

export async function getCachedPdfPreview(
  cacheKey: string,
  builder: () => Promise<ResumeSvgPreview>
) {
  const currentTime = now();
  const cached = previewCache.get(cacheKey);

  if (cached && !isExpired(cached, currentTime)) {
    return cached.value;
  }

  if (cached) {
    previewCache.delete(cacheKey);
  }

  const inFlight = inFlightPreviewMap.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = builder()
    .then((value) => {
      pruneExpiredEntries(currentTime);
      previewCache.set(cacheKey, {
        createdAt: currentTime,
        value
      });
      pruneOverflowEntries();
      return value;
    })
    .finally(() => {
      inFlightPreviewMap.delete(cacheKey);
    });

  inFlightPreviewMap.set(cacheKey, promise);
  return promise;
}

export function resetPdfPreviewCacheForTests() {
  previewCache.clear();
  inFlightPreviewMap.clear();
}

