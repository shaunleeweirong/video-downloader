import InstagramExtractor from '../extractors/instagram';

describe('InstagramExtractor', () => {
    const testUrl = 'https://www.instagram.com/reel/DI7S-GXTOaO/'; // Example public reel
    let extractor: InstagramExtractor;

    beforeEach(() => {
        extractor = new InstagramExtractor(testUrl);
    });

    test('validates Instagram Reel URL correctly', () => {
        expect(() => extractor.validate()).not.toThrow();
        expect(extractor.id).toBe('DI7S-GXTOaO');
    });

    test('throws error for invalid URL', () => {
        const invalidExtractor = new InstagramExtractor('https://invalid-url.com');
        expect(() => invalidExtractor.validate()).toThrow('Invalid Instagram Reel URL');
    });

    test('extracts video information', async () => {
        const videoInfo = await extractor.extractVideo();
        expect(videoInfo).toHaveProperty('id');
        expect(videoInfo).toHaveProperty('title');
        expect(videoInfo).toHaveProperty('formats');
        expect(videoInfo.formats.length).toBeGreaterThan(0);
        const format = videoInfo.formats[0];
        expect(format).toHaveProperty('url');
        expect(format).toHaveProperty('ext');
        expect(format).toHaveProperty('quality');
    }, 30000);
}); 