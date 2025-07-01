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

  const examplePrompts = [
    "How much newbiz and pipeline did we generate last quarter?",
    "Show me the new biz impact of marketing channels this year",
    "Show me the impact of LLMs on mql, pipeline and newbiz over this year",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isGenerating) {
      onQuerySubmit(inputValue);
      setInputValue('');
    }
  };
  
  const handlePromptClick = (prompt: string) => {
    if (!isGenerating) {
        onQuerySubmit(prompt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-200">
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
              <p className="text-xs">{msg.text}</p>
            </div>
             {msg.sender === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                <User size={20} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Example Prompts */}
      <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">Example prompts</p>
          <div className="space-y-2">
              {examplePrompts.map(prompt => (
                  <button 
                    key={prompt} 
                    onClick={() => handlePromptClick(prompt)}
                    disabled={isGenerating}
                    className="w-full text-left text-xs p-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {prompt}
                  </button>
              ))}
          </div>
      </div>

      {/* Input form */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to know"
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
