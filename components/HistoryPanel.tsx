import React, { useState } from 'react';
import type { GeneratedContent } from '../types';
import { useTranslation } from '../i18n/context';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: GeneratedContent[];
  onUseImage: (imageUrl: string) => void;
  onDownload: (item: GeneratedContent, part: 'primary' | 'secondary' | 'video') => void;
  onClearHistory: () => void;
}

const HistoryItem: React.FC<{
    item: GeneratedContent; 
    onUseImage: (url: string) => void; 
    onDownload: (item: GeneratedContent, part: 'primary' | 'secondary' | 'video') => void; 
    index: number;
    selectionMode: boolean;
    isSelected: boolean;
    onToggleSelect: (index: number) => void;
}> = ({ item, onUseImage, onDownload, index, selectionMode, isSelected, onToggleSelect }) => {
    const { t } = useTranslation();
    const ActionButton: React.FC<{ onClick: (e: React.MouseEvent) => void; children: React.ReactNode; isPrimary?: boolean; }> = ({ onClick, children, isPrimary }) => (
        <button 
            onClick={onClick}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md transition-colors duration-200 ${
                isPrimary 
                ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] shadow-sm shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)]' 
                : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] text-[var(--text-primary)]'
            }`}
        >
            {children}
        </button>
    );
    
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    const renderContent = () => {
        if (item.videoUrl) {
          return (
            <div className="flex flex-col gap-3">
              <video src={item.videoUrl} controls className="rounded-md w-full object-contain bg-[var(--bg-primary)]" onClick={stopPropagation} />
              {!selectionMode && (
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <ActionButton onClick={(e) => { stopPropagation(e); onDownload(item, 'video'); }} isPrimary>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    {t('resultDisplay.actions.download')}
                  </ActionButton>
                </div>
              )}
            </div>
          );
        }

        return (
            <>
                {item.secondaryImageUrl && item.imageUrl ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-2">
                            <img src={item.secondaryImageUrl} className="rounded-md aspect-square object-contain bg-[var(--bg-primary)]" alt="Line Art Result" />
                            <div className="text-xs text-center text-[var(--text-secondary)] mb-1">{t('history.lineArt')}</div>
                            {!selectionMode && (
                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    <ActionButton onClick={(e) => { stopPropagation(e); onUseImage(item.secondaryImageUrl!); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2-2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                        {t('history.use')}
                                    </ActionButton>
                                    <ActionButton onClick={(e) => { stopPropagation(e); onDownload(item, 'secondary'); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        {t('history.save')}
                                    </ActionButton>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <img src={item.imageUrl} className="rounded-md aspect-square object-contain bg-[var(--bg-primary)]" alt="Final Result" />
                            <div className="text-xs text-center text-[var(--text-secondary)] mb-1">{t('history.finalResult')}</div>
                            {!selectionMode && (
                                <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    <ActionButton onClick={(e) => { stopPropagation(e); onUseImage(item.imageUrl!); }} isPrimary>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2-2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                        {t('history.use')}
                                    </ActionButton>
                                    <ActionButton onClick={(e) => { stopPropagation(e); onDownload(item, 'primary'); }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        {t('history.save')}
                                    </ActionButton>
                                </div>
                            )}
                        </div>
                    </div>
                ) : item.imageUrl && (
                    <div className="flex flex-col gap-3">
                        <img src={item.imageUrl} className="rounded-md w-full object-contain bg-[var(--bg-primary)]" alt="Generated Result" />
                         {!selectionMode && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <ActionButton onClick={(e) => { stopPropagation(e); onDownload(item, 'primary'); }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    {t('resultDisplay.actions.download')}
                                </ActionButton>
                                <ActionButton onClick={(e) => { stopPropagation(e); onUseImage(item.imageUrl!); }} isPrimary>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2-2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                    {t('resultDisplay.actions.useAsInput')}
                                </ActionButton>
                            </div>
                        )}
                    </div>
                )}
            </>
        )
    };
    
    return (
        <div 
            className={`relative bg-[var(--bg-secondary)] p-3 rounded-lg border-2 transition-all ${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'border-[var(--accent-primary)]' : 'border-[var(--border-primary)]'}`}
            onClick={selectionMode ? () => onToggleSelect(index) : undefined}
        >
            <div className={selectionMode ? 'opacity-60' : ''}>
                {renderContent()}
            </div>
             {selectionMode && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--bg-card)] border-2 flex items-center justify-center pointer-events-none" style={{ borderColor: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]"></div>}
                </div>
            )}
        </div>
    );
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, history, onUseImage, onDownload, onClearHistory }) => {
  const { t } = useTranslation();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const handleToggleSelection = (index: number) => {
    setSelectedIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === history.length) {
        setSelectedIndices(new Set());
    } else {
        setSelectedIndices(new Set(history.map((_, i) => i)));
    }
  };

  const handleCancel = () => {
    setSelectionMode(false);
    setSelectedIndices(new Set());
  };

  const handleDownloadSelected = () => {
    if (selectedIndices.size === 0) return;
    let delay = 0;
    history.forEach((item, index) => {
        if (selectedIndices.has(index)) {
            if (item.imageUrl) {
                setTimeout(() => onDownload(item, 'primary'), delay);
                delay += 300;
            }
            if (item.secondaryImageUrl) {
                setTimeout(() => onDownload(item, 'secondary'), delay);
                delay += 300;
            }
            if (item.videoUrl) {
                setTimeout(() => onDownload(item, 'video'), delay);
                delay += 300;
            }
        }
    });
    handleCancel();
  };
  
  // FIX: Explicitly added `children` to the props type for compatibility with newer versions of `@types/react`
  // where `React.FC` no longer implicitly includes the `children` prop.
  const HeaderButton: React.FC<{onClick:()=>any, disabled?: boolean, isDanger?:boolean, children: React.ReactNode}> = ({ onClick, children, disabled=false, isDanger=false }) => (
      <button 
        onClick={onClick} 
        disabled={disabled}
        className={`py-1 px-3 text-xs font-semibold rounded-md transition-colors duration-200 ${isDanger ? 'text-red-400 hover:bg-red-500/20' : 'text-[var(--text-primary)] hover:bg-[rgba(107,114,128,0.2)]'} disabled:opacity-50 disabled:cursor-not-allowed`}
      >{children}</button>
  );

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-primary)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 border-b border-[var(--border-primary)] flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-semibold text-[var(--accent-primary)]">{t('history.title')}</h2>
          <div className="flex items-center gap-2">
            {!selectionMode && (
                <>
                    <HeaderButton onClick={() => onClearHistory()} disabled={history.length === 0} isDanger={true}>{t('history.clear')}</HeaderButton>
                    <HeaderButton onClick={() => setSelectionMode(true)} disabled={history.length === 0}>{t('history.select')}</HeaderButton>
                </>
            )}
            <button onClick={onClose} className="p-1 rounded-full text-[var(--text-secondary)] hover:bg-[rgba(107,114,128,0.2)] hover:text-[var(--text-primary)] transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {selectionMode && (
            <div className="p-3 border-b border-[var(--border-primary)] flex-shrink-0 flex justify-between items-center bg-[var(--bg-secondary)]">
                <HeaderButton onClick={handleSelectAll}>
                    {selectedIndices.size === history.length ? t('history.deselectAll') : t('history.selectAll')}
                </HeaderButton>
                 <div className="flex items-center gap-2">
                    <HeaderButton onClick={handleDownloadSelected} disabled={selectedIndices.size === 0}>
                        {`${t('history.downloadSelected')} (${selectedIndices.size})`}
                    </HeaderButton>
                    <HeaderButton onClick={handleCancel} isDanger={true}>{t('history.cancel')}</HeaderButton>
                </div>
            </div>
        )}
        
        <div className="flex-grow overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center text-[var(--text-tertiary)] pt-10 flex flex-col items-center gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p>{t('history.empty')}</p>
            </div>
          ) : (
             <div className="space-y-4">
                {history.map((item, index) => (
                    <HistoryItem 
                        key={item.id || index} 
                        item={item} 
                        onUseImage={onUseImage} 
                        onDownload={onDownload} 
                        index={index}
                        selectionMode={selectionMode}
                        isSelected={selectedIndices.has(index)}
                        onToggleSelect={handleToggleSelection}
                    />
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;