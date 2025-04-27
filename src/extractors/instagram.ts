import BaseExtractor from './base';
import { ExtractedVideo, VideoProp } from '@/types';
import RequestError from '@/utils/request_error';

export default class InstagramExtractor extends BaseExtractor {
    url: string;
    urlPattern: RegExp = /https?:\/\/(www\.)?instagram\.com\/reel\//;
    id!: string;

    constructor(url: string) {
        super();
        this.url = url;
    }

    validate(errorMessage: string = 'Invalid Instagram Reel URL'): string {
        if (!this.urlPattern.test(this.url)) {
            throw new RequestError(errorMessage, 400);
        }
        // Extract the reel ID from the URL
        const match = this.url.match(/instagram\.com\/reel\/([\w-]+)/);
        if (!match) {
            throw new RequestError(errorMessage, 400);
        }
        this.id = match[1];
        return this.id;
    }

    async extractVideo(): Promise<ExtractedVideo> {
        this.validate();
        try {
            // Use Instagram's internal GraphQL endpoint
            const shortcode = this.id;
            const url = 'https://www.instagram.com/graphql/query';
            const variables = JSON.stringify({ shortcode });
            const doc_id = '8845758582119845'; // This doc_id is used for reels/posts
            const body = new URLSearchParams({
                av: '0',
                __d: 'www',
                __user: '0',
                __a: '1',
                __req: 'b',
                dpr: '3',
                variables,
                doc_id,
            });
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-IG-App-ID': '1217981644879628',
                },
                body,
            });
            if (!response.ok) {
                throw new RequestError('Failed to fetch Instagram GraphQL', 404);
            }
            const json = await response.json();
            const media = json.data?.xdt_shortcode_media;
            if (!media || !media.is_video || !media.video_url) {
                throw new RequestError('Could not extract video URL from Instagram GraphQL', 404);
            }
            const format: VideoProp = {
                url: media.video_url,
                ext: 'mp4',
                quality: 'HD',
            };
            return {
                id: this.id,
                title: media.title || `Instagram Reel ${this.id}`,
                formats: [format],
                thumbnail: media.display_url || '',
                origin_url: this.url,
            };
        } catch (error) {
            throw new RequestError('Failed to extract Instagram Reel video', 404);
        }
    }
} 