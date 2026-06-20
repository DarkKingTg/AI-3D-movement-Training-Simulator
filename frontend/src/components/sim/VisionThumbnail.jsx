import { useEffect, useRef } from "react";
import { useSimStore } from "@/store/simStore";

/**
 * VisionThumbnail — paints the latest vision buffer onto a canvas element.
 * Updated whenever store.senses.visionUpdatedAt changes.
 */
export default function VisionThumbnail({ width = 192, height = 144 }) {
  const canvasRef = useRef(null);
  const visionData = useSimStore((s) => s.senses.visionData);
  const W = useSimStore((s) => s.senses.visionWidth);
  const H = useSimStore((s) => s.senses.visionHeight);

  useEffect(() => {
    if (!canvasRef.current || !visionData || !W || !H) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new ImageData(visionData, W, H);
    // Render small image and scale up via canvas
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    tmp.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tmp, 0, 0, width, height);
  }, [visionData, W, H, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      data-testid="vision-thumbnail"
      style={{
        width,
        height,
        background: "#000",
        border: "1px solid rgba(0, 255, 136, 0.4)",
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
}
