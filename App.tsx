
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// --- TYPE DEFINITIONS ---
type TextDetectionData = {
  label: string;
  box_2d: [number, number, number, number]; // [yMin, xMin, yMax, xMax] (Normalized 0-1)
  color: string;
  // New optional properties for detected text styles
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
};

type AppStep = 'upload' | 'processing' | 'result' | 'recomposed';

// --- HELPER FUNCTIONS & COMPONENTS ---

const fileToGenerativePart = (file: File) => {
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

const UploadIcon = () => (
  <svg className="w-12 h-12 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
  </svg>
);

const XCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const Spinner = () => (
    <svg className="animate-spin mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const OverlayComponent = ({ boxData, renderedSize, children, isBoundingBox, imageNaturalSize }: { boxData: TextDetectionData, renderedSize: { width: number, height: number }, children?: React.ReactNode, isBoundingBox?: boolean, imageNaturalSize?: { width: number, height: number } }) => {
    const { box_2d } = boxData;

    if (!box_2d || box_2d.length < 4 || renderedSize.width === 0 || renderedSize.height === 0) {
        return null;
    }
    
    const [yMin, xMin, yMax, xMax] = box_2d;

    const top = yMin * renderedSize.height;
    const left = xMin * renderedSize.width;
    const height = (yMax - yMin) * renderedSize.height;
    const width = (xMax - xMin) * renderedSize.width;
    
    let style: React.CSSProperties = {
        top: `${top}px`,
        left: `${left}px`,
        height: `${height}px`,
        width: `${width}px`,
        whiteSpace: 'pre-wrap', // Allows text with newlines to wrap correctly
    };

    let className = "absolute pointer-events-none rounded-sm";

    if (isBoundingBox) {
        const borderColor = boxData.color || '#34D399';
        style.borderColor = borderColor;
        style.backgroundColor = borderColor + '33';
        className += " border-2";
    } else {
        // Text box styling for 'recomposed' step
        const scaleFactor = imageNaturalSize && imageNaturalSize.width > 0 ? renderedSize.width / imageNaturalSize.width : 1;
        style.fontSize = boxData.fontSize ? `${boxData.fontSize * scaleFactor}px` : '1em';
        style.fontFamily = boxData.fontFamily || 'sans-serif';
        style.textAlign = boxData.textAlign as React.CSSProperties['textAlign'] || 'center';
        style.color = boxData.color;

        className += " flex items-center p-1 leading-tight break-words";
        
        if (boxData.textAlign === 'left') {
            style.justifyContent = 'flex-start';
        } else if (boxData.textAlign === 'right') {
            style.justifyContent = 'flex-end';
        } else {
            style.justifyContent = 'center';
        }
    }

    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<AppStep>('upload');
  const [textDetections, setTextDetections] = useState<TextDetectionData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageRenderedSize, setImageRenderedSize] = useState({ width: 0, height: 0 });
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decompositionStatus, setDecompositionStatus] = useState('');
  
  const imageRef = useRef<HTMLImageElement>(null);
  const imageNaturalSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const imageEl = imageRef.current;

    const updateRenderedSize = () => {
        if (imageEl && imageEl.clientWidth > 0) {
            setImageRenderedSize({ width: imageEl.clientWidth, height: imageEl.clientHeight });
            if (imageEl.naturalWidth > 0) {
                 imageNaturalSizeRef.current = { width: imageEl.naturalWidth, height: imageEl.naturalHeight };
            }
        } else {
            setImageRenderedSize({ width: 0, height: 0 });
        }
    };

    if (imageEl) {
        if (imageEl.complete) {
            updateRenderedSize();
        }
        imageEl.addEventListener('load', updateRenderedSize);
        window.addEventListener('resize', updateRenderedSize);
    }

    return () => {
        if (imageEl) {
            imageEl.removeEventListener('load', updateRenderedSize);
        }
        window.removeEventListener('resize', updateRenderedSize);
    };
  }, [previewUrl]);

  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setStep('upload');
    setTextDetections([]);
    setError(null);
    setImageRenderedSize({ width: 0, height: 0 });
    imageNaturalSizeRef.current = { width: 0, height: 0 };
    setIsDecomposing(false);
    setDecompositionStatus('');
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) {
        fileInput.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleReset();
      setSelectedFile(file);
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
    } else {
        alert('Please select a valid image file.');
    }
  };

  const handleSubmit = async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!selectedFile) {
          alert("Please select a file first.");
          return;
      }

      setStep('processing');
      setError(null);
      setTextDetections([]);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const imagePart = await fileToGenerativePart(selectedFile);

          const textPrompt = `
          Output a json list where each entry contains the 2D bounding box in "box_2d", the text content in "label", and the text color in "color". The bounding box coordinates should be normalized to the image dimensions (0-1000).
          Here's what the response should look like: { "box_2d": [68, 75, 322, 408], "label": "Start working out now", "color": "#0055b3" }
          `;

          const response = await ai.models.generateContent({
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
              const normalizedResult = result.map(item => ({
                  ...item,
                  box_2d: item.box_2d.map((val: number) => val / 1000) 
              }));
              console.log('Detection Results:', normalizedResult);
              
              // Automatically run consolidation after text detection
              console.log('Running automatic consolidation...');
              const consolidatedResult = await consolidateDetections(normalizedResult, selectedFile);
              console.log('Consolidation Results:', consolidatedResult);
              
              setTextDetections(consolidatedResult);
              setStep('result');
          } else {
               setError("No text could be detected in the image. Please try another one.");
               setStep('result');
          }

      } catch (err) {
          console.error(err);
          setError("An error occurred while detecting text. Please try again.");
          setStep('upload');
      }
  };

  const consolidateDetections = async (detections: TextDetectionData[], file: File): Promise<TextDetectionData[]> => {
    if (detections.length === 0) {
      return detections;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        
        const response = await ai.models.generateContent({
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
            
            if(boxesToMerge.some(b => !b)) continue;

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
  };

  
  const handleDecompose = async () => {
    if (!selectedFile || textDetections.length === 0) {
      setError("No text was detected to decompose.");
      return;
    }

    setIsDecomposing(true);
    setError(null);

    try {
        // --- Step 1: Detect Properties (if not already done) ---
        const hasProperties = textDetections.every(d => d.fontSize !== undefined);
        let currentDetections = [...textDetections];

        if (!hasProperties && previewUrl) {
            setDecompositionStatus("Analyzing text properties...");

            const image = new Image();
            image.src = previewUrl;
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });
            const { naturalWidth, naturalHeight } = image;

            const propertyPromises = textDetections.map(async (detection, index) => {
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
                ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
                
                const cropDataUrl = canvas.toDataURL('image/png');
                const cropBase64Data = cropDataUrl.split(',')[1];
                const croppedImagePart = { inlineData: { mimeType: 'image/png', data: cropBase64Data } };
                
                // Also get the original full image
                const originalImagePart = await fileToGenerativePart(selectedFile);

                const fontList = "Arial, Helvetica, Verdana, Tahoma, Trebuchet MS, Roboto, Open Sans, Lato, Montserrat, Nunito, Times New Roman, Georgia, Merriweather, Playfair Display, Source Serif Pro, Courier New, Consolas, Roboto Mono, Poppins, Raleway";
                const prompt = `I'm providing two images: first is the original full image, and second is a cropped section containing specific text. Analyze the text in the cropped section and provide its properties as a JSON object including:
- "fontSize": The font size in pixels.
- "fontFamily": The name of the font family. Choose the closest match from the following list: ${fontList}. If none are a close match, provide another common web font name. Only as a last resort, use a generic description like "serif" or "sans-serif".
- "color": The hex code for the text color.
- "textAlign": The alignment of the text ("left", "center", or "right").

Use the context from the full image to better understand the text styling and make more accurate assessments.`;
                
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
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
                console.log(`[VLM Property Detection] Box ${index} ("${detection.label}"):`, properties);
                return properties;
            });

            const allProperties = await Promise.all(propertyPromises);
            const updatedDetections = textDetections.map((detection, index) => ({
                ...detection,
                ...allProperties[index],
            }));

            setTextDetections(updatedDetections);
            currentDetections = updatedDetections;
        }

        // --- Step 2: Remove Text from Image ---
        setDecompositionStatus("Removing text from image...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const imagePart = await fileToGenerativePart(selectedFile);

        const textToRemove = currentDetections.map(d => `"${d.label}"`).join(', ');
        const editPrompt = `Please remove the following text elements from the image: ${textToRemove}. Return only the edited image.`;
        
        const response = await ai.models.generateContent({
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

        let foundImage = false;
        let firstPassImage = '';
        let firstPassMimeType = '';
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes = part.inlineData.data;
                const mimeType = part.inlineData.mimeType;
                firstPassImage = base64ImageBytes;
                firstPassMimeType = mimeType;
                foundImage = true;
                break;
            }
        }

        if (!foundImage) {
            setError("Decomposition failed. Could not generate the edited image.");
            setStep('result');
            return;
        }

        // Second pass: Check if any text remains and remove it
        setDecompositionStatus("Checking for remaining text...");
        
        const secondPassPrompt = `Examine this image carefully. If there is any visible text remaining in the image, remove it completely and return the cleaned image. If there is no visible text at all, return the image unchanged. The goal is to ensure the image is completely text-free.`;
        
        const secondPassResponse = await ai.models.generateContent({
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

        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setImageRenderedSize({ width: 0, height: 0 });
        setPreviewUrl(`data:${finalMimeType};base64,${finalImage}`);
        setStep('recomposed');
    } catch (err) {
        console.error(err);
        setError("An error occurred during decomposition. Please try again.");
        setStep('result');
    } finally {
        setIsDecomposing(false);
        setDecompositionStatus('');
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const getButton = () => {
    const anyProcessRunning = isDecomposing;

    switch (step) {
      case 'processing':
        return (
          <button 
            disabled
            className="w-full max-w-md bg-blue-800 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg flex items-center justify-center transition-all duration-300 ease-in-out"
          >
            <Spinner />
            Detecting Text...
          </button>
        );
      case 'recomposed':
        return (
            <button
                onClick={handleReset}
                className="w-full max-w-md bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
            >
                Start Over
            </button>
        );
      case 'result':
        return (
            <div className="w-full max-w-md flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={handleDecompose}
                        disabled={anyProcessRunning}
                        className="flex-1 bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isDecomposing && <Spinner />}
                        {isDecomposing ? (decompositionStatus || 'Decomposing...') : 'Decompose'}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={anyProcessRunning}
                        className="flex-1 bg-gray-600 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        Re-run Detection
                    </button>
                </div>
            </div>
        );
      case 'upload':
      default:
        return (
            <button 
                onClick={handleSubmit} 
                className="w-full max-w-md bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300 ease-in-out transform hover:-translate-y-1"
            >
                Submit
            </button>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-xl p-8 text-center transition-all duration-300 ease-in-out hover:border-blue-500 hover:bg-gray-700/50 relative">
          {!selectedFile ? (
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
              <UploadIcon />
              <p className="mb-2 text-xl font-semibold text-gray-300">
                <span className="font-bold text-blue-400">Click to upload</span> or drag and drop
              </p>
              <p className="text-lg text-gray-500">Upload an image for decomposition</p>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="flex flex-col items-center gap-6">
                <div 
                    className="relative w-full max-w-md"
                >
                    <img 
                      ref={imageRef} 
                      src={previewUrl!} 
                      alt="Image preview" 
                      className="rounded-lg shadow-2xl w-full h-auto block"
                    />
                    {imageRenderedSize.width > 0 && step === 'result' && textDetections.map((boxData, index) => (
                       <OverlayComponent key={index} boxData={boxData} renderedSize={imageRenderedSize} isBoundingBox />
                    ))}
                     {imageRenderedSize.width > 0 && step === 'recomposed' && textDetections.map((boxData, index) => (
                        <OverlayComponent 
                            key={index} 
                            boxData={boxData} 
                            renderedSize={imageRenderedSize}
                            imageNaturalSize={imageNaturalSizeRef.current}
                        >
                           {boxData.label}
                        </OverlayComponent>
                    ))}
                    <button 
                        onClick={handleReset} 
                        className="absolute -top-3 -right-3 p-1.5 bg-gray-800 text-white rounded-full hover:bg-red-600 hover:scale-110 transition-all duration-200 shadow-lg"
                        aria-label="Remove image"
                    >
                       <XCircleIcon />
                    </button>
                </div>
                {error && <p className="text-red-400 text-center">{error}</p>}
                {getButton()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
