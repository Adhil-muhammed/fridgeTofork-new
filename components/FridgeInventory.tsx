import React, { useState } from 'react';
import { Ingredient } from '../types';

interface FridgeInventoryProps {
  inventory: Ingredient[];
  onUpdateInventory: (newInventory: Ingredient[]) => void;
}

const FridgeInventory: React.FC<FridgeInventoryProps> = ({ inventory, onUpdateInventory }) => {
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientFreshness, setNewIngredientFreshness] = useState('fresh');
  const [editIndex, setEditIndex] = useState<number | null>(null);

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
    if (editIndex !== null) {
      updatedInventory = inventory.map((item, index) =>
        index === editIndex ? newIngredient : item
      );
    } else {
      updatedInventory = [...inventory, newIngredient];
    }
    onUpdateInventory(updatedInventory);
    setNewIngredientName('');
    setNewIngredientQuantity('');
    setNewIngredientFreshness('fresh');
    setEditIndex(null);
  };

  const handleEditIngredient = (index: number) => {
    setEditIndex(index);
    const ingredientToEdit = inventory[index];
    setNewIngredientName(ingredientToEdit.name);
    setNewIngredientQuantity(ingredientToEdit.quantity);
    setNewIngredientFreshness(ingredientToEdit.freshness);
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    onUpdateInventory(inventory.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-2xl mx-auto my-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Your Fridge Inventory</h2>

      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-xl font-semibold text-gray-700 mb-3">{editIndex !== null ? 'Edit Ingredient' : 'Add New Ingredient'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="Ingredient Name"
            value={newIngredientName}
            onChange={(e) => setNewIngredientName(e.target.value)}
            className="p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          />
          <input
            type="text"
            placeholder="Quantity (e.g., 2 cups, 500g)"
            value={newIngredientQuantity}
            onChange={(e) => setNewIngredientQuantity(e.target.value)}
            className="p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          />
          <select
            value={newIngredientFreshness}
            onChange={(e) => setNewIngredientFreshness(e.target.value)}
            className="p-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
          >
            <option value="fresh">Fresh</option>
            <option value="good">Good</option>
            <option value="expiring">Expiring Soon</option>
            <option value="spoiled">Spoiled</option>
          </select>
        </div>
        <button
          onClick={handleAddOrUpdateIngredient}
          className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200"
        >
          {editIndex !== null ? 'Update Ingredient' : 'Add Ingredient'}
        </button>
        {editIndex !== null && (
          <button
            onClick={() => {
              setEditIndex(null);
              setNewIngredientName('');
              setNewIngredientQuantity('');
              setNewIngredientFreshness('fresh');
            }}
            className="w-full mt-2 bg-gray-400 text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {inventory.length === 0 ? (
        <p className="text-center text-gray-500 italic">Your fridge is empty! Add some ingredients to get started.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {inventory.map((item, index) => (
            <li key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3">
              <div className="flex-1 mb-2 sm:mb-0">
                <p className="text-lg font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                <p className="text-sm text-gray-600">Freshness: {item.freshness}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditIngredient(index)}
                  className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition duration-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemoveIngredient(index)}
                  className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition duration-200"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FridgeInventory;