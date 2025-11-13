/**
 * useFaceRecognition Hook
 * 
 * Manages face recognition lifecycle:
 * - Initialize models
 * - Capture face embeddings
 * - Verify faces
 * - Identify users
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import * as faceService from '@/services/faceRecognitionService';
import { trpc } from '@/lib/trpc';

export interface FaceRecognitionState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  faceDetected: boolean;
  confidence: number;
}

export interface UseFaceRecognitionOptions {
  autoInitialize?: boolean;
  videoElement?: HTMLVideoElement | null;
}

export function useFaceRecognition(options: UseFaceRecognitionOptions = {}) {
  const { autoInitialize = true, videoElement } = options;
  
  const [state, setState] = useState<FaceRecognitionState>({
    initialized: false,
    loading: false,
    error: null,
    faceDetected: false,
    confidence: 0,
  });
  
  const initializationRef = useRef<Promise<void> | null>(null);
  
  // Initialize face-api models
  const initialize = useCallback(async () => {
    if (state.initialized || initializationRef.current) {
      return;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      initializationRef.current = faceService.initializeFaceAPI();
      await initializationRef.current;
      
      setState(prev => ({
        ...prev,
        initialized: true,
        loading: false,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to initialize face API';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMsg,
      }));
      console.error('[useFaceRecognition] Initialization error:', error);
    }
  }, [state.initialized]);
  
  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);
  
  // Detect face in video
  const detectFace = useCallback(async () => {
    if (!state.initialized || !videoElement) {
      return null;
    }
    
    try {
      const embeddings = await faceService.detectFacesWithEmbeddings(videoElement);
      
      if (embeddings.length > 0) {
        const embedding = embeddings[0];
        setState(prev => ({
          ...prev,
          faceDetected: true,
          confidence: embedding.confidence,
        }));
        return embedding;
      } else {
        setState(prev => ({
          ...prev,
          faceDetected: false,
          confidence: 0,
        }));
        return null;
      }
    } catch (error) {
      console.error('[useFaceRecognition] Detection error:', error);
      return null;
    }
  }, [state.initialized, videoElement]);
  
  // Capture best face frame
  const captureBestFrame = useCallback(
    async (duration: number = 3000) => {
      if (!state.initialized || !videoElement) {
        return null;
      }
      
      setState(prev => ({ ...prev, loading: true }));
      
      try {
        const embedding = await faceService.captureBestFaceFrame(
          videoElement,
          duration
        );
        
        setState(prev => ({ ...prev, loading: false }));
        return embedding;
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Capture failed',
        }));
        return null;
      }
    },
    [state.initialized, videoElement]
  );
  
  // Enroll user face
  const enrollFace = useCallback(
    async (sampleCount: number = 5) => {
      if (!state.initialized || !videoElement) {
        return null;
      }
      
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const embeddings = await faceService.enrollUserFace(
          videoElement,
          sampleCount
        );
        
        // Send to backend
        const avgEmbedding = faceService.generateAverageEmbedding(
          embeddings.map(e => e.embedding)
        );
        
        // Store via API
        const response = await fetch('/api/face/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embedding: Array.from(avgEmbedding),
            confidence: embeddings[0].confidence,
            metadata: {
              sampleCount: embeddings.length,
            },
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to enroll face');
        }
        
        const result = await response.json();
        
        setState(prev => ({ ...prev, loading: false }));
        return result.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Enrollment failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    [state.initialized, videoElement]
  );
  
  // Verify face
  const verifyFace = useCallback(
    async (embedding: number[], threshold: number = 0.6) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const response = await fetch('/api/face/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embedding, threshold }),
        });
        
        if (!response.ok) {
          throw new Error('Verification failed');
        }
        
        const result = await response.json();
        
        setState(prev => ({ ...prev, loading: false }));
        return result.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Verification failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    []
  );
  
  // Identify user from face
  const identifyUser = useCallback(
    async (embedding: number[], threshold: number = 0.6) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        const response = await fetch('/api/face/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embedding, threshold }),
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            return null; // No match found
          }
          throw new Error('Identification failed');
        }
        
        const result = await response.json();
        
        setState(prev => ({ ...prev, loading: false }));
        return result.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Identification failed';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    []
  );
  
  // Detect liveness
  const detectLiveness = useCallback(async () => {
    if (!state.initialized || !videoElement) {
      return null;
    }
    
    try {
      const result = await faceService.detectLiveness(videoElement);
      return result;
    } catch (error) {
      console.error('[useFaceRecognition] Liveness detection error:', error);
      return null;
    }
  }, [state.initialized, videoElement]);
  
  // Get user profile
  const getUserProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/face/profile');
      
      if (!response.ok) {
        return null;
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('[useFaceRecognition] Profile fetch error:', error);
      return null;
    }
  }, []);
  
  // Get statistics
  const getStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/face/statistics');
      
      if (!response.ok) {
        return null;
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('[useFaceRecognition] Statistics error:', error);
      return null;
    }
  }, []);
  
  return {
    // State
    ...state,
    
    // Methods
    initialize,
    detectFace,
    captureBestFrame,
    enrollFace,
    verifyFace,
    identifyUser,
    detectLiveness,
    getUserProfile,
    getStatistics,
  };
}
