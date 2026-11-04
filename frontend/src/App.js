import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import "./AuthPage.css";
import AuthPage from "./AuthPage";
// eslint-disable-next-line no-unused-vars
import { auth, signOut, onAuthStateChanged } from "./firebase";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PHRASES = ["Thank you", "Welcome", "Yes", "No", "Help", "Sorry", "Eat", "Hello", "Bye", "Stop"];
const MAX_Q = 30;
const DOUBLE_LETTER_COOLDOWN = 3000; 

const FALLBACK_WORDS = [
  "APPLE", "WATER", "SMILE", "HAPPY", "GREEN", "PLANT", "TIGER", "RIVER", "CLOUD", "BRAIN", 
  "LIGHT", "MUSIC", "WORLD", "HELLO", "REACT", "PYTHON", "CODING", "HOUSE", "MOUSE", "CHAIR", 
  "TABLE", "PHONE", "CLOCK", "WATCH", "TRAIN", "PLANE", "SPACE", "EARTH", "NIGHT", "OCEAN", 
  "BEACH", "HEART", "PEACE", "DREAM", "LAUGH", "YOUTH", "FAITH", "TRUST", "TRUTH", "BRAVE", 
  "SMART", "QUICK", "FLASH", "GHOST", "MAGIC", "DRAGON", "FAIRY", "QUEEN", "TRACK", "FIELD", 
  "SPORT", "SCORE", "MATCH", "BREAD", "FRUIT", "SWEET", "CANDY", "JUICE", "DRINK", "GLASS", 
  "PLATE", "SPOON", "KNIFE", "CHIEF", "GUARD", "PILOT", "NURSE", "BAKER", "DANCE", "SINGER", 
  "ACTOR", "MOVIE", "STAGE", "PAINT", "BRUSH", "COLOR", "BLACK", "WHITE", "BROWN", "YELLOW", 
  "ORANGE", "PURPLE", "SILVER", "METAL", "STONE", "BRICK", "PAPER", "PENCIL", "ERASER", "RULER", 
  "SCHOOL", "CLASS", "GRADE", "STUDY", "LEARN", "TEACH", "THINK", "SOLVE", "BUILD", "CREATE"
];

let wordPool = [];

