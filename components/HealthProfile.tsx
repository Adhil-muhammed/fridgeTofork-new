import React from 'react';

interface HealthProfileProps {
  healthLog: string[];
}

const HealthProfile: React.FC<HealthProfileProps> = ({ healthLog }) => {
  const userName = "Chef Sarah"; // Mock user name

  // Mock data for demonstration
  const dietaryGoals = [
    { name: 'Reduce Carbs', progress: 70, unit: '%' },
    { name: 'Increase Protein', progress: 85, unit: '%' },
    { name: 'Stay Hydrated', progress: 60, unit: '%' },
  ];

  const allergens = ['Peanuts', 'Dairy (lactose intolerant)'];

  const foodWasteStats = {
    itemsSavedLastWeek: 5,
    totalWasteReduction: 25, // percentage
  };

  return (
    <div className="p-6 bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-lg max-w-2xl mx-auto my-6 animate-fade-in text-gray-100">
      <h2 className="text-3xl font-bold text-gray-100 mb-4 border-b border-gray-700 pb-3 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 1 00-2 2v4a2 2 0 104 0V9a2 2 0 00-2-2zm-2 7a2 2 0 114 0 2 2 0 01-4 0z" clipRule="evenodd" />
        </svg>
        Hello, {userName}!
      </h2>
      <p className="text-gray-300 mb-6 text-lg">Your personalized health and food management insights at a glance.</p>

      {/* Dietary Goals */}
      <div className="mb-8 p-6 bg-gray-900/50 backdrop-blur-md rounded-2xl shadow-sm">
        <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Your Dietary Goals
        </h3>
        {dietaryGoals.length === 0 ? (
          <p className="text-gray-400 italic text-base">No dietary goals set yet.</p>
        ) : (
          <ul className="space-y-4">
            {dietaryGoals.map((goal, index) => (
              <li key={index} className="flex flex-col">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-lg text-gray-100 font-medium">{goal.name}</span>
                  <span className="text-emerald-400 font-bold text-lg">{goal.progress}{goal.unit}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Allergens */}
      <div className="mb-8 p-6 bg-gray-900/50 backdrop-blur-md rounded-2xl shadow-sm">
        <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Known Allergens
        </h3>
        {allergens.length === 0 ? (
          <p className="text-gray-400 italic text-base">No allergens listed.</p>
        ) : (
          <ul className="list-disc list-inside text-lg text-gray-200 space-y-1">
            {allergens.map((allergen, index) => (
              <li key={index}>{allergen}</li>
            ))}
          </ul>
        )}
      </div>

      {/* AI-Driven Health Insights & Food Waste */}
      <div className="p-6 bg-gray-900/50 backdrop-blur-md rounded-2xl shadow-sm">
        <h3 className="text-2xl font-bold text-gray-100 mb-4 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Chef Fridge Insights
        </h3>
        <div className="mb-4">
          <p className="text-lg font-semibold text-gray-100 mb-2">Food Waste Reduction:</p>
          <div className="flex items-center text-emerald-400 text-xl font-bold mb-3">
            <span className="mr-2">♻️</span> {foodWasteStats.itemsSavedLastWeek} items saved last week!
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-emerald-400 to-lime-400 h-3 rounded-full"
              style={{ width: `${foodWasteStats.totalWasteReduction > 100 ? 100 : foodWasteStats.totalWasteReduction}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-400 mt-1">{foodWasteStats.totalWasteReduction}% overall waste reduction this month.</p>
        </div>

        <div>
          <p className="text-lg font-semibold text-gray-100 mb-2">Recent Health Log:</p>
          {healthLog.length === 0 ? (
            <p className="text-gray-400 italic text-base">No recent health log entries.</p>
          ) : (
            <ul className="list-disc list-inside text-base text-gray-200 space-y-1">
              {healthLog.map((log, index) => (
                <li key={index}>{log}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthProfile;