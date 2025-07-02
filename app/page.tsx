// app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send, Search } from "lucide-react";

const examplePrompts = [
    "How much newbiz and pipeline did we generate last quarter?",
    "Show me the new biz impact of marketing channels this year",
    "Show me the impact of LLMs on mql, pipeline and newbiz over this year",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handlePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Navigate to the builder page with the query
      router.push(`/report/new?prompt=${encodeURIComponent(query)}`);
    }
  };

  const handleExampleClick = (prompt: string) => {
    router.push(`/report/new?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="flex h-full items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-2xl text-center">
        <Search size={48} className="mx-auto text-gray-500 mb-4" />
        <h1 className="text-4xl font-bold text-white mb-2">
          What's on your mind? Which GTM questions are burning in your mind?
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Ask a question to get started, or choose one of the examples below.
        </p>
        <form onSubmit={handlePrompt} className="relative mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., How much pipeline did we generate last quarter?"
            className="w-full rounded-md border-gray-600 bg-gray-800 p-4 pr-12 text-lg text-white shadow-lg focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-500"
            disabled={!query.trim()}
          >
            <Send size={20} />
          </button>
        </form>
        <div className="space-y-2">
            {examplePrompts.map(prompt => (
                <button 
                key={prompt} 
                onClick={() => handleExampleClick(prompt)}
                className="w-full text-left text-sm p-3 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                >
                    {prompt}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
}