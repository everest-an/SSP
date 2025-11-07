import {
  FaceDetector,
  FilesetResolver,
  GestureRecognizer,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

/**
 * MediaPipe Face Detection Utility
 * Used for face recognition and user identification
 */
export class FaceDetectionService {
  private faceDetector: FaceDetector | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      this.faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });

      this.initialized = true;
      console.log("[MediaPipe] Face detector initialized");
    } catch (error) {
      console.error("[MediaPipe] Failed to initialize face detector:", error);
      throw error;
    }
  }

  async detectFaces(videoElement: HTMLVideoElement) {
    if (!this.faceDetector) {
      throw new Error("Face detector not initialized");
    }

    const timestamp = performance.now();
    const detections = this.faceDetector.detectForVideo(videoElement, timestamp);
    return detections;
  }

  /**
   * Extract face embedding (simplified version)
   * In production, you should use a proper face recognition model like FaceNet
   */
  extractFaceEmbedding(detections: any): number[] | null {
    if (!detections.detections || detections.detections.length === 0) {
      return null;
    }

    const detection = detections.detections[0];
    const keypoints = detection.keypoints || [];

    // Create a simple feature vector from face keypoints
    // In production, use a proper face recognition model
    const embedding: number[] = [];
    keypoints.forEach((kp: any) => {
      embedding.push(kp.x, kp.y);
    });

    return embedding;
  }

  close() {
    if (this.faceDetector) {
      this.faceDetector.close();
      this.initialized = false;
    }
  }
}

/**
 * MediaPipe Hand Gesture Recognition Utility
 * Used for detecting "YES" gesture (pick up action)
 */
