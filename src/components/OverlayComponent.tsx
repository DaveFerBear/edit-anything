import React, { useState, useEffect } from 'react';
import { TextDetectionData } from '../services/aiService';

interface OverlayComponentProps {
  boxData: TextDetectionData;
  renderedSize: { width: number; height: number };
  children?: React.ReactNode;
  isBoundingBox?: boolean;
  imageNaturalSize?: { width: number; height: number };
  onTextChange?: (index: number, newText: string) => void;
  textIndex?: number;
  onBoxChange?: (index: number, newBox: [number, number, number, number]) => void;
}

export const OverlayComponent: React.FC<OverlayComponentProps> = ({ 
  boxData, 
  renderedSize, 
  children, 
  isBoundingBox, 
  imageNaturalSize, 
  onTextChange, 
  textIndex, 
  onBoxChange 
}) => {
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
    
    // Apply rotation if detected
    if (boxData.rotation && boxData.rotation !== 0) {
      style.transform = `rotate(${boxData.rotation}deg)`;
      style.transformOrigin = 'center center';
    }

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