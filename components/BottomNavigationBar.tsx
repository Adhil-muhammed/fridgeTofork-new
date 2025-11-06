import React, { useContext } from 'react';
import { TabName } from '../types';
import { ChatControlContext } from '../App';

interface BottomNavigationBarProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ activeTab, setActiveTab }) => {
  const chatContext = useContext(ChatControlContext);

  if (!chatContext) {
    throw new Error("ChatControlContext must be used within a ChatControlProvider in BottomNavigationBar");
  }

  const handleChatFabClick = async () => {
    if (chatContext.isLiveSessionActive) {
      chatContext.stopLiveSession();
      chatContext.setIsChatOverlayOpen(false); // Only applicable if it was an overlay
    } else {
      // If not on 'voicechat' tab, open as overlay, otherwise just start session in current tab
      if (activeTab !== 'voicechat') {
        chatContext.setIsChatOverlayOpen(true);
      }
      await chatContext.startLiveSession();
    }
  };

  const navItems = [
    { name: 'Scan', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.016-4.016L16 16m-4 0l-4-4m4-4l4 4m4-4v12l-4-4m-4 4L4 16m4-4l4-4m4 4l4-4" />
      </svg>
    ), tab: 'scan' as TabName },
    { name: 'Fridge', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ), tab: 'inventory' as TabName },
    { name: 'Recipes', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m15.364 6.364l-.707-.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ), tab: 'recipes' as TabName },
    { name: 'Talk', icon: ( // NEW Voice Chat Tab
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7a7 7 0 007-7m0 0a7 7 0 01-7-7m7 7h1m0 0h1m0-1a7 7 0 01-7-7m7 7v-1m0 0v-1m0 1a7 7 0 00-7 7m0 0a7 7 0 01-7-7m7 7h-1m0 0h-1m0-1a7 7 0 017-7m0 0a7 7 0 00-7 7" />
      </svg>
    ), tab: 'voicechat' as TabName },
    { name: 'Images', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.016-4.016L16 16m-4 0l-4-4m4-4l4 4m4-4v12l-4-4m-4 4L4 16m4-4l4-4m4 4l4-4" />
      </svg>
    ), tab: 'imageGen' as TabName },
    { name: 'Health', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.001 12.001 0 002.928 15.127 12.002 12.002 0 0012 21.055c3.167 0 6.208-.663 8.928-1.928a12.001 12.001 0 00-1.808-11.928z" />
      </svg>
    ), tab: 'health' as TabName },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 shadow-2xl rounded-t-3xl p-3 flex items-center justify-around z-40 backdrop-blur-lg">
      {navItems.map((item) => (
        <button
          key={item.name}
          onClick={async () => {
            // If navigating away from voicechat tab, ensure overlay is closed
            if (activeTab === 'voicechat' && chatContext.isChatOverlayOpen) {
              chatContext.setIsChatOverlayOpen(false);
            }
            setActiveTab(item.tab);
            if (item.tab === 'voicechat' && !chatContext.isLiveSessionActive) {
              await chatContext.startLiveSession(); // Start live session when selecting 'voicechat' tab
            } else if (item.tab !== 'voicechat' && chatContext.isLiveSessionActive && activeTab === 'voicechat') {
              // If switching FROM voicechat tab to another tab, and session is active, stop it
              chatContext.stopLiveSession();
            }
          }}
          className={`flex flex-col items-center justify-center p-2 rounded-xl group transition-all duration-300 ${
            activeTab === item.tab ? 'text-cyan-400 bg-blue-900/20' : 'text-gray-400 hover:text-cyan-400 hover:bg-gray-800'
          }`}
          aria-label={item.name}
        >
          {item.icon}
          <span className={`text-xs font-medium mt-1 transition-colors duration-300 ${activeTab === item.tab ? 'text-cyan-400' : 'text-gray-400 group-hover:text-cyan-400'}`}>
            {item.name}
          </span>
        </button>
      ))}

      {/* Central Floating Action Button for Chat */}
      <button
        onClick={handleChatFabClick}
        className={`absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-in-out
          ${chatContext.isLiveSessionActive ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700' : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700'}
          ${chatContext.isThinking ? 'animate-pulse' : ''}`}
        aria-label={chatContext.isLiveSessionActive ? 'Stop live chat' : 'Start live chat with Chef Fridge'}
        aria-live="polite"
        disabled={chatContext.isThinking}
      >
        {chatContext.isThinking ? (
           <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-white"></div>
        ) : chatContext.isLiveSessionActive ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7v1m0 0v1m0-1a7 7 0 01-7-7m7 7a7 7 0 007-7m0 0a7 7 0 01-7-7m7 7h1m0 0h1m0-1a7 7 0 01-7-7m7 7v-1m0 0v-1m0 1a7 7 0 00-7 7m0 0a7 7 0 01-7-7m7 7h-1m0 0h-1m0-1a7 7 0 017-7m0 0a7 7 0 00-7 7" />
          </svg>
        )}
      </button>

    </nav>
  );
};

export default BottomNavigationBar;