import { useState, useRef, useEffect } from 'react';
import { api, type AskResponse } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: AskResponse['sources'];
  time_ms?: number;
}

const SUGGESTIONS = [
  'RAGとは何ですか？',
  'Embeddingの仕組みを教えて',
  'ハルシネーションとは？',
  'ベクトルDBの役割は？',
];

export default function AskTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (overrideQuestion?: string) => {
    const q = (overrideQuestion || input).trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askBedrock(q);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          time_ms: res.response_time_ms,
        },
      ]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'エラーが発生しました';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `エラー: ${errMsg}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="text-center pt-16 slide-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 bg-gradient-to-br from-orange-100 to-amber-100">
                <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Bedrock Knowledge Bases に聞いてみましょう
              </h3>
              <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
                S3 Vectors + Bedrock KB のRAGで回答します
              </p>

              {/* Suggestion chips */}
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="group px-4 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 card-hover btn-press"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="opacity-50 group-hover:opacity-100 mr-1.5 transition-opacity">&#10024;</span>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 float-in ${msg.role === 'user' ? 'justify-end' : ''}`}
              style={{ animationDelay: '0ms' }}
            >
              {/* AI avatar */}
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-orange-500/20 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
              )}

              <div
                className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-lg shadow-orange-500/20'
                    : 'bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100'
                }`}
              >
                <p className={`whitespace-pre-wrap text-[13.5px] leading-[1.7] ${msg.role === 'assistant' ? 'text-gray-700' : ''}`}>
                  {msg.content}
                </p>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setExpandedSource(expandedSource === i ? null : i)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      参照 ({msg.sources.length})
                      <svg
                        className={`w-3 h-3 transition-transform duration-200 ${expandedSource === i ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {expandedSource === i && (
                      <div className="mt-2 space-y-1.5 scale-in">
                        {msg.sources.map((s, j) => (
                          <div
                            key={j}
                            className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2"
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />
                              <span className="text-[11px] font-semibold text-orange-600">
                                {s.section || s.chunk_id}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">
                              {s.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Response time */}
                {msg.time_ms && (
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-[10px] text-gray-300 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {(msg.time_ms / 1000).toFixed(1)}s
                    </p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-orange-400">
                      Bedrock KB
                    </span>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === 'user' && (
                <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center mt-0.5">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3 float-in">
              <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-md shadow-orange-500/20 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div className="bg-white rounded-2xl rounded-tl-md px-5 py-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
                    <span className="w-2 h-2 bg-orange-400 rounded-full typing-dot" />
                  </div>
                  <span className="text-[11px] text-gray-400 ml-1">Bedrock KB に問い合わせ中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-gray-100/80 bg-white/60 backdrop-blur-xl px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 pl-4 pr-2 py-1.5">
            <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent text-[13.5px] text-gray-700 placeholder-gray-400 focus:outline-none py-2"
              placeholder="質問を入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center hover:from-orange-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-orange-500/20 btn-press"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2">
            Bedrock Knowledge Bases (S3 Vectors) で回答
          </p>
        </div>
      </div>
    </div>
  );
}
