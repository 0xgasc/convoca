// lib/stash.ts
// Uploads a file to Stash (Aeter) — permanent Arweave storage via TUS.
// Returns the permanent URL. Used to persist user-submitted flyers so the
// event detail page can render them later.

import * as tus from 'tus-js-client';

const STASH_SERVER = process.env.NEXT_PUBLIC_STASH_SERVER ?? 'https://stash-production-47fc.up.railway.app';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export interface StashUploadResult {
  url: string;
  id: string;
  size: number;
  contentType: string;
  filename: string;
}

export interface UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
  percent: number;
}

export async function uploadToStash(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<StashUploadResult> {
  // Step 1: TUS resumable upload
  const uploadId = await new Promise<string>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${STASH_SERVER}/tus-upload`,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: file.name,
        filetype: file.type || 'application/octet-stream',
      },
      onError: (err) => reject(err),
      onProgress: (uploaded, total) => {
        onProgress?.({
          bytesUploaded: uploaded,
          bytesTotal: total,
          percent: total ? Math.round((uploaded / total) * 100) : 0,
        });
      },
      onSuccess: () => {
        const url = upload.url;
        if (!url) {
          reject(new Error('TUS upload completed but no URL returned'));
          return;
        }
        const id = url.split('/').pop() ?? '';
        resolve(id);
      },
    });
    upload.start();
  });

  // Step 2: tell Stash to finalize the upload (write to Arweave/Irys)
  const completeRes = await fetch(`${STASH_SERVER}/tus-upload/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, originalFilename: file.name }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.text();
    throw new Error(`Stash complete failed (${completeRes.status}): ${body.slice(0, 200)}`);
  }
  const result = await completeRes.json() as StashUploadResult;
  return result;
}
