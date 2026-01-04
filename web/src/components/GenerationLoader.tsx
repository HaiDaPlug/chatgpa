import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle, Circle, X, ChevronDown, ChevronRight, Clock } from 'lucide-react';

// --- TYPES ---

export type GenerationStage = 'sending' | 'generating' | 'validating' | 'finalizing' | 'error';

export interface TimingItem {
  label: string;
  durationMs?: number;
  status?: 'pending' | 'active' | 'done';
}

interface LoaderOverlayProps {
  stage: GenerationStage;
  title?: string;
  subtitle?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  timingDetails?: TimingItem[];
  tips?: string[]; // Optional rotation of tips
  showReassuranceHint?: boolean; // Phase 8: Show "Still working..." hint after 15s
}

// --- CONSTANTS ---

const STAGE_CONFIG: Record<GenerationStage, { label: string; index: number }> = {
  sending: { label: 'Sending material...', index: 0 },
  generating: { label: 'Drafting questions...', index: 1 },
  validating: { label: 'Formatting & checking...', index: 2 },
  finalizing: { label: 'Finalizing quiz...', index: 3 },
  error: { label: 'Generation failed', index: -1 } // Index handled separately
};

const ORDERED_STAGES: GenerationStage[] = ['sending', 'generating', 'validating', 'finalizing'];

// --- EXPORTED COMPONENTS ---

/**
 * 1. GenerationLoaderOverlay
 * The main container. Renders a blurry backdrop and a centered "Glass" card.
 */
export const GenerationLoaderOverlay: React.FC<LoaderOverlayProps> = ({
  stage,
  title = "Building your Quiz",
  subtitle = "This usually takes 10-20 seconds.",
  onCancel,
  onRetry,
  timingDetails = [],
  tips,
  showReassuranceHint = false
}) => {
  const isError = stage === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with Blur */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-stone-100/80 backdrop-blur-md" 
      />

      {/* Main Card */}
      <motion.div 
        layout
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-white/90 rounded-2xl border border-stone-200 shadow-2xl overflow-hidden"
      >
        {/* Header Section */}
        <div className="p-8 pb-6 text-center space-y-2">
          <h2 className="text-xl font-serif font-bold text-stone-900 tracking-tight">
            {isError ? 'Generation Failed' : title}
          </h2>
          <p className="text-sm text-stone-500 font-medium">
             {isError ? 'We encountered an issue while talking to the AI.' : subtitle}
          </p>
        </div>

        {/* Stepper Body */}
        <div className="px-8 pb-8 space-y-8">
           <StageStepper currentStage={stage} />

           {/* Phase 8: 15s Reassurance Hint */}
           {!isError && showReassuranceHint && stage === 'generating' && (
             <motion.div
               initial={{ opacity: 0, y: -5 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.3 }}
               className="text-center"
             >
               <p className="text-xs text-stone-400 italic">
                 Still working... {timingDetails.length > 0 && <span className="text-stone-500 not-italic underline decoration-dotted cursor-pointer">View details</span>}
               </p>
             </motion.div>
           )}

           {/* Dynamic Tip Area (Optional polish) */}
           {!isError && tips && tips.length > 0 && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="bg-stone-50 rounded-lg p-3 text-center"
             >
               <p className="text-xs text-stone-500 italic">
                 <span className="font-bold not-italic text-stone-400 mr-2">TIP</span>
                 {tips[0]}
               </p>
             </motion.div>
           )}

           {/* Actions */}
           <div className="flex justify-center gap-3 pt-2">
             {isError ? (
               <>
                 <button 
                    onClick={onCancel}
                    className="px-6 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                 >
                   Close
                 </button>
                 <button 
                    onClick={onRetry}
                    className="px-6 py-2 rounded-lg text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors shadow-sm"
                 >
                   Try Again
                 </button>
               </>
             ) : (
                <button 
                  onClick={onCancel}
                  className="group flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Generation
                </button>
             )}
           </div>
        </div>

        {/* Optional: Collapsible Debug/Timing Details */}
        {timingDetails.length > 0 && (
          <TimingDetails items={timingDetails} />
        )}
      </motion.div>
    </div>
  );
};

