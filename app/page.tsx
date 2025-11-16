'use client';

import { useState, useRef, useEffect } from 'react';
import { HaradaGrid } from '@/components/HaradaGrid';
import html2canvas from 'html2canvas';

export interface HaradaPlan {
  goal: string;
  pillars: {
    title: string;
    tasks: string[];
  }[];
}

interface HistoryItem {
  goal: string;
  plan: HaradaPlan;
  generatedAt: number;
}

export default function Home() {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<HaradaPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [generatingState, setGeneratingState] = useState<{
    type: 'goal' | 'pillars' | 'tasks' | null;
    pillarIndex?: number;
  }>({ type: null });
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  // Load plan from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('harada-plan');
    if (saved) {
      try {
        setPlan(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved plan:', e);
      }
    }

    // Load history list
    const historyList = localStorage.getItem('harada-history');
    if (historyList) {
      try {
        setHistory(JSON.parse(historyList));
      } catch (e) {
        console.error('Failed to load history list:', e);
      }
    }
  }, []);

  // Save plan to localStorage whenever it changes
  useEffect(() => {
    if (plan) {
      localStorage.setItem('harada-plan', JSON.stringify(plan));
    }
  }, [plan]);

  const addToHistory = (newPlan: HaradaPlan) => {
    const historyItem: HistoryItem = {
      goal: newPlan.goal,
      plan: newPlan,
      generatedAt: Date.now(),
    };

    const updatedHistory = [historyItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('harada-history', JSON.stringify(updatedHistory));
  };

  const handleLoadFromHistory = (historyItem: HistoryItem) => {
    setPlan(historyItem.plan);
    setShowHistory(false);
  };

  const confirmDeleteFromHistory = () => {
    if (deleteConfirmIndex === null) return;

    const updatedHistory = history.filter((_, i) => i !== deleteConfirmIndex);
    setHistory(updatedHistory);
    localStorage.setItem('harada-history', JSON.stringify(updatedHistory));
    setDeleteConfirmIndex(null);
  };

  const updateStatus = (message: string, error = false) => {
    setStatusMessage(message);
    setIsError(error);
    if (message) {
      setTimeout(() => {
        if (!isLoading) {
          setStatusMessage('');
        }
      }, 5000);
    }
  };

  const handleSaveAsPNG = async () => {
    if (!gridRef.current || !plan) return;

    try {
      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
        logging: false,
        ignoreElements: (element) => {
          // Ignore elements that might have unsupported CSS
          return false;
        },
        onclone: (clonedDoc) => {
          // Fix any lab() or other unsupported color functions in the cloned document
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const computedStyle = window.getComputedStyle(el);

            // Convert any lab/lch colors to RGB
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('lab')) {
              htmlEl.style.backgroundColor = '#0a0a0a';
            }
            if (computedStyle.color && computedStyle.color.includes('lab')) {
              htmlEl.style.color = '#ffffff';
            }
          });
        },
      });

      const link = document.createElement('a');
      link.download = `harada-method-${plan.goal.slice(0, 30).replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to save as PNG:', error);
    }
  };

  const handlePrint = () => {
    if (!plan) return;
    window.print();
  };

  const generatePlan = async () => {
    if (!goal.trim()) {
      updateStatus('Please enter your main goal first.', true);
      return;
    }

    setIsLoading(true);
    setStatusMessage('Generating your 64-cell Harada Method plan...');
    setIsError(false);
    setGeneratingState({ type: 'goal' });

    // Clear the input
    setGoal('');

    try {
      // Call API to generate the plan with streaming
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          customInstructions: customInstructions.trim() || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate plan');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Initialize plan structure
      const streamingPlan: HaradaPlan = {
        goal: '',
        pillars: Array(8)
          .fill(null)
          .map(() => ({ title: '', tasks: [] })),
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'goal') {
                streamingPlan.goal = data.goal;
                setPlan({ ...streamingPlan });
                setGeneratingState({ type: 'pillars' });
                updateStatus('Goal set! Generating 8 pillars...');
              } else if (data.type === 'pillar') {
                streamingPlan.pillars[data.index].title = data.title;
                setPlan({ ...streamingPlan });
                updateStatus(`Generated pillar ${data.index + 1}/8: ${data.title}`);
              } else if (data.type === 'generating_tasks') {
                setGeneratingState({ type: 'tasks', pillarIndex: data.pillarIndex });
                updateStatus(`Generating tasks for pillar ${data.pillarIndex + 1}/8...`);
              } else if (data.type === 'tasks') {
                streamingPlan.pillars[data.pillarIndex].tasks = data.tasks;
                setPlan({ ...streamingPlan });
                updateStatus(
                  `Generated tasks for "${streamingPlan.pillars[data.pillarIndex].title}" (${data.pillarIndex + 1}/8)`
                );
              } else if (data.type === 'complete') {
                setGeneratingState({ type: null });
                updateStatus('Success! Your 64-cell Harada Method plan is complete.', false);
                // Add to history when complete
                addToHistory(streamingPlan);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Skip malformed JSON
              if (e instanceof Error && !e.message.includes('Unexpected')) {
                throw e;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation failed:', error);
      updateStatus(`Failed to generate plan: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      setGeneratingState({ type: null });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-950 to-gray-900 flex flex-col">
      {/* Grid - Takes remaining space */}
      <div className="flex-1 overflow-hidden p-2 md:p-4 flex items-center justify-center">
        <HaradaGrid plan={plan} generatingState={generatingState} gridRef={gridRef} />
      </div>

      {/* Compact Input Section at Bottom */}
      <section className={`flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-2 md:p-4 safe-area-inset-bottom transition-all duration-200 ${advancedMode ? 'pb-4 md:pb-6' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-2 items-start">
            {/* Input Section */}
            <div className="flex-1 min-w-0 space-y-2">
              <input
                id="goal-input"
                type="text"
                placeholder="Enter your goal..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading && !advancedMode) {
                    generatePlan();
                  }
                }}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-500 text-sm font-light transition duration-150 outline-none disabled:bg-gray-800/50 disabled:text-gray-500"
              />

              {advancedMode && (
                <textarea
                  placeholder="Custom instructions (optional): e.g., 'Focus on physical health and outdoor activities' or 'Make tasks more specific and measurable'"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 placeholder-gray-500 text-sm font-light transition duration-150 outline-none disabled:bg-gray-800/50 disabled:text-gray-500 resize-none"
                />
              )}
            </div>

          {/* Generate Button */}
          <button
            onClick={generatePlan}
            disabled={isLoading}
            className="px-4 py-2.5 bg-blue-600 text-white font-light text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 transition duration-150 shadow-lg disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed uppercase tracking-wider flex-shrink-0"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <span className="hidden sm:inline">Generate</span>
            )}
            {!isLoading && (
              <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </button>

          {/* Action Buttons - Always visible, disabled when no plan */}
          <button
            onClick={() => setAdvancedMode(!advancedMode)}
            className={`flex items-center gap-1 px-3 py-2.5 text-xs font-light rounded-lg transition duration-150 border flex-shrink-0 ${
              advancedMode
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden md:inline">Advanced</span>
          </button>

          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 px-3 py-2.5 bg-gray-800 text-gray-300 text-xs font-light rounded-lg hover:bg-gray-700 transition duration-150 border border-gray-700 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden md:inline">History</span>
          </button>

          <button
            onClick={handleSaveAsPNG}
            disabled={!plan}
            className="flex items-center gap-1 px-3 py-2.5 bg-gray-800 text-gray-300 text-xs font-light rounded-lg hover:bg-gray-700 transition duration-150 border border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden md:inline">PNG</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={!plan}
            className="flex items-center gap-1 px-3 py-2.5 bg-gray-800 text-gray-300 text-xs font-light rounded-lg hover:bg-gray-700 transition duration-150 border border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-800 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden md:inline">Print</span>
          </button>
          </div>
        </div>
      </section>

      {/* History Modal */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="max-w-2xl w-full bg-gray-900 rounded-xl shadow-2xl border border-gray-800 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-light text-gray-100">Generation History</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {history.length === 0 && !plan ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-light">No generation history yet</p>
                  <p className="text-xs mt-2">Generated plans will appear here automatically</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Current plan if it exists and isn't in history yet */}
                  {plan && !history.some(h => h.goal === plan.goal && h.generatedAt === history[0]?.generatedAt) && (
                    <div className="flex items-center justify-between p-4 bg-blue-900/30 rounded-lg border border-blue-700 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-light text-gray-100 truncate">{plan.goal}</h3>
                          <span className="px-2 py-0.5 bg-blue-600 text-white text-[0.65rem] rounded-full">Current</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {plan.pillars.filter(p => p.title).length} pillars, {plan.pillars.reduce((acc, p) => acc + p.tasks.filter(t => t).length, 0)} tasks
                        </p>
                      </div>
                    </div>
                  )}

                  {/* History items */}
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-light text-gray-100 truncate">{item.goal}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.plan.pillars.filter(p => p.title).length} pillars, {item.plan.pillars.reduce((acc, p) => acc + p.tasks.filter(t => t).length, 0)} tasks
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(item.generatedAt).toLocaleDateString()} at{' '}
                          {new Date(item.generatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleLoadFromHistory(item)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-light rounded-lg transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => setDeleteConfirmIndex(index)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmIndex !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirmIndex(null)}
        >
          <div
            className="max-w-md w-full bg-gray-900 rounded-xl shadow-2xl border border-gray-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-light text-gray-100 mb-2">Delete from History?</h2>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete <span className="text-gray-300 font-medium">"{history[deleteConfirmIndex]?.goal}"</span>? This cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmIndex(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 text-sm font-light rounded-lg hover:bg-gray-700 transition duration-150 border border-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFromHistory}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-light rounded-lg hover:bg-red-700 transition duration-150"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
