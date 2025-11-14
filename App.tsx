import React, { useState, useCallback, useEffect } from 'react';
import { TRANSFORMATIONS } from './constants';
import { editImage, generateVideo, generateImage } from './services/geminiService';
import type { GeneratedContent, Transformation, InputItem } from './types';
import TransformationSelector from './components/TransformationSelector';
import ResultDisplay from './components/ResultDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import StatusMessage from './components/StatusMessage';
import ImageEditorCanvas from './components/ImageEditorCanvas';
import { dataUrlToFile, embedWatermark, loadImage, resizeImageToMatch, downloadImage } from './utils/fileUtils';
import { getAllGenerations, addGeneration, clearAllHistory } from './utils/db';
import ImagePreviewModal from './components/ImagePreviewModal';
import MultiImageUploader from './components/MultiImageUploader';
import HistoryPanel from './components/HistoryPanel';
import { useTranslation } from './i18n/context';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeSwitcher from './components/ThemeSwitcher';
import BatchInputDisplay from './components/BatchInputDisplay';
import PromptOptions from './components/PromptOptions';
import VirtualTryOnAutoUploader from './components/VirtualTryOnFinalUploader'; // Will contain the new Auto component

type ActiveTool = 'mask' | 'none';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [transformations, setTransformations] = useState<Transformation[]>(() => {
    try {
      const savedOrder = localStorage.getItem('transformationOrder');
      if (savedOrder) {
        const orderedKeys = JSON.parse(savedOrder) as string[];
        const transformationMap = new Map(TRANSFORMATIONS.map(t => [t.key, t]));
        
        const orderedTransformations = orderedKeys
          .map(key => transformationMap.get(key))
          .filter((t): t is Transformation => !!t);

        const savedKeysSet = new Set(orderedKeys);
        const newTransformations = TRANSFORMATIONS.filter(t => !savedKeysSet.has(t.key));
        
        return [...orderedTransformations, ...newTransformations];
      }
    } catch (e) {
      console.error("Failed to load or parse transformation order from localStorage", e);
    }
    return TRANSFORMATIONS;
  });

  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | null>(null);
  const [inputItems, setInputItems] = useState<InputItem[]>([]);
  const [multiInputItems, setMultiInputItems] = useState<(InputItem | null)[]>([]);
  const [secondaryImageUrl, setSecondaryImageUrl] = useState<string | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<{success: number, fail: number} | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [promptOptions, setPromptOptions] = useState<Record<string, string>>({});
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [activeTool, setActiveTool] = useState<ActiveTool>('none');
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<Transformation | null>(null);
  
  useEffect(() => {
    try {
      const orderToSave = transformations.map(t => t.key);
      localStorage.setItem('transformationOrder', JSON.stringify(orderToSave));
    } catch (e) {
      console.error("Failed to save transformation order to localStorage", e);
    }
  }, [transformations]);
  
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const dbHistory = await getAllGenerations();
        setHistory(dbHistory);
      } catch (err) {
        console.error("Failed to load history from IndexedDB", err);
        setError(t('app.error.historyLoadFailed'));
      }
    };
    loadHistory();
  }, [t]);

  useEffect(() => {
    return () => {
        history.forEach(item => {
            if (item.videoUrl) {
                URL.revokeObjectURL(item.videoUrl);
            }
        });
        if (generatedContent?.videoUrl) {
            URL.revokeObjectURL(generatedContent.videoUrl);
        }
    };
  }, [history, generatedContent]);

  const handleSelectTransformation = (transformation: Transformation) => {
    setSelectedTransformation(transformation);
    setGeneratedContent(null);
    setError(null);
    setBatchResult(null);
    if (transformation.prompt !== 'CUSTOM') {
      setCustomPrompt('');
    }
    setPromptOptions({});
    
    if (transformation.multiImageInputs) {
        setMultiInputItems(Array(transformation.multiImageInputs.length).fill(null));
    } else {
        setMultiInputItems([]);
    }

    if (inputItems.length > 1 && !(transformation.supportsBatch ?? true)) {
        setError(t('app.error.batchNotSupported'));
        setInputItems([]);
    }
  };
  
  const handleAddToHistory = async (content: Omit<GeneratedContent, 'id'>) => {
    try {
      const itemToStore = {
        imageUrl: content.imageUrl,
        text: content.text,
        secondaryImageUrl: content.secondaryImageUrl,
        originalFilename: content.originalFilename,
      };
      const newId = await addGeneration(itemToStore);
      setHistory(prev => [{ ...content, id: newId }, ...prev]);
    } catch (dbErr) {
      console.error("Failed to save to history DB from auto uploader", dbErr);
      setError('Failed to save result to history.');
    }
  };

  const handleImagesSelect = useCallback(async (files: FileList) => {
    if (!selectedTransformation) return;

    if (files.length > 1 && !(selectedTransformation.supportsBatch ?? true)) {
      setError(t('app.error.batchNotSupported'));
      return;
    }

    const newItems: InputItem[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const promise = new Promise<InputItem>((resolve) => {
        reader.onload = (e) => {
          resolve({ file, dataUrl: e.target?.result as string, name: file.name });
        };
      });
      reader.readAsDataURL(file);
      newItems.push(await promise);
    }
    
    setInputItems(prev => [...prev, ...newItems]);
    setGeneratedContent(null);
    setError(null);
    setBatchResult(null);
    setMaskDataUrl(null);
    setActiveTool('none');
  }, [selectedTransformation, t]);
  
  const handleMultiItemChange = useCallback((index: number, file: File | null, dataUrl: string | null) => {
      setMultiInputItems(prev => {
          const newItems = [...prev];
          if (file && dataUrl) {
              newItems[index] = { file, dataUrl, name: file.name };
          } else {
              newItems[index] = null;
          }
          return newItems;
      });
      setGeneratedContent(null);
      setError(null);
  }, []);

  const handleSecondaryImageSelect = useCallback((file: File, dataUrl: string) => {
    setSecondaryFile(file);
    setSecondaryImageUrl(dataUrl);
    setGeneratedContent(null);
    setError(null);
    setBatchResult(null);
  }, []);
  
  const handleClearInputItems = () => {
    setInputItems([]);
    setGeneratedContent(null);
    setError(null);
    setBatchResult(null);
    setMaskDataUrl(null);
    setActiveTool('none');
  };
  
  const handleClearSecondaryImage = () => {
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
  };
  
  const buildPrompt = useCallback((transformation: Transformation, currentOptions: Record<string, string>): string => {
    if (transformation.prompt === 'CUSTOM') return customPrompt;

    if (!transformation.promptTemplate || !transformation.options) {
        return transformation.prompt || '';
    }

    let finalPrompt = transformation.promptTemplate;
    
    transformation.options.forEach(optionConfig => {
        const placeholder = `{${optionConfig.key}}`;
        let selectedValueKey = currentOptions[optionConfig.key] || 'random';
        let replacementText = '';

        if (selectedValueKey === 'random') {
            const randomIndex = Math.floor(Math.random() * optionConfig.values.length);
            replacementText = optionConfig.values[randomIndex].valueKey;
        } else {
            const selectedOption = optionConfig.values.find(v => v.valueKey === selectedValueKey);
            replacementText = selectedOption ? selectedOption.valueKey : optionConfig.values[0].valueKey; // Fallback to first
        }
        
        finalPrompt = finalPrompt.replace(new RegExp(placeholder, 'g'), replacementText);
    });

    return finalPrompt;
  }, [customPrompt]);

  const handleGenerateVideo = useCallback(async () => {
    if (!selectedTransformation) return;

    const promptToUse = customPrompt;
    if (!promptToUse.trim()) {
        setError(t('app.error.enterPrompt'));
        return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);
    setGeneratedContent(null);

    try {
        let imagePayload = null;
        let originalFilename: string | undefined = undefined;
        if (inputItems.length > 0) {
            const primaryImageUrl = inputItems[0].dataUrl;
            originalFilename = inputItems[0].name;
            const primaryMimeType = primaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
            const primaryBase64 = primaryImageUrl.split(',')[1];
            imagePayload = { base64: primaryBase64, mimeType: primaryMimeType };
        }

        const videoBlob = await generateVideo(
            promptToUse,
            imagePayload,
            aspectRatio,
            (message) => setLoadingMessage(message)
        );
        
        const objectUrl = URL.createObjectURL(videoBlob);
        
        const id = await addGeneration({ text: null, videoBlob: videoBlob, originalFilename });
        const result: GeneratedContent = { id, imageUrl: null, text: null, videoUrl: objectUrl, originalFilename };

        setGeneratedContent(result);
        setHistory(prev => [result, ...prev]);

    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : t('app.error.unknown'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [selectedTransformation, customPrompt, inputItems, aspectRatio, t]);
  
  const handleGenerateFromPrompt = useCallback(async () => {
    if (!selectedTransformation) return;

    setIsLoading(true);
    setError(null);
    setGeneratedContent(null);
    setBatchResult(null);
    setLoadingMessage(t('app.loading.default'));

    try {
        const promptToUse = buildPrompt(selectedTransformation, promptOptions);
        const result = await generateImage(promptToUse);

        if (result.imageUrl) {
            result.imageUrl = await embedWatermark(result.imageUrl, "Nano Bananary｜ZHO");
        }

        const resultToSave = { ...result, originalFilename: `generated-${selectedTransformation.key}-${Date.now()}.png` };
        const newId = await addGeneration({ imageUrl: resultToSave.imageUrl, text: resultToSave.text, originalFilename: resultToSave.originalFilename });
        
        const finalResult = { ...resultToSave, id: newId };
        setGeneratedContent(finalResult);
        setHistory(prev => [finalResult, ...prev]);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('app.error.unknown'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [selectedTransformation, promptOptions, buildPrompt, t]);

  const handleGenerateImage = useCallback(async () => {
    if ((inputItems.length === 0 && !selectedTransformation?.multiImageInputs) || !selectedTransformation) {
        setError(t('app.error.uploadAndSelect'));
        return;
    }
    if (selectedTransformation.isMultiImage && !selectedTransformation.isSecondaryOptional && !secondaryImageUrl) {
        setError(t('app.error.uploadBoth'));
        return;
    }
    
    const isCustom = selectedTransformation.prompt === 'CUSTOM';
    if (isCustom && !customPrompt.trim()) {
        setError(t('app.error.enterPrompt'));
        return;
    }

    setIsLoading(true);
    setError(null);
    setBatchResult(null);
    setGeneratedContent(null);
    setLoadingMessage('');

    // BATCH MODE
    if (inputItems.length > 1) {
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < inputItems.length; i++) {
            const item = inputItems[i];
            setLoadingMessage(t('app.generatingBatch', { current: i + 1, total: inputItems.length }));
            try {
                const promptToUse = buildPrompt(selectedTransformation, promptOptions);
                const primaryMimeType = item.dataUrl.split(';')[0].split(':')[1] ?? 'image/png';
                const primaryBase64 = item.dataUrl.split(',')[1];
                const imagesPayload = [{ base64: primaryBase64, mimeType: primaryMimeType }];
                let result = await editImage(imagesPayload, promptToUse, null);
                if (result.imageUrl) {
                    result.imageUrl = await embedWatermark(result.imageUrl, "Nano Bananary｜ZHO");
                }
                const resultToSave = { ...result, originalFilename: item.name };
                const newId = await addGeneration({ imageUrl: resultToSave.imageUrl, text: resultToSave.text, originalFilename: item.name });
                setHistory(prev => [{ ...resultToSave, id: newId }, ...prev]);
                successCount++;
            } catch (err) {
                console.error(`Failed to process image ${i + 1} (${item.file.name}):`, err);
                failCount++;
            }
        }
        setBatchResult({ success: successCount, fail: failCount });
        setIsLoading(false);
        setLoadingMessage('');
        setInputItems([]);
        return;
    }

    // SINGLE IMAGE / MULTI-IMAGE MODE
    try {
        const promptToUse = buildPrompt(selectedTransformation, promptOptions);
        if (!isCustom && !promptToUse.trim() && !selectedTransformation.multiImageInputs) {
            setError(t('app.error.enterPrompt'));
            setIsLoading(false);
            return;
        }

        const maskBase64 = maskDataUrl ? maskDataUrl.split(',')[1] : null;

        if (selectedTransformation.isTwoStep) {
            const primaryInput = inputItems[0];
            const primaryImageUrl = primaryInput.dataUrl;
            const originalFilename = primaryInput.name;
            const primaryMimeType = primaryImageUrl!.split(';')[0].split(':')[1] ?? 'image/png';
            const primaryBase64 = primaryImageUrl!.split(',')[1];
            
            setLoadingMessage(t('app.loading.step1'));
            const stepOneResult = await editImage([{ base64: primaryBase64, mimeType: primaryMimeType }], promptToUse, null);

            if (!stepOneResult.imageUrl) throw new Error("Step 1 (line art) failed to generate an image.");

            setLoadingMessage(t('app.loading.step2'));
            const stepOneImageBase64 = stepOneResult.imageUrl.split(',')[1];
            const stepOneImageMimeType = stepOneResult.imageUrl.split(';')[0].split(':')[1] ?? 'image/png';

            const stepOneImagePayload = { base64: stepOneImageBase64, mimeType: stepOneImageMimeType };
            const imagesForStep2 = [stepOneImagePayload];

            if (secondaryImageUrl) {
                const primaryImage = await loadImage(primaryImageUrl);
                const resizedSecondaryImageUrl = await resizeImageToMatch(secondaryImageUrl, primaryImage);
                const secondaryMimeType = resizedSecondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
                const secondaryBase64 = resizedSecondaryImageUrl.split(',')[1];
                imagesForStep2.push({ base64: secondaryBase64, mimeType: secondaryMimeType });
            }

            const stepTwoResult = await editImage(imagesForStep2, selectedTransformation.stepTwoPrompt!, null);
            
            if (stepTwoResult.imageUrl) {
                stepTwoResult.imageUrl = await embedWatermark(stepTwoResult.imageUrl, "Nano Bananary｜ZHO");
            }

            const resultToSave = { ...stepTwoResult, secondaryImageUrl: stepOneResult.imageUrl, originalFilename };
            const newId = await addGeneration({ imageUrl: resultToSave.imageUrl, secondaryImageUrl: resultToSave.secondaryImageUrl, text: resultToSave.text, originalFilename });
            
            const finalResult = { ...resultToSave, id: newId };
            setGeneratedContent(finalResult);
            setHistory(prev => [finalResult, ...prev]);

        } else {
            const primaryInput = inputItems[0];
            const primaryImageUrl = primaryInput.dataUrl;
            const originalFilename = primaryInput.name;
            const primaryMimeType = primaryImageUrl!.split(';')[0].split(':')[1] ?? 'image/png';
            const primaryBase64 = primaryImageUrl!.split(',')[1];
            
            const imagesPayload = [{ base64: primaryBase64, mimeType: primaryMimeType }];
            
            if (selectedTransformation.isMultiImage && secondaryImageUrl) {
                const secondaryMimeType = secondaryImageUrl.split(';')[0].split(':')[1] ?? 'image/png';
                const secondaryBase64 = secondaryImageUrl.split(',')[1];
                imagesPayload.push({ base64: secondaryBase64, mimeType: secondaryMimeType });
            }
            setLoadingMessage(t('app.loading.default'));
            const result = await editImage(imagesPayload, promptToUse, maskBase64);

            if (result.imageUrl) result.imageUrl = await embedWatermark(result.imageUrl, "Nano Bananary｜ZHO");
            
            const resultToSave = { ...result, originalFilename };
            const newId = await addGeneration({ imageUrl: resultToSave.imageUrl, text: resultToSave.text, originalFilename });

            const finalResult = { ...resultToSave, id: newId };
            setGeneratedContent(finalResult);
            setHistory(prev => [finalResult, ...prev]);
        }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('app.error.unknown'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [inputItems, secondaryImageUrl, selectedTransformation, maskDataUrl, customPrompt, t, buildPrompt, promptOptions, multiInputItems]);
  
  const handleGenerate = useCallback(() => {
    if (!selectedTransformation) return;
    if (selectedTransformation.isAutoFlow) {
        // The new component handles its own generation logic
        return;
    }
    if (selectedTransformation.isGenerative) {
        handleGenerateFromPrompt();
    } else if (selectedTransformation.isVideo) {
      handleGenerateVideo();
    } else {
      handleGenerateImage();
    }
  }, [selectedTransformation, handleGenerateFromPrompt, handleGenerateVideo, handleGenerateImage]);

  const handleUseImageAsInput = useCallback(async (imageUrl: string) => {
    if (!imageUrl) return;

    try {
      const newFile = await dataUrlToFile(imageUrl, `edited-${Date.now()}.png`);
      setInputItems([{ file: newFile, dataUrl: imageUrl, name: newFile.name }]);
      setGeneratedContent(null);
      setError(null);
      setBatchResult(null);
      setMaskDataUrl(null);
      setActiveTool('none');
      setSecondaryFile(null);
      setSecondaryImageUrl(null);
      setMultiInputItems([]);
      setSelectedTransformation(null); 
      setActiveCategory(null);
    } catch (err) {
      console.error("Failed to use image as input:", err);
      setError(t('app.error.useAsInputFailed'));
    }
  }, [t]);
  
  const toggleHistoryPanel = () => setIsHistoryPanelOpen(prev => !prev);
  
  const handleUseHistoryImageAsInput = (imageUrl: string) => {
      handleUseImageAsInput(imageUrl);
      setIsHistoryPanelOpen(false);
  };
  
  const handleDownloadFromHistory = (item: GeneratedContent, part: 'primary' | 'secondary' | 'video') => {
      let url: string | undefined;
      let filename: string;
      const fallbackName = `${part}-result-${Date.now()}`;

      switch(part) {
          case 'primary':
              url = item.imageUrl ?? undefined;
              filename = item.originalFilename ? `generated_${item.originalFilename}` : `${fallbackName}.png`;
              break;
          case 'secondary':
              url = item.secondaryImageUrl ?? undefined;
              filename = item.originalFilename ? `line-art_${item.originalFilename}` : `${fallbackName}.png`;
              break;
          case 'video':
              url = item.videoUrl;
              filename = item.originalFilename ? `generated_${item.originalFilename.split('.')[0]}.mp4` : `${fallbackName}.mp4`;
              break;
          default:
              return;
      }
      
      if (url) {
          downloadImage(url, filename);
      }
  };
  
  const handleClearHistory = async () => {
    if (window.confirm(t('history.clearConfirm'))) {
        try {
            await clearAllHistory();
            setHistory([]);
        } catch (err) {
            console.error("Failed to clear history", err);
            setError("Failed to clear history.");
        }
    }
  };

  const handleBackToSelection = () => {
    setSelectedTransformation(null);
  };

  const handleResetApp = () => {
    setSelectedTransformation(null);
    setInputItems([]);
    setMultiInputItems([]);
    setSecondaryImageUrl(null);
    setSecondaryFile(null);
    setGeneratedContent(null);
    setError(null);
    setBatchResult(null);
    setIsLoading(false);
    setMaskDataUrl(null);
    setCustomPrompt('');
    setPromptOptions({});
    setActiveTool('none');
    setActiveCategory(null);
  };

  const handleOpenPreview = (url: string) => setPreviewImageUrl(url);
  const handleClosePreview = () => setPreviewImageUrl(null);
  
  const toggleMaskTool = () => {
    setActiveTool(current => (current === 'mask' ? 'none' : 'mask'));
  };

  const isCustomPromptEmpty = selectedTransformation?.prompt === 'CUSTOM' && !customPrompt.trim();
  
  let isGenerateDisabled = true;
  if (selectedTransformation) {
    if (selectedTransformation.isGenerative) {
        isGenerateDisabled = isLoading;
    } else if (selectedTransformation.isVideo) {
        isGenerateDisabled = isLoading || !customPrompt.trim();
    } else if (selectedTransformation.isAutoFlow) {
        // Button is inside the component, this one won't be shown.
        isGenerateDisabled = true;
    } else {
        let imagesReady = false;
        if (selectedTransformation.isMultiImage) {
            if (selectedTransformation.isSecondaryOptional) {
                imagesReady = inputItems.length > 0;
            } else {
                imagesReady = inputItems.length > 0 && !!secondaryImageUrl;
            }
        } else {
            imagesReady = inputItems.length > 0;
        }
        isGenerateDisabled = isLoading || isCustomPromptEmpty || !imagesReady;
    }
  }

  const renderInputUI = () => {
    if (!selectedTransformation) return null;

    if (selectedTransformation.isAutoFlow) {
        return <VirtualTryOnAutoUploader onAddToHistory={handleAddToHistory} />;
    }
    
    // Generative Mode Display (no uploader)
    if (selectedTransformation.isGenerative) {
      return (
        <div className="text-center p-4 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-[var(--text-secondary)]">{t('transformations.generative.description')}</p>
        </div>
      );
    }
    
    // Batch Mode Display
    if (inputItems.length > 1) {
      return (
        <BatchInputDisplay
          items={inputItems}
          onAddFiles={(files) => handleImagesSelect(files)}
          onRemoveItem={(index) => setInputItems(prev => prev.filter((_, i) => i !== index))}
          onClearAll={handleClearInputItems}
        />
      );
    }
    
    // Video Mode Display
    if (selectedTransformation.isVideo) {
      return (
        <>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={t('transformations.video.promptPlaceholder')}
            rows={4}
            className="w-full mt-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)]"
          />
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t('transformations.video.aspectRatio')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['16:9', '9:16'] as const).map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 ${
                    aspectRatio === ratio ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)]' : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]'
                  }`}
                >
                  {t(ratio === '16:9' ? 'transformations.video.landscape' : 'transformations.video.portrait')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
             <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t('transformations.effects.customPrompt.uploader2Title')}</h3>
            <ImageEditorCanvas
                onImagesSelect={handleImagesSelect}
                initialImageUrl={inputItems[0]?.dataUrl}
                onMaskChange={() => {}}
                onClearImage={handleClearInputItems}
                isMaskToolActive={false}
                allowMultiple={false}
            />
          </div>
        </>
      );
    }

    // Multi-Image (non-batchable) Display
    if (selectedTransformation.isMultiImage) {
      const handlePrimarySelect = (files: FileList) => {
         if (files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => setInputItems([{ file, dataUrl: e.target?.result as string, name: file.name }]);
            reader.readAsDataURL(file);
         }
      }
      return (
        <MultiImageUploader
          onPrimarySelect={handlePrimarySelect}
          onSecondarySelect={handleSecondaryImageSelect}
          primaryImageUrl={inputItems[0]?.dataUrl}
          secondaryImageUrl={secondaryImageUrl}
          onClearPrimary={handleClearInputItems}
          onClearSecondary={handleClearSecondaryImage}
          primaryTitle={selectedTransformation.primaryUploaderTitle ? t(selectedTransformation.primaryUploaderTitle) : undefined}
          primaryDescription={selectedTransformation.primaryUploaderDescription ? t(selectedTransformation.primaryUploaderDescription) : undefined}
          secondaryTitle={selectedTransformation.secondaryUploaderTitle ? t(selectedTransformation.secondaryUploaderTitle) : undefined}
          secondaryDescription={selectedTransformation.secondaryUploaderDescription ? t(selectedTransformation.secondaryUploaderDescription) : undefined}
        />
      );
    }
    
    // Default Single Image / Batchable input display
    return (
      <>
        <ImageEditorCanvas
          onImagesSelect={handleImagesSelect}
          initialImageUrl={inputItems[0]?.dataUrl}
          onMaskChange={setMaskDataUrl}
          onClearImage={handleClearInputItems}
          isMaskToolActive={activeTool === 'mask'}
          allowMultiple={selectedTransformation.supportsBatch ?? true}
        />
        {inputItems.length > 0 && (
          <div className="mt-4">
            <button
              onClick={toggleMaskTool}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold rounded-md transition-colors duration-200 ${
                activeTool === 'mask' ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)]' : 'bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
              <span>{t('imageEditor.drawMask')}</span>
            </button>
          </div>
        )}
      </>
    );
  };
  
  const getBatchSummaryMessage = () => {
    if (!batchResult) return null;
    const { success, fail } = batchResult;
    if (success > 0 && fail > 0) return t('batch.summary', { success, fail });
    if (success > 0 && fail === 0) return t('batch.summarySuccess', { success });
    if (success === 0 && fail > 0) return t('batch.summaryFail', { fail });
    return null;
  }
  const batchSummaryMessage = getBatchSummaryMessage();


  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans">
      <header className="bg-[var(--bg-card-alpha)] backdrop-blur-lg sticky top-0 z-20 p-4 border-b border-[var(--border-primary)]">
        <div className="container mx-auto flex justify-between items-center">
          <h1 
            className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] cursor-pointer" 
            onClick={handleResetApp}
          >
            {t('app.title')}
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={toggleHistoryPanel}
              className="flex items-center gap-2 py-2 px-3 text-sm font-semibold text-[var(--text-primary)] bg-[rgba(107,114,128,0.2)] rounded-md hover:bg-[rgba(107,114,128,0.4)] transition-colors duration-200"
              aria-label="Toggle generation history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">{t('app.history')}</span>
            </button>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main>
        {!selectedTransformation ? (
          <TransformationSelector 
            transformations={transformations} 
            onSelect={handleSelectTransformation} 
            hasPreviousResult={inputItems.length > 0}
            onOrderChange={setTransformations}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
        ) : (
          <div className="container mx-auto p-4 md:p-8 animate-fade-in">
            <div className="mb-8">
              <button
                onClick={handleBackToSelection}
                className="flex items-center gap-2 text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors duration-200 py-2 px-4 rounded-lg hover:bg-[rgba(107,114,128,0.1)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('app.chooseAnotherEffect')}
              </button>
            </div>
            
            {selectedTransformation.isAutoFlow ? (
                <VirtualTryOnAutoUploader onAddToHistory={handleAddToHistory} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="flex flex-col gap-6 p-6 bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20">
                  <div>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold mb-1 text-[var(--accent-primary)] flex items-center gap-3">
                        <span className="text-3xl">{selectedTransformation.emoji}</span>
                        {t(selectedTransformation.titleKey)}
                      </h2>
                      {selectedTransformation.prompt !== 'CUSTOM' ? (
                        <p className="text-[var(--text-secondary)]">{t(selectedTransformation.descriptionKey)}</p>
                      ) : (
                        !selectedTransformation.isVideo && <p className="text-[var(--text-secondary)]">{t(selectedTransformation.descriptionKey)}</p>
                      )}
                    </div>
                    
                    {selectedTransformation.prompt === 'CUSTOM' && !selectedTransformation.isVideo && (
                      <textarea
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="e.g., 'make the sky a vibrant sunset' or 'add a small red boat on the water'"
                          rows={3}
                          className="w-full -mt-2 mb-4 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors placeholder-[var(--text-tertiary)]"
                      />
                    )}
                    
                    <div className="space-y-6">
                      {renderInputUI()}
                    
                      {selectedTransformation.options && (
                          <PromptOptions
                              options={selectedTransformation.options}
                              selectedValues={promptOptions}
                              onChange={(key, value) => setPromptOptions(prev => ({ ...prev, [key]: value }))}
                          />
                      )}

                      {!selectedTransformation.isTwoStepFlow && (
                          <button
                              onClick={handleGenerate}
                              disabled={isGenerateDisabled}
                              className="w-full py-3 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg shadow-lg shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)] disabled:bg-[var(--bg-disabled)] disabled:from-[var(--bg-disabled)] disabled:to-[var(--bg-disabled)] disabled:text-[var(--text-disabled)] disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                          >
                              {isLoading ? (
                              <>
                                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>{t('app.generating')}</span>
                              </>
                              ) : (
                              <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  <span>
                                      {inputItems.length > 1 
                                          ? t('app.generateBatch', { count: inputItems.length }) 
                                          : t('app.generateImage')
                                      }
                                  </span>
                              </>
                              )}
                          </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Output Column */}
                <div className="flex flex-col p-6 bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20">
                  <h2 className="text-xl font-semibold mb-4 text-[var(--accent-primary)] self-start">{t('app.result')}</h2>
                  {isLoading && <div className="flex-grow flex items-center justify-center"><LoadingSpinner message={loadingMessage} /></div>}
                  {error && <div className="flex-grow flex items-center justify-center w-full"><ErrorMessage message={error} /></div>}
                  {batchSummaryMessage && <div className="flex-grow flex items-center justify-center w-full"><StatusMessage message={batchSummaryMessage} type={batchResult?.fail === 0 ? 'success' : 'info'} /></div>}
                  
                  {!isLoading && !error && !batchSummaryMessage && generatedContent && (
                      <ResultDisplay 
                          content={generatedContent} 
                          onUseImageAsInput={handleUseImageAsInput}
                          onImageClick={handleOpenPreview}
                          originalImageUrl={inputItems[0]?.dataUrl ?? multiInputItems[0]?.dataUrl ?? null}
                      />
                  )}
                  {!isLoading && !error && !batchSummaryMessage && !generatedContent && (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-[var(--text-tertiary)]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2">{t('app.yourImageWillAppear')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <ImagePreviewModal imageUrl={previewImageUrl} onClose={handleClosePreview} />
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={toggleHistoryPanel}
        history={history}
        onUseImage={handleUseHistoryImageAsInput}
        onDownload={handleDownloadFromHistory}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};

// Add fade-in animation for view transitions
const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }
  @keyframes fadeInFast {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in-fast {
    animation: fadeInFast 0.2s ease-out forwards;
  }
`;
document.head.appendChild(style);


export default App;