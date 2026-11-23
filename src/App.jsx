import React, { useState, useRef, useEffect } from 'react';
import appleImg from './assets/apple.png';
import startImg from './assets/start.png'; 

const ROWS = 10;
const COLS = 17;
const GAME_DURATION = 120;

function createBoard() {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      id: `${r}-${c}`,
      r,
      c,
      value: Math.floor(Math.random() * 9) + 1,
      active: true,
      popping: false,
    }))
  );
}

// 맑고 경쾌한 "톡! 딩~" 효과음
function playPopSound(count = 2, volume = 50) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(320, now);
    popOsc.frequency.exponentialRampToValueAtTime(880, now + 0.09);

    popGain.gain.setValueAtTime(0.28 * (volume / 100), now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.11);

    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chimeOsc.type = 'triangle';
    const baseFreq = 523.25 + Math.min(count, 8) * 55;
    chimeOsc.frequency.setValueAtTime(baseFreq, now + 0.04);
    chimeOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.22);

    chimeGain.gain.setValueAtTime(0.18 * (volume / 100), now + 0.04);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    chimeOsc.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chimeOsc.start(now + 0.04);
    chimeOsc.stop(now + 0.24);
  } catch (e) {
    // 브라우저 오디오 제한 시 무시
  }
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false); // 시작 여부 상태
  const [board, setBoard] = useState(createBoard);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [dragBox, setDragBox] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('appleGameSound') !== 'off';
  });
  const [gameRecords, setGameRecords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('appleGameRecords') || '[]');
    } catch {
      return [];
    }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);

  // 유튜브 음악 목록
  const [musicList, setMusicList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('appleGameMusic') || '[]');
    } catch {
      return [];
    }
  });

  const [selectedMusicId, setSelectedMusicId] = useState('');
  const [showMusicInput, setShowMusicInput] = useState(false);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicUrl, setMusicUrl] = useState('');
  const [youtubeApiReady, setYoutubeApiReady] = useState(false);
  const selectedMusicIdRef = useRef(selectedMusicId);
  selectedMusicIdRef.current = selectedMusicId;

  const selectedMusic = musicList.find(
    (music) => music.videoId === selectedMusicId
  );

  const [musicVolume, setMusicVolume] = useState(50);
  const [youtubeReady, setYoutubeReady] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(50);

  const youtubePlayerRef = useRef(null);
  const youtubeContainerRef = useRef(null);

  const boardRef = useRef(null);
  const recordSavedRef = useRef(false);

  const isGameOver = hasStarted && timeLeft <= 0;
  // 유튜브 API 로드
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYoutubeApiReady(true);
      return;
    }

    const previousCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      setYoutubeApiReady(true);
    };

    if (!document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    )) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  }, []);

  // 음악 선택 후 플레이어 생성 및 재생
  useEffect(() => {
    if (
    !hasStarted ||
    !selectedMusicId ||
    !youtubeApiReady ||
    !youtubeContainerRef.current
    ) {
      return;
    }

      // 기존 플레이어가 있으면 선택한 음악으로 변경
    if (youtubePlayerRef.current) {
      if (youtubeReady) {
        youtubePlayerRef.current.loadVideoById(selectedMusicId);
        youtubePlayerRef.current.setVolume(musicVolume);
        youtubePlayerRef.current.unMute();
        youtubePlayerRef.current.playVideo();
      }
      return;
    }

    // 플레이어가 없으면 새로 생성
    youtubePlayerRef.current = new window.YT.Player(
      youtubeContainerRef.current,
      {
        width: '200',
        height: '200',
        videoId: selectedMusicId,
        playerVars: {
          playsinline: 1,
          autoplay: 1,
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(musicVolume);
            event.target.loadVideoById(selectedMusicIdRef.current);
            event.target.unMute();
            event.target.playVideo();
            setYoutubeReady(true);
          },
        },
      }
    );
  }, [hasStarted, selectedMusicId, youtubeApiReady]);

  // 컴포넌트 종료 시 플레이어 정리
  useEffect(() => {
    return () => {
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
    };
  }, []);

  // 볼륨 변경
  useEffect(() => {
    if (!youtubeReady || !youtubePlayerRef.current) return;

    youtubePlayerRef.current.setVolume(musicVolume);
  }, [musicVolume, youtubeReady]);

  // 게임 종료 시 점수 기록을 한 번만 저장
  // 게임 종료 시 점수 기록 저장 및 신기록 판정
  useEffect(() => {
  if (!isGameOver || recordSavedRef.current) return;

  recordSavedRef.current = true;

  const previousBest = gameRecords.reduce(
    (best, record) => Math.max(best, Number(record.score) || 0),
    0
  );

  const newRecordAchieved = score > previousBest;
  setIsNewRecord(newRecordAchieved);

  const newRecord = {
    id: Date.now(),
    date: new Date().toLocaleString('ko-KR'),
    score,
  };

  const updatedRecords = [...gameRecords, newRecord].sort(
    (a, b) => b.score - a.score || b.id - a.id
  );

  setGameRecords(updatedRecords);

  try {
    localStorage.setItem(
      'appleGameRecords',
      JSON.stringify(updatedRecords)
    );
  } catch (error) {
    console.error('게임 기록 저장에 실패했습니다.', error);
  }
}, [isGameOver, score]);

  // 시작된 상태이고 게임 오버가 아닐 때만 타이머 작동
  useEffect(() => {
    if (!hasStarted || isGameOver) {
      setDragBox(null);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, isGameOver]);

  const handleStartGame = () => {
    recordSavedRef.current = false;
    setIsNewRecord(false);
    setBoard(createBoard());
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setDragBox(null);
    setHasStarted(true);

    if (musicVolume > 0) playPopSound(3, musicVolume);
  };

  const handleResetGame = () => {
    // 기존 유튜브 플레이어 정리
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.destroy();
      youtubePlayerRef.current = null;
    }

    setHasStarted(false);
    setBoard(createBoard());
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setDragBox(null);
  };

  const handleAddMusic = () => {
    const match = musicUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/
    );

    if (!match) {
      alert('올바른 유튜브 주소를 입력해 주세요.');
      return;
    }

    const videoId = match[1];

    const newMusic = {
      videoId,
      title: musicTitle.trim() || `음악 ${musicList.length + 1}`,
    };

    const updatedList = [
      ...musicList.filter((music) => music.videoId !== videoId),
      newMusic,
    ];

    setMusicList(updatedList);
    localStorage.setItem('appleGameMusic', JSON.stringify(updatedList));

    setSelectedMusicId(videoId);
    setMusicTitle('');
    setMusicUrl('');
    setShowMusicInput(false);
  };

  const getRelativePos = (e) => {
    const rect = boardRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e) => {
    if (!hasStarted || isGameOver) return;
    const pos = getRelativePos(e);
    setDragBox({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
  };

  const handleMouseMove = (e) => {
    if (!dragBox || !hasStarted || isGameOver) return;
    const pos = getRelativePos(e);
    setDragBox((prev) => ({ ...prev, endX: pos.x, endY: pos.y }));
  };

  const getSelectedCells = (box) => {
    if (!box || !boardRef.current) return [];
    const rect = boardRef.current.getBoundingClientRect();
    const cellW = rect.width / COLS;
    const cellH = rect.height / ROWS;

    const minX = Math.min(box.startX, box.endX);
    const maxX = Math.max(box.startX, box.endX);
    const minY = Math.min(box.startY, box.endY);
    const maxY = Math.max(box.startY, box.endY);

    const selected = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = (c + 0.5) * cellW;
        const cy = (r + 0.5) * cellH;
        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          const cell = board[r][c];
          if (cell.active && !cell.popping) selected.push(cell);
        }
      }
    }
    return selected;
  };

  const handleMouseUp = () => {
    if (!dragBox || !hasStarted || isGameOver) return;
    const selected = getSelectedCells(dragBox);
    const sum = selected.reduce((acc, cell) => acc + cell.value, 0);

    if (sum === 10 && selected.length > 0) {
      const targetIds = new Set(selected.map((s) => s.id));

      if (musicVolume > 0) playPopSound(selected.length, musicVolume);
      setScore((prev) => prev + selected.length);

      setBoard((prev) =>
        prev.map((row) =>
          row.map((cell) =>
            targetIds.has(cell.id) ? { ...cell, popping: true } : cell
          )
        )
      );

      setTimeout(() => {
        setBoard((prev) =>
          prev.map((row) =>
            row.map((cell) =>
              targetIds.has(cell.id)
                ? { ...cell, active: false, popping: false }
                : cell
            )
          )
        );
      }, 650);
    }
    setDragBox(null);
  };

  const selectedIds = new Set(getSelectedCells(dragBox).map((s) => s.id));

  return (
    <div
      style={{
        userSelect: 'none',
        width: '98vw',
        maxWidth: 1250, 
        margin: '30px auto',
        fontFamily: 'sans-serif',
      }}
    >
      <style>{`
        @keyframes appleFall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          15% {
            transform: translateY(-8px) rotate(-8deg) scale(1.08);
            opacity: 1;
          }
          100% {
            transform: translateY(100px) rotate(40deg) scale(0.75);
            opacity: 0;
          }
        }

        .apple-popping {
          animation: appleFall 0.48s ease-in forwards;
          pointer-events: none;
        }
      `}</style>

      {/* 상단 점수 및 타이머 바 */}
      {hasStarted && (<>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'center',
          marginBottom: 12,
          padding: '0 4px',
        }}
      >
        <strong style={{ fontSize: 22 }}>
          Score : {score}
        </strong>

        <strong
          style={{
            fontSize: 22,
            textAlign: 'center',
            justifySelf: 'center',
            color: timeLeft <= 10 && hasStarted ? '#d32f2f' : '#222',
          }}
        >
          남은 시간: {timeLeft}초
        </strong>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >

          {/* 음악 선택 */}
          <select
            value={selectedMusicId}
            onChange={(e) => {
              const videoId = e.target.value;
              setSelectedMusicId(videoId);

              if (videoId && youtubePlayerRef.current && youtubeReady) {
                youtubePlayerRef.current.loadVideoById(videoId);
                youtubePlayerRef.current.unMute();
                youtubePlayerRef.current.playVideo();
              }
            }}
            style={{
              width: 115,
              padding: '9px 5px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">🎵 음악 선택</option>

            {musicList.map((music) => (
              <option key={music.videoId} value={music.videoId}>
                {music.title}
              </option>
            ))}
          </select>

          {/* 음악 추가 */}
          <button
            onClick={() => setShowMusicInput((prev) => !prev)}
            title="유튜브 음악 추가"
            style={{
              width: 40,
              height: 36,
              minHeight: 36,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              lineHeight: 1,
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            +
          </button>

          {/* 음악 볼륨 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {/* 음소거 버튼 */}
            <button
              onClick={() => {
                if (musicVolume > 0) {
                  setPreviousVolume(musicVolume);
                  setMusicVolume(0);
                } else {
                  setMusicVolume(previousVolume || 50);
                }
              }}
              title={musicVolume === 0 ? '소리 켜기' : '음소거'}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {musicVolume === 0 ? '🔇' : musicVolume < 50 ? '🔉' : '🔊'}
            </button>

            {/* 볼륨 슬라이더 */}
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={(e) => {
                const value = Number(e.target.value);
                setMusicVolume(value);

                if (value > 0) {
                  setPreviousVolume(value);
                }
              }}
              title={`음악 볼륨 ${musicVolume}%`}
              style={{
                width: 65,
                cursor: 'pointer',
                accentColor: '#43a047',
              }}
            />
          </div>

          {/* Reset */}
          <button
            onClick={handleResetGame}
            style={{
              padding: '8px 16px',
              fontSize: 16,
              fontWeight: 'bold',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* 유튜브 음악 등록 */}
      {showMusicInput && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            marginBottom: 12,
            background: '#f8f9fa',
            border: '1px solid #ddd',
            borderRadius: 8,
          }}
        >
          <input
            type="text"
            placeholder="곡 제목"
            value={musicTitle}
            onChange={(e) => setMusicTitle(e.target.value)}
            style={{
              width: 130,
              padding: 9,
              border: '1px solid #ccc',
              borderRadius: 5,
            }}
          />

          <input
            type="text"
            placeholder="유튜브 주소"
            value={musicUrl}
            onChange={(e) => setMusicUrl(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: 9,
              border: '1px solid #ccc',
              borderRadius: 5,
            }}
          />

          <button
            onClick={handleAddMusic}
            style={{
              padding: '9px 14px',
              border: 'none',
              borderRadius: 5,
              background: '#43a047',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            추가
          </button>
        </div>
      )}

      {/* 진행 게이지 */}
      <div style={{ height: 12, background: '#e0e0e0', borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${(timeLeft / GAME_DURATION) * 100}%`,
            background: timeLeft <= 10 && hasStarted ? '#e53935' : '#43a047',
            transition: 'width 0.3s linear',
          }}
        />
      </div>
      </>
      )}

      {/* 게임 보드 */}
      <div
        ref={boardRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 6,
          padding: 16,
          background: '#f8f9fa',
          borderRadius: 14,
          border: '2px solid #ddd',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        {board.flat().map((cell) => {
          const isSelected = selectedIds.has(cell.id);
          const isVisible = cell.active || cell.popping;

          return (
            <div
              key={cell.id}
              className={cell.popping ? 'apple-popping' : ''}
              style={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                animationDelay: cell.popping
                ? `${((cell.r * 7 + cell.c * 3) % 5) * 35}ms`
                : '0ms',
                justifyContent: 'center',
                backgroundImage: isVisible ? `url(${appleImg})` : 'none',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                // 시작 전에는 숫자를 숨기고 살짝 블러 처리하여 미리 푸는 것을 방지
                filter: !hasStarted
                  ? 'blur(2px) brightness(0.95)'
                  : !cell.popping && isSelected
                  ? 'brightness(1.25) hue-rotate(35deg) drop-shadow(0 0 4px #ff9800)'
                  : 'none',
                transform: !cell.popping ? (isSelected ? 'scale(1.1)' : 'scale(1)') : undefined,
                transition: 'transform 0.08s',
                color: isVisible && hasStarted ? '#fff' : 'transparent',
                fontWeight: 'bold',
                fontSize: 20,
                textShadow: hasStarted ? '0 1px 4px rgba(0, 0, 0, 0.85)' : 'none',
                paddingTop: 6,
              }}
            >
              {isVisible && hasStarted ? cell.value : ''}
            </div>
          );
        })}

        {/* 드래그 영역 박스 */}
        {dragBox && hasStarted && !isGameOver && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(dragBox.startX, dragBox.endX),
              top: Math.min(dragBox.startY, dragBox.endY),
              width: Math.abs(dragBox.endX - dragBox.startX),
              height: Math.abs(dragBox.endY - dragBox.startY),
              border: '2px solid #1976d2',
              background: 'rgba(25, 118, 210, 0.18)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 처음 게임 Start 화면 오버레이 */}
        {!hasStarted && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${startImg})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              zIndex: 10,
            }}
          >
          <button
            onClick={handleStartGame}
            title="게임 시작"
            style={{
              position: 'relative',
              left: '-190px',
              top: '50px',
              width: 240,
              height: 240,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <img
              src={appleImg}
              alt="START"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
              }}
            />

            <span
              style={{
                position: 'absolute',
                top: '60%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 40,
                fontWeight: 900,
                fontFamily: "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif",
                color: '#fff',
                textShadow: '1px 2px 3px rgba(120, 40, 20, 0.8)',
                letterSpacing: 2,
                pointerEvents: 'none',
              }}
            >
              PLAY
            </span>
          </button>
          </div>
        )}

        {/* 시간 종료 화면 */}
        {isGameOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              gap: 16,
              zIndex: 10,
            }}
          >

          <h2 style={{ margin: 0, fontSize: 32 }}>
            Game Over!
          </h2>

          <p style={{ margin: 0, fontSize: 22 }}>
            Score: {score}
          </p>

          {isNewRecord && (
            <p
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 'bold',
                color: '#ffd54f',
              }}
            >
              ✨ 신기록 달성! ✨
            </p>
          )}

          <button
            onClick={handleStartGame}
            style={{
              padding: '10px 24px',
              fontSize: 18,
              fontWeight: 'bold',
              borderRadius: 8,
              border: 'none',
              background: '#43a047',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Restart
          </button>
        </div>
      )}
    </div>

    {/* 누적 게임 기록 */}
    {hasStarted && (
    <div
      style={{
        marginTop: 24,
        padding: 20,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 14,
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.05)',
      }}
    >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
          }}
        >
        <h2 style={{ margin: 0, fontSize: 22, color: '#333' }}>
          🏆 나의 게임 기록
        </h2>
        <strong style={{ color: '#d32f2f', fontSize: 17 }}>
          Best Score: {gameRecords.reduce(
            (best, record) => Math.max(best, record.score),
            0
          )}점
        </strong>
      </div>

        {gameRecords.length === 0 ? (
          <p style={{ margin: 0, padding: '18px 0', color: '#888', textAlign: 'center' }}>
            아직 기록이 없어요. 첫 게임에 도전해 보세요! 🍎
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...gameRecords]
              .sort((a, b) => b.score - a.score || b.id - a.id)
              .map((record, index) => (
                <div
                  key={record.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 9,
                    background: index === 0 ? '#fff8e1' : '#f7f8fa',
                    border: index === 0 ? '1px solid #ffcc80' : '1px solid #eee',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                      {index + 1}위
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
                      {record.date}
                    </div>
                  </div>
                  <strong style={{ flexShrink: 0, fontSize: 18, color: '#333' }}>
                    {record.score}점
                  </strong>
                </div>
              ))}
          </div>
        )}
      </div>
      )}

      {/* 유튜브 음악 플레이어 */}
      {hasStarted && selectedMusic && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          <div
            ref={youtubeContainerRef}
            style={{
              width: 200,
              height: 200,
            }}
          />
        </div>
      )}
    </div>
  );
}