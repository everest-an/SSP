/**
 * LivenessChallenge Component
 * 
 * Displays liveness detection challenges to the user and guides them through the process.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

export interface LivenessChallenge {
  type: 'blink' | 'turn_head' | 'smile' | 'nod';
  instruction: string;
  expectedAction: string;
}

interface LivenessChallengeProps {
  challenges: LivenessChallenge[];
  currentChallengeIndex: number;
  onChallengeComplete?: (index: number) => void;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

const challengeIcons: Record<LivenessChallenge['type'], string> = {
  blink: '👁️',
  turn_head: '↔️',
  smile: '😊',
  nod: '⬆️⬇️',
};

const challengeColors: Record<LivenessChallenge['type'], string> = {
  blink: 'text-blue-500',
  turn_head: 'text-purple-500',
  smile: 'text-yellow-500',
  nod: 'text-green-500',
};

export function LivenessChallenge({
  challenges,
  currentChallengeIndex,
  onChallengeComplete,
  autoAdvance = false,
  autoAdvanceDelay = 3000,
}: LivenessChallengeProps) {
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());
  const [countdown, setCountdown] = useState<number>(0);

  const currentChallenge = challenges[currentChallengeIndex];
  const progress = ((currentChallengeIndex + 1) / challenges.length) * 100;

  useEffect(() => {
    if (autoAdvance && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (autoAdvance && countdown === 0 && currentChallengeIndex < challenges.length - 1) {
      // Auto-advance to next challenge
      const timer = setTimeout(() => {
        handleChallengeComplete();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoAdvance, countdown, currentChallengeIndex, challenges.length]);

  const handleChallengeComplete = () => {
    setCompletedChallenges(prev => new Set(prev).add(currentChallengeIndex));
    
    if (onChallengeComplete) {
      onChallengeComplete(currentChallengeIndex);
    }

    if (autoAdvance && currentChallengeIndex < challenges.length - 1) {
      setCountdown(Math.floor(autoAdvanceDelay / 1000));
    }
  };

  if (!currentChallenge) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          All challenges completed! Processing your face data...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-3xl">{challengeIcons[currentChallenge.type]}</span>
          <span>Liveness Check</span>
        </CardTitle>
        <CardDescription>
          Challenge {currentChallengeIndex + 1} of {challenges.length}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {Math.round(progress)}% Complete
          </p>
        </div>

        {/* Current Challenge Instruction */}
        <div className={`p-4 rounded-lg border-2 border-dashed ${challengeColors[currentChallenge.type]} bg-secondary/50`}>
          <p className="text-lg font-medium text-center">
            {currentChallenge.instruction}
          </p>
        </div>

        {/* Countdown (if auto-advance) */}
        {autoAdvance && countdown > 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Next challenge in {countdown}s
            </p>
          </div>
        )}

        {/* Challenge List */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Challenges:</p>
          <div className="space-y-1">
            {challenges.map((challenge, index) => {
              const isCompleted = completedChallenges.has(index);
              const isCurrent = index === currentChallengeIndex;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded ${
                    isCurrent ? 'bg-primary/10 border border-primary' : ''
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isCurrent ? (
                    <Circle className="h-4 w-4 text-primary animate-pulse" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={`text-sm ${isCurrent ? 'font-medium' : 'text-muted-foreground'}`}>
                    {challenge.instruction}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Tips:</strong> Make sure you're in a well-lit area and your face is clearly visible.
            Follow each instruction carefully.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