const fetchRandomWord = async () => {
  if (wordPool.length > 0) {
    return wordPool.pop();
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); 

  try {
    const res = await fetch(`https://random-word-api.herokuapp.com/word?number=20`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("API Network error");
    const data = await res.json();
    wordPool = data.map(w => w.toUpperCase());
    return wordPool.pop();
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("API was too slow or failed. Using 100-word instant fallback.");
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
  }
};

function App() {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]); 
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tab, setTabState] = useState("home");
  const tabRef = useRef("home");

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [quizStats, setQuizStats] = useState([]);

  // Load individual user stats when authenticated
  const loadUserStats = (uid) => {
    if (!uid) {
      setQuizStats([]);
      return;
    }
    const userKey = `signLanguageStats_${uid}`;
    const saved = localStorage.getItem(userKey);
    if (saved) {
      try {
        setQuizStats(JSON.parse(saved));
      } catch (e) {
        setQuizStats([]);
      }
    } else {
      setQuizStats([]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const rawName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split("@")[0] : "Learner");
        const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const loggedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: formattedName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(loggedUser);
        loadUserStats(loggedUser.uid);
      } else {
        setUser(null);
        setQuizStats([]);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  // Save stats specifically for the active logged-in user
  useEffect(() => {
    if (user && user.uid) {
      const userKey = `signLanguageStats_${user.uid}`;
      localStorage.setItem(userKey, JSON.stringify(quizStats));
    }
  }, [quizStats, user]);

  const dashboardData = useMemo(() => {
    if (!quizStats || quizStats.length === 0) return null;

    let totalCorrect = 0;
    const letterData = {};
    LETTERS.forEach(l => letterData[l] = { attempts: 0, correct: 0, times: [] });

    quizStats.forEach(stat => {
      if (stat.correct) totalCorrect++;
      if (letterData[stat.letter]) {
        letterData[stat.letter].attempts++;
        if (stat.correct) letterData[stat.letter].correct++;
        if (stat.time !== "Wrong" && !isNaN(parseFloat(stat.time))) {
          letterData[stat.letter].times.push(parseFloat(stat.time));
        }
      }
    });

    const accuracy = Math.round((totalCorrect / quizStats.length) * 100);
    const heatmap = [];
    let validTimes = [];

    LETTERS.forEach(l => {
      const data = letterData[l];
      const acc = data.attempts > 0 ? data.correct / data.attempts : null;
      const avgTime = data.times.length > 0 ? (data.times.reduce((a,b)=>a+b,0) / data.times.length) : null;
      
      let status = "unpracticed";
      if (acc !== null) {
        if (acc >= 0.8) status = "good";
        else if (acc >= 0.5) status = "okay";
        else status = "bad";
      }

      heatmap.push({ letter: l, status, acc, avgTime, attempts: data.attempts });
      if (avgTime !== null && acc !== null) {
        validTimes.push({ letter: l, avgTime, acc });
      }
    });

    validTimes.sort((a, b) => a.avgTime - b.avgTime);
    const fastest = validTimes.slice(0, 3);
    const slowest = [...validTimes].reverse().slice(0, 3);
    const weakSpots = heatmap.filter(h => h.attempts > 0 && h.acc < 0.7).sort((a, b) => a.acc - b.acc).slice(0, 3);

    return { totalAttempts: quizStats.length, accuracy, heatmap, fastest, slowest, weakSpots };
  }, [quizStats]);

  const stableCharRef = useRef("");
  const stableCountRef = useRef(0);
  const lastAddedRef = useRef("");
  const handDetectedRef = useRef(false);
  const lastAddedTimeRef = useRef(0); 

  const quizActiveRef = useRef(false);
  const quizTargetRef = useRef("");
  const quizStartTimeRef = useRef(0);

  const wordActiveRef = useRef(false);
  const targetWordRef = useRef("");
  const wordIndexRef = useRef(0);
  const wordStartTimeRef = useRef(0);
  const wordHandDetectedRef = useRef(false);

  const phraseActiveRef = useRef(false);
  const phraseTargetRef = useRef("");
  const phraseStartTimeRef = useRef(0);
  const phraseHandDetectedRef = useRef(false);

  const [prediction, setPrediction] = useState("");
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false); 

  const [sentence, setSentence] = useState("");
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [target, setTarget] = useState("");

  const [word, setWord] = useState("");
  const [wordProgress, setWordProgress] = useState(0);
  const [wordResults, setWordResults] = useState([]); 
  const [wordComplete, setWordComplete] = useState(false);
  const [isFetchingWord, setIsFetchingWord] = useState(false);

  const [phrase, setPhrase] = useState("");
  const [phraseResult, setPhraseResult] = useState(null); 
  const [guideSearch, setGuideSearch] = useState("");
  const [selectedGuideLetter, setSelectedGuideLetter] = useState(null);
  const [themePref, setThemePref] = useState(() => {
    return localStorage.getItem('signTutorTheme') || 'system';
  });

  useEffect(() => {
    const applyTheme = () => {
      let resolved = themePref;
      if (themePref === 'system') {
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolved = isDark ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyTheme();
    try {
      localStorage.setItem('signTutorTheme', themePref);
    } catch (e) {}

    if (themePref === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(listener);
        return () => mediaQuery.removeListener(listener);
      }
    }
  }, [themePref]); 

  const setTab = (newTab) => {
    setTabState(newTab);
    tabRef.current = newTab;
    setPrediction("");
  };

  const speakSentence = () => {
    if (!sentence) return;
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.rate = 0.9; 
    window.speechSynthesis.speak(utterance);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraRunning(true);
      }
    } catch (err) {
      console.error("Failed to start camera:", err);
      alert("Please allow camera access.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraRunning(false);
    setPrediction("");
  };

  const recordAndPredictSequence = useCallback(() => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    if (tabRef.current === "phrases" && !phraseActiveRef.current) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") return;

    setIsRecording(true);
    recordedChunksRef.current = [];

    const stream = videoRef.current.srcObject;
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      setIsRecording(false);
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const formData = new FormData();
      formData.append("file", blob); 

      try {
        const res = await fetch("http://127.0.0.1:8000/predict_sequence", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        
        if (tabRef.current === "phrases" && phraseActiveRef.current) {
          if (!phraseHandDetectedRef.current) {
            phraseHandDetectedRef.current = true;
            phraseStartTimeRef.current = Date.now();
          }
          
          const currentPred = data.label ? data.label.trim() : "";
          setPrediction(currentPred);

          if (currentPred === phraseTargetRef.current) {
            phraseActiveRef.current = false;
            setPhraseResult('correct');
          }
        }
      } catch (error) {
        console.error("Sequence Prediction API Error:", error);
      }
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, 3000); 
  }, []);

  const processFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 300, 300);

    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("file", blob);

      try {
        const res = await fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        const currentPred = data.label ? data.label.trim() : "";
        
        setPrediction(currentPred);
        if (currentPred) handleAppLogic(currentPred);
      } catch (error) {
        console.error("Static Prediction API Error:", error);
      }
    }, "image/jpeg");
  }, []);

  const handleAppLogic = (currentPred) => {
    const currentTab = tabRef.current;

    if (currentTab === "sentence") {
      if (currentPred === stableCharRef.current) {
        stableCountRef.current += 1;
      } else {
        stableCharRef.current = currentPred;
        stableCountRef.current = 1;
      }

      const isSameAsLast = currentPred === lastAddedRef.current;
      const cooldownPassed = Date.now() - lastAddedTimeRef.current >= DOUBLE_LETTER_COOLDOWN;

      if (stableCountRef.current >= 3 && (!isSameAsLast || cooldownPassed)) {
        if (PHRASES.includes(currentPred)) {
          setSentence((prev) => {
            const prefix = prev.length > 0 && !prev.endsWith(" ") ? " " : "";
            return prev + prefix + currentPred + " ";
          });
        } else {
          setSentence((prev) => prev + currentPred);
        }
        lastAddedRef.current = currentPred;
        lastAddedTimeRef.current = Date.now();
        stableCountRef.current = 0;
      }
    }

    if (currentTab === "quiz" && quizActiveRef.current) {
      if (!handDetectedRef.current) {
        handDetectedRef.current = true;
        quizStartTimeRef.current = Date.now();
      }
      if (currentPred === quizTargetRef.current) {
        stableCountRef.current += 1;
        if (stableCountRef.current >= 2) progressQuiz(true);
      } else {
        stableCountRef.current = 0;
      }
    }

    if (currentTab === "word" && wordActiveRef.current && !wordComplete) {
      if (!wordHandDetectedRef.current) {
        wordHandDetectedRef.current = true;
        wordStartTimeRef.current = Date.now();
      }
      const currentTargetLetter = targetWordRef.current[wordIndexRef.current];
      if (currentPred === currentTargetLetter) {
        stableCountRef.current += 1;
        if (stableCountRef.current >= 2) progressWord(true);
      } else {
        stableCountRef.current = 0;
      }
    }
  };

  const startPhraseMode = () => {
    const randomPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    setPhrase(randomPhrase);
    phraseTargetRef.current = randomPhrase;
    setPhraseResult(null);
    phraseActiveRef.current = true;
    phraseStartTimeRef.current = 0;
    phraseHandDetectedRef.current = false;
  };
  
  const progressWord = useCallback((isCorrect) => {
    setWordResults((prev) => [...prev, isCorrect]);
    wordIndexRef.current += 1;
    setWordProgress(wordIndexRef.current);
    stableCountRef.current = 0;
    wordHandDetectedRef.current = false;
    wordStartTimeRef.current = 0;

    if (wordIndexRef.current >= targetWordRef.current.length) {
      wordActiveRef.current = false;
      setWordComplete(true);
    }
  }, []);

  const startWordMode = async () => {
    setIsFetchingWord(true);
    const dynamicWord = await fetchRandomWord();
    setWord(dynamicWord);
    targetWordRef.current = dynamicWord;
    setWordProgress(0);
    setWordResults([]);
    wordIndexRef.current = 0;
    setWordComplete(false);
    wordActiveRef.current = true;
    stableCountRef.current = 0;
    wordHandDetectedRef.current = false;
    wordStartTimeRef.current = 0;
    setIsFetchingWord(false);
  };

  const progressQuiz = useCallback((isCorrect) => {
    const timeTaken = handDetectedRef.current 
      ? ((Date.now() - quizStartTimeRef.current) / 1000).toFixed(1) 
      : 0;

    setQuizStats((prev) => [...prev, { letter: quizTargetRef.current, correct: isCorrect, time: isCorrect ? timeTaken : "Wrong" }]);
    if (isCorrect) setScore((s) => s + 1);

    setTotal((prevTotal) => {
      const newTotal = prevTotal + 1;
      if (newTotal >= MAX_Q) {
        quizActiveRef.current = false;
        return newTotal;
      }
      const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      setTarget(randomLetter);
      quizTargetRef.current = randomLetter;
      stableCountRef.current = 0;
      handDetectedRef.current = false;
      quizStartTimeRef.current = 0; 
      return newTotal;
    });
  }, []);

  const startQuiz = () => {
    setScore(0);
    setTotal(0);
    quizActiveRef.current = true;
    const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    setTarget(randomLetter);
    quizTargetRef.current = randomLetter;
    stableCountRef.current = 0;
    handDetectedRef.current = false;
    quizStartTimeRef.current = 0;
  };

  // ================= INTERVALS & TIMERS =================
  useEffect(() => {
    let interval;
    const noCameraTabs = ["home", "dashboard", "guide"];
    if (isCameraRunning && !noCameraTabs.includes(tab)) {
      if (tab === "phrases") {
        interval = setInterval(() => recordAndPredictSequence(), 3500); 
      } else {
        interval = setInterval(() => processFrame(), 600);
      }
    }
    return () => {
        clearInterval(interval);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
    }
  }, [isCameraRunning, tab, processFrame, recordAndPredictSequence]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = Date.now();
      if (tabRef.current === "quiz" && quizActiveRef.current) {
        if (handDetectedRef.current && quizStartTimeRef.current > 0) {
          if (now - quizStartTimeRef.current >= 5000) progressQuiz(false); 
        }
      }
      if (tabRef.current === "word" && wordActiveRef.current && !wordComplete) {
        if (wordHandDetectedRef.current && wordStartTimeRef.current > 0) {
          if (now - wordStartTimeRef.current >= 5000) progressWord(false); 
        }
      }
      if (tabRef.current === "phrases" && phraseActiveRef.current) {
        if (phraseHandDetectedRef.current && phraseStartTimeRef.current > 0) {
          if (now - phraseStartTimeRef.current >= 10000) { 
            phraseActiveRef.current = false;
            setPhraseResult('wrong');
          }
        }
      }
    }, 500);
    return () => clearInterval(timerInterval);
  }, [progressQuiz, progressWord, wordComplete]);

  useEffect(() => {
    const handleKey = (e) => {
      if (tabRef.current !== "sentence") return;
      if (e.key === " ") {
        setSentence((prev) => prev + " ");
        lastAddedRef.current = ""; 
        lastAddedTimeRef.current = 0;
      } else if (e.key === "Backspace") {
        setSentence((prev) => prev.slice(0, -1));
        lastAddedRef.current = ""; 
        lastAddedTimeRef.current = 0;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    setQuizStats([]);
    setSentence("");
    setScore(0);
    setTotal(0);
    setTab("home");
    localStorage.removeItem('signLanguageTutorUser');
  };

  const hideCameraTabs = ["home", "dashboard", "guide"];

  const handleAuthSuccess = (firebaseUser) => {
    const rawName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split("@")[0] : "Learner");
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const loggedUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: formattedName,
      photoURL: firebaseUser.photoURL,
    };
    setUser(loggedUser);
    loadUserStats(loggedUser.uid);
    setTab("dashboard");
  };

  if (!authChecked) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-spinner"></div>
        <span className="auth-loading-text">Loading SignTutor...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-layout">
      
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="brand-logo" onClick={() => setTab("home")}>SignTutor</span>
        </div>
        
        <div className="topbar-right">
          <div className="theme-toggle-group" role="group" aria-label="Theme selector">
            <button 
              type="button"
              className={`theme-btn ${themePref === 'light' ? 'active' : ''}`}
              onClick={() => setThemePref('light')}
              title="Light mode"
              aria-label="Light mode"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            </button>
            <button 
              type="button"
              className={`theme-btn ${themePref === 'system' ? 'active' : ''}`}
              onClick={() => setThemePref('system')}
              title="System theme"
              aria-label="System theme"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </button>
            <button 
              type="button"
              className={`theme-btn ${themePref === 'dark' ? 'active' : ''}`}
              onClick={() => setThemePref('dark')}
              title="Dark mode"
              aria-label="Dark mode"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
          </div>

          {user && (
            <div className="user-profile-nav">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar">{user.name ? user.name.charAt(0).toUpperCase() : "U"}</div>
              )}
              <span className="user-name">{user.name}</span>
            </div>
          )}
        </div>
      </header>

      <div className="main-container">
        
        <aside className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-content">
            <nav className="sidebar-nav">
              <div className="nav-section">
                <div className="nav-group">
                  <button className={`nav-item ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    <span>Home</span>
                  </button>
                      <button className={`nav-item ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                      <span>Dashboard</span>
                    </button>
                </div>
              </div>
              
              <div className="nav-section">
                <div className="nav-section-title">Learn</div>
                <div className="nav-group">
                  <button className={`nav-item ${tab === "guide" ? "active" : ""}`} onClick={() => setTab("guide")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span>Dictionary Guide</span>
                  </button>
                </div>
              </div>
              
              <div className="nav-section">
                <div className="nav-section-title">Practice Modes</div>
                <div className="nav-group">
                  <button className={`nav-item ${tab === "predict" ? "active" : ""}`} onClick={() => setTab("predict")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <span>Practice</span>
                  </button>
                  <button className={`nav-item ${tab === "quiz" ? "active" : ""}`} onClick={() => setTab("quiz")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>Alphabet Quiz</span>
                  </button>
                  <button className={`nav-item ${tab === "word" ? "active" : ""}`} onClick={() => setTab("word")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 7 4 4 20 4 20 7"></polyline>
                      <line x1="9" y1="20" x2="15" y2="20"></line>
                      <line x1="12" y1="4" x2="12" y2="20"></line>
                    </svg>
                    <span>Spelling Bee</span>
                  </button>
                  <button className={`nav-item ${tab === "phrases" ? "active" : ""}`} onClick={() => setTab("phrases")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Phrase Drills</span>
                  </button>
                  <button className={`nav-item ${tab === "sentence" ? "active" : ""}`} onClick={() => setTab("sentence")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                    <span>Sign & Speak</span>
                  </button>
                </div>
              </div>
            </nav>
          </div>

          <div className="sidebar-footer">
            {user ? (
              <div className="sidebar-user-card">
                <div className="sidebar-user-info">
                  <div className="avatar">{user.name ? user.name.charAt(0).toUpperCase() : "U"}</div>
                  <div className="sidebar-user-details">
                    <span className="sidebar-user-name">{user.name}</span>
                    <span className="sidebar-user-email">{user.email || "Learner"}</span>
                  </div>
                </div>
                <button 
                  className="sidebar-logout-btn" 
                  onClick={handleLogout}
                  title="Log Out"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="content-area">
          <div className="content-wrapper">

            {tab === "home" && (
              <div className="view-container center-text">
                <h1 className="hero-title">Master Sign Language with AI</h1>
                <p className="hero-subtitle">
                  Practice the alphabet, test your spelling speed, and drill real-world phrases with instant, real-time feedback.
                </p>
                <div className="button-group">
                  <button className="btn primary lg" onClick={() => setTab("dashboard")}>
                    Go to Dashboard
                  </button>
                  <button className="btn outline lg" onClick={() => setTab("guide")}>View Dictionary</button>
                </div>
              </div>
            )}



            {tab === "dashboard" && (
              <div className="view-container align-left">
                <div className="dashboard-header">
                  <div>
                    <h2 className="section-title">Hello, {user.name}</h2>
                    <p className="subtitle">Here is your learning overview.</p>
                  </div>
                  <div className="badge success">Active Learner</div>
                </div>

                {!dashboardData ? (
                   <div className="empty-state panel">
                     <p>You haven't generated any practice data yet!</p>
                     <button className="btn primary mt-20" onClick={() => setTab("quiz")}>Take an Alphabet Quiz</button>
                   </div>
                ) : (
                  <div className="bento-layout">
                    
                    <div className="bento-row">
                      <div className="bento-card stat-card">
                        <span className="bento-label">Questions Answered</span>
                        <span className="bento-value">{dashboardData.totalAttempts}</span>
                      </div>
                      <div className="bento-card stat-card">
                        <span className="bento-label">Global Accuracy</span>
                        <div className="bento-progress-container">
                          <span className="bento-value success">{dashboardData.accuracy}%</span>
                          <div className="progress-bar-bg">
                             <div className="progress-bar-fill" style={{ width: `${dashboardData.accuracy}%` }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="bento-card stat-card">
                        <span className="bento-label">Daily Goal</span>
                        <span className="bento-value focus">15 min</span>
                      </div>
                    </div>

                    <div className="bento-row split-2-1">
                      <div className="bento-card">
                        <h3 className="bento-title">Alphabet Heatmap</h3>
                        <p className="bento-desc">Visual breakdown of your proficiency across all 26 letters.</p>
                        <div className="heatmap-grid">
                          {dashboardData.heatmap.map((h, i) => (
                            <div key={i} className={`heat-cell ${h.status}`} title={`${h.letter}: ${h.attempts > 0 ? Math.round(h.acc*100) + '%' : 'Unpracticed'}`}>
                              {h.letter}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bento-card flex-col">
                        <h3 className="bento-title">Needs Review</h3>
                        <p className="bento-desc">Your lowest accuracy signs.</p>
                        {dashboardData.weakSpots.length > 0 ? (
                          <div className="weak-spots-list">
                            {dashboardData.weakSpots.map((ws, i) => (
                              <div key={i} className="weak-item">
                                <div className="weak-letter">{ws.letter}</div>
                                <div className="weak-acc danger">{Math.round(ws.acc * 100)}% acc</div>
                              </div>
                            ))}
                            <button className="btn primary full-width mt-20" onClick={() => setTab("quiz")}>Drill Weak Spots</button>
                          </div>
                        ) : (
                          <div className="empty-state-mini">All good! Keep practicing.</div>
                        )}
                      </div>
                    </div>

                    <div className="bento-row split-half">
                      <div className="bento-card">
                        <h3 className="bento-title">⚡ Fastest Signs</h3>
                        <div className="leaderboard">
                          {dashboardData.fastest.length > 0 ? dashboardData.fastest.map((f, i) => (
                            <div key={i} className="leader-row">
                              <span className="leader-rank">#{i+1}</span>
                              <span className="leader-letter">{f.letter}</span>
                              <span className="leader-time">{f.avgTime.toFixed(1)}s avg</span>
                            </div>
                          )) : <p className="bento-desc mt-20">Not enough data.</p>}
                        </div>
                      </div>

                      <div className="bento-card">
                        <h3 className="bento-title">🐢 Slowest Signs</h3>
                        <div className="leaderboard">
                          {dashboardData.slowest.length > 0 ? dashboardData.slowest.map((s, i) => (
                            <div key={i} className="leader-row">
                              <span className="leader-rank">#{i+1}</span>
                              <span className="leader-letter">{s.letter}</span>
                              <span className="leader-time">{s.avgTime.toFixed(1)}s avg</span>
                            </div>
                          )) : <p className="bento-desc mt-20">Not enough data.</p>}
                        </div>
                      </div>
                    </div>

                    <div className="bento-row">
                      <div className="bento-card full-width">
                        <h3 className="bento-title">Recent Activity Log</h3>
                        <div className="stats-table-container">
                          <table className="stats-table">
                            <thead>
                              <tr><th>#</th><th>Letter</th><th>Result</th><th>Time</th></tr>
                            </thead>
                            <tbody>
                              {[...quizStats].reverse().slice(0, 10).map((stat, i) => (
                                <tr key={i} className={stat.correct ? "row-correct" : "row-wrong"}>
                                  <td>{quizStats.length - i}</td><td>{stat.letter}</td><td>{stat.correct ? "✅" : "❌"}</td><td>{stat.time}{stat.correct ? "s" : ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {tab === "guide" && (
              <div className="view-container align-left guide-view">
                <div className="guide-header">
                  <div className="guide-header-text">
                    <div className="guide-title-row">
                      <h2 className="section-title">ASL Alphabet Dictionary</h2>
                      <span className="guide-badge">26 Signs</span>
                    </div>
                    <p className="guide-subtitle">
                      Visual finger-spelling dictionary for American Sign Language (A–Z). Click any card for details.
                    </p>
                  </div>
                  <div className="guide-search-wrapper">
                    <span className="guide-search-icon">🔍</span>
                    <input
                      type="text"
                      className="guide-search-input"
                      placeholder="Search letter (e.g. A, B...)"
                      value={guideSearch}
                      onChange={(e) => setGuideSearch(e.target.value.toUpperCase().trim())}
                      maxLength={2}
                    />
                    {guideSearch && (
                      <button className="guide-clear-search" onClick={() => setGuideSearch("")}>✕</button>
                    )}
                  </div>
                </div>

                <div className="dictionary-grid">
                  {LETTERS.filter((l) => !guideSearch || l.includes(guideSearch)).map((l) => (
                    <div
                      key={l}
                      className="dict-card"
                      onClick={() => setSelectedGuideLetter(l)}
                      title={`Inspect sign for letter ${l}`}
                    >
                      <div className="dict-img-wrapper">
                        <img 
                          src={`${process.env.PUBLIC_URL || ""}/data/guide_images/Sign_language_${l}.svg.png`} 
                          alt={`ASL Sign ${l}`} 
                          className="dict-sign-img"
                          loading="lazy"
                          onError={(e) => {
                            if (!e.currentTarget.dataset.retried) {
                              e.currentTarget.dataset.retried = "true";
                              e.currentTarget.src = `./data/guide_images/Sign_language_${l}.svg.png`;
                            }
                          }}
                        />
                      </div>
                      <div className="dict-footer">
                        <span className="dict-letter">{l}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedGuideLetter && (
                  <div className="guide-modal-backdrop" onClick={() => setSelectedGuideLetter(null)}>
                    <div className="guide-modal-card" onClick={(e) => e.stopPropagation()}>
                      <button className="guide-modal-close" onClick={() => setSelectedGuideLetter(null)}>✕</button>
                      
                      <div className="guide-modal-header">
                        <span className="guide-modal-tag">ASL Reference</span>
                        <h3 className="guide-modal-title">Letter {selectedGuideLetter}</h3>
                      </div>

                      <div className="guide-modal-image-box">
                        <img
                          src={`${process.env.PUBLIC_URL || ""}/data/guide_images/Sign_language_${selectedGuideLetter}.svg.png`}
                          alt={`ASL sign for ${selectedGuideLetter}`}
                          className="guide-modal-img"
                        />
                      </div>

                      <p className="guide-modal-hint">
                        Hold this exact hand shape in front of your camera to practice.
                      </p>

                      <div className="guide-modal-actions">
                        <button
                          className="btn primary lg full-width"
                          onClick={() => {
                            setSelectedGuideLetter(null);
                            setTab("predict");
                          }}
                        >
                          Practice in Live Detection →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hideCameraTabs.includes(tab) && (
              <div className="practice-layout">
                
                {/* Camera Panel */}
                <div className="camera-panel panel">
                  <div className="panel-header">
                    <div className="panel-header-left">
                      <span className="panel-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                      </span>
                      <h3 className="panel-title">Camera Feed</h3>
                    </div>
                    <div className="panel-header-right">
                      {isCameraRunning ? (
                        <span className="status-badge live">
                          <span className="status-indicator"></span>
                          LIVE
                        </span>
                      ) : (
                        <span className="status-badge standby">STANDBY</span>
                      )}
                    </div>
                  </div>

                  <div className="camera-wrapper">
                    <video ref={videoRef} autoPlay playsInline muted />
                    {!isCameraRunning ? (
                      <div className="camera-placeholder">
                        <div className="camera-placeholder-icon">
                          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                        </div>
                        <h4 className="placeholder-title">Camera Feed Inactive</h4>
                        <p className="placeholder-sub">Click below to enable your camera for live gesture recognition.</p>
                        <button className="btn primary lg mt-20" onClick={startCamera}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                          Enable Camera Feed
                        </button>
                      </div>
                    ) : (
                      isRecording && (
                        <div className="camera-live-overlay">
                          <span className="recording-badge">
                            <span className="rec-dot"></span> RECORDING SEQUENCE
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="camera-controls-footer">
                    {isCameraRunning ? (
                      <div className="camera-status-row">
                        <span className="camera-status-hint">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          Keep hand centered and well-lit in front of the camera
                        </span>
                        <button className="btn outline red sm" onClick={stopCamera}>
                          Stop Camera
                        </button>
                      </div>
                    ) : (
                      <p className="camera-status-hint">
                        All computer vision processing runs locally in real-time.
                      </p>
                    )}
                  </div>
                </div>

                {/* Practice Mode / Game Mode Content */}
                <div className="practice-content">
                  
                  {/* Practice Mode */}
                  {tab === "predict" && (
                    <div className="practice-panel panel">
                      <div className="panel-header">
                        <div className="panel-header-left">
                          <span className="panel-tag">Live Translation</span>
                          <h3 className="panel-title">Practice Mode</h3>
                        </div>
                        <span className="badge-pill">ASL Letters (A–Z)</span>
                      </div>

                      <p className="panel-desc">
                        Show any sign to the camera to see the real-time AI translation. Hold gestures steady for optimal detection.
                      </p>

                      {/* Prominent Bold Answer / Translation Display */}
                      <div className="prediction-display-card">
                        <div className="prediction-display-header">
                          <span className="prediction-label">CURRENT DETECTED SIGN</span>
                          {prediction && <span className="detection-confidence">Active Detection</span>}
                        </div>

                        <div className="prediction-value-box">
                          {prediction ? (
                            <h1 className="prediction-huge-bold">{prediction}</h1>
                          ) : isCameraRunning ? (
                            <div className="prediction-waiting">
                              <span className="status-indicator"></span>
                              <span className="waiting-text">Waiting for hand gesture...</span>
                            </div>
                          ) : (
                            <div className="prediction-inactive">
                              <span className="inactive-dash">—</span>
                              <span className="inactive-text">Camera offline</span>
                            </div>
                          )}
                        </div>

                        <div className="prediction-footer">
                          {prediction ? (
                            <span className="prediction-hint success">
                              Identified sign: <strong>"{prediction}"</strong>
                            </span>
                          ) : isCameraRunning ? (
                            <span className="prediction-hint">
                              Show your hand gesture clearly within frame
                            </span>
                          ) : (
                            <span className="prediction-hint">
                              Enable camera on the left to start live translation
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="practice-guidance-card">
                        <h4 className="guidance-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                          Need a Refresher?
                        </h4>
                        <p className="guidance-text">
                          Browse all 26 American Sign Language finger-spelling gestures in the Dictionary Guide.
                        </p>
                        <button className="btn outline sm" onClick={() => setTab("guide")}>
                          Open Dictionary Guide →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alphabet Quiz */}
                  {tab === "quiz" && (
                    <div className="practice-panel panel">
                      <div className="panel-header">
                        <div className="panel-header-left">
                          <span className="panel-tag">Interactive Challenge</span>
                          <h3 className="panel-title">Alphabet Quiz</h3>
                        </div>
                        {quizActiveRef.current && (
                          <span className="badge-pill score-pill">
                            Score: {score} / {total}
                          </span>
                        )}
                      </div>

                      {!quizActiveRef.current && total < MAX_Q && total === 0 ? (
                        <div className="quiz-intro-state">
                          <p className="panel-desc">
                            Test your fingerspelling recall! Sign the presented letters to the camera within 5 seconds each.
                          </p>
                          <div className="quiz-rules-card">
                            <div className="rule-item">
                              <span className="rule-badge">30</span>
                              <span>Questions per round</span>
                            </div>
                            <div className="rule-item">
                              <span className="rule-badge">5s</span>
                              <span>Time per question</span>
                            </div>
                            <div className="rule-item">
                              <span className="rule-badge">AI</span>
                              <span>Real-time grading</span>
                            </div>
                          </div>
                          <button className="btn primary lg full-width mt-20" onClick={startQuiz}>
                            Start Alphabet Quiz
                          </button>
                        </div>
                      ) : total >= MAX_Q ? (
                        <div className="quiz-complete-state">
                          <span className="panel-tag">Round Complete</span>
                          <h2 className="result-headline">Final Score</h2>
                          <div className="huge-score-box">
                            <span className="huge-score">{score}</span>
                            <span className="score-denom">/ {MAX_Q}</span>
                          </div>
                          <p className="result-comment">
                            {score >= 25 ? "Outstanding ASL accuracy! Excellent fingerspelling mastery." : score >= 15 ? "Solid score! Review any challenging signs in the Dictionary Guide." : "Good try! Practice more letters and try again."}
                          </p>
                          <button className="btn primary lg full-width mt-20" onClick={startQuiz}>
                            Play Again
                          </button>
                        </div>
                      ) : (
                        <div className="quiz-active-state">
                          <div className="quiz-progress-bar-container">
                            <div className="quiz-progress-header">
                              <span>Question {total + 1} of {MAX_Q}</span>
                              <span>Score: {score}</span>
                            </div>
                            <div className="progress-bar-bg">
                              <div className="progress-bar-fill" style={{width: `${((total) / MAX_Q) * 100}%`}}></div>
                            </div>
                          </div>

                          <div className="quiz-target-card">
                            <span className="target-label">SIGN THIS LETTER:</span>
                            <h1 className="target-display">{target}</h1>
                          </div>

                          <div className="quiz-detection-feedback">
                            <span className="feedback-label">Live Recognized Sign:</span>
                            <strong className={`feedback-value ${prediction === target ? "correct" : ""}`}>
                              {prediction ? `"${prediction}"` : "Waiting for sign..."}
                            </strong>
                          </div>

                          <button className="btn outline red full-width mt-20" onClick={() => progressQuiz(false)}>
                            Skip / Mark Wrong
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spelling Bee */}
                  {tab === "word" && (
                    <div className="practice-panel panel">
                      <div className="panel-header">
                        <div className="panel-header-left">
                          <span className="panel-tag">Vocabulary Drill</span>
                          <h3 className="panel-title">Spelling Bee</h3>
                        </div>
                        <span className="badge-pill">5s per letter</span>
                      </div>

                      {!wordActiveRef.current && !wordComplete ? (
                        <div className="quiz-intro-state">
                          <p className="panel-desc">
                            Spell random English vocabulary words letter-by-letter in American Sign Language before the 5-second timer per letter expires!
                          </p>
                          <button className="btn primary lg full-width mt-20" onClick={startWordMode} disabled={isFetchingWord}>
                            {isFetchingWord ? "Loading..." : "Start Spelling Bee"}
                          </button>
                        </div>
                      ) : wordComplete ? (
                        <div className="quiz-complete-state">
                          <span className="panel-tag">Word Completed</span>
                          <h2 className="result-headline">{word}</h2>
                          <div className="word-blocks mt-20">
                            {word.split("").map((char, i) => (
                              <span key={i} className={`block ${wordResults[i] ? "success" : "danger"}`}>{char}</span>
                            ))}
                          </div>
                          <p className="result-comment mt-20">
                            {wordResults.filter(Boolean).length === word.length
                              ? "Perfect spelling! Every single letter verified."
                              : `Spelled with ${wordResults.filter(Boolean).length}/${word.length} letters accurate.`}
                          </p>
                          <button className="btn primary lg full-width mt-20" onClick={startWordMode} disabled={isFetchingWord}>
                            {isFetchingWord ? "Loading..." : "Next Word"}
                          </button>
                        </div>
                      ) : (
                        <div className="quiz-active-state">
                          <p className="panel-desc">Sign the highlighted letter to spell the word:</p>
                          <div className="word-blocks-container">
                            <div className="word-blocks">
                              {word.split("").map((char, i) => {
                                let status = "";
                                if (i === wordProgress) status = "current";
                                else if (i < wordProgress) status = wordResults[i] ? "success" : "danger";
                                return (<span key={i} className={`block ${status}`}>{char}</span>);
                              })}
                            </div>
                          </div>

                          <div className="quiz-detection-feedback mt-20">
                            <span className="feedback-label">Live Recognized Sign:</span>
                            <strong className="feedback-value">
                              {prediction ? `"${prediction}"` : "Waiting for sign..."}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phrase Drills */}
                  {tab === "phrases" && (
                    <div className="practice-panel panel">
                      <div className="panel-header">
                        <div className="panel-header-left">
                          <span className="panel-tag">Dynamic Sequence</span>
                          <h3 className="panel-title">Phrase Drills</h3>
                        </div>
                        <span className="badge-pill">Whole Gestures</span>
                      </div>

                      {!phrase ? (
                        <div className="quiz-intro-state">
                          <p className="panel-desc">
                            Perform dynamic motion phrases (like "Thank you", "Hello", "Welcome", "Yes"). The camera captures a 3-second motion sequence for temporal neural recognition.
                          </p>
                          <button className="btn primary lg full-width mt-20" onClick={startPhraseMode}>
                            Start Phrase Drills
                          </button>
                        </div>
                      ) : phraseResult === 'correct' ? (
                        <div className="quiz-complete-state">
                          <span className="status-badge live">PERFECT MATCH</span>
                          <h1 className="target-display success mt-20">{phrase}</h1>
                          <p className="result-comment">Excellent! The neural network accurately classified your phrase motion.</p>
                          <button className="btn primary lg full-width mt-20" onClick={startPhraseMode}>
                            Next Drill
                          </button>
                        </div>
                      ) : phraseResult === 'wrong' ? (
                        <div className="quiz-complete-state">
                          <span className="status-badge danger">TRY AGAIN</span>
                          <h1 className="target-display danger mt-20">{phrase}</h1>
                          <p className="result-comment">Timer expired or motion gesture not recognized. Keep gestures clear and centered.</p>
                          <button className="btn primary lg full-width mt-20" onClick={startPhraseMode}>
                            Try Another Drill
                          </button>
                        </div>
                      ) : (
                        <div className="quiz-active-state">
                          <p className="panel-desc">Perform the phrase within 10 seconds:</p>
                          <div className="phrase-target-card">
                            <span className="target-label">TARGET PHRASE:</span>
                            <h1 className="target-display">{phrase}</h1>
                          </div>
                          <div className="phrase-status-box">
                            {isRecording ? (
                              <span className="recording-status-text">
                                <span className="status-indicator"></span> Recording motion sequence...
                              </span>
                            ) : (
                              <span className="waiting-status-text">
                                Ready for sequence capture...
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sign & Speak */}
                  {tab === "sentence" && (
                    <div className="practice-panel panel">
                      <div className="panel-header">
                        <div className="panel-header-left">
                          <span className="panel-tag">Real-Time Composition</span>
                          <h3 className="panel-title">Sign & Speak</h3>
                        </div>
                        <span className="badge-pill">Text-to-Speech</span>
                      </div>

                      <p className="panel-desc">
                        Fingerspell letters into the camera to compose sentences in real-time. Use the <strong>Space</strong> key to add space and <strong>Backspace</strong> to delete.
                      </p>

                      <div className="sentence-display-card">
                        <div className="sentence-header">
                          <span className="prediction-label">COMPOSED TEXT</span>
                          <span className="live-char-preview">
                            Live Sign: <strong>{prediction || "—"}</strong>
                          </span>
                        </div>
                        <div className="panel typer-panel">
                          <h2 className="typed-sentence">
                            {sentence || <span className="placeholder">Start signing to compose text...</span>}
                          </h2>
                        </div>
                      </div>

                      <div className="button-group mt-20">
                        <button className="btn primary lg" onClick={speakSentence} disabled={!sentence}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          </svg>
                          Speak Text
                        </button>
                        <button className="btn outline red lg" onClick={() => { setSentence(""); lastAddedRef.current = ""; lastAddedTimeRef.current = 0;}}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                  
                </div>
              </div>
            )}
            
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;