import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
// Removed: import { URL } from './constants'; // This import caused the error

// Main App Component
function App() {
    // State for chat management
    const [prompt, setPrompt] = useState('');
    const [chats, setChats] = useState([]); // Stores list of chat sessions { id, title, messages }
    const [currentChatId, setCurrentChatId] = useState(null); // ID of the currently active chat
    const [currentChatMessages, setCurrentChatMessages] = useState([]); // Messages of the current chat

    // UI related states
    const [isLoading, setIsLoading] = useState(false); // For API call loading
    const [error, setError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // New state for sidebar visibility
    const chatEndRef = useRef(null);

    // The API URL for Gemini, using gemini-2.0-flash
    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDSgZ3eS0gldd9YetCX97xK2yxXmPYKHZE";

    // --- Local Storage Management ---

    // Effect to load chats and sidebar state from localStorage on initial mount
    useEffect(() => {
        let loadedChats = [];
        let loadedSidebarState = true; // Default to open if state not found

        try {
            const storedChats = localStorage.getItem('gemini_chat_history');
            if (storedChats) {
                loadedChats = JSON.parse(storedChats);
            }
        } catch (e) {
            console.error("Failed to parse chat history from local storage:", e);
            setError("Failed to load chat history from your browser. It might be corrupted. Starting a new chat.");
            loadedChats = []; // Reset to empty if corrupted
        }

        try {
            const storedSidebarState = localStorage.getItem('gemini_sidebar_open');
            if (storedSidebarState !== null) {
                loadedSidebarState = JSON.parse(storedSidebarState);
            }
        } catch (e) {
            console.error("Failed to parse sidebar state from local storage:", e);
            // No error message to user for sidebar state, just default to open
        }

        setChats(loadedChats);
        setIsSidebarOpen(loadedSidebarState);

        // Determine initial current chat ID
        if (loadedChats.length > 0) {
            const lastActiveChatId = localStorage.getItem('gemini_last_active_chat_id');
            const initialChat = loadedChats.find(chat => chat.id === lastActiveChatId) || loadedChats[0];
            setCurrentChatId(initialChat.id);
        } else {
            // Only create a new chat if there are absolutely no loaded chats
            handleNewChat();
        }
    }, []); // Empty dependency array means this runs once on mount

    // Effect to save chats to localStorage whenever the 'chats' state changes
    useEffect(() => {
        try {
            localStorage.setItem('gemini_chat_history', JSON.stringify(chats));
        } catch (e) {
            console.error("Failed to save chats to local storage:", e);
            setError("Failed to save chat history to your browser.");
        }
    }, [chats]);

    // Effect to save the currentChatId to localStorage whenever it changes
    useEffect(() => {
        if (currentChatId) {
            localStorage.setItem('gemini_last_active_chat_id', currentChatId);
        } else {
            localStorage.removeItem('gemini_last_active_chat_id');
        }
    }, [currentChatId]);

    // Effect to save sidebar state to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('gemini_sidebar_open', JSON.stringify(isSidebarOpen));
        } catch (e) {
            console.error("Failed to save sidebar state to local storage:", e);
        }
    }, [isSidebarOpen]);


    // --- Update currentChatMessages when currentChatId or chats change ---
    useEffect(() => {
        const activeChat = chats.find(chat => chat.id === currentChatId);
        if (activeChat) {
            setCurrentChatMessages(activeChat.messages || []);
        } else {
            setCurrentChatMessages([]); // Clear messages if no chat is selected or found
        }
    }, [currentChatId, chats]);

    // --- Scroll to latest message ---
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentChatMessages]);

    // --- Chat Management Functions ---

    /**
     * Creates a new chat session.
     */
    const handleNewChat = () => {
        setIsLoading(true);
        setError(null);
        try {
            const newChatId = crypto.randomUUID(); // Generate a unique ID for the new chat
            const newChat = {
                id: newChatId,
                title: "New Chat", // Initial title
                messages: [],
                createdAt: new Date().toISOString(),
            };
            setChats(prevChats => [...prevChats, newChat]);
            setCurrentChatId(newChatId);
            setCurrentChatMessages([]); // Clear messages for the new chat
        } catch (err) {
            console.error("Error creating new chat:", err);
            setError("Failed to create new chat.");
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Loads an existing chat session.
     * @param {string} chatId - The ID of the chat to load.
     */
    const handleLoadChat = (chatId) => {
        setCurrentChatId(chatId);
    };

    /**
     * Deletes a chat session.
     * @param {string} chatId - The ID of the chat to delete.
     */
    const handleDeleteChat = (chatId) => {
        setIsLoading(true);
        setError(null);
        try {
            const updatedChats = chats.filter(chat => chat.id !== chatId);
            setChats(updatedChats);
            if (currentChatId === chatId) {
                // If the current chat is deleted, try to load the first available chat or create a new one
                if (updatedChats.length > 0) {
                    setCurrentChatId(updatedChats[0].id);
                } else {
                    setCurrentChatId(null);
                    setCurrentChatMessages([]);
                    handleNewChat(); // Create a new chat if all are deleted
                }
            }
        } catch (err) {
            console.error("Error deleting chat:", err);
            setError("Failed to delete chat.");
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handles sending the user's prompt to the Gemini API and updating local storage.
     */
    const handleSend = async () => {
        if (!prompt.trim() || isLoading || !currentChatId) {
            if (!currentChatId) setError("Please select or create a chat first.");
            return;
        }
        setError(null);

        const userMessage = { role: 'user', parts: [{ text: prompt }] };
        const updatedMessages = [...currentChatMessages, userMessage];
        setCurrentChatMessages(updatedMessages); // Optimistic UI update
        setIsLoading(true);
        setPrompt(''); // Clear input field immediately

        // Update the chats array in state with the new user message
        setChats(prevChats => prevChats.map(chat =>
            chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat
        ));

        try {
            // Update chat title if it's the first message in a "New Chat"
            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat && currentChat.title === "New Chat" && currentChatMessages.length === 0) {
                const newTitle = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
                setChats(prevChats => prevChats.map(chat =>
                    chat.id === currentChatId ? { ...chat, title: newTitle } : chat
                ));
            }

            // Prepare payload for Gemini API
            const payload = {
                contents: updatedMessages, // Send full conversation history for context
            };

            // The API_URL now contains the key directly, so no need to append it
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'An API error occurred. Please check the console.');
            }

            const data = await response.json();

            let aiMessage;
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                aiMessage = data.candidates[0].content;
            } else {
                // Handle cases where the API returns no candidates (e.g., safety blocks)
                aiMessage = { role: 'model', parts: [{ text: "I'm sorry, I couldn't generate a response for that. It might be due to safety settings or an invalid request." }] };
            }

            const finalMessages = [...updatedMessages, aiMessage];
            setCurrentChatMessages(finalMessages);

            // Update the chats array in state with the new AI message
            setChats(prevChats => prevChats.map(chat =>
                chat.id === currentChatId ? { ...chat, messages: finalMessages } : chat
            ));

        } catch (err) {
            setError(err.message);
            console.error("Error sending message:", err);
            // Revert UI if API call fails
            setCurrentChatMessages(currentChatMessages); // Revert to state before optimistic update
            // Also revert chats state to remove the optimistically added user message
            setChats(prevChats => prevChats.map(chat =>
                chat.id === currentChatId ? { ...chat, messages: currentChatMessages } : chat
            ));
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Renders a single message bubble in the chat.
     */
    const Message = ({ message }) => {
        const isModel = message.role === 'model';
        // Use marked to parse markdown content from the AI
        const rawHtml = isModel ? marked.parse(message.parts[0].text) : message.parts[0].text;

        return (
            <div className={`flex items-start gap-4 my-4 message-bubble ${isModel ? 'justify-start' : 'justify-end'}`}>
                {isModel && (
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                        AI
                    </div>
                )}
                <div className={`max-w-2xl p-4 rounded-2xl shadow-md ${isModel ? 'bg-gray-800 rounded-tl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
                   {isModel ? (
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rawHtml }} />
                   ) : (
                        <p>{rawHtml}</p>
                   )}
                </div>
                {!isModel && (
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                        You
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            {/* Sidebar */}
            <aside className={`bg-gray-800 p-4 flex-col border-r border-gray-700 shadow-lg transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 flex' : 'w-0 hidden'}`}>
                <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">
                    Chat History
                </h2>
                <button
                    onClick={handleNewChat}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 mb-4 hover:bg-indigo-500 transition-colors shadow-md"
                    disabled={isLoading}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    New Chat
                </button>

                {chats.length === 0 && (
                    <div className="text-center text-gray-500 text-sm">No chats yet. Create a new one!</div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {chats.map(chat => (
                        <div
                            key={chat.id}
                            className={`flex items-center justify-between p-3 rounded-lg mb-2 cursor-pointer transition-colors ${currentChatId === chat.id ? 'bg-indigo-700 shadow-inner' : 'bg-gray-700 hover:bg-gray-600'}`}
                            onClick={() => handleLoadChat(chat.id)}
                        >
                            <span className="flex-1 truncate text-sm">
                                {chat.title || "Untitled Chat"}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                                className="ml-2 p-1 rounded-full text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
                                disabled={isLoading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Chat Area */}
            <div className="flex flex-col flex-1 max-w-4xl mx-auto p-4">
                <header className="flex items-center justify-between mb-6 p-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
                        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                    >
                        {isSidebarOpen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </button>
                    <div className="flex-1 text-center">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-transparent bg-clip-text">
                            InterAct AI Assistant
                        </h1>
                        <p className="text-gray-400 mt-2">Powered by the Gemini 2.0 Flash</p>
                    </div>
                    {/* Placeholder to balance the header if needed, or remove if not necessary */}
                    <div className="w-10"></div>
                </header>

                {/* Chat Window */}
                <main className="flex-1 overflow-y-auto p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 mb-4 custom-scrollbar">
                    {currentChatMessages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            {/* Replaced the chat bubble icon with a star icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.691h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.519 4.674c.3.921-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.784.57-1.839-.197-1.539-1.118l1.519-4.674a1 1 0 00-.363-1.118L2.924 10.1c-.783-.57-.381-1.81.588-1.81h4.915a1 1 0 00.95-.691l1.519-4.674z" />
                            </svg>
                            <h2 className="text-2xl font-semibold">Welcome!</h2>
                            <p>Start a new conversation or select one from the sidebar.</p>
                        </div>
                    )}
                    {currentChatMessages.map((msg, index) => (
                        <Message key={index} message={msg} />
                    ))}
                    {isLoading && (
                       <div className="flex items-start gap-4 my-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                                AI
                            </div>
                            <div className="max-w-2xl p-4 bg-gray-800 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </main>

                {/* Error Display */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-center">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Input Form */}
                <footer className="mt-auto">
                    <div className="flex items-center bg-gray-800 border border-gray-700 rounded-full p-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-indigo-500 shadow-lg">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask me anything..."
                            className="flex-1 bg-transparent text-lg px-4 py-2 outline-none text-gray-100 placeholder-gray-500"
                            disabled={isLoading || !currentChatId}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!prompt.trim() || isLoading || !currentChatId}
                            className="p-3 rounded-full bg-indigo-600 text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                </footer>
            </div>
            {/* Custom Scrollbar Styles (for both main and sidebar) */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #374151; /* gray-700 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4B5563; /* gray-600 */
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6B7280; /* gray-500 */
                }
            `}</style>
        </div>
    );
}

export default App;
