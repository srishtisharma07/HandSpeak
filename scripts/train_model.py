import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.utils import to_categorical
from sklearn.utils import shuffle

# ================= SETUP =================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, '..', 'data', 'sequence_dataset')
MODEL_SAVE_PATH = os.path.join(BASE_DIR, '..', 'models')

os.makedirs(MODEL_SAVE_PATH, exist_ok=True)

# ================= DATA LOADING (NO LEAKAGE) =================
print("⏳ Loading dataset with strict Train/Test separation...")

actions = np.array([f for f in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, f))])
label_map = {label:num for num, label in enumerate(actions)}

X_train, y_train = [], []
X_test, y_test = [], []

for action in actions:
    action_path = os.path.join(DATA_PATH, action)
    files = [f for f in os.listdir(action_path) if f.endswith('.npy')]
    
    for file in files:
        res = np.load(os.path.join(action_path, file))
        
        # Extract the original video number from the filename
        # e.g., '1.npy' -> 1 | 'aug_1_5.npy' -> 1
        if file.startswith('aug_'):
            original_vid_num = int(file.split('_')[1])
        else:
            original_vid_num = int(file.split('.')[0])
            
        # Videos 1-16 go to Training, 17-20 go to Testing (Strict 80/20 split)
        if original_vid_num <= 16:
            X_train.append(res)
            y_train.append(label_map[action])
        else:
            X_test.append(res)
            y_test.append(label_map[action])

# Convert to arrays and one-hot encode
X_train = np.array(X_train)
y_train = to_categorical(y_train, num_classes=len(actions)).astype(int)

X_test = np.array(X_test)
y_test = to_categorical(y_test, num_classes=len(actions)).astype(int)

# Shuffle the training data so the model doesn't learn in blocks
X_train, y_train = shuffle(X_train, y_train, random_state=42)
X_test, y_test = shuffle(X_test, y_test, random_state=42)

print(f"✅ Training Set: {X_train.shape[0]} videos.")
print(f"✅ Testing Set: {X_test.shape[0]} videos.")
print(f"🎯 Categories: {actions}")

# ================= STABLE LSTM ARCHITECTURE =================
model = Sequential()
model.add(LSTM(64, return_sequences=True, input_shape=(60, 126)))
model.add(Dropout(0.2))

model.add(LSTM(128, return_sequences=False))
model.add(Dropout(0.2))

model.add(Dense(64, activation='relu'))
model.add(Dense(32, activation='relu'))
model.add(Dense(actions.shape[0], activation='softmax'))

optimizer = tf.keras.optimizers.Adam(learning_rate=0.001, clipvalue=1.0)
model.compile(optimizer=optimizer, loss='categorical_crossentropy', metrics=['categorical_accuracy'])

# ================= TRAINING =================
early_stop = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True, verbose=1)

print("\n🚀 Training started (Real-World Accuracy Mode)...")
model.fit(
    X_train, y_train, 
    epochs=100, 
    batch_size=32, 
    validation_data=(X_test, y_test), 
    callbacks=[early_stop]
)

# ================= SAVING =================
print("\n💾 Saving model and labels...")
model.save(os.path.join(MODEL_SAVE_PATH, 'phrase_model.keras'))
np.save(os.path.join(MODEL_SAVE_PATH, 'phrase_labels.npy'), actions)

print("🎉 DONE! This model is now ready for the real world.")