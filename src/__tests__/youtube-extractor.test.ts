import YoutubeExtractor from '../extractors/youtube';

describe('YoutubeExtractor', () => {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Using a well-known video that's unlikely to be taken down
    let extractor: YoutubeExtractor;

    beforeEach(() => {
        extractor = new YoutubeExtractor(testUrl);
    });

    test('validates YouTube URL correctly', () => {
        expect(() => extractor.validate()).not.toThrow();
        expect(extractor.id).toBe('dQw4w9WgXcQ');
    });

    test('throws error for invalid URL', () => {
        const invalidExtractor = new YoutubeExtractor('https://invalid-url.com');
        expect(() => invalidExtractor.validate()).toThrow('Invalid Youtube url');
    });

    test('extracts video information', async () => {
        const videoInfo = await extractor.extractVideo();
        
        expect(videoInfo).toHaveProperty('id');
        expect(videoInfo).toHaveProperty('title');
        expect(videoInfo).toHaveProperty('formats');
        expect(videoInfo.formats.length).toBeGreaterThan(0);
        
        // Check format properties
        const format = videoInfo.formats[0];
        expect(format).toHaveProperty('url');
        expect(format).toHaveProperty('ext');
        expect(format).toHaveProperty('quality');
    });

    test('handles download progress', async () => {
        const videoInfo = await extractor.extractVideo();
        const format = videoInfo.formats[0];
        
        const onProgress = jest.fn();
        
        // Mock fetch to simulate progress
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                headers: new Map([['content-length', '1000']]),
                arrayBuffer: () => {
                    // Simulate progress by calling onProgress
                    onProgress({
                        percentage: 50,
                        downloadedBytes: 500,
                        totalBytes: 1000,
                        speed: 1000
                    });
                    return Promise.resolve(new ArrayBuffer(1000));
                }
            })
        ) as jest.Mock;

        const buffer = await extractor.downloadWithProgress(format.url, onProgress);
        
        expect(buffer).toBeInstanceOf(Buffer);
        expect(onProgress).toHaveBeenCalled();
        
        // Check progress data structure
        const progressCall = onProgress.mock.calls[0][0];
        expect(progressCall).toHaveProperty('percentage');
        expect(progressCall).toHaveProperty('downloadedBytes');
        expect(progressCall).toHaveProperty('totalBytes');
        expect(progressCall).toHaveProperty('speed');
    });
}); 