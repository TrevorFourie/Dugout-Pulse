import React, { useState, useEffect, useCallback } from 'react';
import { Play, PlayCode, PlayMode } from '../types/baseball';
import { useGame } from '../context/GameContext';
import { Flame, Check, X, Undo2, Plus, AlertTriangle, Info } from 'lucide-react';

export interface RunnerState {
  playerName: string;
  runnerOnBase: boolean;
  basePosition?: '1B' | '2B' | '3B';
  state: 'IDLE_AT_BAT' | 'ON_BASE' | 'PA_COMPLETE' | 'RUNNING' | 'OUT';
  battingOrder?: number;
  lineupSlot?: string;
  isBenched: boolean;
  currentStealCount: number;
  currentRunCount: number;
  isInjured: boolean;
}

export interface BaseAdvanceStep {
  fromBase: '1B' | '2B' | '3B';
  toBase: '1B' | '2B' | '3B';
  isStolenBase: boolean;
  isBalk: boolean;
  isWildPitch: boolean;
  isWalk: boolean;
}

export interface ModalState {
  isOpen: boolean;
  currentStep: 'PRIMARY_TRIGGER' | 'RUNNER_ADVANCE' | 'RUN_SCORED';
  primaryAction: 'HIT' | 'WALK_HBP' | 'OUT' | 'ROE';
  runnerState: RunnerState | null;
  baseAdvanceSteps: BaseAdvanceStep[];
  modalHistory: BaseAdvanceStep[];
  pendingUndoStep: BaseAdvanceStep | null;
  isShowingUndo: boolean;
}

const INITIAL_RUNNER_STATE: RunnerState = {
  playerName: 'Luhan',
  runnerOnBase: false,
  state: 'IDLE_AT_BAT',
  battingOrder: 1,
  lineupSlot: '1st (Leadoff)',
  isBenched: false,
  currentStealCount: 0,
  currentRunCount: 0,
  isInjured: false,
};

const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
  if (typeof window !== 'undefined' && window.navigator?.vibrate) {
    const duration = type === 'light' ? 10 : type === 'medium' ? 30 : 50;
    window.navigator.vibrate(duration);
  }
};

