import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';

function App() {
    const [prompt, setPrompt] = useState('');
    const [chats, setChats] = useState([]);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [currentChatMessages, setCurrentChatMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const chatEndRef = useRef(null);

    const API_FUNCTION_URL = "/.netlify/functions/gemini";

    useEffect(() => {
        const storedChats = localStorage.getItem('gemini_chat_history');
        const storedSidebarState = localStorage.getItem('gemini_sidebar_open');
        const loadedChats = storedChats ? JSON.parse(storedChats) : [];
        const loadedSidebarState = storedSidebarState ? JSON.parse(storedSidebarState) : false;

        setChats(loadedChats);
        setIsSidebarOpen(loadedSidebarState);

        if (loadedChats.length > 0) {
            const lastActiveChatId = localStorage.getItem('gemini_last_active_chat_id');
            const initialChat = loadedChats.find(chat => chat.id === lastActiveChatId) || loadedChats[0];
            setCurrentChatId(initialChat.id);
        } else {
            handleNewChat();
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('gemini_chat_history', JSON.stringify(chats));
    }, [chats]);

    useEffect(() => {
        if (currentChatId) {
            localStorage.setItem('gemini_last_active_chat_id', currentChatId);
        } else {
            localStorage.removeItem('gemini_last_active_chat_id');
        }
    }, [currentChatId]);

    useEffect(() => {
        localStorage.setItem('gemini_sidebar_open', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

    useEffect(() => {
        const activeChat = chats.find(chat => chat.id === currentChatId);
        setCurrentChatMessages(activeChat ? activeChat.messages || [] : []);
    }, [currentChatId, chats]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentChatMessages]);

    const handleNewChat = () => {
        const newChatId = crypto.randomUUID();
        const newChat = {
            id: newChatId,
            title: "New Chat",
            messages: [],
            createdAt: new Date().toISOString(),
        };
        setChats(prev => [...prev, newChat]);
        setCurrentChatId(newChatId);
        setCurrentChatMessages([]);
    };

    const handleLoadChat = (id) => {
        setCurrentChatId(id);
    };

    const handleDeleteChat = (id) => {
        const updatedChats = chats.filter(chat => chat.id !== id);
        setChats(updatedChats);
        if (currentChatId === id) {
            if (updatedChats.length > 0) {
                setCurrentChatId(updatedChats[0].id);
            } else {
                setCurrentChatId(null);
                setCurrentChatMessages([]);
                handleNewChat();
            }
        }
    };

    const handleSend = async () => {
        if (!prompt.trim() || isLoading || !currentChatId) return;
        setError(null);

        const userMessage = { role: 'user', parts: [{ text: prompt }] };
        const updatedMessages = [...currentChatMessages, userMessage];
        setCurrentChatMessages(updatedMessages);
        setPrompt('');
        setIsLoading(true);

        setChats(prev =>
            prev.map(chat => chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat)
        );

        try {
            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat?.title === "New Chat" && currentChatMessages.length === 0) {
                const newTitle = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
                setChats(prev => prev.map(chat =>
                    chat.id === currentChatId ? { ...chat, title: newTitle } : chat
                ));
            }

            const response = await fetch(API_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, history: currentChatMessages }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error from Netlify function.');
            }

            const data = await response.json();
            let aiMessage = data.candidates?.[0]?.content || {
                role: 'model',
                parts: [{ text: "No response from Gemini." }],
            };

            const finalMessages = [...updatedMessages, aiMessage];
            setCurrentChatMessages(finalMessages);
            setChats(prev => prev.map(chat =>
                chat.id === currentChatId ? { ...chat, messages: finalMessages } : chat
            ));
        } catch (err) {
            setError(err.message);
            setCurrentChatMessages(currentChatMessages);
            setChats(prev => prev.map(chat =>
                chat.id === currentChatId ? { ...chat, messages: currentChatMessages } : chat
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const Message = ({ message }) => {
        const isModel = message.role === 'model';
        const rawHtml = isModel ? marked.parse(message.parts[0].text) : message.parts[0].text;
        return (
            <div className={`flex gap-4 my-4 ${isModel ? 'justify-start' : 'justify-end'}`}>
                {isModel && <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">AI</div>}
                <div className={`max-w-2xl p-4 rounded-2xl shadow-md ${isModel ? 'bg-gray-800 rounded-tl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
                    {isModel ? (
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rawHtml }} />
                    ) : (
                        <p>{rawHtml}</p>
                    )}
                </div>
                {!isModel && <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">You</div>}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">

            {/* Desktop Sidebar Hover Tab */}
            <div
                className="hidden md:block fixed top-1/2 left-0 z-30 bg-gray-700 text-white px-2 py-1 rounded-r-lg cursor-pointer hover:bg-indigo-600"
                onMouseEnter={() => setIsSidebarHovered(true)}
            >
                ▶
            </div>

            {/* Sidebar */}
            <aside
                className={`fixed z-40 top-0 left-0 h-full bg-gray-800 border-r border-gray-700 shadow-xl transition-all duration-300 ease-in-out 
                    ${isSidebarHovered || isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} 
                    ${isSidebarOpen ? 'block md:hidden' : 'hidden md:block'}`}
                onMouseLeave={() => setIsSidebarHovered(false)}
            >
                {/* Mobile close button */}
                <div className="md:hidden flex justify-end p-2">
                    <button onClick={() => setIsSidebarOpen(false)} className="text-white text-2xl">×</button>
                </div>

                <h2 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-green-400 to-blue-500 text-transparent bg-clip-text">Chat History</h2>
                <button onClick={handleNewChat} className="w-full bg-indigo-600 py-2 rounded-lg mb-4">New Chat</button>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {chats.map(chat => (
                        <div key={chat.id}
                            className={`p-3 rounded-lg mb-2 cursor-pointer ${currentChatId === chat.id ? 'bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                            onClick={() => handleLoadChat(chat.id)}>
                            <div className="flex justify-between">
                                <span className="truncate">{chat.title}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }} className="text-sm text-red-300 hover:text-white">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Chat */}
            <div className="flex flex-col flex-1 max-w-4xl mx-auto p-4">
                <header className="flex items-center justify-between mb-6">
                    {/* Mobile hamburger */}
                    <div className="md:hidden">
                        <button onClick={() => setIsSidebarOpen(true)} className="text-2xl">☰</button>
                    </div>
                    <div className="flex-1 text-center">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-transparent bg-clip-text">InterAct AI Assistant</h1>
                        <p className="text-gray-400">Powered by Gemini</p>
                    </div>
                    <div className="w-10"></div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 custom-scrollbar">
                    {currentChatMessages.map((msg, index) => (
                        <Message key={index} message={msg} />
                    ))}
                    {isLoading && (
                        <div className="flex gap-4 my-4">
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">AI</div>
                            <div className="max-w-2xl p-4 bg-gray-800 rounded-2xl flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef}></div>
                </main>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-center">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <footer className="mt-4">
                    <div className="flex items-center bg-gray-800 border border-gray-700 rounded-full p-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask me anything..."
                            className="flex-1 bg-transparent px-4 py-2 outline-none text-white"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!prompt.trim() || isLoading}
                            className="p-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                </footer>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #374151;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4B5563;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6B7280;
                }
            `}</style>
        </div>
    );
}

export default App;
