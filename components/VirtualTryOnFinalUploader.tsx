import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/context';
import type { InputItem, GeneratedContent, AffiliateConfigData } from '../types';
import { editImage } from '../services/geminiService';
import { downloadImage, dataUrlToFile, embedWatermark } from '../utils/fileUtils';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import StatusMessage from './StatusMessage';

type ItemKey = 'model' | 'clothing' | 'bag' | 'shoes';
type DataField = 'image_url' | 'sku' | 'affiliate_url' | 'pose name';

interface VirtualTryOnAutoUploaderProps {
  onAddToHistory: (content: Omit<GeneratedContent, 'id'>) => Promise<void>;
}

const UploaderBox: React.FC<{
    onImageSelect: (file: File, dataUrl: string) => void;
    imageUrl: string | null;
    onClear: () => void;
    title: string;
    className?: string;
}> = ({ onImageSelect, imageUrl, onClear, title, className = '' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const { t } = useTranslation();

    const handleFiles = useCallback((files: FileList | null) => {
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => onImageSelect(file, e.target?.result as string);
            reader.readAsDataURL(file);
        }
    }, [onImageSelect]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => handleFiles(event.target.files);
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault(); event.stopPropagation(); setIsDragging(false);
        handleFiles(event.dataTransfer.files);
    }, [handleFiles]);
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    
    const inputId = `file-upload-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={`relative w-full aspect-square bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center transition-colors duration-200 select-none ${
                isDragging ? 'outline-dashed outline-2 outline-[var(--accent-primary)] bg-[rgba(249,115,22,0.1)]' : ''
                } ${imageUrl ? 'p-0' : 'p-4 border-2 border-dashed border-[var(--border-primary)]'}`}
            >
                {!imageUrl ? (
                    <label htmlFor={inputId} className="flex flex-col items-center justify-center text-[var(--text-tertiary)] cursor-pointer w-full h-full text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.158 0h.008v.008h-.008V8.25z" /></svg>
                        <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">{t('imageEditor.upload')}</p>
                        <input id={inputId} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                    </label>
                ) : (
                    <>
                        <img src={imageUrl} alt={title} className="w-full h-full object-contain rounded-lg" />
                        <button onClick={onClear} className="absolute top-2 right-2 z-10 p-1 bg-black/50 backdrop-blur-sm rounded-full text-white hover:bg-red-600 transition-colors" aria-label={`Remove ${title} image`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const ResultDisplay: React.FC<{
  content: GeneratedContent | null,
  isLoading: boolean,
  error: string | null,
  onUse: () => void,
}> = ({ content, isLoading, error, onUse }) => {
    const { t } = useTranslation();
    const handleDownload = () => content?.imageUrl && downloadImage(content.imageUrl, content.originalFilename || `result-${Date.now()}.png`);

    if (isLoading) return <div className="w-full h-full flex items-center justify-center"><LoadingSpinner /></div>;
    if (error) return <ErrorMessage message={error} />;
    if (!content || !content.imageUrl) return (
      <div className="w-full aspect-square bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center text-center text-[var(--text-tertiary)] text-sm p-4">
        {t('app.yourImageWillAppear')}
      </div>
    );

    return (
        <div className="flex flex-col gap-2 animate-fade-in">
            <img src={content.imageUrl!} alt="Generated result" className="w-full aspect-square object-contain rounded-lg bg-[var(--bg-secondary)]" />
            <div className="grid grid-cols-2 gap-2 text-sm">
                <button onClick={handleDownload} className="py-2 px-3 font-semibold rounded-md transition-colors bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] flex items-center justify-center gap-2">
                    {t('resultDisplay.actions.download')}
                </button>
                <button onClick={onUse} className="py-2 px-3 font-semibold rounded-md transition-colors bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] flex items-center justify-center gap-2">
                    {t('transformations.effects.virtualTryOnAuto.useAsInput')}
                </button>
            </div>
        </div>
    );
};

const Step4ResultItem: React.FC<{ content: GeneratedContent; index: number }> = ({ content, index }) => {
    const { t } = useTranslation();
    const handleDownload = () => {
      if (content.imageUrl) {
        downloadImage(content.imageUrl, content.originalFilename || `stylized-result-${index + 1}.png`);
      }
    };
    return (
      <div className="flex flex-col gap-2 animate-fade-in">
        <img src={content.imageUrl!} className="w-full aspect-square object-contain rounded-lg bg-[var(--bg-secondary)]" alt={`Stylized result ${index + 1}`}/>
        <button onClick={handleDownload} className="w-full py-2 px-3 font-semibold rounded-md transition-colors bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] flex items-center justify-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            <span>{t('resultDisplay.actions.download')}</span>
        </button>
      </div>
    );
};

const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helpers: Normalize Amazon image URL to fixed size and extract SKU from affiliate URL
const normalizeAmazonImageUrl = (url: string): string => {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('amazon')) return url;
  } catch {
    return url;
  }
  // Only handle typical m.media-amazon.com images path
  // Replace size token between ._ and _ before extension with SR800,1200
  // Case 1: already has size token like ._AC_SL1500_.jpg -> ._SR800,1200_.jpg
  const replaced = url.replace(/\._[^._]*_\.(jpg|jpeg|png|webp)(\?.*)?$/i, '._SR800,1200_.$1$2');
  if (replaced !== url) return replaced;
  // Case 2: no size token, insert before extension: .../I/xxxxx.jpg -> .../I/xxxxx._SR800,1200_.jpg
  return url.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, '._SR800,1200_.$1$2');
};

const extractAmazonSku = (affiliateUrl: string): string | null => {
  if (!affiliateUrl) return null;
  try {
    const u = new URL(affiliateUrl);
    const dpMatch = u.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
    if (dpMatch) return dpMatch[1].toUpperCase();
    const gpMatch = u.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    if (gpMatch) return gpMatch[1].toUpperCase();
  } catch {
    // ignore
  }
  // Fallback: try raw string match
  const dpMatch2 = affiliateUrl.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch2) return dpMatch2[1].toUpperCase();
  const gpMatch2 = affiliateUrl.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch2) return gpMatch2[1].toUpperCase();
  return null;
};

const VirtualTryOnAutoUploader: React.FC<VirtualTryOnAutoUploaderProps> = ({ onAddToHistory }) => {
  const { t } = useTranslation();
  const jsonImportRef = useRef<HTMLInputElement>(null);

  const defaultState: AffiliateConfigData = {
    model: { image_url: '', 'pose name': '' },
    clothing: { image_url: '', sku: '', affiliate_url: '' },
    bag: { image_url: '', sku: '', affiliate_url: '' },
    shoes: { image_url: '', sku: '', affiliate_url: '' },
  };
  const [data, setData] = useState<AffiliateConfigData>(() => JSON.parse(JSON.stringify(defaultState)));
  const [images, setImages] = useState<Record<ItemKey, InputItem | null>>({ model: null, clothing: null, bag: null, shoes: null });
  // 每个步骤的“模特”独立输入，避免全局 model 同步变更导致全部联动
  const [stepModelInputs, setStepModelInputs] = useState<{ step1: InputItem | null; step2: InputItem | null; step3: InputItem | null; step4: InputItem | null }>({ step1: null, step2: null, step3: null, step4: null });
  
  const [step1Result, setStep1Result] = useState<GeneratedContent | null>(null);
  const [step2Result, setStep2Result] = useState<GeneratedContent | null>(null);
  const [step3Result, setStep3Result] = useState<GeneratedContent | null>(null);
  const [step4Results, setStep4Results] = useState<GeneratedContent[]>([]);
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [selectedStyles, setSelectedStyles] = useState<Record<string, boolean>>({
    tShow: true, street: true, party: true, vintageBuilding: true, nightClub: true, custom: false
  });
  const [customLocation, setCustomLocation] = useState('');

  // 默认步骤提示词（步骤1-3可编辑）
  const defaultStepPrompts: Record<1|2|3, string> = {
    1: "Replace the clothing of the character in image 1 with the apparel from image 2. Simultaneously, adjust the character's pose in image 1 to a more fitting and fashionable stance that best showcases the new garment, ensuring overall visual harmony and unity. The final output should embody a high-fashion editorial aesthetic.",
    2: "A stunning fashion model from the first image expertly showcasing the handbag from the second image, embodying high fashion and modern elegance. The model should hold or wear the item with an effortless, organic pose that seamlessly integrates the handbag into the model's overall flow and style.",
    3: "Wear the shoes from the second image onto the model from the first image. The shoes should be worn naturally, matching the model's pose and the overall high-fashion aesthetic of the image." 
  };
  const [stepPrompts, setStepPrompts] = useState<Record<1|2|3, string>>({ 1: defaultStepPrompts[1], 2: defaultStepPrompts[2], 3: defaultStepPrompts[3] });
  const restoreStepPrompt = (step: 1|2|3) => setStepPrompts(prev => ({ ...prev, [step]: defaultStepPrompts[step] }));

  const stylesConfig = [
    { key: 'tShow', labelKey: 'transformations.effects.virtualTryOnAuto.tShow', prompt: "Reimagine the photo as a Fashion editorial cover shoot. Create an ultra-realistic portrait with impeccable detail in the skin texture and fabric. in T-show, The subject should hold a powerful, dramatic pose. Illuminate the scene with moody, cinematic lighting that sculpts the features and casts deep, artistic shadows, creating a high-fashion, atmospheric feel." },
    { key: 'street', labelKey: 'transformations.effects.virtualTryOnAuto.street', prompt: "Reimagine the photo as a Fashion editorial cover shoot. Create an ultra-realistic portrait with impeccable detail in the skin texture and fabric. In the Street, the subject should hold a powerful, dramatic pose. Illuminate the scene with moody, cinematic lighting that sculpts the features and casts deep, artistic shadows, creating a high-fashion, atmospheric feel." },
    { key: 'party', labelKey: 'transformations.effects.virtualTryOnAuto.party', prompt: "Reimagine the photo as a Fashion editorial cover shoot. Create an ultra-realistic portrait with impeccable detail in the skin texture and fabric. In an exclusive, candlelit grand ballroom/lounge, the subject should hold a powerful, dramatic pose. Illuminate the scene with moody, cinematic lighting that sculpts the features and casts deep, artistic shadows, creating a high-fashion, atmospheric feel." },
    { key: 'vintageBuilding', labelKey: 'transformations.effects.virtualTryOnAuto.vintageBuilding', prompt: "Capture the essence of a high-fashion editorial cover: An ultra-realistic portrait demanding impeccable fidelity in skin texture and fabric detail. Against the backdrop of a grand vintage edifice, the subject strikes a dynamic, commanding pose. The scene must be dramatically sculpted by moody, cinematic illumination, emphasizing deep, artistic shadows and chiseled features" },
    { key: 'nightClub', labelKey: 'transformations.effects.virtualTryOnAuto.nightClub', prompt: "Reimagine the photo inside a high-energy night club. Create an ultra-realistic portrait with impeccable skin and fabric detail. The scene features a live DJ booth, pulsing neon lights, laser beams, and a lively dancing crowd. The subject strikes a dynamic, powerful pose. Illuminate the scene with moody, cinematic lighting and vibrant color gels, casting deep, artistic shadows for a high-fashion, electric atmosphere." },
    { key: 'custom', labelKey: 'transformations.effects.virtualTryOnAuto.customize', prompt: "Capture the essence of a high-fashion editorial cover: An ultra-realistic portrait demanding impeccable fidelity in skin texture and fabric detail. Against the backdrop of **[LOCATION]**, the subject strikes a dynamic, commanding pose. The scene must be dramatically sculpted by moody, cinematic illumination, emphasizing deep, artistic shadows and chiseled features, forging an atmosphere of opulent glamour perfect for a spectacular Ball and Party night." },
  ];
  
  useEffect(() => {
    if (importStatus) {
      const timer = setTimeout(() => setImportStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [importStatus]);

  // Handlers
  const handleDataChange = (item: ItemKey, field: DataField, value: string) => {
    setData(prev => ({ ...prev, [item]: { ...prev[item], [field]: value } }));
  };

  const handleImageChange = (item: ItemKey, file: File, dataUrl: string) => {
    setImages(prev => ({ ...prev, [item]: { file, dataUrl, name: file.name } }));
  };
  const handleStepModelChange = (step: 1 | 2 | 3 | 4, file: File, dataUrl: string) => {
    const name = file.name || `step${step}.png`;
    setStepModelInputs(prev => ({ ...prev, [`step${step}`]: { file, dataUrl, name } as any }));
  };
  
  const handleClearImage = (item: ItemKey) => setImages(prev => ({ ...prev, [item]: null }));
  const handleClearStepModel = (step: 1 | 2 | 3 | 4) => setStepModelInputs(prev => ({ ...prev, [`step${step}`]: null } as any));

  const generateStep = async (step: number, image1: InputItem, image2: InputItem | null, prompt: string, filename: string): Promise<GeneratedContent | null> => {
    const stepKey = `step${step}`;
    setLoading(prev => ({ ...prev, [stepKey]: true }));
    setErrors(prev => ({ ...prev, [stepKey]: null }));
    try {
        const imagesPayload = [{ base64: image1.dataUrl.split(',')[1], mimeType: image1.dataUrl.split(';')[0].split(':')[1] }];
        if (image2) {
            imagesPayload.push({ base64: image2.dataUrl.split(',')[1], mimeType: image2.dataUrl.split(';')[0].split(':')[1] });
        }
        
        let result = await editImage(imagesPayload, prompt, null);
        if (result.imageUrl) result.imageUrl = await embedWatermark(result.imageUrl, "Nano Bananary｜ZHO");

        const sanitizedFilename = (filename || 'generated-image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
        const finalResult = { ...result, originalFilename: sanitizedFilename };
        await onAddToHistory(finalResult);

        setLoading(prev => ({ ...prev, [stepKey]: false }));
        return finalResult;
    } catch (err) {
        setErrors(prev => ({ ...prev, [stepKey]: err instanceof Error ? err.message : String(err) }));
        setLoading(prev => ({ ...prev, [stepKey]: false }));
        return null;
    }
  };

  const handleGenerateStep1 = async () => {
      const modelInput = stepModelInputs.step1 || images.model;
      if (!modelInput || !images.clothing) {
        setErrors(prev => ({ ...prev, step1: t('app.error.uploadBoth') }));
        return;
      }
      const prompt = (stepPrompts[1]?.trim()) || defaultStepPrompts[1];
      const filename = `step1_try_on_${images.clothing.name}`;
      const result = await generateStep(1, modelInput, images.clothing, prompt, filename);
      if (result) setStep1Result(result);
      return result;
  };
  const handleGenerateStep2 = async (inputImage: InputItem) => {
      if (!images.bag) {
        setErrors(prev => ({ ...prev, step2: 'Please upload a bag image.' }));
        return;
      }
      const prompt = (stepPrompts[2]?.trim()) || defaultStepPrompts[2];
      const filename = `step2_add_bag_${images.bag.name}`;
      const result = await generateStep(2, inputImage, images.bag, prompt, filename);
      if (result) setStep2Result(result);
      return result;
  };
  const handleGenerateStep3 = async (inputImage: InputItem) => {
      if (!images.shoes) {
        setErrors(prev => ({ ...prev, step3: 'Please upload a shoes image.' }));
        return;
      }
      const prompt = (stepPrompts[3]?.trim()) || defaultStepPrompts[3];
      const filename = `step3_add_shoes_${images.shoes.name}`;
      const result = await generateStep(3, inputImage, images.shoes, prompt, filename);
      if (result) setStep3Result(result);
      return result;
  };
  
  const handleGenerateStep4 = async (inputImage: InputItem) => {
      setStep4Results([]);
      const activeStyles = stylesConfig.filter(s => selectedStyles[s.key]);
      if (activeStyles.length === 0) {
        setErrors(prev => ({...prev, step4: 'Please select at least one style.'}))
        return;
      };

      const allResults: GeneratedContent[] = [];
      for (const style of activeStyles) {
          let prompt = style.prompt;
          if (style.key === 'custom') {
              prompt = prompt.replace('**[LOCATION]**', customLocation || 'a dramatic location');
          }
          const filename = `step4_style_${style.key}_${inputImage.name}`;
          const result = await generateStep(4, inputImage, null, prompt, filename);
          if (result) allResults.push(result);
      }
      setStep4Results(allResults);
  };
  
  const useResultAsStepModelInput = async (result: GeneratedContent | null, step: 2 | 3 | 4) => {
    if (!result?.imageUrl) return;
    const file = await dataUrlToFile(result.imageUrl, `step${step}-model.png`);
    handleStepModelChange(step, file, result.imageUrl);
  };

  // Automation Handlers
  const handleAutomate123 = async () => {
    const res1 = await handleGenerateStep1();
    if (res1?.imageUrl) {
    const file1 = await dataUrlToFile(res1.imageUrl, 'step1.png');
    // 设置第二步默认输入为第一步结果
    setStepModelInputs(prev => ({ ...prev, step2: { file: file1, dataUrl: res1.imageUrl!, name: 'step1.png' } }));
    const res2 = await handleGenerateStep2({ file: file1, dataUrl: res1.imageUrl, name: 'step1.png' });
        if (res2?.imageUrl) {
      const file2 = await dataUrlToFile(res2.imageUrl, 'step2.png');
      setStepModelInputs(prev => ({ ...prev, step3: { file: file2, dataUrl: res2.imageUrl!, name: 'step2.png' } }));
      const res3 = await handleGenerateStep3({ file: file2, dataUrl: res2.imageUrl, name: 'step2.png' });
            if (res3?.imageUrl) {
        const file3 = await dataUrlToFile(res3.imageUrl, 'step3.png');
        setStepModelInputs(prev => ({ ...prev, step4: { file: file3, dataUrl: res3.imageUrl!, name: 'step3.png' } }));
            }
        }
    }
  };
  
  const handleFullAutomate = async () => {
    const res1 = await handleGenerateStep1();
    if (res1?.imageUrl) {
    const file1 = await dataUrlToFile(res1.imageUrl, 'step1.png');
    setStepModelInputs(prev => ({ ...prev, step2: { file: file1, dataUrl: res1.imageUrl!, name: 'step1.png' } }));
    const res2 = await handleGenerateStep2({ file: file1, dataUrl: res1.imageUrl, name: 'step1.png' });
        if (res2?.imageUrl) {
      const file2 = await dataUrlToFile(res2.imageUrl, 'step2.png');
      setStepModelInputs(prev => ({ ...prev, step3: { file: file2, dataUrl: res2.imageUrl!, name: 'step2.png' } }));
      const res3 = await handleGenerateStep3({ file: file2, dataUrl: res2.imageUrl, name: 'step2.png' });
            if (res3?.imageUrl) {
        const file3 = await dataUrlToFile(res3.imageUrl, 'step3.png');
        setStepModelInputs(prev => ({ ...prev, step4: { file: file3, dataUrl: res3.imageUrl!, name: 'step3.png' } }));
        await handleGenerateStep4({ file: file3, dataUrl: res3.imageUrl, name: 'step3.png' });
            }
        }
    }
  };

  // Config Handlers
  const handleExportJson = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadImage(url, 'data.json');
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm(t('transformations.effects.virtualTryOnAuto.importConfirm'))) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
        setImportStatus({ type: 'error', message: `Error reading file: ${file.name}` });
        console.error("FileReader error:", reader.error);
    };
    reader.onload = (e) => {
        try {
            let fileContent = e.target?.result as string;
            if (!fileContent) throw new Error("File is empty.");
            
            // Handle Byte Order Mark (BOM)
            if (fileContent.charCodeAt(0) === 0xFEFF) {
                fileContent = fileContent.slice(1);
            }

      const parsedContent = JSON.parse(fileContent);
      if (typeof parsedContent !== 'object' || parsedContent === null) {
        throw new Error("Invalid JSON structure: not an object.");
      }

      // 深度合并并验证字段类型
      const newMergedData = JSON.parse(JSON.stringify(defaultState));
      const itemKeys: ItemKey[] = ['model', 'clothing', 'bag', 'shoes'];
      const missingFields: string[] = [];
      const typeErrorFields: string[] = [];
      itemKeys.forEach(key => {
        const incoming = parsedContent[key];
        if (incoming && typeof incoming === 'object') {
          Object.keys(newMergedData[key]).forEach(field => {
            if (field in incoming) {
              const val = incoming[field];
              if (typeof val === 'string') {
                (newMergedData as any)[key][field] = val;
              } else if (val !== undefined && val !== null) {
                typeErrorFields.push(`${key}.${field}`);
              }
            } else {
              // 仅在导入数据中缺失且默认值为空时记录缺失（帮助提示）
              missingFields.push(`${key}.${field}`);
            }
          });
        }
      });

      setData(newMergedData);
      setImages({ model: null, clothing: null, bag: null, shoes: null });
      setStep1Result(null); setStep2Result(null); setStep3Result(null); setStep4Results([]);
      setErrors({});

      // 构建提示信息
      let successMsg = t('transformations.effects.virtualTryOnAuto.importSuccess');
      const needAutoFetch = ['clothing','bag','shoes'].some(k => (newMergedData as any)[k].image_url);
      if (needAutoFetch) {
        successMsg = t('transformations.effects.virtualTryOnAuto.importSuccessWithFetch');
      }
      if (missingFields.length > 0) {
        successMsg += `\n${t('transformations.effects.virtualTryOnAuto.importFieldMissing')}: ${missingFields.join(', ')}`;
      }
      if (typeErrorFields.length > 0) {
        successMsg += `\n${t('transformations.effects.virtualTryOnAuto.importFieldTypeError')}: ${typeErrorFields.join(', ')}`;
      }
            // 成功时不再提示，仅在错误情况下提示；仍执行自动拉取
            if (needAutoFetch) {
              Promise.resolve().then(() => handleFetchImages());
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown parsing error';
            setImportStatus({ type: 'error', message: `${t('app.error.jsonParseError')}: ${errorMessage}` });
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const handleFetchImages = async () => {
      setLoading(prev => ({ ...prev, fetch: true }));
      setErrors(prev => ({...prev, fetch: null}));
    // Prepare normalized data and urls
    const newData: AffiliateConfigData = JSON.parse(JSON.stringify(data));
    const items: ItemKey[] = ['clothing','bag','shoes'];
    const urlsToFetch: { item: ItemKey, url: string }[] = [];
    items.forEach((item) => {
      const rawUrl = (newData as any)[item].image_url?.trim?.() ?? '';
      if (rawUrl) {
        const normalized = normalizeAmazonImageUrl(rawUrl);
        (newData as any)[item].image_url = normalized;
        urlsToFetch.push({ item, url: normalized });
      }
      const sku = extractAmazonSku((newData as any)[item].affiliate_url || '');
      if (sku) {
        (newData as any)[item].sku = sku;
      }
    });
    // Apply data updates (normalized urls and extracted sku)
    setData(newData);

    for (const { item, url } of urlsToFetch) {
          if (!url) continue;
          try {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const blob = await response.blob();
              const file = new File([blob], url.split('/').pop() || 'fetched-image', { type: blob.type });
              const dataUrl = await blobToDataURL(blob);
              setImages(prev => ({ ...prev, [item]: { file, dataUrl, name: file.name } }));
          } catch (err) {
              setErrors(prev => ({ ...prev, fetch: t('app.error.imageFetchError', { url }) }));
              console.error(`Failed to fetch ${url}`, err);
          }
      }
      setLoading(prev => ({ ...prev, fetch: false }));
  };
  
  const handleClearAll = () => {
      setData(JSON.parse(JSON.stringify(defaultState)));
      setImages({ model: null, clothing: null, bag: null, shoes: null });
    setStepModelInputs({ step1: null, step2: null, step3: null, step4: null });
      setStep1Result(null); setStep2Result(null); setStep3Result(null); setStep4Results([]);
      setErrors({});
  };

  const renderDataInputs = (item: ItemKey) => (
    <div className="flex flex-col gap-2 text-xs">
      {Object.keys(data[item]).map(key => (
        <input key={key} type="text" placeholder={key}
          value={data[item][key as DataField]}
          onChange={e => handleDataChange(item, key as DataField, e.target.value)}
          className="w-full p-1.5 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md focus:ring-1 focus:ring-[var(--accent-primary)] placeholder-[var(--text-tertiary)]"
        />
      ))}
    </div>
  );
  
  const StepSeparator = () => <hr className="border-[var(--border-primary)] my-8" />;
  
  const renderStep = (
      step: number,
      titleKey: string,
      image1TitleKey: string,
      image2TitleKey: string,
      image1ItemKey: ItemKey,
      image2ItemKey: ItemKey,
      result: GeneratedContent | null,
    onGenerate: () => void,
    onUseResult: () => void,
    image1UrlOverride?: string | null,
    image1OnSelectOverride?: (file: File, dataUrl: string) => void,
    image1OnClearOverride?: () => void,
      children?: React.ReactNode
  ) => (
      <div>
          <h3 className="text-xl font-bold text-[var(--accent-secondary)] mb-4">{t(titleKey)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
            <UploaderBox title={t(image1TitleKey)} imageUrl={image1UrlOverride ?? images[image1ItemKey]?.dataUrl ?? null}
              onImageSelect={image1OnSelectOverride || ((f, d) => handleImageChange(image1ItemKey, f, d))} onClear={image1OnClearOverride || (() => handleClearImage(image1ItemKey))} />
                      {renderDataInputs(image1ItemKey)}
                  </div>
                  <div>
                      <UploaderBox title={t(image2TitleKey)} imageUrl={images[image2ItemKey]?.dataUrl ?? null}
                          onImageSelect={(f, d) => handleImageChange(image2ItemKey, f, d)} onClear={() => handleClearImage(image2ItemKey)} />
                      {renderDataInputs(image2ItemKey)}
                  </div>
                  <div className="sm:col-span-2">
                    <button onClick={onGenerate} disabled={loading[`step${step}`]} className="w-full py-2 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg shadow-md hover:from-[var(--accent-primary-hover)] disabled:bg-[var(--bg-disabled)] disabled:from-[var(--bg-disabled)] disabled:cursor-not-allowed transition-all">
                        {loading[`step${step}`] ? t('app.generating') : t('transformations.effects.virtualTryOnAuto.generate')}
                    </button>
                    {children}
                  </div>
              </div>
              <div className="md:col-span-1">
                  <ResultDisplay content={result} isLoading={loading[`step${step}`]} error={errors[`step${step}`]} onUse={onUseResult} />
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6 bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20">
      {/* Step 1 */}
      {renderStep(1, "transformations.effects.virtualTryOnAuto.step1", "transformations.effects.virtualTryOnAuto.model", "transformations.effects.virtualTryOnAuto.clothing", "model", "clothing", step1Result, handleGenerateStep1, () => useResultAsStepModelInput(step1Result, 2), stepModelInputs.step1?.dataUrl ?? images.model?.dataUrl ?? null, (f,d) => handleStepModelChange(1, f, d), () => handleClearStepModel(1), (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="step1PromptTextarea" className="text-xs font-semibold text-[var(--text-secondary)]">Step 1 Prompt</label>
          <textarea
            id="step1PromptTextarea"
            title="Step 1 Prompt"
            placeholder="输入或编辑第1步的提示词..."
            value={stepPrompts[1]}
            onChange={e => setStepPrompts(p => ({...p, 1: e.target.value}))}
            rows={4}
            className="w-full text-xs p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md focus:ring-1 focus:ring-[var(--accent-primary)]"
          />
          <div className="flex justify-end">
            <button type="button" onClick={() => restoreStepPrompt(1)} className="px-2 py-1 text-xs bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] rounded-md">恢复默认</button>
          </div>
        </div>
      ))}
      <StepSeparator/>
      {/* Step 2 */}
      {renderStep(2, "transformations.effects.virtualTryOnAuto.step2", "transformations.effects.virtualTryOnAuto.model", "transformations.effects.virtualTryOnAuto.bag", "model", "bag", step2Result, async () => {
          // 计算第二步的输入：优先使用用户在第二步上传的模特，否则使用第1步结果，否则使用初始模特
          if (stepModelInputs.step2) {
            await handleGenerateStep2(stepModelInputs.step2);
          } else if (step1Result?.imageUrl) {
            const file = await dataUrlToFile(step1Result.imageUrl, 'step1.png');
            await handleGenerateStep2({ file, dataUrl: step1Result.imageUrl, name: 'step1.png' });
          } else if (images.model) {
            await handleGenerateStep2(images.model);
          } else {
            setErrors(prev => ({ ...prev, step2: t('app.error.uploadBoth') }));
          }
        }, () => useResultAsStepModelInput(step2Result, 3), stepModelInputs.step2?.dataUrl ?? step1Result?.imageUrl ?? images.model?.dataUrl ?? null, (f,d) => handleStepModelChange(2, f, d), () => handleClearStepModel(2), (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="step2PromptTextarea" className="text-xs font-semibold text-[var(--text-secondary)]">Step 2 Prompt</label>
            <textarea
              id="step2PromptTextarea"
              title="Step 2 Prompt"
              placeholder="输入或编辑第2步的提示词..."
              value={stepPrompts[2]}
              onChange={e => setStepPrompts(p => ({...p, 2: e.target.value}))}
              rows={4}
              className="w-full text-xs p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => restoreStepPrompt(2)} className="px-2 py-1 text-xs bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] rounded-md">恢复默认</button>
            </div>
          </div>
        ))}
      <StepSeparator/>
      {/* Step 3 */}
      {renderStep(3, "transformations.effects.virtualTryOnAuto.step3", "transformations.effects.virtualTryOnAuto.model", "transformations.effects.virtualTryOnAuto.shoes", "model", "shoes", step3Result, async () => {
          if (stepModelInputs.step3) {
            await handleGenerateStep3(stepModelInputs.step3);
          } else if (step2Result?.imageUrl) {
            const file = await dataUrlToFile(step2Result.imageUrl, 'step2.png');
            await handleGenerateStep3({ file, dataUrl: step2Result.imageUrl, name: 'step2.png' });
          } else if (images.model) {
            await handleGenerateStep3(images.model);
          } else {
            setErrors(prev => ({ ...prev, step3: t('app.error.uploadBoth') }));
          }
        }, () => useResultAsStepModelInput(step3Result, 4), stepModelInputs.step3?.dataUrl ?? step2Result?.imageUrl ?? images.model?.dataUrl ?? null, (f,d) => handleStepModelChange(3, f, d), () => handleClearStepModel(3), (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="step3PromptTextarea" className="text-xs font-semibold text-[var(--text-secondary)]">Step 3 Prompt</label>
            <textarea
              id="step3PromptTextarea"
              title="Step 3 Prompt"
              placeholder="输入或编辑第3步的提示词..."
              value={stepPrompts[3]}
              onChange={e => setStepPrompts(p => ({...p, 3: e.target.value}))}
              rows={4}
              className="w-full text-xs p-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-md focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <div className="flex justify-end">
              <button type="button" onClick={() => restoreStepPrompt(3)} className="px-2 py-1 text-xs bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] rounded-md">恢复默认</button>
            </div>
          </div>
        ))}
      <StepSeparator/>
      
      {/* Step 4 */}
       <div>
          <h3 className="text-xl font-bold text-[var(--accent-secondary)] mb-4">{t('transformations.effects.virtualTryOnAuto.step4')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <div>
            <UploaderBox title={t('transformations.effects.virtualTryOnAuto.model')} imageUrl={stepModelInputs.step4?.dataUrl ?? step3Result?.imageUrl ?? images.model?.dataUrl ?? null}
              onImageSelect={(f, d) => handleStepModelChange(4, f, d)} onClear={() => handleClearStepModel(4)} />
          </div>
                  <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('transformations.effects.virtualTryOnAuto.stylize')}</h3>
                      <div className="space-y-2 p-3 bg-[var(--bg-secondary)] rounded-lg">
                          {stylesConfig.map(style => (
                            <div key={style.key} className="flex items-center">
                                <input type="checkbox" id={style.key} checked={!!selectedStyles[style.key]} onChange={e => setSelectedStyles(p => ({...p, [style.key]: e.target.checked}))} className="h-4 w-4 rounded accent-[var(--accent-primary)]" />
                                <label htmlFor={style.key} className="ml-2 text-sm text-[var(--text-primary)]">{t(style.labelKey)}</label>
                            </div>
                          ))}
                          {selectedStyles.custom && (
                            <input type="text" placeholder="Enter location" value={customLocation} onChange={e => setCustomLocation(e.target.value)} className="w-full mt-2 p-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md" />
                          )}
                      </div>
                  </div>
                   <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={async () => {
                        let input: InputItem | null = null;
                        if (stepModelInputs.step4) input = stepModelInputs.step4;
                        else if (step3Result?.imageUrl) {
                          const file = await dataUrlToFile(step3Result.imageUrl, 'step3.png');
                          input = { file, dataUrl: step3Result.imageUrl, name: 'step3.png' };
                        } else if (images.model) input = images.model;
                        else setErrors(prev => ({ ...prev, step4: t('app.error.uploadBoth') }));
                        if (input) await handleGenerateStep4(input);
                      }} disabled={loading.step4} className="w-full py-2 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg shadow-md hover:from-[var(--accent-primary-hover)] disabled:bg-[var(--bg-disabled)] disabled:from-[var(--bg-disabled)] disabled:cursor-not-allowed transition-all">
                        {loading.step4 ? t('app.generating') : t('transformations.effects.virtualTryOnAuto.generate')}
                      </button>
                      <button onClick={async () => {
                        let input: InputItem | null = null;
                        if (stepModelInputs.step4) input = stepModelInputs.step4;
                        else if (step3Result?.imageUrl) {
                          const file = await dataUrlToFile(step3Result.imageUrl, 'step3.png');
                          input = { file, dataUrl: step3Result.imageUrl, name: 'step3.png' };
                        } else if (images.model) input = images.model;
                        else setErrors(prev => ({ ...prev, step4: t('app.error.uploadBoth') }));
                        if (input) await handleGenerateStep4(input);
                      }} disabled={loading.step4} className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed transition-all">
                          {t('transformations.effects.virtualTryOnAuto.automateStep4')}
                      </button>
                  </div>
              </div>
              <div className="md:col-span-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
                  {loading.step4 && <div className="sm:col-span-2 md:col-span-1"><LoadingSpinner /></div>}
                  {errors.step4 && <div className="sm:col-span-2 md:col-span-1"><ErrorMessage message={errors.step4} /></div>}
                  {step4Results.map((res, i) => (
                      <Step4ResultItem key={i} content={res} index={i} />
                  ))}
              </div>
          </div>
      </div>
      
      <StepSeparator/>
      
      {/* Bottom Controls */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <button onClick={handleAutomate123} className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition-colors">{t('transformations.effects.virtualTryOnAuto.automateSteps123')}</button>
            <button onClick={handleFullAutomate} className="py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-md transition-colors">{t('transformations.effects.virtualTryOnAuto.fullAutomate')}</button>
            <button onClick={handleFetchImages} disabled={loading.fetch} className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors col-span-2 md:col-span-1 disabled:bg-indigo-400">
              {loading.fetch ? t('transformations.effects.virtualTryOnAuto.fetching') : t('transformations.effects.virtualTryOnAuto.fetchImages')}
            </button>
        </div>
        <div className="p-4 bg-black/20 rounded-lg border border-[var(--border-primary)] flex flex-col gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button onClick={handleExportJson} className="py-2 px-4 text-sm bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] rounded-md transition-colors">{t('transformations.effects.virtualTryOnAuto.exportJson')}</button>
              <button onClick={() => jsonImportRef.current?.click()} className="py-2 px-4 text-sm bg-[rgba(107,114,128,0.2)] hover:bg-[rgba(107,114,128,0.4)] rounded-md transition-colors">{t('transformations.effects.virtualTryOnAuto.importJson')}</button>
              <input type="file" ref={jsonImportRef} onChange={handleImportJson} accept=".json" className="hidden" aria-label="Import JSON" title="Import JSON" />
              <button onClick={handleClearAll} className="py-2 px-4 text-sm bg-red-800/50 hover:bg-red-800/80 rounded-md transition-colors col-span-2 sm:col-span-2">{t('transformations.effects.virtualTryOnAuto.clearAll')}</button>
          </div>
          <div className="col-span-full mt-2 min-h-[48px]">
            {errors.fetch && <ErrorMessage message={errors.fetch} />}
            {importStatus?.type === 'success' && <StatusMessage message={importStatus.message} type="success" />}
            {importStatus?.type === 'error' && <ErrorMessage message={importStatus.message} />}
          </div>
        </div>
      </div>

    </div>
  );
};

export default VirtualTryOnAutoUploader;