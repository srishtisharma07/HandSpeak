<div align="center">

# 🤟 HandSpeak

### An AI-powered Sign Language Tutor — Learn, Practice & Get Recognised in Real Time

[![Python](https://img.shields.io/badge/Python-3.10-blue?logo=python)](https://www.python.org/)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange?logo=tensorflow)](https://www.tensorflow.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-purple)](https://mediapipe.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## 📌 Table of Contents

- [Problem Statement](#-problem-statement)
- [Project Objectives](#-project-objectives)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Machine Learning Implementation](#-machine-learning-implementation)
- [Dataset & Model Information](#-dataset--model-information)
- [Installation & Setup](#-installation--setup)
- [Running the Application](#-running-the-application)
- [Screenshots & Demo](#-screenshots--demo)
- [Team & Contributions](#-team--contributions)

---

## 🧩 Problem Statement

Over 70 million Deaf and hard-of-hearing people worldwide communicate primarily through sign language, yet the overwhelming majority of hearing people have no knowledge of it. Traditional learning resources — videos, books, and classes — are passive; they teach the shapes of signs but provide no feedback on whether you are forming them correctly.

**HandSpeak** bridges this gap by using your webcam and machine learning to give real-time, interactive feedback as you practise American Sign Language (ASL).

---

## 🎯 Project Objectives

1. Build a real-time hand-sign recognition system that works from a standard webcam.
2. Classify all 26 ASL static alphabet letters using landmark-based ML.
3. Recognise dynamic ASL phrases (e.g., *"Thank you"*, *"Hello"*, *"Yes/No"*) from short video sequences.
4. Provide an interactive quiz mode that challenges users to sign displayed letters or words and scores their performance.
5. Offer a beginner guide with reference images for every ASL letter.
6. Deliver a polished, responsive web UI so the system is accessible without any installation beyond running two local servers.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 📷 **Live Letter Detection** | Webcam feed processed frame-by-frame; recognised ASL letter shown instantly |
| 🎬 **Phrase Recognition** | Record a 2-second clip; LSTM model predicts the signed phrase |
| ⚡ **WebSocket Real-Time Mode** | Sub-100 ms latency via persistent WebSocket connection |
| 🧠 **Dual-Model Pipeline** | Dense MLP for static signs + LSTM for dynamic phrase sequences |
| 🎮 **Quiz Mode** | 30-question letter quiz & word-spelling challenge with scoring |
| 📊 **Performance Dashboard** | Per-letter accuracy, session history, and streak tracking |
| 📘 **Beginner Guide** | A–Z reference images for all ASL static hand shapes |
| 🔐 **Local Auth** | Simple localStorage-based user profile so progress persists across sessions |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (React SPA)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Guide   │  │  Quiz    │  │ Practice │  │ Dash   │ │
│  │   Tab    │  │  Mode    │  │  Mode    │  │ Board  │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│       │               │             │                   │
│  @mediapipe/hands (client-side landmark extraction)     │
│       │               │             │                   │
│  HTTP POST        WebSocket     HTTP POST               │
│  /predict         /ws/predict   /predict_sequence       │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (Python 3.10)               │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │  Static Model    │   │     Sequence Model        │   │
│  │  (MLP — Keras)   │   │   (LSTM — Keras)          │   │
│  │  26 ASL letters  │   │  10 ASL phrases           │   │
│  └──────────────────┘   └──────────────────────────┘   │
│          │                         │                     │
│   MediaPipe Hands (server-side for video endpoint)      │
│          │                         │                     │
│   landmark_normalizer.py (wrist-origin, scale-norm)     │
└─────────────────────────────────────────────────────────┘
```

**Data flow for a single prediction:**

1. Browser captures webcam frame → MediaPipe Hands extracts 21 landmarks (63 float values per hand).
2. For *static* mode: landmark array is sent to `/predict`; backend normalises, runs MLP → returns letter label.
3. For *dynamic* mode: 60 frames of landmarks (126 floats × 60) are collected, sent to `/ws/predict` or `/predict_sequence`; LSTM returns phrase label.

---

## 🛠 Technology Stack

### Backend
| Technology | Role |
|---|---|
| Python 3.10 | Runtime |
| FastAPI | REST + WebSocket API server |
| Uvicorn | ASGI server |
| TensorFlow / Keras | ML model loading & inference |
| MediaPipe | Hand landmark extraction (server-side video) |
| OpenCV | Video frame decoding |
| NumPy | Numerical operations |

### Frontend
| Technology | Role |
|---|---|
| React 19 | Single-page application |
| @mediapipe/hands | Client-side real-time landmark extraction |
| Tailwind CSS | Utility-first styling |
| WebSocket API | Real-time bidirectional communication |
| MediaRecorder API | In-browser video capture for sequence mode |

### ML & Data
| Technology | Role |
|---|---|
| TensorFlow / Keras | Model training (MLP + LSTM) |
| MediaPipe Hands | Landmark extraction during data collection |
| NumPy (.npy) | Sequence dataset storage |
| CSV | Landmark dataset (per-letter CSVs) |
| Kaggle ASL Alphabet | 87,000-image source dataset (A–Z + space/delete/nothing) |

---

## 📁 Project Structure

```
HandSpeak/
├── backend/                    # FastAPI server
│   ├── main.py                 # All API endpoints (predict, predict_sequence, ws/predict)
│   └── requirements.txt        # Backend Python dependencies
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.js              # Main application (all tabs & logic)
│   │   └── App.css             # Global styles
│   ├── public/
│   │   └── data/guide_images/  # ASL reference images for the Guide tab
│   ├── package.json
│   └── README.md
│
├── models/                     # Trained Keras models (checked in)
│   ├── landmark_model.keras    # MLP — static letter classification
│   ├── landmark_labels.npy     # Label array for landmark_model
│   ├── sequence_model.keras    # LSTM — dynamic phrase classification
│   ├── sequence_labels.npy     # Label array for sequence_model
│   ├── phrase_model.keras      # Earlier phrase model (kept for reference)
│   └── phrase_labels.npy
│
├── data/
│   ├── guide_images/           # A–Z sign language reference PNGs (Streamlit app)
│   ├── landmarks/              # Per-letter landmark CSVs (A.csv … Z.csv)
│   ├── asl_alphabet_train/     # ⚠ NOT in repo — 1 GB raw images (download from Kaggle)
│   └── sequence_dataset/       # ⚠ NOT in repo — 280 MB .npy sequence data
│
├── scripts/
│   ├── 01_collect_sequences.py # Webcam data-collection script for phrase sequences
│   ├── 02_train_sequence_model.py  # LSTM training script
│   ├── train_model.py          # MLP training script for static letters
│   ├── augment_data.py         # Sequence data augmentation
│   ├── test_realtime.py        # Real-time test harness (standalone)
│   └── data/phrase_sequences/  # Raw phrase recordings (bye, …)
│
├── src/                        # Shared Python utilities & early Streamlit prototype
│   ├── utils/
│   │   └── landmark_normalizer.py  # Wrist-origin + scale normalisation
│   ├── collect_landmarks.py    # Landmark data collection helper
│   ├── train_landmark_model.py # Early training script
│   ├── learning_mode.py        # Streamlit learning mode
│   └── webcam_mediapipe.py     # Standalone webcam test
│
├── app.py                      # Original Streamlit prototype (3-mode app)
├── requirements.txt            # Root-level Python dependencies (Streamlit stack)
├── setup.py                    # Package setup
└── .gitignore
```

---

## 🧠 Machine Learning Implementation

### Static Sign Classifier (MLP)

- **Input:** 63-dimensional vector — (x, y, z) coordinates for 21 hand landmarks.
- **Preprocessing:** `landmark_normalizer.py` — translates the wrist to the origin, mirrors left-hand coordinates, then scale-normalises by the maximum inter-joint distance. This makes the model invariant to hand position, size, and handedness.
- **Architecture:** Multi-layer perceptron with Dense + Dropout layers (Keras).
- **Output:** Softmax over 26 ASL letter classes.
- **Training data:** Per-letter CSV files in `data/landmarks/` (landmark rows extracted from Kaggle ASL Alphabet images via MediaPipe).

### Dynamic Phrase Classifier (LSTM)

- **Input:** Sequence of 60 frames, each with 126 features (63 per hand × 2 hands, padded when only one hand is detected).
- **Architecture:** LSTM layers followed by Dense + Dropout (Keras).
- **Output:** Softmax over 10 ASL phrase classes: *Hello, Thank you, Yes, No, Help, Sorry, Eat, Bye, Stop, Welcome*.
- **Training data:** `.npy` sequence files collected using `scripts/01_collect_sequences.py` and augmented with `scripts/augment_data.py`.
- **Inference confidence threshold:** 0.70 (REST) / 0.65 (WebSocket, with smoothing over 3 predictions).

### Real-Time WebSocket Pipeline

The `/ws/predict` endpoint maintains a **sliding window** of the last 60 frames. Every incoming landmark payload is appended; once the buffer has ≥ 30 frames, a prediction is made on every new frame. A **prediction history deque** (length 3) averages probabilities to smooth flickering output.

---

## 📊 Dataset & Model Information

| Asset | Description | Size | Source |
|---|---|---|---|
| `data/asl_alphabet_train/` | 87,000 images (200×200 px) A–Z + space/delete/nothing | ~1 GB | [Kaggle ASL Alphabet](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) |
| `data/landmarks/*.csv` | MediaPipe landmark extractions per letter (~1,000 rows each) | 12.5 MB | Extracted from above |
| `data/sequence_dataset/` | ~300 .npy files per phrase, 60 frames × 126 features | ~280 MB | Recorded with `scripts/01_collect_sequences.py` |
| `models/landmark_model.keras` | Trained MLP — 26-class letter classifier | 246 KB | Trained locally |
| `models/sequence_model.keras` | Trained LSTM — 10-class phrase classifier | 2.2 MB | Trained locally |

> ⚠ **The raw image dataset and sequence dataset are NOT included in this repository** due to size constraints. The trained models ARE included — the application is fully functional without downloading raw data.

---

## ⚙ Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- A webcam

### 1 — Clone the repository

```bash
git clone https://github.com/srishtisharma07/HandSpeak.git
cd HandSpeak
```

### 2 — Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3 — Frontend setup

```bash
cd frontend
npm install
```

---

## ▶ Running the Application

### Start the backend

```bash
cd backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Start the frontend

```bash
cd frontend
npm start
```

The React app will open at `http://localhost:3000`.

> Both servers must be running simultaneously for the app to function.

### (Optional) Run the legacy Streamlit prototype

```bash
# From the project root, with root venv active
pip install -r requirements.txt
streamlit run app.py
```

---

## 🖼 Screenshots & Demo

> The app runs entirely in-browser using your webcam — no additional software needed.

### Guide Tab
Browse A–Z ASL hand-shape reference images to learn the alphabet.

### Practice Mode
Point your hand at the camera — the detected letter appears in real time.

### Quiz Mode — Letters
The app displays a target letter; sign it correctly to score a point. 30 questions per session.

### Quiz Mode — Words
Spell out a full word one letter at a time. Words are pulled from a live word API with an instant fallback list.

### Phrase Mode
Record a 2-second clip of a dynamic phrase (e.g. waving for *"Hello"*). The LSTM model identifies which of 10 phrases you signed.

### Dashboard
Track your accuracy per letter, total sessions, and best streak.

---

## 👥 Team & Contributions

This project was developed as a semester group project.

### Team Members

| Name | Role |
|---|---|
| Srishti Sharma | Frontend development, React UI, Quiz mode, Dashboard, WebSocket integration, Phrase mode, overall system integration |
| *(Team member 2)* | *(Role)* |
| *(Team member 3)* | *(Role)* |

### My Individual Contributions — Srishti Sharma

- **Frontend (React):** Built the complete single-page application in `frontend/src/App.js` — all tabs (Home, Guide, Practice, Quiz, Dashboard), client-side MediaPipe integration, styling with Tailwind CSS, and responsive layout.
- **Quiz Mode:** Implemented the 30-question letter quiz, the word-spelling challenge (with real-time API word fetch + 100-word fallback), double-letter cooldown logic, and score tracking.
- **Dashboard:** Designed and implemented the performance analytics view — per-letter accuracy bars, session history, and streak counter persisted via `localStorage`.
- **Phrase / Sequence Mode:** Integrated the `MediaRecorder` API for in-browser video capture and connected it to the `/predict_sequence` endpoint; added the WebSocket real-time pipeline.
- **System Integration:** Connected the React frontend to the FastAPI backend, debugged CORS configuration, and tested end-to-end predictions for both static and dynamic modes.
- **Backend WebSocket:** Co-developed the `/ws/predict` WebSocket endpoint in `backend/main.py` including the sliding window buffer and prediction-history smoothing.

---

## 📄 License

This project is released under the [MIT License](LICENSE).

---

<div align="center">

Made with 🤟 for accessibility and inclusive technology

</div>
