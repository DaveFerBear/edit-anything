
import React, { useState, useEffect, useRef } from 'react';
import { aiService, TextDetectionData } from './src/services/aiService';

type AppStep = 'upload' | 'processing' | 'result' | 'recomposed';

// --- HELPER FUNCTIONS & COMPONENTS ---

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

const OverlayComponent = ({ boxData, renderedSize, children, isBoundingBox, imageNaturalSize, onTextChange, textIndex, onBoxChange }: { boxData: TextDetectionData, renderedSize: { width: number, height: number }, children?: React.ReactNode, isBoundingBox?: boolean, imageNaturalSize?: { width: number, height: number }, onTextChange?: (index: number, newText: string) => void, textIndex?: number, onBoxChange?: (index: number, newBox: [number, number, number, number]) => void }) => {
    const { box_2d } = boxData;
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

        className += " flex items-center p-1 leading-tight break-words cursor-text hover:border-2 hover:border-blue-400 hover:bg-blue-50/20 transition-all duration-75 pointer-events-auto group";
        
        if (boxData.textAlign === 'left') {
            style.justifyContent = 'flex-start';
        } else if (boxData.textAlign === 'right') {
            style.justifyContent = 'flex-end';
        } else {
            style.justifyContent = 'center';
        }
    }

    const handleTextEdit = (e: React.FocusEvent<HTMLDivElement>) => {
        if (onTextChange && textIndex !== undefined) {
            const newText = e.target.innerText;
            onTextChange(textIndex, newText);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    const handleDragMouseDown = (e: React.MouseEvent) => {
        if (!onBoxChange || textIndex === undefined || isBoundingBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if ((!isDragging && !isResizing) || !onBoxChange || textIndex === undefined) return;

        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        const normalizedDeltaX = deltaX / renderedSize.width;
        const normalizedDeltaY = deltaY / renderedSize.height;

        const [yMin, xMin, yMax, xMax] = box_2d;

        if (isDragging) {
            // Move the entire box
            const newBox: [number, number, number, number] = [
                Math.max(0, Math.min(1, yMin + normalizedDeltaY)),
                Math.max(0, Math.min(1, xMin + normalizedDeltaX)),
                Math.max(0, Math.min(1, yMax + normalizedDeltaY)),
                Math.max(0, Math.min(1, xMax + normalizedDeltaX))
            ];
            onBoxChange(textIndex, newBox);
        } else if (isResizing) {
            // Resize the box (bottom-right corner)
            const newBox: [number, number, number, number] = [
                yMin,
                xMin,
                Math.max(yMin + 0.05, Math.min(1, yMax + normalizedDeltaY)),
                Math.max(xMin + 0.05, Math.min(1, xMax + normalizedDeltaX))
            ];
            onBoxChange(textIndex, newBox);
        }

        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
    };

    useEffect(() => {
        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart]);

    const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
        if (!onBoxChange || textIndex === undefined || isBoundingBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const isEditable = !isBoundingBox && onTextChange !== undefined;
    const isDraggable = !isBoundingBox && onBoxChange !== undefined;

    return (
      <div 
        className={className} 
        style={style}
        contentEditable={isEditable}
        suppressContentEditableWarning={true}
        onBlur={handleTextEdit}
        onKeyDown={handleKeyDown}
      >
        {children}
        
        {isDraggable && (
          <>
            {/* Resize handle - bottom right */}
            <div
              className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity duration-75"
              onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            />
            {/* Drag handle - top left */}
            <div
              className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-move opacity-0 group-hover:opacity-100 transition-opacity duration-75"
              onMouseDown={handleDragMouseDown}
            />
          </>
        )}
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

  const handleTextChange = (index: number, newText: string) => {
    setTextDetections(prev => prev.map((detection, i) => 
      i === index ? { ...detection, label: newText } : detection
    ));
  };

  const handleBoxChange = (index: number, newBox: [number, number, number, number]) => {
    setTextDetections(prev => prev.map((detection, i) => 
      i === index ? { ...detection, box_2d: newBox } : detection
    ));
  };

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
          // Detect text in the image
          console.log('Detecting text...');
          const detectionResult = await aiService.detectText(selectedFile);
          console.log('Detection Results:', detectionResult);
          
          // Automatically run consolidation after text detection
          console.log('Running automatic consolidation...');
          const consolidatedResult = await aiService.consolidateDetections(detectionResult, selectedFile);
          console.log('Consolidation Results:', consolidatedResult);
          
          setTextDetections(consolidatedResult);
          setStep('result');

      } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "An error occurred while detecting text. Please try again.";
          setError(errorMessage);
          setStep('result');
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
                try {
                    const properties = await aiService.detectFontProperties(detection, selectedFile, naturalWidth, naturalHeight);
                    console.log(`[VLM Property Detection] Box ${index} ("${detection.label}"):`, properties);
                    return properties;
                } catch (err) {
                    console.error(`Error detecting properties for box ${index}:`, err);
                    return {
                        fontSize: 16,
                        fontFamily: 'sans-serif',
                        color: detection.color,
                        textAlign: 'center'
                    };
                }
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
        const cleanedImageUrl = await aiService.removeTextFromImage(selectedFile, currentDetections);

        if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
        }
        setImageRenderedSize({ width: 0, height: 0 });
        setPreviewUrl(cleanedImageUrl);
        setStep('recomposed');
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : "An error occurred during decomposition. Please try again.";
        setError(errorMessage);
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
                            onTextChange={handleTextChange}
                            onBoxChange={handleBoxChange}
                            textIndex={index}
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