export class GestureRecognitionService {
  private gestureRecognizer: GestureRecognizer | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Initialize gesture recognizer
      this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Initialize hand landmarker for detailed hand tracking
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.initialized = true;
      console.log("[MediaPipe] Gesture recognizer initialized");
    } catch (error) {
      console.error("[MediaPipe] Failed to initialize gesture recognizer:", error);
      throw error;
    }
  }

  async recognizeGesture(videoElement: HTMLVideoElement) {
    if (!this.gestureRecognizer || !this.handLandmarker) {
      throw new Error("Gesture recognizer not initialized");
    }

    const timestamp = performance.now();
    
    // Get gesture recognition results
    const gestureResults = this.gestureRecognizer.recognizeForVideo(videoElement, timestamp);
    
    // Get hand landmarks for detailed analysis
    const landmarkResults = this.handLandmarker.detectForVideo(videoElement, timestamp);

    return {
      gestures: gestureResults.gestures,
      landmarks: landmarkResults.landmarks,
      handedness: gestureResults.handednesses,
    };
  }

  /**
   * Detect thumbs up 👍 gesture for payment confirmation
   */
  detectThumbsUpGesture(results: any): {
    detected: boolean;
    confidence: number;
    handPosition?: { x: number; y: number; z: number };
  } {
    if (!results.landmarks || results.landmarks.length === 0) {
      return { detected: false, confidence: 0 };
    }

    const handLandmarks = results.landmarks[0];
    
    // Calculate hand center
    const palmCenter = {
      x: handLandmarks[0].x,
      y: handLandmarks[0].y,
      z: handLandmarks[0].z,
    };

    // Check for thumbs up gesture from MediaPipe
    let gestureConfidence = 0;
    if (results.gestures && results.gestures.length > 0) {
      const gesture = results.gestures[0][0];
      if (gesture.categoryName === "Thumb_Up") {
        gestureConfidence = gesture.score;
      }
    }

    // Manual check for thumbs up: thumb extended, other fingers curled
    const thumbUp = this.isThumbUp(handLandmarks);
    const confidence = Math.max(thumbUp ? 0.85 : 0, gestureConfidence);

    return {
      detected: confidence > 0.7,
      confidence,
      handPosition: palmCenter,
    };
  }

  /**
   * Check if thumb is up (extended upward)
   */
  private isThumbUp(landmarks: any[]): boolean {
    // Thumb tip (4) should be higher than thumb base (2)
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const thumbExtended = thumbTip.y < thumbBase.y - 0.05;

    // Other fingers should be curled
    const palmY = landmarks[0].y;
    const fingertipIndices = [8, 12, 16, 20]; // Index, middle, ring, pinky tips
    
    let curledCount = 0;
    fingertipIndices.forEach((idx) => {
      if (landmarks[idx].y > palmY - 0.05) {
        curledCount++;
      }
    });

    return thumbExtended && curledCount >= 3;
  }

  /**
   * Detect "YES" gesture (pick up action)
   * Based on hand position and movement
   */
  detectPickUpGesture(results: any): {
    detected: boolean;
    confidence: number;
    handPosition?: { x: number; y: number; z: number };
  } {
    if (!results.landmarks || results.landmarks.length === 0) {
      return { detected: false, confidence: 0 };
    }

    // Get the first hand's landmarks
    const handLandmarks = results.landmarks[0];
    
    // Calculate hand center (palm center)
    const palmCenter = {
      x: handLandmarks[0].x,
      y: handLandmarks[0].y,
      z: handLandmarks[0].z,
    };

    // Check if hand is in "picking up" position
    // Simplified logic: check if fingers are curled (grasping)
    const fingersCurled = this.areFingersCurled(handLandmarks);
    
    // Check for recognized gestures
    let gestureConfidence = 0;
    if (results.gestures && results.gestures.length > 0) {
      const gesture = results.gestures[0][0];
      // Look for "Closed_Fist" or similar grasping gestures
      if (gesture.categoryName === "Closed_Fist" || gesture.categoryName === "Thumb_Up") {
        gestureConfidence = gesture.score;
      }
    }

    const confidence = Math.max(fingersCurled ? 0.8 : 0, gestureConfidence);

    return {
      detected: confidence > 0.6,
      confidence,
      handPosition: palmCenter,
    };
  }

  /**
   * Check if fingers are curled (grasping position)
   */
  private areFingersCurled(landmarks: any[]): boolean {
    // Simplified check: compare fingertip positions with palm
    const palmY = landmarks[0].y;
    const fingertipIndices = [8, 12, 16, 20]; // Index, middle, ring, pinky tips
    
    let curledCount = 0;
    fingertipIndices.forEach((idx) => {
      if (landmarks[idx].y > palmY - 0.1) {
        curledCount++;
      }
    });

    return curledCount >= 3; // At least 3 fingers curled
  }

  /**
   * Calculate distance between hand and object
   */
  calculateDistance(handPosition: { x: number; y: number; z: number }, objectBounds: { x: number; y: number; width: number; height: number }): number {
    const objectCenterX = objectBounds.x + objectBounds.width / 2;
    const objectCenterY = objectBounds.y + objectBounds.height / 2;

    const dx = handPosition.x - objectCenterX;
    const dy = handPosition.y - objectCenterY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  close() {
    if (this.gestureRecognizer) {
      this.gestureRecognizer.close();
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
    }
    this.initialized = false;
  }
}

/**
 * Payment State Machine
 * Implements the 5-state payment flow
 */
export type PaymentState = "S0_waiting" | "S1_approaching" | "S2_picked" | "S3_checkout" | "S4_completed";

export interface StateMachineContext {
  currentState: PaymentState;
  userId: number | null;
  productId: number | null;
  handPosition: { x: number; y: number; z: number } | null;
  stateStartTime: number;
  confidence: number;
}

export class PaymentStateMachine {
  private context: StateMachineContext = {
    currentState: "S0_waiting",
    userId: null,
    productId: null,
    handPosition: null,
    stateStartTime: Date.now(),
    confidence: 0,
  };

