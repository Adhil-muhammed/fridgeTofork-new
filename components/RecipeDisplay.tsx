import React from 'react';
import { Recipe } from '../types';

interface RecipeDisplayProps {
  recipes: Recipe[];
  onRecipeSelected: (recipe: Recipe) => void;
  selectedRecipe: Recipe | null;
}

const RecipeDisplay: React.FC<RecipeDisplayProps> = ({ recipes, onRecipeSelected, selectedRecipe }) => {
  if (recipes.length === 0) {
    return (
      <p className="text-center text-gray-500 italic mt-6">No recipes generated yet. Upload ingredients to get started!</p>
    );
  }

  return (
    <div className="mt-6 p-4 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Suggested Recipes</h3>
      <div className="space-y-4">
        {recipes.map((recipe, index) => (
          <div
            key={index}
            className={`p-4 border rounded-lg cursor-pointer transition duration-200
                       ${selectedRecipe?.name === recipe.name ? 'border-green-500 ring-2 ring-green-200 bg-green-50' : 'border-gray-200 hover:shadow-sm'}`}
            onClick={() => onRecipeSelected(recipe)}
          >
            <h4 className="text-lg font-semibold text-gray-900 mb-1">{recipe.name}</h4>
            <p className="text-gray-700 text-sm mb-2">{recipe.summary}</p>
            <p className="text-green-700 text-sm font-medium">✨ Health Insight: {recipe.healthInsight}</p>

            {selectedRecipe?.name === recipe.name && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <h5 className="font-medium text-gray-800 mb-1">Ingredients:</h5>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  {recipe.ingredients.map((ingredient, i) => (
                    <li key={i}>{ingredient}</li>
                  ))}
                </ul>
                <button
                  onClick={() => alert(`Great choice! Starting ${recipe.name}. (Inventory would be updated here)`)}
                  className="mt-4 bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200"
                >
                  Cook This Recipe!
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipeDisplay;