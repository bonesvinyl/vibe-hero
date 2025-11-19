# VIBE HERO 🎸

A Guitar Hero-style rhythm game built with React. Play along to any YouTube music video with keyboard controls!

## Features

- Play rhythm game with YouTube music videos as background
- 5-lane note highway (like Guitar Hero)
- Keyboard controls: A, S, D, F, G keys
- Scoring system with combos and multipliers
- Perfect/Good hit detection
- Real-time visual feedback
- Brutalist cyberpunk aesthetic with neon colors

## Getting Started

### Install Dependencies

```bash
npm install
```

### Crowd Sound Effects ✓

The game includes immersive crowd audio feedback with multiple sound variations:

**Installed Audio Files:**
- `cheer1.mp3` & `cheer2.mp3` - Large arena crowd cheering
- `boo1.mp3` & `boo2.mp3` - Crowd booing sounds

**How it works:**
- The game randomly selects from multiple sound files for variety
- Cheering plays at 15% volume (subtle background effect)
- Booing plays at 20% volume (slightly more noticeable)
- Volumes are intentionally low to not overpower the YouTube music

**When sounds play:**
- **Cheering:** When you hit 20x multiplier or every 10 combo hits
- **Booing:** After 10 seconds of continuously missing notes

### Run Development Server

```bash
npm run dev
```

The game will be available at `http://localhost:5173/`

## How to Play

1. **Enter YouTube URL**: Paste any YouTube music video URL in the menu
2. **Press START GAME**: The video will load in the background
3. **Play**: Watch colored notes fall down the highway
4. **Hit Notes**: Press the corresponding key (A, S, D, F, G) when notes reach the white hit zone at the bottom
5. **Build Combos**: Hit consecutive notes to build your combo multiplier (up to 8x)

### Controls

- **A** - Red lane (leftmost)
- **S** - Blue lane
- **D** - Green lane (center)
- **F** - Yellow lane
- **G** - Purple lane (rightmost)
- **STOP** button - Return to menu

### Scoring

- **Perfect Hit** (within 150ms): 100 points × multiplier
- **Good Hit** (within 300ms): 50 points × multiplier
- **Combo Multiplier**: Increases by 1x every 10 consecutive hits (max 8x)
- **Miss**: Resets combo to 0

## Design

The game features a brutalist cyberpunk aesthetic:
- Monospace Courier New font
- High contrast neon colors on black
- Heavy borders and glowing effects
- No rounded corners or gradients
- Aggressive, raw visual style
- YouTube video plays dimmed and blurred in background

### Color Coding

Each lane has a distinct neon color:
- Lane 1 (A): Red
- Lane 2 (S): Cyan
- Lane 3 (D): Green
- Lane 4 (F): Yellow
- Lane 5 (G): Magenta

## Technical Details

### Technologies

- React 18
- Vite
- YouTube IFrame Player API
- Web Audio API (for future beat detection)
- CSS3 animations

### Note Spawning

Currently uses interval-based random spawning. In future iterations, this can be enhanced with:
- Web Audio API beat detection
- Pre-charted note patterns
- Difficulty levels
- Song-specific patterns

### Performance

- Optimized with React hooks and memoization
- Hardware-accelerated CSS animations
- Efficient state management for real-time gameplay

## Future Enhancements

### Spotify Integration (Coming Soon)

To add Spotify playlist support:

1. Register app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Get Client ID and Client Secret
3. Implement Spotify Web API authentication
4. Use Spotify Web Playback SDK for audio
5. Implement audio analysis for beat detection

**Note**: Spotify integration requires:
- OAuth 2.0 authentication flow
- Spotify Premium account for playback
- Audio analysis API for beat detection
- More complex setup than YouTube

### Other Planned Features

- Beat detection from audio analysis
- Multiple difficulty levels
- Song library/playlist management
- Leaderboards and high scores
- Custom note patterns/charts
- Multiplayer mode
- More visual effects and animations

## YouTube URL Examples

Try these popular music videos:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=9bZkp7q19f0
https://www.youtube.com/watch?v=kJQP7kiw5Fk
```

## Troubleshooting

**YouTube video not loading?**
- Check that the URL is valid
- Some videos may be restricted from embedding
- Try a different video

**Notes not spawning?**
- Make sure the video has started playing
- Check browser console for errors

**Keys not responding?**
- Make sure game is in focus
- Check that you're pressing A, S, D, F, or G
- Keys are case-insensitive

## Development

The game is structured into several key components:

- **App.jsx**: Main game logic and state management
- **index.css**: Brutalist styling and animations
- **YouTube Player API**: Video background integration
- **Game Loop**: Note spawning and timing
- **Input Handler**: Keyboard event processing
- **Scoring System**: Points, combos, and multipliers

## License

MIT

## Credits

Inspired by Guitar Hero, Rock Band, and other rhythm games.