  private readonly APPROACH_THRESHOLD = 0.3; // Distance threshold for S1
  private readonly PICKUP_DURATION = 500; // ms to confirm pickup
  private readonly CHECKOUT_TIMEOUT = 3000; // ms before auto-checkout

  getState(): StateMachineContext {
    return { ...this.context };
  }

  /**
   * Update state machine based on current inputs
   */
  update(inputs: {
    faceDetected: boolean;
    userId: number | null;
    handDetected: boolean;
    handPosition: { x: number; y: number; z: number } | null;
    pickupGestureDetected: boolean;
    confidence: number;
    productId: number | null;
    productBounds: { x: number; y: number; width: number; height: number } | null;
  }): { stateChanged: boolean; shouldTriggerPayment: boolean } {
    const previousState = this.context.currentState;
    let shouldTriggerPayment = false;

    switch (this.context.currentState) {
      case "S0_waiting":
        if (inputs.faceDetected && inputs.userId) {
          this.context.userId = inputs.userId;
          if (inputs.handDetected && inputs.productId) {
            this.transitionTo("S1_approaching");
            this.context.productId = inputs.productId;
          }
        }
        break;

      case "S1_approaching":
        if (!inputs.faceDetected || !inputs.handDetected) {
          this.transitionTo("S0_waiting");
          break;
        }

        if (inputs.handPosition && inputs.productBounds) {
          const distance = this.calculateDistance(inputs.handPosition, inputs.productBounds);
          if (distance < this.APPROACH_THRESHOLD && inputs.pickupGestureDetected) {
            this.transitionTo("S2_picked");
            this.context.handPosition = inputs.handPosition;
            this.context.confidence = inputs.confidence;
          }
        }
        break;

      case "S2_picked":
        const pickupDuration = Date.now() - this.context.stateStartTime;
        
        if (!inputs.pickupGestureDetected || !inputs.faceDetected) {
          // User put down the product
          this.transitionTo("S0_waiting");
          break;
        }

        if (pickupDuration > this.PICKUP_DURATION) {
          // Confirmed pickup, move to checkout
          this.transitionTo("S3_checkout");
        }
        break;

      case "S3_checkout":
        const checkoutDuration = Date.now() - this.context.stateStartTime;
        
        if (!inputs.faceDetected) {
          // User left without completing
          this.transitionTo("S0_waiting");
          break;
        }

        if (checkoutDuration > this.CHECKOUT_TIMEOUT || !inputs.pickupGestureDetected) {
          // Auto-checkout or user released the product
          shouldTriggerPayment = true;
          this.transitionTo("S4_completed");
        }
        break;

      case "S4_completed":
        // Wait for payment confirmation, then reset
        setTimeout(() => {
          this.reset();
        }, 2000);
        break;
    }

    return {
      stateChanged: previousState !== this.context.currentState,
      shouldTriggerPayment,
    };
  }

  private transitionTo(newState: PaymentState) {
    console.log(`[StateMachine] ${this.context.currentState} -> ${newState}`);
    this.context.currentState = newState;
    this.context.stateStartTime = Date.now();
  }

  private calculateDistance(
    handPos: { x: number; y: number; z: number },
    productBounds: { x: number; y: number; width: number; height: number }
  ): number {
    const productCenterX = productBounds.x + productBounds.width / 2;
    const productCenterY = productBounds.y + productBounds.height / 2;

    const dx = handPos.x - productCenterX;
    const dy = handPos.y - productCenterY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  reset() {
    this.context = {
      currentState: "S0_waiting",
      userId: null,
      productId: null,
      handPosition: null,
      stateStartTime: Date.now(),
      confidence: 0,
    };
  }

  triggerPayment(): {
    userId: number;
    productId: number;
    confidence: number;
  } | null {
    if (!this.context.userId || !this.context.productId) {
      return null;
    }

    return {
      userId: this.context.userId,
      productId: this.context.productId,
      confidence: this.context.confidence,
    };
  }
}
