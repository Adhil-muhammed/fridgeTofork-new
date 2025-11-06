import React from 'react';
import { Ingredient } from '../types'; // Ingredient type is still used for local state/display if needed
import LoadingSpinner from './LoadingSpinner';

interface ImageUploaderProps {
  onLoadingChange: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
  uploadedImageFile: File | null;
  uploadedImagePreviewUrl: string | null;
  setUploadedImageFile: (file: File | null) => void;
  setUploadedImagePreviewUrl: (url: string | null) => void;
  onRemoveImage: () => void;
  // NEW: This prop handles the entire scan -> analyze -> generate recipes -> navigate flow
  onScanAndGenerateRecipes: (file: File) => Promise<void>;
  // This is for displaying ingredients if the process hasn't completed yet, or if there's an error.
  analyzedIngredients: Ingredient[];
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onLoadingChange,
  onError,
  uploadedImageFile,
  uploadedImagePreviewUrl,
  setUploadedImageFile,
  setUploadedImagePreviewUrl,
  onRemoveImage,
  onScanAndGenerateRecipes, // Destructure new prop
  analyzedIngredients, // Destructure analyzed ingredients from App.tsx
}) => {
  const [isLoadingInternal, setIsLoadingInternal] = React.useState<boolean>(false);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      setUploadedImagePreviewUrl(URL.createObjectURL(file));
      onError(null);
    } else {
      setUploadedImageFile(null);
      setUploadedImagePreviewUrl(null);
      onRemoveImage();
    }
  };

  const handleScanButtonClick = async () => {
    if (!uploadedImageFile) {
      onError('Please select an image to analyze.');
      return;
    }
    setIsLoadingInternal(true);
    onLoadingChange(true); // Notify parent App.tsx about loading state
    onError(null);

    try {
      await onScanAndGenerateRecipes(uploadedImageFile); // Trigger the full process in App.tsx
    } catch (err: any) {
      // Error handling is primarily done in App.tsx now, but keep a fallback
      console.error('Error during scan and recipe generation:', err);
      onError(`Failed to process: ${err.message || 'Unknown error'}.`);
    } finally {
      setIsLoadingInternal(false);
      onLoadingChange(false); // Notify parent App.tsx that loading is complete
    }
  };

  return (
    <div className="p-6 bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg max-w-2xl mx-auto my-6 animate-fade-in text-gray-100">
      <h2 className="text-3xl font-bold text-gray-100 mb-4 border-b border-gray-700 pb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-4 3 3 5-5V15zm0-12H4v2h12V3z" />
        </svg>
        Scan Your Fridge
      </h2>
      <p className="text-gray-300 mb-6 text-lg">Snap a photo of your fridge contents and let Chef Fridge do the magic!</p>

      <div className={`mb-6 p-8 bg-gray-900/50 border-4 border-dashed ${uploadedImagePreviewUrl ? 'border-emerald-400' : 'border-gray-700'} rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 group ${isLoadingInternal ? 'animate-pulse-light' : 'hover:border-cyan-400 hover:bg-violet-900/20'}`}>
        {!uploadedImagePreviewUrl ? (
          <>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Upload ingredient photo"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-400 group-hover:text-cyan-400 mb-4 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6H16a2 2 0 012 2v1H6a2 2 0 00-2 2v2m2 5l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <p className="text-gray-200 group-hover:text-cyan-200 text-xl font-bold mb-2 transition-colors duration-300">Drag & Drop or Click to Upload</p>
            <p className="text-gray-400 group-hover:text-cyan-300 text-base transition-colors duration-300">PNG, JPG, GIF up to 10MB</p>
          </>
        ) : (
          <div className="relative w-full h-64 flex items-center justify-center">
            <img src={uploadedImagePreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl shadow-md" />
            <button
              onClick={onRemoveImage}
              className="absolute top-2 right-2 bg-rose-600 text-white p-2 rounded-full hover:bg-rose-700 transition duration-200 shadow-md"
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleScanButtonClick}
        className="w-full bg-gradient-to-r from-cyan-400 to-emerald-500 text-white font-bold py-4 px-4 rounded-xl hover:from-cyan-500 hover:to-emerald-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-xl flex items-center justify-center"
        disabled={!uploadedImageFile || isLoadingInternal}
        aria-label="Analyze ingredients"
      >
        {isLoadingInternal ? (
          <>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
            Scanning & Generating Recipes...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            Scan My Fridge
          </>
        )}
      </button>

      {isLoadingInternal && (
        <div className="mt-8">
          <LoadingSpinner message="Chef Fridge is identifying your items and creating recipes..." />
        </div>
      )}

      {analyzedIngredients.length > 0 && !isLoadingInternal && (
        <div className="mt-8 p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl animate-fade-in">
          <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Ingredients Found:
          </h3>
          <ul className="list-disc list-inside space-y-2 text-lg text-gray-200">
            {analyzedIngredients.map((item, index) => (
              <li key={index} className="flex items-center">
                <span className="font-semibold text-cyan-300 mr-2">{item.name}:</span> {item.quantity} - <span className={`font-medium ${item.freshness === 'expiring' ? 'text-orange-300' : item.freshness === 'spoiled' ? 'text-rose-400' : 'text-emerald-300'}`}>{item.freshness}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-gray-300 text-base">These items have been added to your Fridge Inventory!</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;