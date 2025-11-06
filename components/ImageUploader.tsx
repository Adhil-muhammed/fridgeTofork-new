import React from 'react';
import geminiService from '../services/geminiService';
import { Ingredient } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ImageUploaderProps {
  onIngredientsAnalyzed: (ingredients: Ingredient[], rawAnalysis: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
  // New props for image persistence
  uploadedImageFile: File | null;
  uploadedImagePreviewUrl: string | null;
  setUploadedImageFile: (file: File | null) => void;
  setUploadedImagePreviewUrl: (url: string | null) => void;
  onRemoveImage: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onIngredientsAnalyzed,
  onLoadingChange,
  onError,
  uploadedImageFile,
  uploadedImagePreviewUrl,
  setUploadedImageFile,
  setUploadedImagePreviewUrl,
  onRemoveImage,
}) => {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      setUploadedImagePreviewUrl(URL.createObjectURL(file));
      onError(null); // Clear previous errors
    } else {
      setUploadedImageFile(null);
      setUploadedImagePreviewUrl(null);
      onRemoveImage(); // Clear image and related data if file is deselected
    }
  };

  const handleAnalyzeImage = async () => {
    if (!uploadedImageFile) {
      onError('Please select an image to analyze.');
      return;
    }
    setIsLoading(true);
    onLoadingChange(true);
    onError(null); // Clear previous errors

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = (reader.result as string).split(',')[1];
        const mimeType = uploadedImageFile.type;
        const { ingredients, rawAnalysis } = await geminiService.analyzeImage(
          base64Image,
          mimeType,
        );
        onIngredientsAnalyzed(ingredients, rawAnalysis);
      };
      reader.readAsDataURL(uploadedImageFile);
    } catch (err: any) {
      console.error('Error analyzing image:', err);
      onError(`Failed to analyze image: ${err.message || 'Unknown error'}.`);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-2xl mx-auto my-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Scan Your Fridge</h2>
      <p className="text-gray-600 mb-4">Upload a photo of your ingredients to get instant recipe suggestions.</p>

      <div className="mb-4">
        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
          Upload Ingredient Photo:
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-green-50 file:text-green-700
            hover:file:bg-green-100 cursor-pointer"
        />
      </div>

      {uploadedImagePreviewUrl && (
        <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-col items-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Image Preview:</h3>
          <img src={uploadedImagePreviewUrl} alt="Preview" className="max-w-full h-48 object-contain rounded-md mx-auto shadow-md" />
          <button
            onClick={onRemoveImage}
            className="mt-4 bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition duration-200 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Remove Image
          </button>
        </div>
      )}

      <button
        onClick={handleAnalyzeImage}
        className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!uploadedImageFile || isLoading}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
            Analyzing...
          </div>
        ) : (
          'Analyze Ingredients'
        )}
      </button>

      {isLoading && (
        <div className="mt-6">
          <LoadingSpinner message="Analyzing your ingredients..." />
        </div>
      )}
    </div>
  );
};

export default ImageUploader;