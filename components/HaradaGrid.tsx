'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HaradaPlan {
  goal: string;
  pillars: {
    title: string;
    tasks: string[];
  }[];
}

interface HaradaGridProps {
  plan: HaradaPlan | null;
  generatingState: {
    type: 'goal' | 'pillars' | 'tasks' | null;
    pillarIndex?: number;
  };
  gridRef?: React.RefObject<HTMLDivElement>;
}

interface ExpandedCell {
  content: string;
  type: 'goal' | 'pillar' | 'task';
  index: number;
  parent?: {
    content: string;
    type: 'goal' | 'pillar';
  };
}

export function HaradaGrid({ plan, generatingState, gridRef }: HaradaGridProps) {
  const [expandedCell, setExpandedCell] = useState<ExpandedCell | null>(null);
  const [showNavigationChoice, setShowNavigationChoice] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-focus modal for keyboard navigation
  useEffect(() => {
    if (expandedCell && modalRef.current) {
      modalRef.current.focus();
    }
  }, [expandedCell]);

  // Get cells for the current scope (pillar + its tasks, or just goal + pillars)
  const getScopedCells = (currentCell: ExpandedCell | null): ExpandedCell[] => {
    if (!plan || !currentCell) return [];

    // If we're viewing a pillar or task, show just that pillar + its tasks
    if (currentCell.type === 'pillar' || currentCell.type === 'task') {
      const pillarContent = currentCell.type === 'pillar'
        ? currentCell.content
        : currentCell.parent?.content;

      // Find the pillar index
      const pillarIndex = plan.pillars.findIndex(p => p.title === pillarContent);
      if (pillarIndex === -1) return [];

      const pillar = plan.pillars[pillarIndex];
      const cells: ExpandedCell[] = [];

      // Add the pillar
      if (pillar.title) {
        cells.push({
          content: pillar.title,
          type: 'pillar',
          index: cells.length,
          parent: plan.goal ? { content: plan.goal, type: 'goal' } : undefined
        });
      }

      // Add its tasks
      for (const task of pillar.tasks) {
        if (task) {
          cells.push({
            content: task,
            type: 'task',
            index: cells.length,
            parent: pillar.title ? { content: pillar.title, type: 'pillar' } : undefined
          });
        }
      }

      return cells;
    }

    // If viewing goal, show goal + all pillars
    if (currentCell.type === 'goal') {
      const cells: ExpandedCell[] = [];

      if (plan.goal) {
        cells.push({ content: plan.goal, type: 'goal', index: cells.length });
      }

      for (const pillar of plan.pillars) {
        if (pillar.title) {
          cells.push({
            content: pillar.title,
            type: 'pillar',
            index: cells.length,
            parent: plan.goal ? { content: plan.goal, type: 'goal' } : undefined
          });
        }
      }

      return cells;
    }

    return [];
  };

  const scopedCells = getScopedCells(expandedCell);

  const handleNavigate = (direction: 'next' | 'prev') => {
    if (!expandedCell || scopedCells.length === 0) return;

    const currentIndex = expandedCell.index;

    // Check if we're at the LAST task and going next (show navigation choice)
    // Only show for tasks, not for pillars (pillar should navigate to first task)
    if (direction === 'next' && currentIndex === scopedCells.length - 1 &&
        expandedCell.type === 'task') {
      setShowNavigationChoice(true);
      return;
    }

    let newIndex: number;

    if (direction === 'next') {
      newIndex = (currentIndex + 1) % scopedCells.length;
    } else {
      newIndex = currentIndex - 1 < 0 ? scopedCells.length - 1 : currentIndex - 1;
    }

    // Use View Transition API if available
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setExpandedCell(scopedCells[newIndex]);
      });
    } else {
      setExpandedCell(scopedCells[newIndex]);
    }
  };

  const handleReviewAgain = () => {
    if (scopedCells.length === 0) return;
    setShowNavigationChoice(false);

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setExpandedCell(scopedCells[0]);
      });
    } else {
      setExpandedCell(scopedCells[0]);
    }
  };

  const goToNextPillar = () => {
    if (!plan || !expandedCell) return;

    // Get current pillar index
    const currentPillarContent = expandedCell.type === 'pillar'
      ? expandedCell.content
      : expandedCell.parent?.content;

    const currentPillarIndex = plan.pillars.findIndex(p => p.title === currentPillarContent);
    if (currentPillarIndex === -1) return;

    // Get next pillar (wrap around to first if at end)
    const nextPillarIndex = (currentPillarIndex + 1) % plan.pillars.length;
    const nextPillar = plan.pillars[nextPillarIndex];

    if (!nextPillar.title) return;

    setShowNavigationChoice(false);

    const nextCell: ExpandedCell = {
      content: nextPillar.title,
      type: 'pillar',
      index: 0,
      parent: plan.goal ? { content: plan.goal, type: 'goal' } : undefined
    };

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        setExpandedCell(nextCell);
      });
    } else {
      setExpandedCell(nextCell);
    }
  };
  // Helper function to get cell content based on position
  const getCellContent = (sectionRow: number, sectionCol: number, cellRow: number, cellCol: number) => {
    // Center section (1, 1) contains the goal and 8 pillars
    if (sectionRow === 1 && sectionCol === 1) {
      // Center cell is the goal
      if (cellRow === 1 && cellCol === 1) {
        return { type: 'goal', content: plan?.goal || '' };
      }
      // 8 surrounding cells are the pillars
      const pillarIndex = getCenterPillarIndex(cellRow, cellCol);
      return { type: 'pillar', content: plan?.pillars[pillarIndex]?.title || '', index: pillarIndex };
    }

    // Other sections contain tasks for their respective pillar
    const pillarIndex = getSectionPillarIndex(sectionRow, sectionCol);
    const taskIndex = getTaskIndex(cellRow, cellCol);
    return {
      type: 'task',
      content: plan?.pillars[pillarIndex]?.tasks[taskIndex] || '',
      pillarIndex,
      taskIndex,
    };
  };

  // Map center cell position to pillar index (0-7)
  const getCenterPillarIndex = (row: number, col: number): number => {
    // Top row: pillars 0, 1, 2
    if (row === 0 && col === 0) return 0;
    if (row === 0 && col === 1) return 1;
    if (row === 0 && col === 2) return 2;
    // Middle row: pillars 7 (left) and 3 (right)
    if (row === 1 && col === 0) return 7;
    if (row === 1 && col === 2) return 3;
    // Bottom row: pillars 6, 5, 4
    if (row === 2 && col === 0) return 6;
    if (row === 2 && col === 1) return 5;
    if (row === 2 && col === 2) return 4;
    return 0; // Fallback
  };

  // Map section position to pillar index
  const getSectionPillarIndex = (sectionRow: number, sectionCol: number): number => {
    // Top row sections
    if (sectionRow === 0 && sectionCol === 0) return 0;
    if (sectionRow === 0 && sectionCol === 1) return 1;
    if (sectionRow === 0 && sectionCol === 2) return 2;
    // Middle row sections
    if (sectionRow === 1 && sectionCol === 0) return 7;
    if (sectionRow === 1 && sectionCol === 2) return 3;
    // Bottom row sections
    if (sectionRow === 2 && sectionCol === 0) return 6;
    if (sectionRow === 2 && sectionCol === 1) return 5;
    if (sectionRow === 2 && sectionCol === 2) return 4;
    return 0; // Fallback
  };

  // Map cell position within a section to task index (0-7)
  const getTaskIndex = (row: number, col: number): number => {
    // Tasks arranged clockwise around the pillar:
    // 0 1 2
    // 7 P 3
    // 6 5 4
    if (row === 0 && col === 0) return 0;
    if (row === 0 && col === 1) return 1;
    if (row === 0 && col === 2) return 2;
    if (row === 1 && col === 2) return 3;
    if (row === 2 && col === 2) return 4;
    if (row === 2 && col === 1) return 5;
    if (row === 2 && col === 0) return 6;
    if (row === 1 && col === 0) return 7;
    return 0; // Center (pillar position)
  };

  // Render a single cell
  const renderCell = (sectionRow: number, sectionCol: number, cellRow: number, cellCol: number) => {
    const cellData = getCellContent(sectionRow, sectionCol, cellRow, cellCol);
    const isGoal = cellData.type === 'goal';
    const isPillar = cellData.type === 'pillar';
    const isTask = cellData.type === 'task';

    // Check if content is empty (not yet generated)
    const isEmpty = !cellData.content || cellData.content.trim() === '';

    // Check if this cell is currently being generated
    const isGenerating =
      (generatingState.type === 'goal' && isGoal && isEmpty) ||
      (generatingState.type === 'pillars' && isPillar && isEmpty) ||
      (generatingState.type === 'tasks' && isTask && isEmpty &&
        cellData.pillarIndex !== undefined &&
        generatingState.pillarIndex !== undefined &&
        cellData.pillarIndex === generatingState.pillarIndex);

    // Cell styling based on type - DARK MODE
    let cellClasses = 'border border-gray-800 p-0.5 md:p-1 flex items-center justify-center text-center transition-all min-h-[30px] md:min-h-[40px]';
    let textClasses = 'text-[0.45rem] md:text-[0.5rem] leading-tight';

    if (isGoal) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-blue-600/30 border-blue-500/50 animate-pulse'
          : ' bg-gray-800/30 border-gray-700';
      } else {
        cellClasses += ' bg-gradient-to-br from-blue-600 to-blue-700 text-white font-medium shadow-lg';
      }
      textClasses = 'text-[0.55rem] md:text-[0.65rem] font-light';
    } else if (isPillar) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-purple-600/30 border-purple-500/50 animate-pulse'
          : ' bg-gray-800/20 border-gray-700';
      } else {
        cellClasses += ' bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium shadow-md';
      }
      textClasses = 'text-[0.5rem] md:text-[0.55rem] font-light uppercase tracking-tight';
    } else if (isTask) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-gray-700/40 border-gray-600/50 animate-pulse'
          : ' bg-gray-900/30 border-gray-800';
      } else {
        cellClasses += ' bg-gray-800/50 hover:bg-gray-700/50 text-gray-300';
      }
      textClasses = 'text-[0.45rem] md:text-[0.5rem] font-light';
    }

    const handleClick = () => {
      if (!isEmpty) {
        // Build parent info for this cell
        let parent: { content: string; type: 'goal' | 'pillar' } | undefined;

        if (cellData.type === 'pillar' && plan?.goal) {
          parent = { content: plan.goal, type: 'goal' };
        } else if (cellData.type === 'task' && cellData.pillarIndex !== undefined) {
          const pillarTitle = plan?.pillars[cellData.pillarIndex]?.title;
          if (pillarTitle) {
            parent = { content: pillarTitle, type: 'pillar' };
          }
        }

        const cellToExpand: ExpandedCell = {
          content: cellData.content,
          type: cellData.type as 'goal' | 'pillar' | 'task',
          index: 0, // Will be recalculated in scoped context
          parent
        };

        // Use View Transition API if available
        if (typeof document !== 'undefined' && 'startViewTransition' in document) {
          (document as any).startViewTransition(() => {
            setExpandedCell(cellToExpand);
          });
        } else {
          setExpandedCell(cellToExpand);
        }
      }
    };

    return (
      <div
        key={`${sectionRow}-${sectionCol}-${cellRow}-${cellCol}`}
        className={`${cellClasses} ${!isEmpty ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
      >
        {isEmpty ? (
          <span className="text-gray-700 text-xs"></span>
        ) : (
          <span className={textClasses}>{cellData.content}</span>
        )}
      </div>
    );
  };

  // Render a 3x3 section
  const renderSection = (sectionRow: number, sectionCol: number) => {
    const cells = [];
    for (let cellRow = 0; cellRow < 3; cellRow++) {
      for (let cellCol = 0; cellCol < 3; cellCol++) {
        cells.push(renderCell(sectionRow, sectionCol, cellRow, cellCol));
      }
    }

    return (
      <div
        key={`section-${sectionRow}-${sectionCol}`}
        className="grid grid-cols-3 gap-0 border-2 border-gray-700"
      >
        {cells}
      </div>
    );
  };

  // Render the entire 3x3 grid of sections
  const renderGrid = () => {
    const sections = [];
    for (let sectionRow = 0; sectionRow < 3; sectionRow++) {
      for (let sectionCol = 0; sectionCol < 3; sectionCol++) {
        sections.push(renderSection(sectionRow, sectionCol));
      }
    }

    return (
      <div className="w-full h-full grid grid-cols-3 gap-0.5 md:gap-1 bg-gray-800 p-0.5 md:p-1 rounded-lg shadow-2xl">
        {sections}
      </div>
    );
  };

  return (
    <>
      <div ref={gridRef} className="w-full h-full flex items-center justify-center overflow-hidden p-2">
        {/* 9x9 Grid - Always visible, scales to fit */}
        <div className="aspect-square h-full max-h-full">
          {renderGrid()}
        </div>
      </div>

      {/* Expanded Cell Modal */}
      {expandedCell && (
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (typeof document !== 'undefined' && 'startViewTransition' in document) {
              (document as any).startViewTransition(() => {
                setExpandedCell(null);
              });
            } else {
              setExpandedCell(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              handleNavigate('prev');
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              handleNavigate('next');
            } else if (e.key === 'Escape') {
              setExpandedCell(null);
            }
          }}
          tabIndex={0}
        >
          <div
            className={`max-w-2xl w-full p-6 md:p-12 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 relative min-h-[400px] flex flex-col ${
              expandedCell.type === 'goal'
                ? 'bg-gradient-to-br from-blue-600 to-blue-700'
                : expandedCell.type === 'pillar'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700'
                : 'bg-gray-800'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs uppercase tracking-widest font-light ${
                      expandedCell.type === 'task' ? 'text-gray-400' : 'text-white/70'
                    }`}
                  >
                    {expandedCell.type === 'goal'
                      ? 'Central Goal'
                      : expandedCell.type === 'pillar'
                      ? 'Core Pillar'
                      : 'Action Item'}
                  </span>
                  <span
                    className={`text-xs font-light ${
                      expandedCell.type === 'task' ? 'text-gray-500' : 'text-white/50'
                    }`}
                  >
                    {expandedCell.index + 1} / {scopedCells.length}
                  </span>
                </div>
                {expandedCell.parent && (
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs uppercase tracking-wide font-light ${
                        expandedCell.type === 'task' ? 'text-gray-500' : 'text-white/50'
                      }`}
                    >
                      {expandedCell.parent.type === 'goal' ? 'Goal:' : 'Pillar:'}
                    </span>
                    <span
                      className={`text-sm font-normal ${
                        expandedCell.type === 'task' ? 'text-gray-300' : 'text-white/80'
                      }`}
                    >
                      {expandedCell.parent.content}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
                    (document as any).startViewTransition(() => {
                      setExpandedCell(null);
                    });
                  } else {
                    setExpandedCell(null);
                  }
                }}
                className={`-mt-2 -mr-2 p-2 rounded-lg transition-colors ${
                  expandedCell.type === 'task'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {showNavigationChoice ? (
                <div className="w-full text-center space-y-6">
                  <div>
                    <h3 className={`text-2xl md:text-3xl font-light mb-3 ${expandedCell.type === 'task' ? 'text-gray-100' : 'text-white'}`}>
                      Section Complete
                    </h3>
                    <p className={`text-sm font-light ${expandedCell.type === 'task' ? 'text-gray-400' : 'text-white/70'}`}>
                      Ready for the next pillar?
                    </p>
                  </div>

                  <button
                    onClick={handleReviewAgain}
                    className={`px-6 py-2.5 rounded-lg font-light text-sm transition-colors ${
                      expandedCell.type === 'task'
                        ? 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                        : 'bg-white/10 hover:bg-white/20 text-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Review This Section Again</span>
                    </div>
                  </button>
                </div>
              ) : (
                <p
                  className={`text-xl md:text-3xl font-light leading-relaxed ${
                    expandedCell.type === 'task' ? 'text-gray-100' : 'text-white'
                  }`}
                >
                  {expandedCell.content}
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-auto mb-4">
              <div className="flex items-center gap-1 mb-2">
                {scopedCells.map((cell, index) => (
                  <div
                    key={index}
                    className={`h-2 flex-1 rounded-full transition-all relative group ${
                      index === expandedCell.index
                        ? expandedCell.type === 'task'
                          ? 'bg-gray-300 scale-y-125'
                          : 'bg-white scale-y-125'
                        : index < expandedCell.index
                        ? expandedCell.type === 'task'
                          ? 'bg-gray-600'
                          : 'bg-white/50'
                        : expandedCell.type === 'task'
                        ? 'bg-gray-700/40'
                        : 'bg-white/20'
                    }`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className={`px-2 py-1 rounded text-[0.6rem] whitespace-nowrap ${
                        expandedCell.type === 'task' ? 'bg-gray-700 text-gray-200' : 'bg-white/10 text-white backdrop-blur-sm'
                      }`}>
                        {cell.content.slice(0, 40)}{cell.content.length > 40 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => handleNavigate('prev')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-light text-sm transition-colors ${
                  expandedCell.type === 'task'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back</span>
              </button>

              <button
                onClick={() => showNavigationChoice ? goToNextPillar() : handleNavigate('next')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-light text-sm transition-colors ${
                  expandedCell.type === 'task'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <span className="hidden sm:inline">{showNavigationChoice ? 'Next Pillar' : 'Next'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
