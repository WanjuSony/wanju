import { supabase } from './supabase';
import * as tus from 'tus-js-client';

/**
 * Uploads a file to Supabase Storage using the TUS resumable upload protocol.
 * This bypasses the 50MB limit on the standard free-tier Supabase edge network
 * by chunking the file.
 */
export async function uploadFileWithTus(bucketName: string, file: File | Blob, fileName: string): Promise<string> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase credentials for TUS upload.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseAnonKey;

    return new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseAnonKey,
                'x-upsert': 'true', // overwrite if exists
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true, // clear localstorage tracking
            metadata: {
                bucketName: bucketName,
                objectName: fileName,
                contentType: file.type || 'application/octet-stream',
            },
            chunkSize: 6 * 1024 * 1024, // 6MB chunks
            onError: function (error) {
                console.error('TUS Upload Failed:', error);
                reject(error);
            },
            onProgress: function (bytesUploaded, bytesTotal) {
                const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                console.log(`[TUS] Uploading ${fileName}: ${percentage}%`);
            },
            onSuccess: function () {
                console.log('TUS Upload Success:', upload.url);
                // Return the public URL
                const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
                resolve(data.publicUrl);
            },
        });

        // Start upload
        const previousUploads = upload.findPreviousUploads().then(function (previousUploads) {
            // Found previous uploads so we select the first one. 
            if (previousUploads.length) {
                upload.resumeFromPreviousUpload(previousUploads[0])
            }
            upload.start()
        }).catch(() => {
            upload.start()
        });
    });
}
