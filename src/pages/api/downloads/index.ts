import { NextApiRequest, NextApiResponse } from 'next';
import { once } from 'node:events';
import { promisify } from 'node:util';
import RequestError from '@/utils/request_error';
import { getQuery } from '@/utils';
import ErrorManager from '@/services/error-manager';
import randomUserAgent from '@/utils/user_agent';
import RateLimiter from '@/services/ratelimiter';
import download from 'download';
import { pipeline } from 'node:stream';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

const streamPipeline = promisify(pipeline);

// Use a direct download for YouTube URLs (since youtube-dl-exec requires a binary)
// or fall back to the regular download for other URLs
const downloadFile = (url: string, res: NextApiResponse, ext: string, timeout: number = 30000) => {
    return new Promise<void>(async (resolve, reject) => {
        console.log(`Starting download for: ${url}`);
        
        // Detect if this is a YouTube URL
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        
        try {
            if (isYouTube) {
                console.log('Detected YouTube URL, using format extraction');
                // For YouTube URLs, get the video format directly
                // This gets the actual video file URLs that were extracted earlier
                // Using regex to identify if this is already a direct video URL
                const isDirectVideoUrl = url.includes('.googlevideo.com/') || 
                                        url.includes('videoplayback?') || 
                                        url.endsWith('.mp4') || 
                                        url.endsWith('.webm');
                
                if (isDirectVideoUrl) {
                    console.log('Direct video URL detected, using direct download');
                    await downloadWithTimeout(url, res, ext, timeout);
                } else {
                    // This isn't a direct URL but a YouTube watch page URL
                    console.error('Not a direct video URL. Make sure to pass the format URL, not the watch page URL');
                    res.status(400).json({ error: 'Please select a format before downloading' });
                    reject(new Error('Not a direct video URL'));
                    return;
                }
            } else {
                // For non-YouTube URLs, use the regular download method
                await downloadWithTimeout(url, res, ext, timeout);
            }
            resolve();
        } catch (error) {
            console.error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
            console.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
            reject(error);
        }
    });
};

const downloadWithTimeout = (url: string, res: NextApiResponse, ext: string, timeout: number = 30000) => {
    return new Promise<void>((resolve, reject) => {
        let isFetching = false;
        
        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="video.${ext}"`);
        res.setHeader('Content-Type', `video/${ext}`);
        
        // Add a timeout
        const timeoutId = setTimeout(() => {
            if (!isFetching) {
                if (!res.headersSent) {
                    res.removeHeader('Content-Disposition');
                    res.status(504).json({ error: 'Download timed out' });
                }
                reject(new Error('Download timeout reached'));
            }
        }, timeout);
        
        const headers = {
            'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-us,en;q=0.5',
            'User-Agent': randomUserAgent()
        };
        
        console.log('Downloading from URL:', url);
        console.log('With headers:', headers);
        
        try {
            const dataStream = download(url, undefined, { headers, followRedirect: true, timeout });
            
            // Mark as fetching when data starts flowing
            once(dataStream, 'data').then(() => {
                console.log('Download started successfully');
                isFetching = true;
                clearTimeout(timeoutId);
            }).catch(err => {
                console.error('Error on data event:', err);
            });
            
            // Pipe the data to the response
            streamPipeline(dataStream, res)
                .then(() => {
                    console.log('Download completed successfully');
                    resolve();
                })
                .catch(err => {
                    console.error('Error during streaming:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ error: err.message || 'Download failed' });
                    }
                    reject(err);
                });
        } catch (err) {
            clearTimeout(timeoutId);
            console.error('Error setting up download:', err);
            if (!res.headersSent) {
                const errorMessage = err instanceof Error ? err.message : 'Download failed';
                res.status(500).json({ error: errorMessage });
            }
            reject(err);
        }
    });
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        switch (req.method) {
            case 'GET':
                const url = getQuery(req, 'url');
                let ext = getQuery(req, 'ext');
                if (!url) {
                    throw new RequestError('Invalid args provided, must have a url query');
                }

                if(!ext) {
                    ext = 'mp4';
                }

                try {
                    await downloadFile(url, res, ext);
                } catch (error) {
                    // Error is already handled inside downloadFile
                    const errorManager = new ErrorManager();
                    errorManager.report(error);
                }
                break;
            default:
                throw new RequestError('Method not supported', 405);
        }
    } catch (error) {
        ErrorManager.handleError(res, error);
    }
};

export default RateLimiter.applyRateLimiting(handler);
