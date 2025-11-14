
import React, { useRef, useCallback, useState } from 'react';
import { useTranslation } from '../i18n/context';

interface BatchInputDisplayProps {
  items: { file: File; dataUrl: string }[];
  onAddFiles: (files: FileList) => void;
  onRemoveItem: (index: number) => void;
  onClearAll: () => void;
}

const BatchInputDisplay: React.FC<BatchInputDisplayProps> = ({ items, onAddFiles, onRemoveItem, onClearAll }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onAddFiles(e.target.files);
      // Reset input to allow re-selecting the same file
      e.target.value = ''; 
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files?.length > 0) {
      onAddFiles(event.dataTransfer.files);
    }
  }, [onAddFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in-fast">
      <h3 className="text-lg font-semibold text-[var(--text-secondary)]">{t('batch.title')}</h3>
      
      <div 
        className={`grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] min-h-[100px] transition-colors ${isDragging ? 'outline-dashed outline-2 outline-[var(--accent-primary)]' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {items.map((item, index) => (
          <div key={`${item.file.name}-${index}`} className="relative group aspect-square">
            <img src={item.dataUrl} alt={item.file.name} className="w-full h-full object-cover rounded-md" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button 
                onClick={() => onRemoveItem(index)} 
                className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                aria-label="Remove image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-[var(--text-tertiary)]">
        {t('batch.dropzone')}{' '}
        <button onClick={handleAddClick} className="font-semibold text-[var(--accent-primary)] hover:underline">
          {t('batch.clickToAdd')}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={onClearAll}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]"
        >
          {t('batch.clearAll')}
        </button>
        <button
          onClick={handleAddClick}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]"
        >
          {t('batch.addMore')}
        </button>
      </div>
      <input 
        type="file" 
        multiple 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        className="hidden" 
      />
    </div>
  );
};

export default BatchInputDisplay;
