// app/ask/page.tsx
"use client";
import { useState } from 'react';
import { Bot, User, Loader2, Send, Database, FileCode } from 'lucide-react';
import AdHocTable from '../components/AdHocTable'; // Using the new component

type AdHocMessage = {
  sender: 'user' | 'bot';
  text: string;
};

export default function AskPage() {
  const [messages, setMessages] = useState<AdHocMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [queryResult, setQueryResult] = useState<{ sql: string; explanation: string; data: any[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AdHocMessage = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setQueryResult(null);
    const query = inputValue;
    setInputValue('');

    try {
      setLoadingStep('Generating SQL...');
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'An unknown server error occurred.');
      }
      
      setLoadingStep('Querying database...');
      setMessages(prev => [...prev, { sender: 'bot', text: data.explanation }]);
      setQueryResult(data);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sorry, something went wrong.";
      setMessages(prev => [...prev, { sender: 'bot', text: `Error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {messages.length === 0 && (
          <div className="text-center pt-16">
            <Database size={48} className="mx-auto text-gray-500 mb-4" />
            <h1 className="text-3xl font-bold text-white">Ask Ad-Hoc Questions</h1>
            <p className="text-gray-400 mt-2">
              Type a question below to query the database directly.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'bot' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"><Bot size={20} /></div>}
            <div className={`p-3 rounded-lg max-w-2xl ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700'}`}>
              <p className="text-sm break-words">{msg.text}</p>
            </div>
            {msg.sender === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center"><User size={20} /></div>}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <div className="p-3 rounded-lg max-w-sm bg-gray-700">
              <p className="text-sm">{loadingStep}</p>
            </div>
          </div>
        )}

        {queryResult?.data && (
          <div className="space-y-4">
             <div className="bg-gray-800 p-4 shadow rounded-lg">
                <h3 className="text-lg font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <FileCode size={20} /> Generated SQL Query
                </h3>
                <pre className="text-sm text-yellow-300 bg-gray-900 p-4 rounded-md overflow-x-auto">
                  <code>{queryResult.sql}</code>
                </pre>
            </div>
            <AdHocTable data={queryResult.data} title="Query Results" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(e)}
            placeholder="Ask a question, e.g., 'How many deals did we win in the UK last quarter?'"
            className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-3 pr-12 text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed" 
            disabled={isLoading || !inputValue.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}