import { ttdl } from 'ruhend-scraper';
import BaseExtractor from './base';
import { ExtractedVideo, VideoFormat } from '@/types';
import RequestError from '@/utils/request_error';

class TikTokExtractor extends BaseExtractor {
    // Original TikTok URL pattern
    urlPattern: RegExp = /https?:\/\/(?:www\.|m\.|vm\.)?tiktok\.com\/(?:@(?:[^\/]+)\/video\/|v\/|)(?<id>[^\/?#&]+)/;
    url: string;
    id!: string;

    constructor(url: string) {
        super();
        // Keep the full URL including query parameters for this scraper
        this.url = url;
    }

    async extractVideo(): Promise<ExtractedVideo> {
        try {
            console.log('Attempting to extract TikTok video:', this.url);
            const videoInfo = await ttdl(this.url);
            
            if (!videoInfo) {
                console.error('No video info returned from ttdl');
                throw new RequestError('Failed to get video information', 404);
            }

            if (!videoInfo.video) {
                console.error('No video URL in response:', videoInfo);
                throw new RequestError('No video URL found in response', 404);
            }

            // Create format object
            const format: VideoFormat = {
                url: videoInfo.video, // No watermark video URL
                ext: 'mp4',
                quality: 'HD',
                width: 1080,  // TikTok typically uses these dimensions
                height: 1920
            };

            console.log('Successfully extracted TikTok video:', {
                title: videoInfo.title,
                hasVideo: !!videoInfo.video,
                hasThumbnail: !!videoInfo.cover
            });

            return {
                id: this.id,
                title: videoInfo.title || 'TikTok Video',
                thumbnail: videoInfo.cover || '',
                origin_url: this.url,
                formats: [format]
            };
        } catch (error) {
            console.error('TikTok extraction failed:', error);
            if (error instanceof Error) {
                throw new RequestError(`Failed to extract TikTok video: ${error.message}`, 404);
            }
            throw new RequestError('Failed to extract TikTok video', 404);
        }
    }

    validate(): string {
        const matches = this.url.match(this.urlPattern);
        if (!matches || !matches.groups?.id) {
            throw new RequestError('Invalid TikTok URL format', 400);
        }
        this.id = matches.groups.id;
        return this.id;
    }
}

export default TikTokExtractor; 