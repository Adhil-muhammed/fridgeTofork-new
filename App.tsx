import React, { useState, useEffect, useCallback } from 'react';
import { Ingredient, Recipe, TabName } from './types';
import ImageUploader from './components/ImageUploader';
import RecipeDisplay from './components/RecipeDisplay';
import FridgeInventory from './components/FridgeInventory';
import ChatInterface from './components/ChatInterface';
import ImageGenerator from './components/ImageGenerator';
import geminiService from './services/geminiService';
import { INVENTORY_MILK_EXPIRY_THRESHOLD_DAYS } from './constants';
import LoadingSpinner from './components/LoadingSpinner'; // Import LoadingSpinner

function App() {
  const [activeTab, setActiveTab] = useState<TabName>('scan');
  const [fridgeInventory, setFridgeInventory] = useState<Ingredient[]>([]);
  const [healthLog, setHealthLog] = useState<string[]>([]);
  const [generatedRecipes, setGeneratedRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState<boolean>(false);
  const [recipeGenerationLoading, setRecipeGenerationLoading] = useState<boolean>(false);
  const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);
  const [recipeGenerationError, setRecipeGenerationError] = useState<string | null>(null);

  // State for persistent uploaded image
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedImagePreviewUrl, setUploadedImagePreviewUrl] = useState<string | null>(null);

  // Simulate dietary preferences from a user profile
  const dietaryPreferences = 'vegetarian, low-carb';

  // --- Image Analysis & Recipe Generation ---
  const handleIngredientsAnalyzed = useCallback((ingredients: Ingredient[], rawAnalysis: string) => {
    setFridgeInventory((prev) => {
      // Basic deduplication or merging could happen here if needed
      const newInventory = [...prev];
      ingredients.forEach(newIng => {
        const existingIndex = newInventory.findIndex(ing => ing.name.toLowerCase() === newIng.name.toLowerCase());
        if (existingIndex > -1) {
          // Update quantity or freshness, or ignore if already added
          // For simplicity, just updating quantity here.
          newInventory[existingIndex].quantity = newIng.quantity;
          newInventory[existingIndex].freshness = newIng.freshness;
        } else {
          newInventory.push(newIng);
        }
      });
      return newInventory;
    });
    setImageAnalysisError(null);
    // Do NOT automatically trigger recipe generation here.
    // User will click the "Generate / Refresh Recipes" button explicitly.
    // Simulate adding to health log (e.g., based on analysis)
    setHealthLog((prev) => [...prev, `Analyzed new ingredients. Raw analysis: ${rawAnalysis}`]);
  }, []);

  const handleGenerateRecipesFromInventory = useCallback(async () => {
    if (fridgeInventory.length === 0) {
      setRecipeGenerationError('Add ingredients to your fridge or scan an image first to generate recipes!');
      setGeneratedRecipes([]);
      return;
    }
    setRecipeGenerationLoading(true);
    setRecipeGenerationError(null);
    try {
      const recipes = await geminiService.generateRecipes(fridgeInventory, dietaryPreferences);
      setGeneratedRecipes(recipes);
      setSelectedRecipe(null); // Reset selected recipe
    } catch (err: any) {
      console.error('Error generating recipes:', err);
      setRecipeGenerationError(`Failed to generate recipes: ${err.message || 'Unknown error'}. Please try again.`);
      setGeneratedRecipes([]);
    } finally {
      setRecipeGenerationLoading(false);
    }
  }, [fridgeInventory, dietaryPreferences]);

  const handleImageUploadLoadingChange = useCallback((isLoading: boolean) => {
    setImageAnalysisLoading(isLoading);
  }, []);

  const handleImageUploadError = useCallback((error: string | null) => {
    setImageAnalysisError(error);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setUploadedImageFile(null);
    setUploadedImagePreviewUrl(null);
    setGeneratedRecipes([]); // Clear recipes when image is removed
    setSelectedRecipe(null); // Clear selected recipe
    setImageAnalysisError(null);
    setRecipeGenerationError(null);
  }, []);

  // --- Fridge Inventory Management ---
  const handleUpdateInventory = useCallback((newInventory: Ingredient[]) => {
    setFridgeInventory(newInventory);
    // Simulate proactive alert if milk is expiring
    const milkItem = newInventory.find(item => item.name.toLowerCase().includes('milk') && item.freshness === 'expiring');
    if (milkItem && !healthLog.includes(`Proactive alert: ${milkItem.name} is expiring soon!`)) {
      setHealthLog((prev) => [...prev, `Proactive alert: ${milkItem.name} is expiring soon!`]);
      // In a real app, this would trigger a voice alert in the ChatInterface or a notification
      console.log(`Proactive alert: ${milkItem.name} is expiring soon!`);
    }
  }, [healthLog]);

  // --- Proactive Alerts (Example: Milk Expiry) ---
  useEffect(() => {
    // This effect simulates checking for expiring items.
    // In a real app, this might run periodically or be triggered by data changes.
    const checkExpiry = () => {
      const updatedInventory = fridgeInventory.map(item => {
        // For demonstration, assume "milk" items that are "good" might become "expiring"
        // In a real app, this would be based on actual expiry dates.
        if (item.name.toLowerCase().includes('milk') && item.freshness === 'good') {
          // Simulate expiry logic
          const daysUntilExpiry = 1; // For demonstration, assume 1 day left
          if (daysUntilExpiry <= INVENTORY_MILK_EXPIRY_THRESHOLD_DAYS) {
            return { ...item, freshness: 'expiring' };
          }
        }
        return item;
      });
      // Only update if there's an actual change to prevent infinite re-renders
      if (JSON.stringify(updatedInventory) !== JSON.stringify(fridgeInventory)) {
        setFridgeInventory(updatedInventory);
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute for demo
    checkExpiry(); // Initial check
    return () => clearInterval(interval);
  }, [fridgeInventory]);


  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <header className="w-full max-w-4xl bg-white rounded-lg shadow-md p-4 mb-6 sticky top-4 z-10">
        <h1 className="text-3xl font-extrabold text-center text-green-700 mb-4">Fridge to Fork 🥕</h1>
        <nav className="flex justify-center space-x-2 sm:space-x-4 border-t pt-4">
          <button
            className={`py-2 px-3 sm:px-4 rounded-full text-sm sm:text-base font-semibold transition duration-200
              ${activeTab === 'scan' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('scan')}
          >
            Fridge Scan & Recipes
          </button>
          <button
            className={`py-2 px-3 sm:px-4 rounded-full text-sm sm:text-base font-semibold transition duration-200
              ${activeTab === 'chat' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('chat')}
          >
            Live Chef Chat
          </button>
          <button
            className={`py-2 px-3 sm:px-4 rounded-full text-sm sm:text-base font-semibold transition duration-200
              ${activeTab === 'inventory' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('inventory')}
          >
            Fridge Inventory
          </button>
          <button
            className={`py-2 px-3 sm:px-4 rounded-full text-sm sm:text-base font-semibold transition duration-200
              ${activeTab === 'imageGen' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('imageGen')}
          >
            Image Generator
          </button>
        </nav>
      </header>

      <main className="w-full max-w-4xl flex-1">
        {activeTab === 'scan' && (
          <section>
            <ImageUploader
              onIngredientsAnalyzed={handleIngredientsAnalyzed}
              onLoadingChange={handleImageUploadLoadingChange}
              onError={handleImageUploadError}
              uploadedImageFile={uploadedImageFile}
              uploadedImagePreviewUrl={uploadedImagePreviewUrl}
              setUploadedImageFile={setUploadedImageFile}
              setUploadedImagePreviewUrl={setUploadedImagePreviewUrl}
              onRemoveImage={handleRemoveImage}
            />
            {imageAnalysisError && (
              <p className="text-red-600 text-center mt-4">{imageAnalysisError}</p>
            )}

            {fridgeInventory.length > 0 && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleGenerateRecipesFromInventory}
                  className="bg-purple-600 text-white font-bold py-3 px-6 rounded-full hover:bg-purple-700 transition duration-300 ease-in-out transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                  disabled={recipeGenerationLoading || imageAnalysisLoading}
                >
                  {recipeGenerationLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Generating Recipes...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12c0 1.511.433 2.943 1.258 4.148M16 16v-5h.582m-15.356-2A8.001 8.001 0 0120 12c0-1.511-.433-2.943-1.258-4.148" />
                      </svg>
                      Generate / Refresh Recipes
                    </>
                  )}
                </button>
                {recipeGenerationError && (
                  <p className="text-red-600 text-center mt-4">{recipeGenerationError}</p>
                )}
              </div>
            )}

            {(recipeGenerationLoading || imageAnalysisLoading) && !recipeGenerationError && (
              <div className="mt-6">
                <LoadingSpinner message={imageAnalysisLoading ? "Analyzing your ingredients..." : "Chef Fridge is thinking up delicious recipes with your ingredients..."} />
              </div>
            )}

            {!recipeGenerationLoading && !recipeGenerationError && generatedRecipes.length > 0 && (
              <RecipeDisplay
                recipes={generatedRecipes}
                onRecipeSelected={setSelectedRecipe}
                selectedRecipe={selectedRecipe}
              />
            )}
            {/* Display message if no recipes are generated yet and not loading/error */}
            {!recipeGenerationLoading && !recipeGenerationError && generatedRecipes.length === 0 && fridgeInventory.length > 0 && (
              <p className="text-center text-gray-500 italic mt-6">Click "Generate / Refresh Recipes" to see suggestions based on your inventory.</p>
            )}
          </section>
        )}

        {activeTab === 'chat' && (
          <section className="h-[calc(100vh-180px)]"> {/* Adjust height based on header/footer */}
            <ChatInterface />
          </section>
        )}

        {activeTab === 'inventory' && (
          <section>
            <FridgeInventory inventory={fridgeInventory} onUpdateInventory={handleUpdateInventory} />
            <div className="p-4 bg-white rounded-lg shadow-md max-w-2xl mx-auto my-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Health Log & Alerts</h3>
              {healthLog.length === 0 ? (
                <p className="text-gray-500 italic">No health log entries yet.</p>
              ) : (
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {healthLog.map((log, index) => (
                    <li key={index}>{log}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === 'imageGen' && (
          <section>
            <ImageGenerator />
          </section>
        )}
      </main>
    </div>
  );
}

export default App;