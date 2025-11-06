import React, { useState } from 'react';
import { Ingredient, ShoppingListItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FridgeInventoryProps {
  inventory: Ingredient[];
  onUpdateInventory: (newInventory: Ingredient[]) => void;
  shoppingList: ShoppingListItem[];
  onUpdateShoppingList: (newShoppingList: ShoppingListItem[]) => void;
  healthLog: string[];
}

const FridgeInventory: React.FC<FridgeInventoryProps> = ({ inventory, onUpdateInventory, shoppingList, onUpdateShoppingList, healthLog }) => {
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientFreshness, setNewIngredientFreshness] = useState('fresh');
  const [editIngredientIndex, setEditIngredientIndex] = useState<number | null>(null);

  const [newShoppingItemName, setNewShoppingItemName] = useState('');
  const [editShoppingItemIndex, setEditShoppingItemIndex] = useState<string | null>(null);

  const handleAddOrUpdateIngredient = () => {
    if (!newIngredientName.trim() || !newIngredientQuantity.trim()) {
      alert('Ingredient name and quantity cannot be empty.');
      return;
    }

    const newIngredient: Ingredient = {
      name: newIngredientName.trim(),
      quantity: newIngredientQuantity.trim(),
      freshness: newIngredientFreshness,
    };

    let updatedInventory: Ingredient[];
    if (editIngredientIndex !== null) {
      updatedInventory = inventory.map((item, index) =>
        index === editIngredientIndex ? newIngredient : item
      );
    } else {
      updatedInventory = [...inventory, newIngredient];
    }
    onUpdateInventory(updatedInventory);
    setNewIngredientName('');
    setNewIngredientQuantity('');
    setNewIngredientFreshness('fresh');
    setEditIngredientIndex(null);
  };

  const handleEditIngredient = (index: number) => {
    setEditIngredientIndex(index);
    const ingredientToEdit = inventory[index];
    setNewIngredientName(ingredientToEdit.name);
    setNewIngredientQuantity(ingredientToEdit.quantity);
    setNewIngredientFreshness(ingredientToEdit.freshness);
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    onUpdateInventory(inventory.filter((_, index) => index !== indexToRemove));
  };

  const categorizeIngredients = (ingredients: Ingredient[]) => {
    const categories: { [key: string]: Ingredient[] } = {};
    ingredients.forEach(item => {
      let category = 'Other';
      if (item.name.toLowerCase().includes('milk') || item.name.toLowerCase().includes('cheese') || item.name.toLowerCase().includes('yogurt')) {
        category = 'Dairy';
      } else if (item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('beef') || item.name.toLowerCase().includes('fish')) {
        category = 'Meat & Seafood';
      } else if (item.name.toLowerCase().includes('carrot') || item.name.toLowerCase().includes('apple') || item.name.toLowerCase().includes('lettuce')) {
        category = 'Produce';
      } else if (item.name.toLowerCase().includes('bread') || item.name.toLowerCase().includes('rice') || item.name.toLowerCase().includes('pasta')) {
        category = 'Pantry & Grains';
      }
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(item);
    });
    return categories;
  };

  const ingredientCategories = categorizeIngredients(inventory);
  const expiringItems = inventory.filter(item => item.freshness === 'expiring' || item.freshness === 'spoiled');

  // Shopping List Handlers
  const handleAddShoppingItem = () => {
    if (!newShoppingItemName.trim()) return;
    const newItem: ShoppingListItem = { id: uuidv4(), name: newShoppingItemName.trim(), checked: false };
    onUpdateShoppingList([...shoppingList, newItem]);
    setNewShoppingItemName('');
  };

  const handleUpdateShoppingItem = (id: string, newName: string) => {
    onUpdateShoppingList(shoppingList.map(item => item.id === id ? { ...item, name: newName } : item));
    setEditShoppingItemIndex(null);
  };

  const handleToggleShoppingItem = (id: string) => {
    onUpdateShoppingList(shoppingList.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleRemoveShoppingItem = (id: string) => {
    onUpdateShoppingList(shoppingList.filter(item => item.id !== id));
  };

  const clearCompletedShoppingItems = () => {
    onUpdateShoppingList(shoppingList.filter(item => !item.checked));
  };

  const mostCriticalExpiringItem = expiringItems.find(item => item.freshness === 'spoiled') || expiringItems[0];


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-gray-800/60 backdrop-blur-lg shadow-lg">
      {/* Expiry Alert Bento Box */}
      <div className="md:col-span-2 p-6 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-2xl shadow-md">
        <h2 className="text-3xl font-extrabold mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd" />
          </svg>
          Expiry Alerts
        </h2>
        {mostCriticalExpiringItem ? (
          <div>
            <p className="text-xl font-semibold mb-3">Heads up! Your <span className="underline">{mostCriticalExpiringItem.name}</span> is <span className="font-bold uppercase">{mostCriticalExpiringItem.freshness}</span>.</p>
            <button className="bg-white text-rose-600 font-bold py-3 px-6 rounded-xl hover:bg-gray-100 transition duration-200 shadow-md text-lg" aria-label={`Save ${mostCriticalExpiringItem.name} now`}>
              Save It Now! ✨
            </button>
          </div>
        ) : (
          <p className="text-lg opacity-90">No urgent expiring items. Keep up the good work!</p>
        )}
      </div>

      {/* Ingredient Categories Bento Box */}
      <div className="p-6 bg-gray-900/50 backdrop-blur-md rounded-2xl shadow-md md:col-span-1 flex flex-col h-full">
        <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" />
          </svg>
          Your Fridge Inventory
        </h3>
        {Object.keys(ingredientCategories).length === 0 ? (
          <p className="text-center text-gray-400 italic mt-4 text-base">Your fridge is looking a bit empty! Add some ingredients.</p>
        ) : (
          <div className="flex-1 space-y-4">
            {Object.entries(ingredientCategories).map(([category, items]) => (
              <div key={category} className="bg-gray-700/30 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-gray-700">
                <h4 className="text-xl font-semibold text-gray-200 mb-3 flex items-center">
                  {category === 'Produce' && <span className="mr-2">🥦</span>}
                  {category === 'Dairy' && <span className="mr-2">🥛</span>}
                  {category === 'Meat & Seafood' && <span className="mr-2">🥩</span>}
                  {category === 'Pantry & Grains' && <span className="mr-2">🍞</span>}
                  {category === 'Other' && <span className="mr-2">📦</span>}
                  {category} ({items.length})
                </h4>
                <ul className="divide-y divide-gray-700">
                  {items.map((item, index) => (
                    <li key={index} className="flex justify-between items-center py-2 group">
                      <div className="flex-1">
                        <p className="text-lg font-medium text-gray-100">{item.name}</p>
                        <p className="text-sm text-gray-400">Qty: {item.quantity} - Freshness: {item.freshness}</p>
                      </div>
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => handleEditIngredient(inventory.indexOf(item))}
                          className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700 transition duration-200"
                          aria-label={`Edit ${item.name}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveIngredient(inventory.indexOf(item))}
                          className="bg-rose-600 text-white px-3 py-1 rounded-md text-sm hover:bg-rose-700 transition duration-200"
                          aria-label={`Remove ${item.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 border rounded-xl bg-gray-700/30 backdrop-blur-sm shadow-sm border-gray-700">
          <h3 className="text-xl font-semibold text-gray-100 mb-3">{editIngredientIndex !== null ? 'Edit Ingredient' : 'Add New Ingredient'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Ingredient Name"
              value={newIngredientName}
              onChange={(e) => setNewIngredientName(e.target.value)}
              className="p-3 border border-gray-600 rounded-xl focus:ring-cyan-400 focus:border-cyan-400 text-base bg-gray-900 text-gray-100"
              aria-label="New ingredient name"
            />
            <input
              type="text"
              placeholder="Quantity (e.g., 2 cups)"
              value={newIngredientQuantity}
              onChange={(e) => setNewIngredientQuantity(e.target.value)}
              className="p-3 border border-gray-600 rounded-xl focus:ring-cyan-400 focus:border-cyan-400 text-base bg-gray-900 text-gray-100"
              aria-label="New ingredient quantity"
            />
            <select
              value={newIngredientFreshness}
              onChange={(e) => setNewIngredientFreshness(e.target.value)}
              className="p-3 border border-gray-600 rounded-xl focus:ring-cyan-400 focus:border-cyan-400 text-base bg-gray-900 text-gray-100"
              aria-label="New ingredient freshness"
            >
              <option value="fresh">Fresh</option>
              <option value="good">Good</option>
              <option value="expiring">Expiring Soon</option>
              <option value="spoiled">Spoiled</option>
            </select>
          </div>
          <button
            onClick={handleAddOrUpdateIngredient}
            className="w-full bg-gradient-to-r from-cyan-400 to-violet-500 text-white font-semibold py-3 px-4 rounded-xl hover:from-cyan-500 hover:to-violet-600 transition duration-200 shadow-md text-lg"
            aria-label={editIngredientIndex !== null ? 'Update ingredient' : 'Add ingredient'}
          >
            {editIngredientIndex !== null ? 'Update Ingredient' : 'Add Ingredient'}
          </button>
          {editIngredientIndex !== null && (
            <button
              onClick={() => {
                setEditIngredientIndex(null);
                setNewIngredientName('');
                setNewIngredientQuantity('');
                setNewIngredientFreshness('fresh');
              }}
              className="w-full mt-2 bg-gray-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-700 transition duration-200 shadow-md text-lg"
              aria-label="Cancel editing ingredient"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Shopping List Bento Box */}
      <div className="p-6 bg-gray-900/50 backdrop-blur-md rounded-2xl shadow-md md:col-span-1 flex flex-col h-full">
        <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 11a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-6 2a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zm-2 2a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zm10-4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM6 7a1 1 0 00-1 1v1a1 1 0 102 0V8a1 1 0 00-1-1zm-2 2a1 1 0 00-1 1v1a1 1 0 102 0v-1a1 1 0 00-1-1zm10 0a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-6-2a1 1 0 00-1 1v1a1 1 0 102 0V8a1 1 0 00-1-1zm2 0a1 1 0 011 1v1a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Shopping List
        </h3>
        <div className="mb-4 flex space-x-2">
          <input
            type="text"
            placeholder="Add item to list"
            value={newShoppingItemName}
            onChange={(e) => setNewShoppingItemName(e.target.value)}
            className="flex-1 p-3 border border-gray-600 rounded-xl focus:ring-cyan-400 focus:border-cyan-400 text-base bg-gray-900 text-gray-100"
            aria-label="New shopping list item name"
          />
          <button
            onClick={handleAddShoppingItem}
            className="bg-indigo-600 text-white font-semibold py-3 px-5 rounded-xl hover:bg-indigo-700 transition duration-200 shadow-md text-lg"
            aria-label="Add shopping item"
          >
            Add
          </button>
        </div>
        {shoppingList.length === 0 ? (
          <p className="text-center text-gray-400 italic mt-4 text-base">Your shopping list is empty. Time to plan a grocery trip!</p>
        ) : (
          <ul className="divide-y divide-gray-700 bg-gray-700/30 backdrop-blur-sm rounded-xl shadow-sm border border-gray-700 p-4 flex-1">
            {shoppingList.map((item) => (
              <li key={item.id} className="flex items-center py-2 group">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleShoppingItem(item.id)}
                  className="form-checkbox h-5 w-5 text-cyan-400 rounded focus:ring-cyan-400 mr-3 cursor-pointer"
                  aria-label={`Check ${item.name}`}
                />
                {editShoppingItemIndex === item.id ? (
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateShoppingItem(item.id, e.target.value)}
                    onBlur={() => setEditShoppingItemIndex(null)}
                    onKeyPress={(e) => { if (e.key === 'Enter') setEditShoppingItemIndex(null); }}
                    className="flex-1 p-1 border border-gray-600 rounded-md focus:ring-cyan-400 focus:border-cyan-400 text-lg bg-gray-900 text-gray-100"
                    aria-label={`Edit shopping item ${item.name}`}
                  />
                ) : (
                  <span
                    className={`flex-1 text-lg ${item.checked ? 'line-through text-gray-500' : 'text-gray-100'} cursor-pointer`}
                    onDoubleClick={() => setEditShoppingItemIndex(item.id)}
                    aria-label={item.name}
                  >
                    {item.name}
                  </span>
                )}
                <button
                  onClick={() => handleRemoveShoppingItem(item.id)}
                  className="ml-3 bg-rose-600 text-white p-1 rounded-md text-sm hover:bg-rose-700 transition duration-200 opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${item.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        {shoppingList.some(item => item.checked) && (
          <button
            onClick={clearCompletedShoppingItems}
            className="w-full mt-4 bg-gray-600 text-gray-100 font-semibold py-3 px-4 rounded-xl hover:bg-gray-700 transition duration-200 shadow-md text-lg"
            aria-label="Clear completed shopping items"
          >
            Clear Completed
          </button>
        )}
      </div>
    </div>
  );
};

export default FridgeInventory;