/**
 * 2. StageStepper
 * Visualizes the linear progress. 
 * Handles the logic of "past", "present", "future" styles based on the current stage prop.
 */
export const StageStepper: React.FC<{ currentStage: GenerationStage }> = ({ currentStage }) => {
  const isError = currentStage === 'error';
  
  // Determine the numeric index of the current stage (0-3). If error, we don't highlight a specific step as active.
  const currentIndex = STAGE_CONFIG[currentStage].index;

  return (
    <div className="space-y-3 relative">
      {/* Connecting Line (Absolute) - Visual glue */}
      <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-stone-100 -z-10" />

      {ORDERED_STAGES.map((stepStage, idx) => {
        let status: 'done' | 'active' | 'todo' | 'error' = 'todo';

        if (isError) {
             // If global error, everything pending is error state, everything done remains done
             // Simplified: Just show error on the active step where it failed? 
             // For this UI, let's mark the 'would-be' active step as error.
             // But we don't know *which* step failed easily without more props. 
             // Fallback: If error, show generic error state on all non-done steps or just keep static.
             status = 'error'; 
        } else {
             if (idx < currentIndex) status = 'done';
             else if (idx === currentIndex) status = 'active';
             else status = 'todo';
        }

        return (
          <StageRow 
            key={stepStage}
            status={status}
            label={STAGE_CONFIG[stepStage].label}
            isLast={idx === ORDERED_STAGES.length - 1}
          />
        );
      })}
    </div>
  );
};

/**
 * 3. StageRow
 * A single row in the stepper.
 * Uses Framer Motion for the "Active" pulse effect.
 */
export const StageRow: React.FC<{ 
  status: 'done' | 'active' | 'todo' | 'error'; 
  label: string; 
  isLast?: boolean;
}> = ({ status, label }) => {
  
  return (
    <div className="flex items-center gap-4 bg-white/50 backdrop-blur-[2px] rounded-lg py-1">
      {/* Icon Indicator */}
      <div className="relative flex-shrink-0 flex items-center justify-center w-8 h-8">
        <AnimatePresence mode="wait">
          {status === 'done' && (
            <motion.div 
              key="done"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-green-600"
            >
              <CheckCircle2 className="w-5 h-5 fill-green-100" />
            </motion.div>
          )}

          {status === 'active' && (
            <motion.div 
              key="active"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
               {/* Pulsing ring */}
               <motion.div 
                 animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 className="absolute inset-0 rounded-full bg-blue-100"
               />
               <Loader2 className="w-5 h-5 text-blue-600 animate-spin relative z-10" />
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              key="error"
              initial={{ scale: 0.5 }} 
              animate={{ scale: 1 }}
              className="text-red-500"
            >
              <AlertCircle className="w-5 h-5 fill-red-50" />
            </motion.div>
          )}

          {status === 'todo' && (
            <motion.div 
               key="todo"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
            >
               <Circle className="w-3 h-3 text-stone-200 fill-stone-50" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Label */}
      <div className="flex-1">
        <span 
          className={`
            text-sm font-medium transition-colors duration-300
            ${status === 'active' ? 'text-stone-900' : ''}
            ${status === 'done' ? 'text-stone-400 line-through decoration-stone-200' : ''}
            ${status === 'todo' ? 'text-stone-300' : ''}
            ${status === 'error' ? 'text-red-600' : ''}
          `}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

/**
 * 4. TimingDetails (Collapsible Debug)
 * Hidden by default, useful for "nerd stats" or simply showing user that *something* is happening.
 */
export const TimingDetails: React.FC<{ items: TimingItem[] }> = ({ items }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // Auto-expand if something takes > 3s? Logic stays outside. Here purely manual toggle.
  
  return (
    <div className="border-t border-stone-100 bg-stone-50/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-8 py-3 text-xs font-medium text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Timing Details
        </span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-4 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className={`
                    ${item.status === 'active' ? 'text-stone-900 font-semibold' : 'text-stone-500'}
                  `}>
                    {item.label}
                  </span>
                  <span className="font-mono text-stone-400">
                    {item.durationMs ? `${(item.durationMs / 1000).toFixed(2)}s` : '--'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};