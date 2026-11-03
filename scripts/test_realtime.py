import cv2
import mediapipe as mp
import numpy as np
import tensorflow as tf
import os

# ================= SETUP =================
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.7, min_tracking_confidence=0.7)
mp_draw = mp.solutions.drawing_utils

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'phrase_model.keras')
LABEL_PATH = os.path.join(BASE_DIR, '..', 'models', 'phrase_labels.npy')

print("⏳ Loading Model... Please wait.")
model = tf.keras.models.load_model(MODEL_PATH)
actions = np.load(LABEL_PATH)

# ================= STABILITY LOGIC =================
sequence = []           # Holds the last 60 frames of skeleton data
prediction_history = [] # Holds the raw percentage scores of the last 5 guesses
sentence = []           # Holds the final chosen words

# STABILITY TUNING PARAMETERS
HISTORY_LENGTH = 5      # How many predictions to average together (Higher = more stable, but slower to react)
CONFIDENCE_THRESH = 0.85 # The average must be over 85% to trigger a word

cap = cv2.VideoCapture(0)
print("🚀 Real-time Inference Started! Press 'q' to stop.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret: break

    frame = cv2.flip(frame, 1)
    image, results = frame, hands.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    last_known_left = [0.0] * 63
    last_known_right = [0.0] * 63

    if results.multi_hand_landmarks:
        for hand_landmarks, handedness in zip(results.multi_hand_landmarks, results.multi_handedness):
            mp_draw.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            
            coords = []
            for lm in hand_landmarks.landmark:
                coords.extend([lm.x, lm.y, lm.z])
            
            label = handedness.classification[0].label 
            if label == 'Right': last_known_left = coords
            else: last_known_right = coords

    # 1. Update the Sliding Window (Keep 60 frames)
    current_row = np.concatenate([last_known_left, last_known_right])
    sequence.append(current_row)
    sequence = sequence[-60:] 

    # 2. Prediction & Probability Smoothing
    if len(sequence) == 60:
        # Get raw probabilities (e.g., [0.1, 0.8, 0.05, ...])
        res = model.predict(np.expand_dims(sequence, axis=0), verbose=0)[0]
        
        # Add these probabilities to our history buffer
        prediction_history.append(res)
        prediction_history = prediction_history[-HISTORY_LENGTH:]
        
        # Calculate the AVERAGE probability across the last 5 predictions
        avg_probs = np.mean(prediction_history, axis=0)
        best_class_idx = np.argmax(avg_probs)
        best_class_score = avg_probs[best_class_idx]

        # 3. Decision Logic: Is the average confidence high enough?
        if best_class_score > CONFIDENCE_THRESH:
            predicted_word = actions[best_class_idx]
            
            # Prevent the same word from being spammed back-to-back
            if len(sentence) > 0:
                if predicted_word != sentence[-1]:
                    sentence.append(predicted_word)
            else:
                sentence.append(predicted_word)

        if len(sentence) > 5:
            sentence = sentence[-5:]

        # UI Element: Show the current live accuracy bar
        cv2.putText(image, f"Confidence: {best_class_score*100:.1f}%", (400, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2, cv2.LINE_AA)

    # UI Overlay: Show the final sentence
    cv2.rectangle(image, (0,0), (640, 40), (245, 117, 16), -1)
    cv2.putText(image, ' '.join(sentence), (3,30), 
               cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
    
    cv2.imshow('SignTutor Real-Time Test', image)

    if cv2.waitKey(10) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()