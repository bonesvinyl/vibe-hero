import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const LANES = 5
const KEYS = ['a', 's', 'd', 'f', 'g']
const FALL_DURATION = 3000 // ms
const HIT_WINDOW = 150 // ms for perfect hit
const GOOD_WINDOW = 300 // ms for good hit

function App() {
  const [gameState, setGameState] = useState('menu') // menu, loading, playing, paused, finished
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [videoId, setVideoId] = useState(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [bpm, setBpm] = useState(120) // Default BPM
  const [detectedBpm, setDetectedBpm] = useState(null)
  const [difficulty, setDifficulty] = useState('medium') // easy, medium, expert
  const [mediumChords, setMediumChords] = useState(false) // Chords on/off for medium difficulty
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '')
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('favorites') || '[]'))
  const [highScores, setHighScores] = useState(() => JSON.parse(localStorage.getItem('highScores') || '{}'))
  const [userStats, setUserStats] = useState(() => JSON.parse(localStorage.getItem('userStats') || '{}'))
  const [notes, setNotes] = useState([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  const [activeKeys, setActiveKeys] = useState(new Set())
  const [feedback, setFeedback] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [starPower, setStarPower] = useState(0) // 0-100
  const [starPowerActive, setStarPowerActive] = useState(false)
  const [blueStreak, setBlueStreak] = useState(0)
  const [crowdMood, setCrowdMood] = useState('neutral') // cheering, neutral, booing
  const [missedNotes, setMissedNotes] = useState(0)
  const [lastHitTime, setLastHitTime] = useState(Date.now())
  const [totalNotesSpawned, setTotalNotesSpawned] = useState(0)
  const [notesHit, setNotesHit] = useState(0)
  const [accuracyPercent, setAccuracyPercent] = useState(0)
  const [starRating, setStarRating] = useState(0)

  const playerRef = useRef(null)
  const gameLoopRef = useRef(null)
  const noteIdRef = useRef(0)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const crowdAudioRef = useRef(null)
  const missCheckIntervalRef = useRef(null)

  // Extract YouTube video ID from URL
  const extractVideoId = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[7].length === 11) ? match[7] : null
  }

  // Try to detect BPM from video title
  const detectBPMFromTitle = (title) => {
    // Look for BPM in title like "120 BPM", "BPM: 120", "(120bpm)", etc.
    const bpmMatch = title.match(/(\d{2,3})\s*bpm/i) || title.match(/bpm[:\s]*(\d{2,3})/i)
    if (bpmMatch) {
      return parseInt(bpmMatch[1])
    }
    return null
  }

  // Fetch video info from YouTube
  const fetchVideoInfo = async (vidId) => {
    try {
      // YouTube oEmbed API (doesn't require API key)
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vidId}&format=json`)
      const data = await response.json()

      setVideoTitle(data.title)

      // Try to detect BPM from title
      const detectedBpm = detectBPMFromTitle(data.title)
      if (detectedBpm) {
        setDetectedBpm(detectedBpm)
        setBpm(detectedBpm)
        setFeedback({ quality: 'starpower', text: `BPM DETECTED: ${detectedBpm}!` })
        setTimeout(() => setFeedback(null), 2000)
      }
    } catch (error) {
      console.log('Could not fetch video info:', error)
    }
  }

  // Save high score
  const saveHighScore = useCallback(() => {
    const key = `${videoId}-${difficulty}`
    const currentHigh = highScores[key] || 0

    if (score > currentHigh) {
      setHighScores(prev => ({
        ...prev,
        [key]: score
      }))
      setFeedback({ quality: 'perfect', text: 'NEW HIGH SCORE!' })
      setTimeout(() => setFeedback(null), 1000)
    }
  }, [videoId, difficulty, score, highScores])

  // Add to favorites
  const toggleFavorite = useCallback(() => {
    const favorite = {
      url: youtubeUrl,
      videoId,
      title: videoTitle,
      bpm
    }

    const existingIndex = favorites.findIndex(f => f.videoId === videoId)

    if (existingIndex >= 0) {
      setFavorites(prev => prev.filter((_, i) => i !== existingIndex))
    } else {
      setFavorites(prev => [...prev, favorite])
    }
  }, [youtubeUrl, videoId, videoTitle, bpm, favorites])

  // Play crowd audio feedback using actual audio files
  const playCrowdSound = useCallback((type) => {
    try {
      let audio

      if (type === 'cheer') {
        // Randomly select from 2 cheering sounds
        const cheerSounds = ['/sounds/cheer1.mp3', '/sounds/cheer2.mp3']
        const randomCheer = cheerSounds[Math.floor(Math.random() * cheerSounds.length)]
        audio = new Audio(randomCheer)
        audio.volume = 0.15 // Subtle - 15% volume so it doesn't overpower music
      } else if (type === 'boo') {
        // Randomly select from 2 booing sounds
        const booSounds = ['/sounds/boo1.mp3', '/sounds/boo2.mp3']
        const randomBoo = booSounds[Math.floor(Math.random() * booSounds.length)]
        audio = new Audio(randomBoo)
        audio.volume = 0.2 // Slightly louder for booing - 20% volume
      }

      if (audio) {
        // Play with error handling
        audio.play().catch(err => {
          console.log('Audio playback failed:', err)
          // Fallback to silent if audio files not found
        })
      }
    } catch (error) {
      console.log('Could not play crowd sound:', error)
    }
  }, [])

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    }
  }, [])

  // Save user data to localStorage
  useEffect(() => {
    if (username) {
      localStorage.setItem('username', username)
    }
  }, [username])

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('highScores', JSON.stringify(highScores))
  }, [highScores])

  useEffect(() => {
    localStorage.setItem('userStats', JSON.stringify(userStats))
  }, [userStats])

  // Spawn notes based on beat detection or interval
  const spawnNote = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES)
    const id = noteIdRef.current++
    const spawnTime = Date.now()

    setNotes(prev => [...prev, {
      id,
      lane,
      spawnTime,
      hit: false
    }])

    // Remove note after it falls
    setTimeout(() => {
      setNotes(prev => prev.filter(n => n.id !== id))
    }, FALL_DURATION + 1000)
  }, [])

  // Animation loop for smooth note movement
  useEffect(() => {
    if (gameState === 'playing') {
      const animate = () => {
        setCurrentTime(Date.now())
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animationFrameRef.current = requestAnimationFrame(animate)

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [gameState])

  // Check for prolonged poor performance (10 seconds without hits)
  useEffect(() => {
    if (gameState === 'playing') {
      const checkInterval = setInterval(() => {
        const timeSinceLastHit = Date.now() - lastHitTime
        if (timeSinceLastHit > 10000 && crowdMood !== 'booing') {
          setCrowdMood('booing')
          playCrowdSound('boo') // Play boo sound when crowd starts booing
        } else if (timeSinceLastHit < 10000 && crowdMood === 'booing') {
          setCrowdMood('neutral')
        }
      }, 1000)

      return () => clearInterval(checkInterval)
    }
  }, [gameState, lastHitTime, crowdMood, playCrowdSound])

  // Start game loop
  const startGame = useCallback(() => {
    setGameState('playing')

    // Calculate beat interval from BPM
    const beatInterval = (60 / bpm) * 1000 // ms per beat

    // Difficulty settings
    const difficultySettings = {
      easy: { spawnRate: 2, chords: false, offbeats: 0.3 },
      medium: { spawnRate: 1, chords: mediumChords, offbeats: 0.5 }, // Respect mediumChords setting
      expert: { spawnRate: 1, chords: true, offbeats: 0.7 }
    }

    const settings = difficultySettings[difficulty]
    let beatCount = 0

    // Spawn notes on beat
    gameLoopRef.current = setInterval(() => {
      beatCount++

      // Spawn notes based on difficulty
      if (beatCount % settings.spawnRate === 0) {
        const spawnTime = Date.now()

        // Expert mode: sometimes spawn chords (2-3 notes)
        if (settings.chords && Math.random() > 0.6) {
          const chordSize = Math.random() > 0.7 ? 3 : 2
          const availableLanes = [0, 1, 2, 3, 4]
          const chordLanes = []

          for (let i = 0; i < chordSize; i++) {
            const laneIndex = Math.floor(Math.random() * availableLanes.length)
            chordLanes.push(availableLanes[laneIndex])
            availableLanes.splice(laneIndex, 1)
          }

          // Create chord notes
          chordLanes.forEach(lane => {
            const id = noteIdRef.current++
            const isBlue = lane === 1 // Lane 1 (S key) is blue/cyan

            setNotes(prev => [...prev, {
              id,
              lane,
              spawnTime,
              hit: false,
              isChord: true,
              isBlue
            }])

            setTotalNotesSpawned(prev => prev + 1) // Track for accuracy

            setTimeout(() => {
              setNotes(prev => {
                const note = prev.find(n => n.id === id)
                if (note && !note.hit) {
                  // Missed note - break combo (no sound, crowd reacts after 10s)
                  setCombo(0)
                  setMultiplier(1)
                  setMissedNotes(m => m + 1)
                }
                return prev.filter(n => n.id !== id)
              })
            }, FALL_DURATION + 500)
          })
        } else {
          // Single note
          const lane = Math.floor(Math.random() * LANES)
          const id = noteIdRef.current++
          const isBlue = lane === 1 // Lane 1 (S key) is blue/cyan

          setNotes(prev => [...prev, {
            id,
            lane,
            spawnTime,
            hit: false,
            isChord: false,
            isBlue
          }])

          setTotalNotesSpawned(prev => prev + 1) // Track for accuracy

          setTimeout(() => {
            setNotes(prev => {
              const note = prev.find(n => n.id === id)
              if (note && !note.hit) {
                // Missed note - break combo (no sound)
                setCombo(0)
                setMultiplier(1)
                setMissedNotes(m => m + 1)
                setCrowdMood('booing')
              }
              return prev.filter(n => n.id !== id)
            })
          }, FALL_DURATION + 500)
        }
      }

      // Add offbeat notes based on difficulty
      if (Math.random() > (1 - settings.offbeats)) {
        setTimeout(() => {
          const lane = Math.floor(Math.random() * LANES)
          const id = noteIdRef.current++
          const spawnTime = Date.now()
          const isBlue = lane === 1

          setNotes(prev => [...prev, {
            id,
            lane,
            spawnTime,
            hit: false,
            isChord: false,
            isBlue
          }])

          setTotalNotesSpawned(prev => prev + 1) // Track for accuracy

          setTimeout(() => {
            setNotes(prev => {
              const note = prev.find(n => n.id === id)
              if (note && !note.hit) {
                // Missed note - break combo (no sound)
                setCombo(0)
                setMultiplier(1)
                setMissedNotes(m => m + 1)
                setCrowdMood('booing')
              }
              return prev.filter(n => n.id !== id)
            })
          }, FALL_DURATION + 500)
        }, beatInterval / 2)
      }
    }, beatInterval)
  }, [bpm, difficulty, playCrowdSound])

  // Start beat detection using Web Audio API
  const startBeatDetection = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
    }
  }

  // Initialize YouTube Player
  const initializePlayer = useCallback((vidId) => {
    if (window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: vidId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event) => {
            event.target.playVideo()
            startGame()
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              startBeatDetection()
            } else if (event.data === window.YT.PlayerState.ENDED) {
              // Video ended - show results screen
              stopGame()
            }
          }
        }
      })
    } else {
      setTimeout(() => initializePlayer(vidId), 100)
    }
  }, [startGame])

  // Calculate final rating
  const calculateRating = useCallback(() => {
    const accuracy = totalNotesSpawned > 0 ? (notesHit / totalNotesSpawned) * 100 : 0
    setAccuracyPercent(Math.round(accuracy))

    // Calculate star rating (0-5 stars)
    let stars = 0
    if (accuracy >= 95) stars = 5
    else if (accuracy >= 85) stars = 4
    else if (accuracy >= 70) stars = 3
    else if (accuracy >= 50) stars = 2
    else if (accuracy >= 30) stars = 1

    setStarRating(stars)

    // Save to user stats
    const key = `${videoId}-${difficulty}`
    const newStat = {
      videoTitle,
      difficulty,
      score,
      accuracy: Math.round(accuracy),
      stars,
      date: new Date().toISOString()
    }

    setUserStats(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newStat]
    }))

    return { accuracy: Math.round(accuracy), stars }
  }, [totalNotesSpawned, notesHit, videoId, difficulty, videoTitle, score])

  // Stop game
  const stopGame = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
    if (playerRef.current && playerRef.current.pauseVideo) {
      playerRef.current.pauseVideo()
    }

    // Calculate rating and save high score
    calculateRating()
    saveHighScore()

    // Show results screen
    setGameState('finished')
  }

  // Return to menu from results
  const returnToMenu = () => {
    setGameState('menu')
    setNotes([])
    setScore(0)
    setCombo(0)
    setMultiplier(1)
    setStarPower(0)
    setStarPowerActive(false)
    setTotalNotesSpawned(0)
    setNotesHit(0)
    setAccuracyPercent(0)
    setStarRating(0)
  }

  // Handle key press
  const handleKeyDown = useCallback((e) => {
    const key = e.key.toLowerCase()

    // Pause/Resume game with Enter key
    if (key === 'enter') {
      if (gameState === 'playing') {
        setGameState('paused')
        if (playerRef.current && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo()
        }
      } else if (gameState === 'paused') {
        setGameState('playing')
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo()
        }
      }
      return
    }

    // Activate star power with Spacebar
    if (key === ' ' && starPower >= 50 && !starPowerActive && gameState === 'playing') {
      setStarPowerActive(true)
      setFeedback({ quality: 'starpower', text: 'WHAMMY BAR ACTIVATED!' })
      setTimeout(() => setFeedback(null), 800)

      // Play crowd cheering for arena atmosphere
      playCrowdSound('cheer')

      // Create arena reverb ambience using Web Audio API
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      // Create a rich synthetic reverb/echo ambience sound with multiple layers
      const ctx = audioContextRef.current

      // Layer 1: Deep bass rumble
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(110, ctx.currentTime) // A2
      gain1.gain.setValueAtTime(0.08, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 10)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start()
      osc1.stop(ctx.currentTime + 10)

      // Layer 2: Mid-range harmonic
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(220, ctx.currentTime) // A3
      gain2.gain.setValueAtTime(0.05, ctx.currentTime)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 10)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start()
      osc2.stop(ctx.currentTime + 10)

      // Layer 3: Sweeping filter for reverb effect
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      const filter3 = ctx.createBiquadFilter()
      osc3.type = 'sawtooth'
      osc3.frequency.setValueAtTime(55, ctx.currentTime) // A1
      filter3.type = 'lowpass'
      filter3.frequency.setValueAtTime(800, ctx.currentTime)
      filter3.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 5)
      gain3.gain.setValueAtTime(0.06, ctx.currentTime)
      gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 10)
      osc3.connect(filter3)
      filter3.connect(gain3)
      gain3.connect(ctx.destination)
      osc3.start()
      osc3.stop(ctx.currentTime + 10)

      // Drain star power over 10 seconds (1% per 100ms = 10 seconds total)
      const drainInterval = setInterval(() => {
        setStarPower(prev => {
          const newValue = prev - 1
          if (newValue <= 0) {
            clearInterval(drainInterval)
            setStarPowerActive(false)
            return 0
          }
          return newValue
        })
      }, 100)

      return
    }

    if (!KEYS.includes(key) || activeKeys.has(key)) return

    const laneIndex = KEYS.indexOf(key)
    setActiveKeys(prev => new Set(prev).add(key))

    // Check for hits
    const now = Date.now()
    const notesInLane = notes.filter(n => n.lane === laneIndex && !n.hit)

    if (notesInLane.length > 0) {
      // Hit zone is at approximately 85-90% of the fall
      const hitZoneProgress = 0.87 // 87% of the way down
      const hitZoneTime = FALL_DURATION * hitZoneProgress

      // Find closest note in hit zone
      const closestNote = notesInLane.reduce((closest, note) => {
        const elapsed = now - note.spawnTime
        const timeDiff = Math.abs(elapsed - hitZoneTime)

        if (!closest || timeDiff < Math.abs((now - closest.spawnTime) - hitZoneTime)) {
          return note
        }
        return closest
      }, null)

      if (closestNote) {
        const elapsed = now - closestNote.spawnTime
        const timeDiff = Math.abs(elapsed - hitZoneTime)

        if (timeDiff < HIT_WINDOW) {
          // Perfect hit
          handleHit(closestNote.id, 'perfect', 100, closestNote.isBlue)
        } else if (timeDiff < GOOD_WINDOW) {
          // Good hit
          handleHit(closestNote.id, 'good', 50, closestNote.isBlue)
        }
      }
    }
  }, [notes, activeKeys, starPower, starPowerActive])

  // Handle key release
  const handleKeyUp = useCallback((e) => {
    const key = e.key.toLowerCase()
    if (!KEYS.includes(key)) return

    setActiveKeys(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
  }, [])

  // Handle successful hit
  const handleHit = (noteId, quality, points, isBlue) => {
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, hit: true } : n
    ))

    setNotesHit(prev => prev + 1) // Track for accuracy

    const newCombo = combo + 1
    setCombo(newCombo)
    setLastHitTime(Date.now()) // Update last hit time

    // Update multiplier based on combo - now with real-time scaling
    let newMultiplier = Math.min(Math.floor(newCombo / 10) + 1, 20)

    // Double multiplier if star power is active
    if (starPowerActive) {
      newMultiplier *= 2
    }

    setMultiplier(newMultiplier)

    // Calculate score with multiplier
    const earnedPoints = points * newMultiplier
    setScore(prev => prev + earnedPoints)

    // Build star power based on combo (every hit adds to bar)
    if (!starPowerActive) {
      // Add 2% per hit, bonus for blue notes
      const powerGain = isBlue ? 3 : 2
      setStarPower(prev => {
        const newPower = Math.min(prev + powerGain, 100)
        if (newPower === 100 && prev < 100) {
          setFeedback({ quality: 'starpower', text: 'WHAMMY BAR READY!' })
          setTimeout(() => setFeedback(null), 800)
        }
        return newPower
      })
    }

    // Track blue streak
    if (isBlue) {
      setBlueStreak(prev => prev + 1)
    } else {
      setBlueStreak(0)
    }

    // Crowd reactions - only cheer, never boo on individual misses
    if (newMultiplier >= 20 && crowdMood !== 'cheering') {
      setCrowdMood('cheering')
      playCrowdSound('cheer')
    } else if (newCombo % 10 === 0 && newCombo > 0) {
      playCrowdSound('cheer')
    }

    // Reset crowd mood if they were booing
    if (crowdMood === 'booing') {
      setCrowdMood('neutral')
    }

    // Show feedback
    setFeedback({ quality, text: quality.toUpperCase() })
    setTimeout(() => setFeedback(null), 500)
  }

  // Keyboard event listeners
  useEffect(() => {
    if (gameState === 'playing' || gameState === 'paused') {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    }
  }, [gameState, handleKeyDown, handleKeyUp])

  // Initialize player when videoId changes
  useEffect(() => {
    if (videoId && gameState === 'loading') {
      // Wait for DOM to render the youtube-player div
      const timer = setTimeout(() => {
        initializePlayer(videoId)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [videoId, gameState, initializePlayer])

  // Start game with YouTube URL
  const handleStartGame = async () => {
    if (!username.trim()) {
      alert('Please enter a username first!')
      return
    }

    const vidId = extractVideoId(youtubeUrl)
    if (vidId) {
      setGameState('loading')
      setVideoId(vidId)

      // Fetch video info and try to detect BPM
      await fetchVideoInfo(vidId)
    } else {
      alert('Invalid YouTube URL')
    }
  }

  // Load song from favorites
  const loadFavorite = (favorite) => {
    setYoutubeUrl(favorite.url)
    setBpm(favorite.bpm)
    setVideoId(favorite.videoId)
    setVideoTitle(favorite.title)
  }

  // Paused screen
  if (gameState === 'paused') {
    return (
      <div className="game-container">
        {/* YouTube Video Background (still visible when paused) */}
        {videoId && (
          <div className="video-background">
            <div id="youtube-player"></div>
          </div>
        )}

        <div className="menu" style={{
          background: 'rgba(0, 0, 0, 0.95)',
          position: 'relative',
          zIndex: 100
        }}>
          <h1 style={{ color: '#FFFF00', marginBottom: '2rem' }}>PAUSED</h1>
          <div style={{ fontSize: '1rem', marginBottom: '2rem', opacity: 0.8 }}>
            <p>Game paused. Take a break!</p>
          </div>
          <div className="menu-buttons">
            <button onClick={() => {
              setGameState('playing')
              if (playerRef.current && playerRef.current.playVideo) {
                playerRef.current.playVideo()
              }
            }} style={{
              borderColor: '#00FF00',
              color: '#00FF00'
            }}>
              RESUME
            </button>
            <button onClick={stopGame} style={{
              borderColor: '#FF0000',
              color: '#FF0000'
            }}>
              END SONG
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Results/Finished screen
  if (gameState === 'finished') {
    return (
      <div className="game-container">
        <div className="menu">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{
              color: '#00FF00',
              textShadow: '4px 4px 0 #000',
              marginBottom: '1rem'
            }}>
              SONG COMPLETE!
            </h1>
            <div style={{ fontSize: '1rem', opacity: 0.8 }}>
              {videoTitle}
            </div>
          </div>

          {/* Accuracy Percentage */}
          <div style={{
            textAlign: 'center',
            marginBottom: '2rem',
            padding: '2rem',
            border: '6px solid #00FFFF',
            background: '#0a0a0a',
            boxShadow: '8px 8px 0 #00FFFF'
          }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: '900',
              color: '#00FFFF',
              textShadow: '4px 4px 0 #000',
              marginBottom: '1rem'
            }}>
              {accuracyPercent}%
            </div>
            <div style={{ fontSize: '1rem', opacity: 0.8, marginBottom: '1rem' }}>
              ACCURACY
            </div>

            {/* Star Rating */}
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem',
              letterSpacing: '0.2em'
            }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{
                  color: i < starRating ? '#FFFF00' : '#333'
                }}>
                  ★
                </span>
              ))}
            </div>
            <div style={{ fontSize: '1rem', color: '#FFFF00', fontWeight: '900' }}>
              {starRating} / 5 STARS
            </div>
          </div>

          {/* Stats */}
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '4px solid #FF00FF',
            background: '#0a0a0a',
            boxShadow: '6px 6px 0 #FF00FF'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              fontSize: '1rem'
            }}>
              <div>
                <div style={{ color: '#00FF00', fontWeight: '900' }}>SCORE</div>
                <div style={{ fontSize: '1.5rem' }}>{score.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: '#00FFFF', fontWeight: '900' }}>DIFFICULTY</div>
                <div style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>{difficulty}</div>
              </div>
              <div>
                <div style={{ color: '#FFFF00', fontWeight: '900' }}>NOTES HIT</div>
                <div style={{ fontSize: '1.5rem' }}>{notesHit} / {totalNotesSpawned}</div>
              </div>
              <div>
                <div style={{ color: '#FF00FF', fontWeight: '900' }}>BEST COMBO</div>
                <div style={{ fontSize: '1.5rem' }}>{combo}</div>
              </div>
            </div>
          </div>

          <div className="menu-buttons">
            <button onClick={returnToMenu} style={{
              flex: 1,
              borderColor: '#00FF00',
              color: '#00FF00'
            }}>
              MAIN MENU
            </button>
            <button onClick={() => {
              returnToMenu()
              setTimeout(() => handleStartGame(), 100)
            }} style={{
              flex: 1,
              borderColor: '#00FFFF',
              color: '#00FFFF'
            }}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Menu screen
  if (gameState === 'menu') {
    return (
      <div className="game-container">
        <div className="menu">
          <div style={{
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontSize: '1.5rem',
              marginBottom: '0.5rem',
              letterSpacing: '0.2em'
            }}>
              🎸 🎵 🎸
            </div>
            <h1 style={{
              background: 'linear-gradient(90deg, #FF0000, #00FFFF, #00FF00, #FFFF00, #FF00FF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '4rem',
              marginBottom: '0.5rem'
            }}>
              VIBE HERO
            </h1>
            <div style={{
              fontSize: '1.5rem',
              marginTop: '0.5rem',
              letterSpacing: '0.2em'
            }}>
              🎸 🎵 🎸
            </div>
          </div>

          {/* Username Input */}
          <div className="menu-input">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username..."
              maxLength={20}
            />
          </div>

          {/* YouTube URL Input */}
          <div className="menu-input">
            <label>YouTube URL</label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              onKeyPress={(e) => e.key === 'Enter' && handleStartGame()}
            />
            {detectedBpm && (
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#00FFFF' }}>
                Auto-detected BPM: {detectedBpm}
              </p>
            )}
          </div>

          {/* Favorites List */}
          {favorites.length > 0 && (
            <div style={{
              marginBottom: '1.5rem',
              maxHeight: '200px',
              overflowY: 'auto',
              border: '6px solid #FF00FF',
              padding: '1rem',
              background: '#000',
              boxShadow: '8px 8px 0 #FF00FF'
            }}>
              <label style={{
                marginBottom: '1rem',
                display: 'block',
                fontSize: '1.25rem',
                color: '#FF00FF',
                textShadow: '2px 2px 0 #000',
                letterSpacing: '0.15em',
                fontWeight: '900'
              }}>
                ★ YOUR FAVORITES ★
              </label>
              {favorites.map((fav, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  borderBottom: i < favorites.length - 1 ? '3px solid #FF00FF' : 'none',
                  fontSize: '0.875rem',
                  background: i % 2 === 0 ? '#0a0a0a' : '#000',
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1a0a1a'}
                onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? '#0a0a0a' : '#000'}
                >
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginRight: '1rem',
                    color: '#fff'
                  }}>
                    🎵 {fav.title || fav.url.substring(0, 30)}...
                  </span>
                  <button
                    onClick={() => loadFavorite(fav)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      marginLeft: '0.5rem',
                      boxShadow: '4px 4px 0 #FF00FF',
                      border: '3px solid #FF00FF',
                      backgroundColor: '#000',
                      color: '#FF00FF',
                      fontWeight: '900'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#FF00FF'
                      e.currentTarget.style.color = '#000'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#000'
                      e.currentTarget.style.color = '#FF00FF'
                    }}
                  >
                    ▶ PLAY
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="menu-input">
            <label>BPM (Beats Per Minute)</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(60, Math.min(200, parseInt(e.target.value) || 120)))}
              placeholder="120"
              min="60"
              max="200"
            />
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>
              Adjust to match the song tempo (60-200)
            </p>
          </div>

          <div className="menu-input">
            <label>Difficulty</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['easy', 'medium', 'expert'].map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: difficulty === diff ? '#fff' : '#000',
                    color: difficulty === diff ? '#000' : '#fff',
                    fontSize: '0.875rem'
                  }}
                >
                  {diff.toUpperCase()}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>
              {difficulty === 'expert' && 'Expert mode includes CHORDS (2-3 notes at once)!'}
              {difficulty === 'medium' && 'Medium difficulty with regular note patterns'}
              {difficulty === 'easy' && 'Easy mode with slower note spawning'}
            </p>

            {/* Chord toggle for medium difficulty */}
            {difficulty === 'medium' && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                border: '3px solid #FF00FF',
                background: '#0a0a0a'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '900', color: '#FF00FF' }}>
                    CHORDS
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setMediumChords(false)}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.75rem',
                        backgroundColor: !mediumChords ? '#FF00FF' : '#000',
                        color: !mediumChords ? '#000' : '#FF00FF',
                        border: '3px solid #FF00FF',
                        boxShadow: !mediumChords ? '4px 4px 0 #FF00FF' : 'none'
                      }}
                    >
                      OFF
                    </button>
                    <button
                      onClick={() => setMediumChords(true)}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.75rem',
                        backgroundColor: mediumChords ? '#FF00FF' : '#000',
                        color: mediumChords ? '#000' : '#FF00FF',
                        border: '3px solid #FF00FF',
                        boxShadow: mediumChords ? '4px 4px 0 #FF00FF' : 'none'
                      }}
                    >
                      ON
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                  {mediumChords
                    ? '⚡ Chords enabled! Play 2-3 notes simultaneously'
                    : 'Single notes only'}
                </p>
              </div>
            )}
          </div>

          <div style={{
            marginTop: '1.5rem',
            fontSize: '0.875rem',
            border: '4px solid #00FFFF',
            padding: '1rem',
            background: '#0a0a0a',
            boxShadow: '6px 6px 0 #00FFFF'
          }}>
            <div style={{ color: '#00FFFF', fontWeight: '900', marginBottom: '0.75rem', fontSize: '1rem', letterSpacing: '0.1em' }}>
              🎮 HOW TO PLAY 🎮
            </div>
            <p style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#FFFF00', fontWeight: '900' }}>CONTROLS:</span> A S D F G keys
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#00FFFF', fontWeight: '900' }}>STAR POWER:</span> Hit 10 BLUE (S) notes!
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: '#FF00FF', fontWeight: '900' }}>WHAMMY BAR:</span> Press SPACE (2x multiplier!)
            </p>
            <p>
              <span style={{ color: '#00FF00', fontWeight: '900' }}>PAUSE:</span> Press ENTER
            </p>
          </div>

          <div className="menu-buttons">
            <button
              onClick={handleStartGame}
              style={{
                background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
                borderColor: '#00FF00',
                color: '#00FF00',
                boxShadow: '8px 8px 0 #00FF00',
                fontSize: '1.25rem',
                padding: '1.25rem 2.5rem',
                letterSpacing: '0.2em',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00FF00'
                e.currentTarget.style.color = '#000'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)'
                e.currentTarget.style.color = '#00FF00'
              }}
            >
              🎸 START GAME 🎸
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Game screen (loading or playing)
  return (
    <div className="game-container" style={{
      animation: starPowerActive ? 'arenaShake 0.1s infinite' : 'none'
    }}>
      {/* Arena Flash Overlay */}
      {starPowerActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, rgba(0,255,255,0.2) 0%, transparent 70%)',
          animation: 'arenaFlash 0.2s infinite',
          pointerEvents: 'none',
          zIndex: 5
        }} />
      )}

      {/* YouTube Video Background */}
      {videoId && (
        <div className="video-background" style={{
          filter: starPowerActive ? 'brightness(1.5) saturate(2)' : 'none',
          transition: 'filter 0.3s'
        }}>
          <div id="youtube-player"></div>
        </div>
      )}

      {/* Loading Screen */}
      {gameState === 'loading' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '2rem',
          textAlign: 'center',
          zIndex: 100
        }}>
          <h2>LOADING...</h2>
          <p style={{ fontSize: '1rem', marginTop: '1rem', opacity: 0.7 }}>
            Initializing YouTube Player
          </p>
        </div>
      )}

      {/* Vertical Star Power Bar - Left Side */}
      <div style={{
        position: 'fixed',
        left: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '60px',
        height: '500px',
        zIndex: 100,
        pointerEvents: 'none'
      }}>
        {/* Bar Container */}
        <div style={{
          width: '100%',
          height: '100%',
          border: '6px solid #fff',
          background: '#000',
          position: 'relative',
          boxShadow: starPower >= 100 ? '0 0 30px #00FFFF, inset 0 0 20px #00FFFF' : '0 0 10px rgba(0,0,0,0.5)'
        }}>
          {/* Fill */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${starPower}%`,
            background: starPowerActive
              ? 'linear-gradient(to top, #00FFFF, #00FF00, #FFFF00)'
              : starPower >= 100
                ? 'linear-gradient(to top, #0088FF, #00FFFF)'
                : 'linear-gradient(to top, #003366, #0088FF)',
            boxShadow: starPowerActive
              ? '0 0 40px #00FFFF, inset 0 0 20px #fff'
              : starPower >= 100
                ? '0 0 20px #00FFFF, inset 0 0 10px #00FFFF'
                : 'none',
            transition: 'height 0.3s, background 0.3s, box-shadow 0.3s',
            animation: starPowerActive ? 'pulse 0.5s infinite' : starPower >= 100 ? 'pulse 1s infinite' : 'none'
          }} />

          {/* Segments */}
          {[...Array(10)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              bottom: `${i * 10}%`,
              left: 0,
              width: '100%',
              height: '2px',
              background: 'rgba(255, 255, 255, 0.2)'
            }} />
          ))}
        </div>

        {/* Label */}
        <div style={{
          marginTop: '10px',
          fontSize: '0.75rem',
          fontWeight: '900',
          textAlign: 'center',
          color: starPower >= 100 ? '#00FFFF' : '#fff',
          textShadow: starPower >= 100 ? '0 0 10px #00FFFF' : 'none',
          animation: starPower >= 100 ? 'pulse 1s infinite' : 'none',
          letterSpacing: '0.1em'
        }}>
          {starPowerActive ? 'ACTIVE!' : starPower >= 100 ? 'READY!' : 'WHAMMY'}
        </div>
      </div>

      {/* Game Overlay */}
      <div className="game-overlay" style={{
        filter: starPowerActive ? 'hue-rotate(90deg) saturate(1.5)' : 'none',
        transition: 'filter 0.3s',
        animation: starPowerActive ? 'arenaPulse 0.3s infinite' : 'none'
      }}>
        {/* HUD */}
        <div className="hud">
          <div className="score" style={{
            animation: starPowerActive ? 'pulse 0.5s infinite' : 'none',
            color: starPowerActive ? '#00FF00' : '#fff'
          }}>
            SCORE: {score.toLocaleString()}
          </div>
          {combo > 0 && (
            <div className="combo">
              COMBO: {combo}
              <span className="multiplier" style={{
                color: starPowerActive ? '#FFFF00' : '#00FF00'
              }}> x{multiplier}</span>
            </div>
          )}

          {/* Status Messages */}
          <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            {starPower >= 100 && !starPowerActive && (
              <div style={{ color: '#00FFFF', animation: 'pulse 1s infinite', fontWeight: '900' }}>
                PRESS ENTER FOR WHAMMY BAR!
              </div>
            )}
            {starPowerActive && (
              <div style={{ color: '#00FF00', animation: 'pulse 0.5s infinite', fontWeight: '900' }}>
                WHAMMY BAR ACTIVE! 2X MULTIPLIER!
              </div>
            )}
            {blueStreak >= 3 && (
              <div style={{ color: '#00FFFF', marginTop: '0.5rem' }}>
                BLUE STREAK: {blueStreak}
              </div>
            )}
          </div>

          {/* Crowd Mood Indicator */}
          {crowdMood !== 'neutral' && (
            <div style={{
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: crowdMood === 'cheering' ? '#00FF00' : '#FF0000',
              animation: 'pulse 1s infinite',
              fontWeight: '900'
            }}>
              {crowdMood === 'cheering' ? '🎉 CROWD IS GOING WILD!' : '😠 CROWD IS DISAPPOINTED'}
            </div>
          )}
        </div>

        {/* Hit Feedback */}
        {feedback && (
          <div className={`hit-feedback ${feedback.quality}`}>
            {feedback.text}
          </div>
        )}

        {/* Note Highway */}
        <div className="note-highway" style={{
          filter: starPowerActive ? 'drop-shadow(0 0 20px rgba(0,255,255,0.8))' : 'none'
        }}>
          <div className="highway-container" style={{
            animation: starPowerActive ? 'arenaGlow 0.5s infinite' : 'none'
          }}>
            <div className="lanes">
              {Array.from({ length: LANES }).map((_, i) => (
                <div key={i} className="lane">
                  {notes
                    .filter(note => note.lane === i && !note.hit)
                    .map(note => {
                      const elapsed = currentTime - note.spawnTime
                      const progress = Math.min(Math.max(elapsed / FALL_DURATION, 0), 1)

                      // Calculate position: start at top (0%) and move to bottom (100%)
                      const topPosition = progress * 100

                      return (
                        <div
                          key={note.id}
                          className={`note lane-${i}`}
                          style={{
                            top: `${topPosition}%`,
                            transform: `translateY(-50%)`,
                            height: note.isChord ? '80px' : '60px',
                            boxShadow: note.isChord
                              ? `0 0 30px ${i === 0 ? 'var(--accent-red)' : i === 1 ? 'var(--accent-blue)' : i === 2 ? 'var(--accent-green)' : i === 3 ? 'var(--accent-yellow)' : 'var(--accent-purple)'}`
                              : undefined,
                            borderWidth: note.isChord ? '6px' : '4px',
                            animation: starPowerActive ? 'pulse 0.3s infinite' : 'none'
                          }}
                        >
                          {note.isChord && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: '#fff',
                              fontWeight: '900',
                              fontSize: '1.5rem',
                              textShadow: '2px 2px 4px #000'
                            }}>
                              ⚡
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              ))}
            </div>
            <div className="hit-zone"></div>
          </div>
        </div>

        {/* Key Indicators */}
        <div className="key-indicators" style={{
          filter: starPowerActive ? 'drop-shadow(0 0 15px rgba(0,255,255,0.9))' : 'none'
        }}>
          {KEYS.map((key, i) => (
            <div
              key={key}
              className={`key-indicator lane-${i} ${activeKeys.has(key) ? 'active' : ''}`}
              style={{
                animation: starPowerActive ? 'pulse 0.3s infinite' : 'none',
                boxShadow: starPowerActive ? '0 0 30px currentColor' : undefined
              }}
            >
              {key.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Game Controls */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 50,
          pointerEvents: 'all',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <button onClick={toggleFavorite} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            {favorites.some(f => f.videoId === videoId) ? '★ FAVORITED' : '☆ ADD FAVORITE'}
          </button>
          <button onClick={stopGame}>STOP</button>
        </div>

        {/* High Score Display */}
        {videoId && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '100px',
            zIndex: 30,
            pointerEvents: 'none',
            fontSize: '0.875rem'
          }}>
            <div style={{ opacity: 0.7 }}>
              HIGH SCORE: {highScores[`${videoId}-${difficulty}`]?.toLocaleString() || 0}
            </div>
            {videoTitle && (
              <div style={{ marginTop: '0.5rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {videoTitle}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
