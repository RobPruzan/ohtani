'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';

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
  const [mobileDrilldownPillar, setMobileDrilldownPillar] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    let cellClasses = 'border border-gray-800 text-center transition-all p-1 h-full w-full overflow-hidden';
    let textClasses = 'leading-snug break-words hyphens-auto';

    if (isGoal) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-blue-600/30 border-blue-500/50 animate-pulse'
          : ' bg-gray-800/30 border-gray-700';
      } else {
        cellClasses += ' bg-gradient-to-br from-blue-600 to-blue-700 text-white font-medium shadow-lg';
      }
      textClasses += ' font-light';
    } else if (isPillar) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-purple-600/30 border-purple-500/50 animate-pulse'
          : ' bg-gray-800/20 border-gray-700';
      } else {
        cellClasses += ' bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium shadow-md';
      }
      textClasses += ' font-light uppercase tracking-tight';
    } else if (isTask) {
      if (isEmpty) {
        cellClasses += isGenerating
          ? ' bg-gray-700/40 border-gray-600/50 animate-pulse'
          : ' bg-gray-900/30 border-gray-800';
      } else {
        cellClasses += ' bg-gray-800/50 hover:bg-gray-700/50 text-gray-300';
      }
      textClasses += ' font-light';
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

    // Dynamic font size based on content length
    const getDynamicFontSize = () => {
      if (isEmpty) return '';
      const contentLength = cellData.content.length;

      if (isGoal) {
        if (contentLength < 30) return 'text-[0.9rem]';
        if (contentLength < 50) return 'text-[0.8rem]';
        if (contentLength < 80) return 'text-[0.7rem]';
        return 'text-[0.6rem]';
      } else if (isPillar) {
        if (contentLength < 20) return 'text-[0.75rem]';
        if (contentLength < 35) return 'text-[0.65rem]';
        if (contentLength < 50) return 'text-[0.55rem]';
        return 'text-[0.5rem]';
      } else {
        // Tasks
        if (contentLength < 40) return 'text-[0.7rem]';
        if (contentLength < 70) return 'text-[0.6rem]';
        if (contentLength < 100) return 'text-[0.55rem]';
        if (contentLength < 140) return 'text-[0.5rem]';
        return 'text-[0.45rem]';
      }
    };

    return (
      <div
        key={`${sectionRow}-${sectionCol}-${cellRow}-${cellCol}`}
        className={`${cellClasses} ${!isEmpty ? 'cursor-pointer' : ''} flex items-center justify-center`}
        onClick={handleClick}
      >
        {isEmpty ? (
          <span className="text-gray-700 text-xs min-h-[30px]"></span>
        ) : (
          <span className={`${textClasses} ${getDynamicFontSize()}`}>{cellData.content}</span>
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
        className="grid grid-cols-3 grid-rows-3 gap-0 border-2 border-gray-700 h-full w-full"
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
      <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5 bg-gray-800 p-0.5 rounded-lg shadow-2xl">
        {sections}
      </div>
    );
  };

  // Render mobile view with progressive disclosure
  const renderMobileView = () => {
    if (!plan) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <div className="aspect-square w-full max-w-sm grid grid-cols-3 gap-0.5 bg-gray-800 p-0.5 rounded-lg">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-gray-900/30 border border-gray-700 min-h-[80px]" />
            ))}
          </div>
        </div>
      );
    }

    // Overview - center 3x3 grid (goal + 8 pillars)
    return (
      <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="aspect-square w-full grid grid-cols-3 gap-1 bg-gray-800 p-1 rounded-lg shadow-2xl">
            {[...Array(9)].map((_, index) => {
              const row = Math.floor(index / 3);
              const col = index % 3;

              // Center cell is goal
              if (row === 1 && col === 1) {
                const isEmpty = !plan.goal;
                const isGenerating = generatingState.type === 'goal' && isEmpty;

                return (
                  <div
                    key={index}
                    className={`border border-gray-700 p-2 flex items-center justify-center text-center transition-all ${
                      isEmpty
                        ? isGenerating
                          ? 'bg-blue-600/30 border-blue-500/50 animate-pulse'
                          : 'bg-gray-800/30'
                        : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg'
                    }`}
                  >
                    <span className="text-[0.7rem] font-light leading-tight">
                      {plan.goal || ''}
                    </span>
                  </div>
                );
              }

              // Surrounding cells are pillars
              const pillarIndex = getCenterPillarIndex(row, col);
              const pillar = plan.pillars[pillarIndex];
              const isEmpty = !pillar?.title;
              const isGenerating = generatingState.type === 'pillars' && isEmpty;

              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!isEmpty) {
                      setMobileDrilldownPillar(pillarIndex);
                    }
                  }}
                  className={`border border-gray-700 p-2 flex items-center justify-center text-center transition-all ${
                    isEmpty
                      ? isGenerating
                        ? 'bg-purple-600/30 border-purple-500/50 animate-pulse'
                        : 'bg-gray-800/20'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md cursor-pointer active:scale-95'
                  }`}
                >
                  <span className="text-[0.65rem] font-light uppercase tracking-tight leading-tight">
                    {pillar?.title || ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hint text */}
          {plan.pillars.some(p => p.title) && (
            <p className="text-center text-xs text-gray-500 mt-4">
              Tap any pillar to view its tasks
            </p>
          )}
        </div>
      </div>
    );
  };

  // Get all filled cells for modal navigation
  const allCells: ExpandedCell[] = [];
  if (plan) {
    if (plan.goal) {
      allCells.push({ content: plan.goal, type: 'goal', index: allCells.length });
    }
    for (let pillarIndex = 0; pillarIndex < plan.pillars.length; pillarIndex++) {
      const pillar = plan.pillars[pillarIndex];
      if (pillar.title) {
        allCells.push({
          content: pillar.title,
          type: 'pillar',
          index: allCells.length,
          parent: plan.goal ? { content: plan.goal, type: 'goal' } : undefined
        });
      }
      for (const task of pillar.tasks) {
        if (task) {
          allCells.push({
            content: task,
            type: 'task',
            index: allCells.length,
            parent: pillar.title ? { content: pillar.title, type: 'pillar' } : undefined
          });
        }
      }
    }
  }

  return (
    <>
      <div ref={gridRef} className="w-full h-full overflow-hidden p-2">
        {isMobile ? (
          renderMobileView()
        ) : (
          <div className="w-full h-full">
            {renderGrid()}
          </div>
        )}
      </div>

      {/* Mobile Drawer for Pillar Tasks */}
      {isMobile && mobileDrilldownPillar !== null && plan && (
        <Drawer open={mobileDrilldownPillar !== null} onOpenChange={(open) => !open && setMobileDrilldownPillar(null)}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <DrawerTitle className="text-xl font-light">
                {plan.pillars[mobileDrilldownPillar]?.title}
              </DrawerTitle>
              <DrawerDescription className="text-white/70 text-xs">
                Goal: {plan.goal}
              </DrawerDescription>
            </DrawerHeader>

            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {plan.pillars[mobileDrilldownPillar]?.tasks.map((task, index) => {
                  const isEmpty = !task || task.trim() === '';
                  const isGenerating = generatingState.type === 'tasks' &&
                                      isEmpty &&
                                      generatingState.pillarIndex === mobileDrilldownPillar;

                  return (
                    <div
                      key={index}
                      onClick={() => {
                        if (!isEmpty) {
                          const cellIndex = allCells.findIndex(
                            (cell) => cell.content === task && cell.type === 'task'
                          );
                          if (cellIndex >= 0) {
                            setMobileDrilldownPillar(null); // Close drawer
                            if (typeof document !== 'undefined' && 'startViewTransition' in document) {
                              (document as any).startViewTransition(() => {
                                setExpandedCell(allCells[cellIndex]);
                              });
                            } else {
                              setExpandedCell(allCells[cellIndex]);
                            }
                          }
                        }
                      }}
                      className={`p-3 rounded-lg border transition-all min-h-[100px] flex items-center justify-center text-center ${
                        isEmpty
                          ? isGenerating
                            ? 'bg-gray-700/40 border-gray-600/50 animate-pulse'
                            : 'bg-gray-900/30 border-gray-800'
                          : 'bg-gray-800/50 border-gray-700 active:bg-gray-700/50 cursor-pointer'
                      }`}
                    >
                      <span className="text-xs font-light text-gray-300 leading-snug">
                        {task || ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

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