export const ContextModal: React.FC = () => {
  const { liveGame, addPlay } = useGame();
  
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    currentStep: 'PRIMARY_TRIGGER',
    primaryAction: 'HIT',
    runnerState: null,
    baseAdvanceSteps: [],
    modalHistory: [],
    pendingUndoStep: null,
    isShowingUndo: false,
  });

  const openModal = useCallback((action: 'HIT' | 'WALK_HBP' | 'OUT' | 'ROE') => {
    triggerHaptic('light');
    
    const newRunnerState: RunnerState = {
      ...INITIAL_RUNNER_STATE,
      state: 'ON_BASE',
      runnerOnBase: true,
      basePosition: '1B',
    };
    
    setModalState(prev => ({
      ...prev,
      isOpen: true,
      currentStep: 'RUNNER_ADVANCE',
      primaryAction: action,
      runnerState: newRunnerState,
      baseAdvanceSteps: [],
      modalHistory: [],
      pendingUndoStep: null,
      isShowingUndo: false,
    }));
  }, []);

  const handleRunnerAdvance = useCallback((isStolenBase: boolean = true) => {
    if (!modalState.runnerState || modalState.runnerState.state !== 'ON_BASE') return;
    
    triggerHaptic('medium');
    
    const runner = modalState.runnerState;
    let newBasePosition: '1B' | '2B' | '3B' | undefined = '1B';
    let newStealCount = 0;
    
    if (runner.basePosition === '1B') {
      newBasePosition = '2B';
      newStealCount = isStolenBase ? 1 : 0;
    } else if (runner.basePosition === '2B') {
      newBasePosition = '3B';
      newStealCount = isStolenBase ? 2 : 0;
    } else if (runner.basePosition === '3B') {
      newBasePosition = '3B';
    }
    
    const step: BaseAdvanceStep = {
      fromBase: runner.basePosition || '1B',
      toBase: newBasePosition,
      isStolenBase,
      isBalk: false,
      isWildPitch: false,
      isWalk: modalState.primaryAction === 'WALK_HBP',
    };
    
    const newRunnerState: RunnerState = {
      ...runner,
      basePosition: newBasePosition,
      currentStealCount: newStealCount,
    };
    
    setModalState(prev => ({
      ...prev,
      runnerState: newRunnerState,
      baseAdvanceSteps: [...prev.baseAdvanceSteps, step],
      modalHistory: [...prev.modalHistory, step],
      pendingUndoStep: step,
      isShowingUndo: true,
    }));
  }, [modalState.runnerState, modalState.primaryAction]);

  const handleDoneStayOnBase = useCallback(() => {
    triggerHaptic('medium');
    
    if (!modalState.runnerState) return;
    
    addPlay('batting', 'single');
    
    setModalState(prev => ({
      ...prev,
      isOpen: false,
      currentStep: 'PRIMARY_TRIGGER',
      runnerState: null,
      baseAdvanceSteps: [],
      modalHistory: [],
      pendingUndoStep: null,
      isShowingUndo: false,
    }));
  }, [modalState.runnerState, addPlay]);

  if (!modalState.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="w-full max-w-md mx-4 rounded-3xl border border-slate-200 dark:border-[#354050] bg-white dark:bg-[#1A2028] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#354050] bg-gradient-to-r from-[#00BFA5]/10 to-teal-50/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-[#FAFAFA]">
            Scoring Options
          </h2>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center text-slate-900 dark:text-[#FAFAFA]">
              Select Primary Action
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openModal('HIT')}
                className="p-4 rounded-xl bg-[#00BFA5] dark:bg-[#00D7BC] text-[#18212D] dark:text-[#101419] hover:opacity-90 transition-all transform hover:scale-105 shadow-lg active:scale-95"
              >
                <Flame className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold text-sm">HIT</div>
                <div className="text-xs opacity-90 mt-1">Single, Double, Triple, or Home Run</div>
              </button>
              
              <button
                onClick={() => openModal('WALK_HBP')}
                className="p-4 rounded-xl bg-blue-500 text-white hover:opacity-90 transition-all transform hover:scale-105 shadow-lg active:scale-95"
              >
                <Plus className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold text-sm">WALK / HBP</div>
                <div className="text-xs opacity-90 mt-1">Base on balls or hit by pitch</div>
              </button>
              
              <button
                onClick={() => openModal('OUT')}
                className="p-4 rounded-xl bg-slate-500 text-white hover:opacity-90 transition-all transform hover:scale-105 shadow-lg active:scale-95"
              >
                <X className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold text-sm">OUT</div>
                <div className="text-xs opacity-90 mt-1">Any defensive out</div>
              </button>
              
              <button
                onClick={() => openModal('ROE')}
                className="p-4 rounded-xl bg-blue-500 text-white hover:opacity-90 transition-all transform hover:scale-105 shadow-lg active:scale-95"
              >
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <div className="font-semibold text-sm">REACHED ON ERROR</div>
                <div className="text-xs opacity-90 mt-1">Reached base on defensive mistake</div>
              </button>
            </div>
            
            <div className="p-3 rounded-md bg-slate-100 dark:bg-[#252D38]/50">
              <p className="text-xs text-slate-600 dark:text-[#9CA3AF] text-center">
                💡 Non-expert friendly: Choose what happened on the play
              </p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#354050] bg-slate-50 dark:bg-[#1A2028]/80">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-[#9CA3AF]">
            <span>⚾ Contextual Morphing Lockdown Modal</span>
            <span>•</span>
            <span>Sub-3-Second Data Entry</span>
          </div>
        </div>
      </div>
    </div>
  );
};
