# SSP - Recognition Technology Components

**Version**: 1.0  
**Date**: 2025-11-17

---

You aim to achieve **simultaneous tracking and behavior analysis of products and hands for "context-aware self-checkout"** using existing devices (iPad/phone cameras) through software. This is a classic multi-object tracking problem in the field of **Computer Vision (CV)**.

Based on your requirements for "ease of deployment" and "use of common existing devices," the most viable open-source technology stack is: **Google MediaPipe (for hand tracking) + YOLO/MobileNet (for product detection) + OpenCV (for tracking and geometric analysis)**.

Below is a detailed breakdown, available open-source components, and an implementation direction based on your scenario.

---

## 💻 Core Open-Source Technology Components

### 1. Hand Tracking: MediaPipe Hands
-   **Functionality**: Accurately identifies hands in an image and outputs the 3D coordinates of 21 keypoints. The `z` coordinate can be used for simple depth estimation.
-   **Advantages**: Optimized for mobile devices (like Android/iOS), extremely fast, and provides stable recognition, making it ideal for running on an iPad/phone POS.
-   **Available Versions**: APIs and sample code are available for Python, JavaScript (Web), Android, and iOS, which you can directly integrate into your iPad app.

### 2. Object Detection: YOLOv8 or MobileNet-SSD
-   **Functionality**: Identifies the class and bounding box of all products in the field of view.
-   **Advantages**:
    -   **YOLOv8 (You Only Look Once)**: Offers a good balance between speed and accuracy, making it very suitable for real-time detection.
    -   **MobileNet-SSD**: Designed specifically for mobile and edge devices. While slightly less accurate, it is faster and has a smaller model size, making it suitable for smooth operation on an iPad/phone.
-   **Available Versions**: Their models and pre-trained weights are open-source and can be deployed on iOS/Android devices using PyTorch Mobile or TensorFlow Lite (TFLite) format.

### 3. Tracking & Geometric Analysis: OpenCV
-   **Functionality**: Provides powerful image processing, coordinate transformation, and traditional object tracking algorithms.
-   **Advantages**: Used to associate and correct the hand coordinates from MediaPipe with the product bounding boxes from YOLO, and to calculate their relative distance and velocity.
-   **Available Versions**: Complete C++ and Python APIs are available, with support for iOS and Android integration.

---

## 🛠️ Implementation of the "Payment Trigger" Based on the Scenario

Your core challenge is: **How to translate the contextual behaviors of "picking up" and "walking away" into a reliable payment command?**

This requires a **Context Analysis State Machine** running inside the app on the iPad POS.

### State Machine Logic:

| State | Trigger | Action |
| :--- | :--- | :--- |
| **S0: Waiting** | Only products are in view; no hands are nearby. | Continuously run YOLO/MobileNet to detect product locations. |
| **S1: Hand Approaching** | MediaPipe detects hand keypoints, and the 3D distance between the hand keypoints and the bounding box of a product A is less than a threshold. | Lock onto the target product A and enter "Pick-up-Decision" mode. |
| **S2: Pick-up Decision** | The centroid coordinates of the hand keypoints highly overlap with product A's, and the original bounding box of product A disappears within the next 0.5 seconds. | Mark product A as "picked up" and enter "Checkout-Decision" mode. |
| **S3: Checkout Decision** | The product A, marked as "picked up," leaves the preset POS camera's field of view (e.g., moves completely out of frame or moves to the lower part of the frame and stays for 1 second). | Trigger the payment command: send `{User_ID, Item_A}` to the backend. |
| **S4: Transaction Complete** | An ACK for successful payment is received from the backend. | Clear the markings and return to the S0 state. |

### Key Geometric Analysis (to be implemented with OpenCV):

1.  **3D Distance Approximation Calculation**:
    -   The `z` coordinate from MediaPipe provides a rough depth estimate. The distance can be approximated as `sqrt((x_hand - x_item)^2 + (y_hand - y_item)^2 + (z_hand - z_item)^2)`, where `(x_hand, y_hand, z_hand)` are the center coordinates of the hand keypoints, and `z_item` is estimated based on the product's size in the frame and a preset perspective model.

2.  **"Pick-up" Action Judgment**: Tracking the disappearance of product A's bounding box (or its complete occlusion by the hand) is the key indicator for judging a "pick-up." It is crucial to exclude cases where the product is put back or merely touched.

3.  **Coordinate System Transformation**: If you use the iPad's rear camera, you may need OpenCV to handle camera intrinsic calibration to ensure that the calculated relative distances are accurate.

---

## 📦 Open-Source Code Components for Research (Python Examples)

Since you need to integrate this into an iPad/phone app, the final implementation will likely use Swift/Kotlin. However, the following Python examples are the best for a Proof of Concept (PoC) and for prototyping the algorithm.

### 1. Basic MediaPipe Hand Tracking Code (Python)

This code demonstrates how to use MediaPipe to recognize hand keypoints.

```python
import cv2
import mediapipe as mp

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7)

cap = cv2.VideoCapture(0) # 0 for default camera (iPad/PC)

while cap.isOpened():
    success, image = cap.read()
    if not success:
        continue

    # 1. Image Processing
    image = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    
    # 2. MediaPipe Processing
    results = hands.process(image)
    
    image.flags.writeable = True
    image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    
    # 3. Keypoint Drawing and Analysis
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Example: Get the coordinates of the index finger tip (Landmark 8)
            index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
            
            # TODO: Add your payment trigger logic here:
            # 1. Get the bounding box of Product A (from the YOLO model)
            # 2. Calculate the relative distance between the (x, y, z) of index_tip and the center of Product A
            # 3. Update the payment state machine (S1 -> S2 -> S3) based on the distance and the disappearance state of Product A
            
            # Draw the hand
            mp.solutions.drawing_utils.draw_landmarks(
                image, hand_landmarks, mp_hands.HAND_CONNECTIONS)

    cv2.imshow('MediaPipe Hand Tracking', image)
    if cv2.waitKey(5) & 0xFF == 27:
        break

hands.close()
cap.release()
cv2.destroyAllWindows()
```

### 2. Research Direction for YOLO/MobileNet Product Detection

Since YOLO models are large, the full code cannot be pasted directly, but the integration approach is as follows:

1.  **Prepare the Dataset**: Take pictures of the products you want to sell and annotate them (create bounding boxes for the products).
2.  **Train the Model**: Use the YOLOv8 or MobileNet framework to train a custom detection model.
3.  **Integrate into the App**: Load the trained model file (e.g., `.onnx` or `.tflite`) into your iOS/Android app and run detection on each video frame to get the real-time bounding box of product A.

**Research Keywords**: `YOLOv8 custom object detection tflite`, `TensorFlow Lite object detection iOS example`.

---

## Summary

You should start with the MediaPipe Python example above and, on top of this code, integrate a simplified YOLO model output (simulated with fixed variables or using TFLite). Then, focus on developing and testing the S0 to S4 context analysis state machine, which is the software soul of achieving a "silky smooth, frictionless" payment experience.
