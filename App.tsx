import React, { useState, useEffect, useCallback, createContext } from 'react';
import { Ingredient, Recipe, TabName, ShoppingListItem } from './types';
import ImageUploader from './components/ImageUploader';
import RecipeDisplay from './components/RecipeDisplay';
import FridgeInventory from './components/FridgeInventory';
import ChatInterface from './components/ChatInterface';
import ImageGenerator from './components/ImageGenerator';
import HealthProfile from './components/HealthProfile'; // NEW
import BottomNavigationBar from './components/BottomNavigationBar'; // NEW
import geminiService from './services/geminiService';
import { INVENTORY_MILK_EXPIRY_THRESHOLD_DAYS } from './constants';
import LoadingSpinner from './components/LoadingSpinner';

// Create a context to provide ChatInterface controls to children
export const ChatControlContext = createContext<{
  isChatOverlayOpen: boolean;
  setIsChatOverlayOpen: (isOpen: boolean) => void;
  startLiveSession: (initialPrompt?: string) => Promise<void>; // Modified: Accepts optional initialPrompt
  stopLiveSession: () => void;
  isLiveSessionActive: boolean;
  isThinking: boolean;
} | null>(null);

function App() {
  const [activeTab, setActiveTab] = useState<TabName>('scan');
  const [fridgeInventory, setFridgeInventory] = useState<Ingredient[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]); // NEW State for Shopping List
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

  // State for ChatInterface overlay
  const [isChatOverlayOpen, setIsChatOverlayOpen] = useState<boolean>(false);
  // States passed from ChatInterface for live session status
  const [isLiveSessionActive, setIsLiveSessionActive] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  // Modified: Adjust useState setter to match the new signature of startLiveSession
  const [startLiveSession, setStartLiveSession] = useState<(_initialPrompt?: string) => Promise<void>>(() => async (_initialPrompt?: string) => {});
  const [stopLiveSession, setStopLiveSession] = useState<() => void>(() => () => {});


  // Simulate dietary preferences from a user profile
  const dietaryPreferences = 'vegetarian, low-carb';

  // --- Consolidated Image Analysis & Recipe Generation ---
  const initiateFullScanProcess = useCallback(async (file: File) => {
    setImageAnalysisLoading(true); // Indicate image analysis is starting
    setRecipeGenerationLoading(true); // Indicate recipe generation is part of the process
    setImageAnalysisError(null);
    setRecipeGenerationError(null);

    try {
      // 1. Analyze Image
      const reader = new FileReader();
      const base64ImagePromise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      });
      reader.readAsDataURL(file);
      const base64Image = await base64ImagePromise;
      const mimeType = file.type;

      const { ingredients, rawAnalysis } = await geminiService.analyzeImage(
        base64Image,
        mimeType,
      );

      // Update inventory (and log health event)
      setFridgeInventory((prev) => {
        const newInventory = [...prev];
        ingredients.forEach(newIng => {
          const existingIndex = newInventory.findIndex(ing => ing.name.toLowerCase() === newIng.name.toLowerCase());
          if (existingIndex > -1) {
            newInventory[existingIndex].quantity = newIng.quantity;
            newInventory[existingIndex].freshness = newIng.freshness;
          } else {
            newInventory.push(newIng);
          }
        });
        return newInventory;
      });
      setHealthLog((prev) => [...prev, `Analyzed new ingredients. Raw analysis: ${rawAnalysis}`]);

      // 2. Generate Recipes
      const recipes = await geminiService.generateRecipes(ingredients, dietaryPreferences);
      setGeneratedRecipes(recipes);
      setSelectedRecipe(null); // Reset selected recipe

      // 3. Navigate to Recipes tab
      setActiveTab('recipes');

    } catch (err: any) {
      console.error('Error during full scan process:', err);
      setImageAnalysisError(`Failed to process image and generate recipes: ${err.message || 'Unknown error'}.`);
      setGeneratedRecipes([]); // Clear any partially generated recipes
    } finally {
      setImageAnalysisLoading(false);
      setRecipeGenerationLoading(false);
    }
  }, [dietaryPreferences, setFridgeInventory, setHealthLog, setGeneratedRecipes, setSelectedRecipe, setActiveTab]);


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
    const milkItem = newInventory.find(item => item.name.toLowerCase().includes('milk') && item.freshness === 'good');
    if (milkItem && !healthLog.includes(`Proactive alert: ${milkItem.name} is expiring soon!`)) {
      setHealthLog((prev) => [...prev, `Proactive alert: ${milkItem.name} is expiring soon!`]);
      console.log(`Proactive alert: ${milkItem.name} is expiring soon!`);
    }
  }, [healthLog]);

  // --- Shopping List Management ---
  const handleUpdateShoppingList = useCallback((updatedList: ShoppingListItem[]) => {
    setShoppingList(updatedList);
  }, []);

  // --- Proactive Alerts (Example: Milk Expiry) ---
  useEffect(() => {
    const checkExpiry = () => {
      const updatedInventory = fridgeInventory.map(item => {
        if (item.name.toLowerCase().includes('milk') && item.freshness === 'good') {
          const daysUntilExpiry = 1; // For demonstration, assume 1 day left
          if (daysUntilExpiry <= INVENTORY_MILK_EXPIRY_THRESHOLD_DAYS) {
            return { ...item, freshness: 'expiring' };
          }
        }
        return item;
      });
      if (JSON.stringify(updatedInventory) !== JSON.stringify(fridgeInventory)) {
        setFridgeInventory(updatedInventory);
      }
    };

    const interval = setInterval(checkExpiry, 60000); // Check every minute for demo
    checkExpiry(); // Initial check
    return () => clearInterval(interval);
  }, [fridgeInventory]);

  const chatViewMode = activeTab === 'voicechat' ? 'tab' : (isChatOverlayOpen ? 'overlay' : 'hidden');

  return (
    <div className="relative min-h-screen flex flex-col items-center p-4 pb-20 bg-gradient-to-br from-slate-900 to-indigo-950 antialiased">
      <header className="w-full max-w-4xl bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg p-6 mb-6">
        <h1 className="text-4xl font-extrabold text-center text-cyan-400 mb-2 tracking-tight">Fridge to Fork 🥕</h1>
        <p className="text-center text-gray-300 text-lg">Your smart kitchen companion.</p>
      </header>

      <ChatControlContext.Provider value={{
        isChatOverlayOpen,
        setIsChatOverlayOpen,
        startLiveSession,
        stopLiveSession,
        isLiveSessionActive,
        isThinking,
      }}>
        <main className="w-full max-w-4xl flex-1 mb-20 flex flex-col"> {/* Added flex flex-col for proper tab layout */}
          {activeTab === 'scan' && (
            <section className="animate-fade-in flex-1">
              <ImageUploader
                onScanAndGenerateRecipes={initiateFullScanProcess} // Pass the combined function
                onLoadingChange={handleImageUploadLoadingChange}
                onError={handleImageUploadError}
                uploadedImageFile={uploadedImageFile}
                uploadedImagePreviewUrl={uploadedImagePreviewUrl}
                setUploadedImageFile={setUploadedImageFile}
                setUploadedImagePreviewUrl={setUploadedImagePreviewUrl}
                onRemoveImage={handleRemoveImage}
                analyzedIngredients={fridgeInventory} // Pass current inventory for display if needed
              />
              {imageAnalysisError && (
                <p className="text-rose-400 text-center mt-4 text-sm">{imageAnalysisError}</p>
              )}

              {(imageAnalysisLoading || recipeGenerationLoading) && !imageAnalysisError && (
                <div className="mt-8">
                  <LoadingSpinner message={imageAnalysisLoading ? "Analyzing your ingredients with Chef Fridge..." : "Chef Fridge is thinking up delicious recipes with your ingredients..."} />
                </div>
              )}
            </section>
          )}

          {activeTab === 'recipes' && (
            <section className="animate-fade-in flex-1">
              {!recipeGenerationLoading && !recipeGenerationError && (
                <RecipeDisplay
                  recipes={generatedRecipes}
                  onRecipeSelected={setSelectedRecipe}
                  selectedRecipe={selectedRecipe}
                />
              )}
              {/* The "No recipes generated yet..." message will now be handled within RecipeDisplay */}
              {(recipeGenerationLoading || imageAnalysisLoading) && !recipeGenerationError && (
                <div className="mt-8">
                  <LoadingSpinner message={imageAnalysisLoading ? "Analyzing your ingredients with Chef Fridge..." : "Chef Fridge is thinking up delicious recipes with your ingredients..."} />
                </div>
              )}
            </section>
          )}

          {activeTab === 'inventory' && (
            <section className="animate-fade-in flex-1">
              <FridgeInventory
                inventory={fridgeInventory}
                onUpdateInventory={handleUpdateInventory}
                shoppingList={shoppingList}
                onUpdateShoppingList={handleUpdateShoppingList}
                healthLog={healthLog}
              />
            </section>
          )}

          {activeTab === 'imageGen' && (
            <section className="animate-fade-in flex-1">
              <ImageGenerator />
            </section>
          )}

          {activeTab === 'health' && (
            <section className="animate-fade-in flex-1">
              <HealthProfile healthLog={healthLog} />
            </section>
          )}
          
          {/* Render ChatInterface here, controlling its visibility/mode with viewMode */}
          <ChatInterface
            viewMode={chatViewMode}
            onClose={() => {
              setIsChatOverlayOpen(false);
              stopLiveSession(); // Ensure live session is stopped when chat overlay closes
            }}
            setLiveSessionActive={setIsLiveSessionActive}
            setThinking={setIsThinking}
            setStartLiveSession={setStartLiveSession}
            setStopLiveSession={setStopLiveSession}
          />
        </main>

        <BottomNavigationBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </ChatControlContext.Provider>
    </div>
  );
}

export default App;