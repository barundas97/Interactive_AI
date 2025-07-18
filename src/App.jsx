import React, { useState, useEffect, useRef } from 'react';
// import './index.css'; // Removed: All styling is handled by Tailwind CSS directly within the component

// Main App component
const App = () => {
  // State to control the visibility of the sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // State for the current message being typed
  const [message, setMessage] = useState('');
  // State to store the history of all chats
  const [chatHistory, setChatHistory] = useState([]);
  // State to store messages of the currently selected chat
  const [messages, setMessages] = useState([]);
  // State to indicate if an AI response is being loaded
  const [isLoading, setIsLoading] = useState(false);
  // State for the search query in the sidebar
  const [searchQuery, setSearchQuery] = useState('');
  // Ref for the sidebar element, used to detect clicks outside the sidebar
  const sidebarRef = useRef(null);
  // Ref for the main content area, to prevent closing sidebar when clicking on main content
  const mainContentRef = useRef(null);

  // Helper function to determine if the current view is mobile (less than md breakpoint)
  const isMobileView = () => window.innerWidth < 768;

  // Effect hook to handle clicks outside the sidebar to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If the sidebar is open and the click occurred outside the sidebar itself
      // and also not on the main content area (to prevent accidental closing when interacting with chat)
      if (isSidebarOpen &&
          sidebarRef.current && !sidebarRef.current.contains(event.target) &&
          mainContentRef.current && !mainContentRef.current.contains(event.target) &&
          event.target.closest('.sidebar-toggle-button') === null // Exclude the toggle button itself
      ) {
        // Close the sidebar
        setIsSidebarOpen(false);
      }
    };

    // Add event listener when the component mounts
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]); // Dependency array: re-run effect if isSidebarOpen changes

  // Function to toggle sidebar visibility (used by the button on mobile)
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Function to start a new chat
  const startNewChat = () => {
    setMessages([]); // Clear current messages
    const newChatId = Date.now();
    // Add a default name for the new chat for search functionality
    setChatHistory([...chatHistory, { id: newChatId, name: `New Chat ${chatHistory.length + 1}`, messages: [] }]);
    // Immediately select the new chat
    selectChat(newChatId);
    // Close sidebar on mobile after starting a new chat
    if (isMobileView()) {
      setIsSidebarOpen(false);
    }
  };

  // Function to delete a chat from history
  const deleteChat = (id) => {
    setChatHistory(chatHistory.filter(chat => chat.id !== id));
    // If the deleted chat was the currently active one, clear messages
    if (messages.length > 0 && messages[0].chatId === id) {
      setMessages([]);
    }
  };

  // Function to select an existing chat
  const selectChat = (id) => {
    const chat = chatHistory.find(chat => chat.id === id);
    setMessages(chat ? chat.messages : []);
    // Close sidebar on mobile after selecting a chat
    if (isMobileView()) {
      setIsSidebarOpen(false);
    }
  };

  // Function to send a message to the AI
  const sendMessage = async () => {
    if (!message.trim()) return; // Don't send empty messages

    setIsLoading(true); // Set loading state
    const currentChatId = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].id : Date.now();
    const newMessage = { text: message, sender: 'user', chatId: currentChatId };

    // Update messages for the current chat immediately
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setMessage(''); // Clear input field

    try {
      // API call to Gemini
      // Using import.meta.env for environment variables, which is standard for Vite-based React apps
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: newMessage.text }] }],
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Check for valid response structure
      if (data.candidates && data.candidates.length > 0 &&
          data.candidates[0].content && data.candidates[0].content.parts &&
          data.candidates[0].content.parts.length > 0) {
        const aiResponse = data.candidates[0].content.parts[0].text;
        const aiMessage = { text: aiResponse, sender: 'ai', chatId: currentChatId };

        // Update messages for the current chat with AI response
        setMessages((prevMessages) => [...prevMessages, aiMessage]);

        // Update chat history with both user and AI messages
        setChatHistory((prevChatHistory) => {
          const chatIndex = prevChatHistory.findIndex((chat) => chat.id === currentChatId);
          if (chatIndex !== -1) {
            // If chat exists, update its messages
            const updatedChatHistory = [...prevChatHistory];
            updatedChatHistory[chatIndex] = {
              ...updatedChatHistory[chatIndex],
              messages: [...updatedChatHistory[chatIndex].messages, newMessage, aiMessage],
            };
            return updatedChatHistory;
          } else {
            // If it's a new chat (e.g., first message in a session), create it
            return [...prevChatHistory, { id: currentChatId, name: `Chat ${prevChatHistory.length + 1}`, messages: [newMessage, aiMessage] }];
          }
        });
      } else {
        console.error('Unexpected API response structure:', data);
        setMessages((prev) => [...prev, { text: 'Error: Unexpected AI response format.', sender: 'ai', chatId: currentChatId }]);
      }
    } catch (error) {
      console.error('Error communicating with AI:', error);
      setMessages((prev) => [...prev, { text: 'Error communicating with AI. Please try again.', sender: 'ai', chatId: currentChatId }]);
    } finally {
      setIsLoading(false); // End loading state
    }
  };

  // Filter chat history based on search query
  const filteredChatHistory = chatHistory.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans relative overflow-hidden">
      {/* Overlay for mobile view when the sidebar is open */}
      {isSidebarOpen && isMobileView() && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)} // Close sidebar on overlay click
        ></div>
      )}

      {/* Sidebar Toggle Button (visible on desktop for hover, clickable on mobile) */}
      <div
        className={`
          fixed top-1/2 left-0 transform -translate-y-1/2 z-30
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'md:left-[calc(16rem-1px)]' : 'md:left-0'}
        `}
        // On desktop, the button itself is part of the hoverable area
        onMouseEnter={() => !isMobileView() && setIsSidebarOpen(true)}
      >
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-button p-2 bg-gray-800 rounded-r-lg hover:bg-gray-700 transition-colors shadow-lg"
          title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /> // Left arrow
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /> // Right arrow
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 h-full bg-gray-800 transition-all duration-300 ease-in-out z-20
          ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}
          md:w-64 md:${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          overflow-hidden
        `}
        // On desktop, the entire sidebar area triggers hover close
        onMouseLeave={() => !isMobileView() && setIsSidebarOpen(false)}
      >
        {/* Only show content if sidebar is logically open to prevent rendering issues when width is 0 */}
        {isSidebarOpen && (
          <div className="flex flex-col h-full p-4">
            {/* Search Bar in Sidebar Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-4 text-white">Chats</h2>
              <input
                type="text"
                placeholder="Search chats..."
                className="w-full p-2 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* New Chat Button */}
            <button
              onClick={startNewChat}
              className="w-full py-2 px-4 flex items-center justify-center bg-gradient-to-r from-cyan-500 to-purple-500 rounded-md hover:from-cyan-600 hover:to-purple-600 transition-colors mb-4 shadow-md"
              title="Start New Chat"
            >
              {/* Plus Icon for New Chat Button */}
              <svg className="w-5 h-5 flex-shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <span className="truncate">New Chat</span>
            </button>

            {/* Chat History List */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              <ul className="space-y-2">
                {filteredChatHistory.map((chat) => (
                  <li key={chat.id} className="flex items-center p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors">
                    <button
                      onClick={() => selectChat(chat.id)}
                      className="flex items-center flex-1 text-left truncate focus:outline-none"
                      title={chat.name}
                    >
                      <svg className="w-5 h-5 flex-shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5v-4a2 2 0 012-2h10a2 2 0 012 2v4h-4m-6 0h6" />
                      </svg>
                      <span className="truncate">{chat.name}</span>
                    </button>
                    <button
                      onClick={() => deleteChat(chat.id)}
                      className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-500"
                      title="Delete Chat"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div
        ref={mainContentRef}
        className={`
          flex-1 flex flex-col items-center p-4
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'md:ml-64' : 'md:ml-0'}
          overflow-hidden
        `}
      >
        <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-transparent bg-clip-text mb-8">
          InterAct AI
        </div>
        <div className="w-full max-w-2xl h-[70vh] bg-gray-800 rounded-lg overflow-y-auto p-4 flex flex-col-reverse custom-scrollbar">
          {isLoading && <div className="text-center text-gray-400 p-2">Loading...</div>}
          {messages.slice().reverse().map((msg, index) => ( // Reverse to show latest at bottom
            <div key={index} className={`mb-4 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <span className={`inline-block p-3 rounded-lg max-w-[80%] ${msg.sender === 'user' ? 'bg-cyan-500' : 'bg-purple-500'}`}>
                {msg.text}
              </span>
            </div>
          ))}
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 mt-auto">Start a new chat or select an existing one!</div>
          )}
        </div>
        <div className="w-full max-w-2xl mt-4 flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 p-3 bg-gray-700 rounded-l-lg focus:outline-none placeholder-gray-400"
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            className="p-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-r-lg hover:from-cyan-600 hover:to-purple-600 transition-colors shadow-md flex items-center justify-center"
            title="Send Message"
            disabled={isLoading || !message.trim()}
          >
            {/* Gemini Logo Icon for Send Button */}
           <span class="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
