import { GoogleGenAI, Type, Modality } from "@google/genai";

// Type definitions
export type TextDetectionData = {
  label: string;
  box_2d: [number, number, number, number]; // [yMin, xMin, yMax, xMax] (Normalized 0-1)
  color: string;
  // Optional properties for detected text styles
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
};

export type FontProperties = {
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: string;
};

// Helper function to convert file to format expected by Google AI
export const fileToGenerativePart = (file: File) => {
  return new Promise<{ mimeType: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      resolve({
        mimeType: file.type,
        data: base64Data,
      });
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
};

// AI Service class
export class AIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Detect text in an image
   */
  async detectText(file: File): Promise<TextDetectionData[]> {
    const imagePart = await fileToGenerativePart(file);

    const textPrompt = `
    Output a json list where each entry contains the 2D bounding box in "box_2d", the text content in "label", and the text color in "color". The bounding box coordinates should be normalized to the image dimensions (0-1000).
    Here's what the response should look like: { "box_2d": [68, 75, 322, 408], "label": "Start working out now", "color": "#0055b3" }
    `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: imagePart },
          { text: textPrompt }
        ]
      },
      config: {
        temperature: 0.5,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              color: { type: Type.STRING },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
              },
            },
            required: ["label", "color", "box_2d"]
          }
        }
      }
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if (Array.isArray(result) && result.length > 0) {
      return result.map(item => ({
        ...item,
        box_2d: item.box_2d.map((val: number) => val / 1000)
      }));
    } else {
      throw new Error("No text could be detected in the image.");
    }
  }

  /**
   * Consolidate text detections by grouping related text boxes with same color
   */
  async consolidateDetections(detections: TextDetectionData[], file: File): Promise<TextDetectionData[]> {
    if (detections.length === 0) {
      return detections;
    }

    try {
      const imagePart = await fileToGenerativePart(file);

      const detectionsForPrompt = detections.map((d, index) => ({
        index,
        label: d.label,
        color: d.color,
        box_2d: d.box_2d.map(coord => Math.round(coord * 1000)),
      }));

      const consolidationPrompt = `
I have detected the following text boxes in an image. Each has an index, a label, color, and bounding box coordinates ([yMin, xMin, yMax, xMax]). Some of these are single lines that belong to a larger, multi-line text block. Please group the indices of text boxes that should be merged. 

IMPORTANT RULES:
- Only group text boxes that have the EXACT SAME COLOR
- Text boxes that are far apart or have different styling should not be grouped
- Different colors indicate different text elements and must remain separate

Return a JSON object with a single key "groups". This key should contain an array of arrays, where each inner array is a group of indices that belong together. For example, if boxes 0 and 1 have the same color and are a group, and 3, 4, and 5 have the same color and are another group, the response should be: { "groups": [[0, 1], [3, 4, 5]] }. Do not include single, ungrouped boxes in the response.

Here are the detections:
${JSON.stringify(detectionsForPrompt, null, 2)}
`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: imagePart },
            { text: consolidationPrompt }
          ]
        },
        config: {
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              groups: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER }
                }
              }
            },
            required: ["groups"]
          }
        }
      });

      const jsonString = response.text.trim();
      const result = JSON.parse(jsonString);
      const groups: number[][] = result.groups || [];

      if (groups.length === 0) {
        console.log("Consolidation did not result in any new groups.");
        return detections;
      }

      const newDetections: TextDetectionData[] = [];
      const processedIndices = new Set<number>();

      for (const group of groups) {
        const boxesToMerge = group.map(index => detections[index]);

        if (boxesToMerge.some(b => !b)) continue;

        // Ensure all boxes in the group have the same color
        const firstColor = boxesToMerge[0].color;
        if (!boxesToMerge.every(b => b.color === firstColor)) {
          console.log(`Skipping group ${group} - boxes have different colors`);
          continue;
        }

        const mergedLabel = boxesToMerge.map(b => b.label).join('\n');
        const mergedColor = firstColor;

        const yMin = Math.min(...boxesToMerge.map(b => b.box_2d[0]));
        const xMin = Math.min(...boxesToMerge.map(b => b.box_2d[1]));
        const yMax = Math.max(...boxesToMerge.map(b => b.box_2d[2]));
        const xMax = Math.max(...boxesToMerge.map(b => b.box_2d[3]));

        newDetections.push({
          label: mergedLabel,
          color: mergedColor,
          box_2d: [yMin, xMin, yMax, xMax]
        });

        group.forEach(index => processedIndices.add(index));
      }

      detections.forEach((detection, index) => {
        if (!processedIndices.has(index)) {
          newDetections.push(detection);
        }
      });

      return newDetections;
    } catch (err) {
      console.error('Consolidation error:', err);
      return detections;
    }
  }

  /**
   * Detect font properties for a specific text detection
   */
  async detectFontProperties(detection: TextDetectionData, file: File, naturalWidth: number, naturalHeight: number): Promise<FontProperties> {
    const [yMin, xMin, yMax, xMax] = detection.box_2d;
    const cropX = xMin * naturalWidth;
    const cropY = yMin * naturalHeight;
    const cropWidth = (xMax - xMin) * naturalWidth;
    const cropHeight = (yMax - yMin) * naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get canvas context");

    // Create image from file and crop it
    const image = new Image();
    const imageDataUrl = URL.createObjectURL(file);
    image.src = imageDataUrl;
    
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    URL.revokeObjectURL(imageDataUrl);

    const cropDataUrl = canvas.toDataURL('image/png');
    const cropBase64Data = cropDataUrl.split(',')[1];
    const croppedImagePart = { inlineData: { mimeType: 'image/png', data: cropBase64Data } };

    // Also get the original full image
    const originalImagePart = await fileToGenerativePart(file);

    const fontList = "Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Roboto, Open Sans, Lato, Montserrat, Nunito, Times New Roman, Georgia, Merriweather, Playfair Display, Source Serif Pro, Courier New, Consolas, Roboto Mono, Poppins, Raleway";
    const prompt = `I'm providing two images: first is the original full image, and second is a cropped section containing specific text. Analyze the text in the cropped section and provide its properties as a JSON object including:
- "fontSize": The font size in pixels.
- "fontFamily": The name of the font family. Choose the closest match from the following list: ${fontList}. If none are a close match, provide another common web font name. Only as a last resort, use a generic description like "serif" or "sans-serif".
- "color": The hex code for the text color.
- "textAlign": The alignment of the text ("left", "center", or "right").

Use the context from the full image to better understand the text styling and make more accurate assessments.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ inlineData: originalImagePart }, croppedImagePart, { text: prompt }] },
      config: {
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fontSize: { type: Type.NUMBER },
            fontFamily: { type: Type.STRING },
            color: { type: Type.STRING },
            textAlign: { type: Type.STRING },
          },
          required: ["fontSize", "fontFamily", "color", "textAlign"]
        }
      }
    });

    const jsonString = response.text.trim();
    const properties = JSON.parse(jsonString);
    return properties;
  }

  /**
   * Remove text from image and return cleaned image as base64 data URL
   */
  async removeTextFromImage(file: File, detections: TextDetectionData[]): Promise<string> {
    const imagePart = await fileToGenerativePart(file);

    // First pass: Remove specific text elements
    const textToRemove = detections.map(d => `"${d.label}"`).join(', ');
    const editPrompt = `IMPORTANT: Remove ONLY the following specific text elements from the image: ${textToRemove}. 

CRITICAL PRESERVATION RULES:
- DO NOT remove any images, photos, illustrations, or visual elements
- DO NOT remove logos, icons, graphics, or decorative elements  
- DO NOT remove borders, frames, backgrounds, or visual design elements
- DO NOT remove colors, patterns, textures, or visual styling
- ONLY remove the exact text content specified above
- Preserve all non-text visual elements completely unchanged
- Fill any removed text areas naturally to match surrounding background/context

Return only the edited image with text removed but all other visual elements preserved.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          { inlineData: imagePart },
          { text: editPrompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let firstPassImage = '';
    let firstPassMimeType = '';

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        firstPassImage = part.inlineData.data;
        firstPassMimeType = part.inlineData.mimeType;
        break;
      }
    }

    if (!firstPassImage) {
      throw new Error("Could not generate the edited image.");
    }

    // Second pass: Check for any remaining text and remove it
    const secondPassPrompt = `Examine this image carefully for any remaining visible text. If you find ANY text still visible, remove it completely while following these STRICT PRESERVATION RULES:

CRITICAL PRESERVATION RULES:
- DO NOT remove any images, photos, illustrations, or visual elements
- DO NOT remove logos, icons, graphics, or decorative elements
- DO NOT remove borders, frames, backgrounds, or visual design elements  
- DO NOT remove colors, patterns, textures, or visual styling
- DO NOT alter any non-text visual elements
- ONLY remove visible text/letters/words/numbers
- Preserve the exact visual composition and design
- Fill removed text areas to match surrounding context naturally

If there is no visible text remaining, return the image completely unchanged. 
If there is text remaining, remove ONLY the text while preserving all other visual elements.

The goal is a completely text-free image with all original visual elements intact.`;

    const secondPassResponse = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: firstPassMimeType, data: firstPassImage } },
          { text: secondPassPrompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    let finalImage = firstPassImage;
    let finalMimeType = firstPassMimeType;

    // Check if second pass returned a new image
    for (const part of secondPassResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        finalImage = part.inlineData.data;
        finalMimeType = part.inlineData.mimeType;
        console.log('Second pass text removal applied');
        break;
      }
    }

    return `data:${finalMimeType};base64,${finalImage}`;
  }
}

// Export singleton instance
export const aiService = new AIService();