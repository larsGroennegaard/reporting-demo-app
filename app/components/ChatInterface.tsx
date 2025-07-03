// app/components/ChatInterface.tsx
"use client";

import { useState } from 'react';
import { Bot, User, Loader2, Send } from 'lucide-react';

// Define the structure of a chat message
type Message = {
  sender: 'user' | 'bot' | 'loading';
  text: string;
};

// Define the props the component will accept
interface ChatInterfaceProps {
  onQuerySubmit: (query: string) => void;
  messages: Message[];
  isGenerating: boolean;
}

export default function ChatInterface({ onQuerySubmit, messages, isGenerating }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isGenerating) {
      onQuerySubmit(inputValue);
      setInputValue('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col flex-grow bg-gray-800 text-gray-200 min-h-0">
      {/* Message display area */}
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender !== 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                {msg.sender === 'bot' ? <Bot size={20} /> : <Loader2 size={20} className="animate-spin" />}
              </div>
            )}
            <div className={`p-3 rounded-lg max-w-sm ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'}`}>
              <p className="text-sm">{msg.text}</p>
            </div>
             {msg.sender === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                <User size={20} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input form */}
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-3 pr-12 text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={3}
            disabled={isGenerating}
          />
          <button 
            type="submit" 
            className="absolute right-3 bottom-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed" 
            disabled={isGenerating || !inputValue.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}