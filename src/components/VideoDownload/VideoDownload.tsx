import React, { useState } from "react";
import { HiPlay } from "react-icons/hi2";
import VideoMenu from "../VideoMenu";
import Badge from "../Badge";
import useVideoCtx from "@/hooks/useVideoCtx";
import { ExtractedVideo } from "@/types";
import styles from "./VideoDownload.module.css";

interface VideoDownloadProps {
  videoData: ExtractedVideo;
}

const VideoDownload = ({ videoData }: VideoDownloadProps) => {
  const [currentFormat, setCurrentFormat] = useState(videoData.formats[0]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { showVideo } = useVideoCtx();

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    
    try {
      // Use backend API to proxy the video download and avoid CORS issues
      const apiUrl = `/api/downloads?url=${encodeURIComponent(currentFormat.url)}&ext=${currentFormat.ext}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      // Use video title or a default name for the download
      const fileName = videoData.title ? `${videoData.title}.${currentFormat.ext}` : `video_${videoData.id || 'download'}.${currentFormat.ext}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      let message = 'Download failed. Please try again.';
      if (error instanceof Error) {
        message = `Download failed: ${error.message}`;
      }
      setDownloadError(message);
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={styles["download"]}>
      <div className={styles["thumbnail-wrapper"]}>
        {videoData.thumbnail && (
          <img
            src={videoData.thumbnail}
            className={styles["thumbnail"]}
            alt={videoData.title}
          />
        )}
        <div className={styles["overlay"]}>
          <button
            className={styles["play-btn"]}
            onClick={() =>
              showVideo(currentFormat.url, {
                autoplay: true,
                controls: true,
                responsive: true,
                fluid: true,
                sources: [
                  {
                    src: currentFormat.url,
                    type: `video/${currentFormat.ext}`,
                  },
                ],
              })
            }
          >
            <HiPlay className={styles["play-icon"]} />
          </button>
        </div>
      </div>
      <div className={styles["main-content"]}>
        <div>
          <h6 className={styles["main-title"]}>{videoData.title}</h6>
          <div className={styles.badges}>
            <Badge>{currentFormat.quality}</Badge>
            <Badge>{currentFormat.ext}</Badge>
          </div>
        </div>
        <div className={styles["download-actions"]}>
          <div>
            <button
              className={styles["download-btn"]}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? 'Downloading...' : 'Download'}
            </button>
            {downloadError && (
              <div className={styles["error-message"]}>{downloadError}</div>
            )}
          </div>
          <div>
            <VideoMenu
              formats={videoData.formats}
              onChange={setCurrentFormat}
              value={currentFormat}
              title="Quality"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDownload;