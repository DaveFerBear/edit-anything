import { TextDetectionData } from './aiService';

export interface ExportOptions {
  filename?: string;
  format?: 'png' | 'jpeg';
  quality?: number; // For JPEG format (0-1)
}

export class ExportService {
  /**
   * Composite and download an image with text overlays
   */
  static async downloadComposite(
    backgroundImage: HTMLImageElement,
    textDetections: TextDetectionData[],
    renderedSize: { width: number; height: number },
    options: ExportOptions = {}
  ): Promise<void> {
    const {
      filename = 'composed-image.png',
      format = 'png',
      quality = 0.9
    } = options;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas to original image resolution
    canvas.width = backgroundImage.naturalWidth;
    canvas.height = backgroundImage.naturalHeight;

    // Calculate the scale factor used in preview
    const scaleFactor = renderedSize.width > 0 ? renderedSize.width / backgroundImage.naturalWidth : 1;

    // Draw the background image
    ctx.drawImage(backgroundImage, 0, 0);

    // Set canvas text rendering to match CSS as closely as possible
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;

    // Draw each text detection
    textDetections.forEach((detection) => {
      this.renderTextOnCanvas(ctx, detection, canvas.width, canvas.height, scaleFactor);
    });

    // Create and trigger download
    await this.triggerDownload(canvas, filename, format, quality);
  }

  /**
   * Render a single text detection on the canvas
   */
  private static renderTextOnCanvas(
    ctx: CanvasRenderingContext2D,
    detection: TextDetectionData,
    canvasWidth: number,
    canvasHeight: number,
    scaleFactor: number
  ): void {
    const [yMin, xMin, yMax, xMax] = detection.box_2d;
    
    // Convert normalized coordinates to actual pixel coordinates
    const x = xMin * canvasWidth;
    const y = yMin * canvasHeight;
    const width = (xMax - xMin) * canvasWidth;
    const height = (yMax - yMin) * canvasHeight;

    // Use the same font size calculation as the preview
    const baseFontSize = detection.fontSize || 16;
    const scaledFontSize = baseFontSize * scaleFactor;
    
    // Scale the font size back up for the full resolution canvas
    const canvasFontSize = scaledFontSize / scaleFactor;
    
    // Set text properties
    ctx.font = `${canvasFontSize}px ${detection.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = detection.color;
    ctx.textAlign = (detection.textAlign as CanvasTextAlign) || 'center';

    // Apply rotation if detected
    const rotation = detection.rotation || 0;
    const hasRotation = rotation !== 0;

    // Handle multi-line text with tighter line spacing to match CSS leading-tight
    const lines = detection.label.split('\n');
    const lineHeight = canvasFontSize * 1.1; // Tighter spacing to match CSS leading-tight
    
    // Calculate text positioning to match the preview
    const totalTextHeight = lines.length * lineHeight;
    let startY = y;
    
    // Match the CSS flexbox centering behavior
    if (detection.textAlign === 'center' || !detection.textAlign) {
      startY = y + (height - totalTextHeight) / 2;
    } else {
      startY = y + canvasFontSize * 0.1; // Small top padding
    }

    // Save the current canvas state for rotation
    if (hasRotation) {
      ctx.save();
      // Rotate around the center of the text bounding box
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180); // Convert degrees to radians
      ctx.translate(-centerX, -centerY);
    }

    // Draw each line with consistent positioning
    lines.forEach((line, index) => {
      let textX = x;
      if (detection.textAlign === 'center' || !detection.textAlign) {
        textX = x + width / 2;
      } else if (detection.textAlign === 'right') {
        textX = x + width - canvasFontSize * 0.1; // Small right padding
      } else {
        textX = x + canvasFontSize * 0.1; // Small left padding
      }
      
      ctx.fillText(line, textX, startY + index * lineHeight);
    });

    // Restore the canvas state after rotation
    if (hasRotation) {
      ctx.restore();
    }
  }

  /**
   * Convert canvas to blob and trigger download
   */
  private static async triggerDownload(
    canvas: HTMLCanvasElement,
    filename: string,
    format: 'png' | 'jpeg',
    quality: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        resolve();
      }, mimeType, format === 'jpeg' ? quality : undefined);
    });
  }

  /**
   * Get canvas with composite image (without downloading)
   * Useful for previews or further processing
   */
  static async getCompositeCanvas(
    backgroundImage: HTMLImageElement,
    textDetections: TextDetectionData[],
    renderedSize: { width: number; height: number }
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas to original image resolution
    canvas.width = backgroundImage.naturalWidth;
    canvas.height = backgroundImage.naturalHeight;

    // Calculate the scale factor used in preview
    const scaleFactor = renderedSize.width > 0 ? renderedSize.width / backgroundImage.naturalWidth : 1;

    // Draw the background image
    ctx.drawImage(backgroundImage, 0, 0);

    // Set canvas text rendering to match CSS as closely as possible
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;

    // Draw each text detection
    textDetections.forEach((detection) => {
      this.renderTextOnCanvas(ctx, detection, canvas.width, canvas.height, scaleFactor);
    });

    return canvas;
  }

  /**
   * Export as different formats with custom options
   */
  static async exportAsJPEG(
    backgroundImage: HTMLImageElement,
    textDetections: TextDetectionData[],
    renderedSize: { width: number; height: number },
    filename = 'composed-image.jpg',
    quality = 0.9
  ): Promise<void> {
    return this.downloadComposite(backgroundImage, textDetections, renderedSize, {
      filename,
      format: 'jpeg',
      quality
    });
  }

  static async exportAsPNG(
    backgroundImage: HTMLImageElement,
    textDetections: TextDetectionData[],
    renderedSize: { width: number; height: number },
    filename = 'composed-image.png'
  ): Promise<void> {
    return this.downloadComposite(backgroundImage, textDetections, renderedSize, {
      filename,
      format: 'png'
    });
  }
}

// Export convenience instance
export const exportService = ExportService;