import { ExtractedVideo, VideoProp } from "@/types";
import BaseExtractor from "./base";
import RequestError from "@/utils/request_error";
import _ from 'lodash';
import youtubeDl from 'youtube-dl-exec';

// Define the type for youtube-dl-exec response
interface YoutubeDlResponse {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    uploader: string;
    formats: Array<{
        url: string;
        ext: string;
        width?: number;
        height?: number;
        tbr?: number;
        format_note?: string;
        acodec: string;
        vcodec: string;
        filesize?: number;
    }>;
}

export enum VideoQualityPreference {
    Lowest = 'lowest',
    UpTo360p = '360p',
    UpTo480p = '480p',
    UpTo720p = '720p',
    UpTo1080p = '1080p',
    Highest = 'highest'
}

export interface VideoDownloadPreference {
    preferredContainer: string;
    preferredQuality: VideoQualityPreference;
}

export interface DownloadProgress {
    percentage: number;
    downloadedBytes: number;
    totalBytes: number;
    speed: number;
}

class YoutubeExtractor extends BaseExtractor {
    url: string;
    urlPattern: RegExp = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    id!: string;

    constructor(url: string) {
        super();
        this.url = url;
    }

    validate(errorMessage: string = 'Invalid Youtube url'): string {
        try {
            // Extract video ID using regex
            const match = this.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            if (!match) {
                throw new RequestError(errorMessage, 400);
            }
            this.id = match[1];
            return this.id;
        } catch (error) {
            const err = error instanceof RequestError ? error : new RequestError(errorMessage, 400);
            throw err;
        }
    }

    private mapFormats(formats: YoutubeDlResponse['formats']): VideoProp[] {
        try {
            // Filter formats that have both video and audio
            const formatsWithAudio = formats.filter(format => 
                format.acodec !== 'none' && format.vcodec !== 'none'
            );
            
            // Sort by quality (height) and bitrate
            const sortedFormats = formatsWithAudio.sort((a, b) => {
                if (a.height === b.height) {
                    return (b.tbr || 0) - (a.tbr || 0);
                }
                return (b.height || 0) - (a.height || 0);
            });

            // Map to our VideoProp format with additional metadata
            return sortedFormats.map(format => ({
                url: format.url,
                ext: format.ext || 'mp4',
                width: format.width,
                height: format.height,
                rate: format.tbr ? `${Math.round(format.tbr)}kbps` : '',
                quality: format.format_note || `${format.height}p`,
                filesize: format.filesize
            }));
        } catch (error) {
            console.error(`Error processing formats: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    async extractVideo(): Promise<ExtractedVideo> {
        const id = this.validate();
        
        try {
            console.log(`Attempting to extract YouTube video: ${this.url}`);
            
            // Get video info using yt-dlp
            const videoInfo = await youtubeDl(this.url, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
                preferFreeFormats: true,
                format: 'best',
                addHeader: [
                    'referer:youtube.com',
                    'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                ]
            }) as YoutubeDlResponse;
            
            console.log(`Successfully extracted YouTube video: ${JSON.stringify({
                title: videoInfo.title,
                formats: videoInfo.formats?.length || 0
            }, null, 2)}`);
            
            if (!videoInfo.formats || videoInfo.formats.length === 0) {
                throw new RequestError('No formats available for this video', 404);
            }
            
            // Get best quality formats
            const videoFormats = this.mapFormats(videoInfo.formats);
            
            if (videoFormats.length === 0) {
                throw new RequestError('No suitable formats found for this video', 404);
            }

            return {
                id,
                origin_url: this.url,
                thumbnail: videoInfo.thumbnail || '',
                formats: videoFormats,
                title: videoInfo.title || '',
                duration: videoInfo.duration,
                uploader: videoInfo.uploader || 'Unknown'
            };
        } catch (error) {
            console.error(`YouTube extraction error: ${error instanceof Error ? error.message : String(error)}`);
            console.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
            
            // Enhanced error handling with specific error messages
            if (error instanceof Error) {
                if (error.message.includes('Video unavailable')) {
                    throw new RequestError('This video is unavailable or has been removed', 410);
                } else if (error.message.includes('Private video')) {
                    throw new RequestError('This video is private', 403);
                } else if (error.message.includes('Sign in')) {
                    throw new RequestError('This video requires authentication', 401);
                } else if (error.message.includes('copyright')) {
                    throw new RequestError('This video is not available due to copyright restrictions', 403);
                } else if (error.message.includes('Status code: 410')) {
                    throw new RequestError('This video is no longer available', 410);
                } else if (error.message.includes('Status code: 403')) {
                    throw new RequestError('Access to this video is forbidden', 403);
                } else if (error.message.includes('Status code: 404')) {
                    throw new RequestError('Video not found', 404);
                }
            }
            
            throw new RequestError('Failed to extract video information', 500);
        }
    }

    public async downloadWithProgress(
        url: string, 
        onProgress: (progress: DownloadProgress) => void
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            let downloadedBytes = 0;
            let totalBytes = 0;
            let lastProgressUpdate = Date.now();
            let downloadSpeed = 0;

            const handleProgress = (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                
                // Update progress every 100ms to avoid overwhelming the UI
                const now = Date.now();
                if (now - lastProgressUpdate > 100) {
                    downloadSpeed = (chunk.length / ((now - lastProgressUpdate) / 1000)); // bytes per second
                    const percentage = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
                    
                    onProgress({
                        percentage,
                        downloadedBytes,
                        totalBytes,
                        speed: downloadSpeed
                    });
                    
                    lastProgressUpdate = now;
                }
            };

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
                    return response.arrayBuffer();
                })
                .then(buffer => {
                    resolve(Buffer.from(buffer));
                })
                .catch(error => {
                    reject(new Error(`Download failed: ${error.message}`));
                });
        });
    }
}

export default YoutubeExtractor;






