const { YoutubeTranscript } = require('youtube-transcript');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { url, v } = req.query;
    const input = url || v;

    if (!input) {
        return res.status(400).json({ error: 'Missing url or v parameter' });
    }

    // Extract video ID from various YouTube URL formats
    let videoId = input;
    try {
        if (input.includes('youtube.com') || input.includes('youtu.be')) {
            const urlObj = new URL(input);
            if (urlObj.hostname === 'youtu.be') {
                videoId = urlObj.pathname.slice(1);
            } else {
                videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
            }
        }
    } catch (e) {
        // If URL parsing fails, assume it's a video ID
    }

    if (!videoId) {
        return res.status(400).json({ error: 'Could not extract video ID' });
    }

    try {
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);

        if (!transcript || transcript.length === 0) {
            return res.status(404).json({ error: 'No transcript found for this video' });
        }

        return res.status(200).json({
            videoId,
            transcript: transcript.map(item => ({
                text: item.text,
                offset: item.offset,
                duration: item.duration
            }))
        });
    } catch (error) {
        console.error('Transcript fetch error:', error.message);

        if (error.message?.includes('disabled')) {
            return res.status(404).json({ error: 'Transcripts are disabled for this video' });
        }
        if (error.message?.includes('unavailable')) {
            return res.status(404).json({ error: 'Video is unavailable' });
        }

        return res.status(500).json({ error: 'Failed to fetch transcript: ' + error.message });
    }
};
