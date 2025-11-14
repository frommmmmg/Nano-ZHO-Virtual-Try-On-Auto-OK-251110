export interface OptionValue {
  valueKey: string; // The actual string to be inserted into the prompt
  labelKey: string; // The translation key for the UI
}

export interface PromptOption {
  key: string; // Corresponds to the placeholder in promptTemplate, e.g., 'style'
  titleKey: string; // Translation key for the dropdown label
  values: OptionValue[];
}

export interface MultiImageInputConfig {
  key: string;
  titleKey: string;
  descriptionKey: string;
}

export type InputItem = { file: File, dataUrl: string, name: string };

export interface PromptStyle {
  valueKey: string;
  labelKey: string;
  prompt: string;
}

export interface AffiliateItemData {
  image_url: string;
  sku: string;
  affiliate_url: string;
}

export interface AffiliateConfigData {
  model: {
    image_url: string;
    "pose name": string;
  };
  clothing: AffiliateItemData;
  bag: AffiliateItemData;
  shoes: AffiliateItemData;
}

export interface Transformation {
  key: string;
  titleKey: string;
  emoji: string;
  prompt?: string;
  descriptionKey?: string;
  items?: Transformation[];
  isMultiImage?: boolean;
  isSecondaryOptional?: boolean;
  isTwoStep?: boolean;
  stepTwoPrompt?: string;
  primaryUploaderTitle?: string;
  secondaryUploaderTitle?: string;
  primaryUploaderDescription?: string;
  secondaryUploaderDescription?: string;
  isVideo?: boolean;
  supportsBatch?: boolean;
  promptTemplate?: string;
  options?: PromptOption[];
  isGenerative?: boolean;
  multiImageInputs?: MultiImageInputConfig[];
  isTwoStepFlow?: boolean;
  isAutoFlow?: boolean;
  promptStyles?: PromptStyle[];
}

export interface GeneratedContent {
  id?: number;
  imageUrl: string | null;
  text: string | null;
  secondaryImageUrl?: string | null;
  videoUrl?: string;
  originalFilename?: string;
}