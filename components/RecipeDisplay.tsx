import React, { useState } from 'react';
import { Recipe } from '../types';

interface RecipeDisplayProps {
  recipes: Recipe[];
  onRecipeSelected: (recipe: Recipe | null) => void; // Allow setting null to deselect
  selectedRecipe: Recipe | null;
}

const RecipeDisplay: React.FC<RecipeDisplayProps> = ({ recipes, onRecipeSelected, selectedRecipe }) => {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [cookingMode, setCookingMode] = useState<boolean>(false);

  const allFilters = ['Quick (<30 Mins)', 'Vegetarian', 'Low Carb', 'High Protein']; // Example filters

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const filteredRecipes = recipes.filter(recipe => {
    // Implement actual filtering logic here based on recipe properties
    // For now, this is a placeholder.
    if (activeFilters.length === 0) return true;
    return activeFilters.some(filter => {
      if (filter === 'Vegetarian') return recipe.summary.toLowerCase().includes('vegetarian');
      if (filter === 'Low Carb') return recipe.healthInsight.toLowerCase().includes('low carb');
      // Add more sophisticated filtering as needed
      return true;
    });
  });

  // --- Cooking Mode View (retains background for readability) ---
  if (cookingMode && selectedRecipe) {
    return (
      <div className="mt-6 p-6 bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg max-w-2xl mx-auto animate-fade-in text-gray-100">
        <button
          onClick={() => setCookingMode(false)}
          className="mb-4 text-cyan-400 hover:text-cyan-600 flex items-center text-lg font-semibold"
          aria-label="Back to recipe details"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Recipe Details
        </button>
        <h2 className="text-4xl font-extrabold text-cyan-400 mb-4">{selectedRecipe.name}</h2>
        
        <p className="text-gray-300 text-xl leading-relaxed mb-6">{selectedRecipe.summary}</p>

        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-100 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.243 3.03a1 1 0 01.782-.07l7 2a1 1 0 01.55 1.63L16.2 10.59a1 1 0 01-.782.07l-7-2a1 1 0 01-.55-1.63L9.243 3.03zM4 11.002v3.668a1 1 0 00.89 1.054l7 2a1 1 0 00.55-1.63l-1.424-2.847L4.99 10.59a1 1 0 00-.55-.16L4 11.002z" clipRule="evenodd" />
            </svg>
            Ingredients
          </h3>
          <ul className="list-disc list-outside ml-6 text-xl text-gray-200 leading-relaxed space-y-2">
            {selectedRecipe.ingredients.map((ingredient, i) => (
              <li key={i}>{ingredient}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-gray-100 mb-3 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11.586a2 2 0 00.586 1.414L5 20.414V17.5a1 1 0 011-1h6.5a1 1 0 011 1V20l2.414-2.414A2 2 0 0018 15.586V4a2 2 0 00-2-2H4zm.586 10.414a1 1 0 011.414 0L7 13.586l1.293-1.293a1 1 0 011.414 1.414L8.414 15l1.293 1.293a1 1 0 01-1.414 1.414L7 16.414l-1.293 1.293a1 1 0 01-1.414-1.414L5.586 15l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Instructions
          </h3>
          <ol className="list-decimal list-outside ml-6 text-xl text-gray-200 leading-relaxed space-y-3">
            {/* Placeholder instructions, replace with actual recipe steps if available */}
            <li>Preheat oven to 375°F (190°C).</li>
            <li>Prepare ingredients as listed.</li>
            <li>Combine all ingredients in a large bowl.</li>
            <li>Bake for 20-25 minutes, or until golden brown.</li>
            <li>Serve hot and enjoy!</li>
          </ol>
        </div>

        <button
          onClick={() => { alert(`Enjoy your ${selectedRecipe.name}!`); setCookingMode(false); onRecipeSelected(null); }}
          className="mt-8 w-full bg-gradient-to-r from-cyan-400 to-emerald-500 text-white font-bold py-4 px-6 rounded-xl hover:from-cyan-500 hover:to-emerald-600 transition duration-200 shadow-lg text-xl"
          aria-label={`Mark ${selectedRecipe.name} as cooked`}
        >
          I'm Cooking This!
        </button>
      </div>
    );
  }

  // --- Recipe Detail Overlay (when a recipe card is selected) ---
  if (selectedRecipe && !cookingMode) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-xl flex flex-col items-center justify-start p-4 animate-fade-in-up">
        <div className="w-full max-w-2xl bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-2xl p-6 text-gray-100 flex flex-col relative overflow-hidden">
          <button
            onClick={() => onRecipeSelected(null)}
            className="absolute top-4 left-4 text-cyan-400 hover:text-cyan-600 flex items-center text-lg font-semibold z-10"
            aria-label="Back to recipe list"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          
          <h2 className="text-4xl font-extrabold text-cyan-400 mb-4 text-center mt-12">{selectedRecipe.name}</h2>
          
          <p className="text-gray-300 text-xl leading-relaxed mb-6">{selectedRecipe.summary}</p>

          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-100 mb-3 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.243 3.03a1 1 0 01.782-.07l7 2a1 1 0 01.55 1.63L16.2 10.59a1 1 0 01-.782.07l-7-2a1 1 0 01-.55-1.63L9.243 3.03zM4 11.002v3.668a1 1 0 00.89 1.054l7 2a1 1 0 00.55-1.63l-1.424-2.847L4.99 10.59a1 1 0 00-.55-.16L4 11.002z" clipRule="evenodd" />
              </svg>
              Ingredients
            </h3>
            <ul className="list-disc list-outside ml-6 text-xl text-gray-200 leading-relaxed space-y-2">
              {selectedRecipe.ingredients.map((ingredient, i) => (
                <li key={i}>{ingredient}</li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setCookingMode(true)}
            className="mt-8 w-full bg-gradient-to-r from-cyan-400 to-emerald-500 text-white font-bold py-4 px-6 rounded-xl hover:from-cyan-500 hover:to-emerald-600 transition duration-200 shadow-lg text-xl"
            aria-label={`Start cooking ${selectedRecipe.name}`}
          >
            Cook This Recipe!
          </button>
        </div>
      </div>
    );
  }

  // --- Recipe List View (no main background) ---
  return (
    <div className="mt-6 p-0 max-w-2xl mx-auto animate-fade-in text-gray-100">
      <div className="p-6 bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg mb-6"> {/* Filters in a distinct section */}
        <h3 className="text-3xl font-bold text-gray-100 mb-5 border-b border-gray-700 pb-3 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          Suggested Recipes
        </h3>

        {recipes.length === 0 ? (
          <p className="text-center text-gray-400 italic text-xl py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No recipes generated yet.<br/>Scan ingredients or manage your fridge to get started!
          </p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap gap-2">
              {allFilters.map(filter => (
                <button
                  key={filter}
                  onClick={() => toggleFilter(filter)}
                  className={`py-3 px-6 rounded-full text-lg font-bold transition duration-200 shadow-sm
                    ${activeFilters.includes(filter) ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  aria-pressed={activeFilters.includes(filter)}
                  aria-label={`Filter recipes by ${filter}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-6 bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg mt-6"> {/* Recipes list in a distinct section */}
        {filteredRecipes.length === 0 ? (
          <p className="text-center text-gray-400 italic text-xl py-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No recipes match your current filters.
          </p>
        ) : (
          <div className="space-y-6">
            {filteredRecipes.map((recipe, index) => (
              <div
                key={index}
                className={`relative bg-gray-900/30 backdrop-blur-lg border ${selectedRecipe?.name === recipe.name ? 'border-cyan-500 ring-4 ring-cyan-900/30' : 'border-gray-700'} rounded-2xl cursor-pointer overflow-hidden shadow-lg hover:shadow-cyan-500/30 hover:ring-2 hover:ring-cyan-500/50 transition-all duration-300 group`}
                onClick={() => onRecipeSelected(recipe)}
                role="button"
                tabIndex={0}
                aria-label={`Select recipe: ${recipe.name}`}
              >
                {/* Removed recipe.imageUrl from list cards for cleaner UI */}
                <div className="p-6"> {/* Increased padding here */}
                  <h4 className="text-2xl font-bold text-gray-100 mb-2">{recipe.name}</h4>
                  <p className="text-gray-300 text-base mb-3">{recipe.summary}</p>
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-emerald-400 to-lime-500 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md flex items-center">
                    ✨ {recipe.healthInsight}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeDisplay;