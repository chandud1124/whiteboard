# Whiteboard Application - Quick Start & Feature Overview

## 🚀 Quick Start

### Prerequisites
- Java 11+ (Installed)
- Maven 3.6+ (Installed)
- MySQL 5.7+ (Running: `mysql -u root`)
- Tomcat 9.0+ (Running on port 8080)

### Setup (One-time)
```bash
# 1. Create MySQL database
mysql -u root -p whiteboard_db < java-whiteboard-project/sql/schema.sql

# 2. Build the project
cd java-whiteboard-project
mvn clean package -DskipTests

# 3. Deploy to Tomcat
cp target/whiteboard.war /opt/homebrew/opt/tomcat@9/libexec/webapps/

# 4. Start Tomcat (if not running)
JAVA_HOME=$(brew --prefix openjdk) /opt/homebrew/opt/tomcat@9/libexec/bin/catalina.sh start
```

### Access the App
- **URL**: http://localhost:8080/whiteboard/
- **WebSocket**: ws://localhost:8080/whiteboard/whiteboard

---

## 📋 Feature Categories

### 1. Drawing Tools (8 tools)
| Tool | Shortcut | Description |
|------|----------|-------------|
| **Pen** | P | Free-hand drawing |
| **Line** | L | Straight lines (Shift for horizontal/vertical) |
| **Rectangle** | R | Rectangular shapes (Shift for squares) |
| **Circle** | C | Circular shapes |
| **Arrow** | A | Lines with arrowheads |
| **Highlighter** | H | Semi-transparent strokes (30% opacity) |
| **Text** | T | Add text labels to canvas |
| **Eraser** | E | Remove content |

### 2. Canvas Controls
| Feature | Shortcut | Description |
|---------|----------|-------------|
| **Grid Toggle** | G | Show/hide grid with 20px spacing |
| **Snap to Grid** | None | Align drawings to grid points |
| **Zoom In** | + | Increase canvas zoom (0.5x to 5x) |
| **Zoom Out** | − | Decrease canvas zoom |
| **Reset Zoom** | 0 | Return to 100% zoom |
| **Mini-map** | M | Toggle navigation helper (bottom-right) |
| **Pan** | Middle Mouse | Click & drag to move canvas |

### 3. Drawing Styles
- **Line Styles**: Solid, Dashed (10-5), Dotted (2-5)
- **Colors**: 6 presets + full RGB picker
- **Stroke Width**: 1px to 50px adjustable slider
- **Transparency**: Highlighter uses 30% opacity

### 4. Edit Operations
| Action | Shortcut | Description |
|--------|----------|-------------|
| **Undo** | Ctrl+Z | Revert last action (50 states) |
| **Redo** | Ctrl+Y | Restore undone action |
| **Clear Canvas** | Delete | Clear all drawings (with confirmation) |
| **Decrease Stroke** | [ | Reduce line width by 1px |
| **Increase Stroke** | ] | Increase line width by 1px |

### 5. Collaboration Features
- **Live Cursors**: See other users' cursors in real-time with color coding
- **Built-in Chat**: Side panel with message history and timestamps
- **Room System**: Create rooms with 6-char codes, invite others
- **Approval System**: Room owners approve join requests
- **User Presence**: Real-time user count and online indicators
- **Connection Status**: Visual indicator (green=connected)

### 6. Export & Sharing
- **Download PNG**: Save canvas as image with current date
- **Share Room**: Copy 6-char room code or full shareable URL
- **Room Badge**: Shows current room code in header

### 7. Authentication
- **Register**: Create account (username, email, password)
- **Login**: Secure authentication with token
- **Logout**: Session termination
- **Session Management**: Token-based access control

---

## 🎨 UI Tour

### Top Toolbar (Left to Right)
1. **Logo** - "Collaborative Whiteboard" with pencil icon
2. **Room Badge** - Shows room code when in a room (tap to copy)
3. **Connection Status** - Green dot (connected), red (disconnected)
4. **User Count** - Shows 👥 icon and number of online users

### Top Toolbar (Right to Left)
1. **Auth Buttons** - Login / Register (hidden when logged in)
2. **User Info** - Shows username and logout button (visible when logged in)
3. **Pending Requests** - Badge showing join requests for room owner

### Main Toolbar
**Section 1: Drawing Tools**
- 8 tool buttons (Pen, Line, Rectangle, Circle, Arrow, Highlighter, Text, Eraser)
- Active tool highlighted in blue

**Section 2: Style**
- Line style dropdown (Solid/Dashed/Dotted)

**Section 3: Color**
- Color picker input
- 6 preset color buttons

**Section 4: Stroke**
- Slider (1-50px)
- Current value display

**Section 5: Canvas Controls**
- Grid toggle button (⊞)
- Snap to grid button (🧲)
- Minimap toggle button (🗺️)

**Section 6: Zoom Controls**
- Zoom out button (−)
- Zoom percentage display (100%)
- Zoom in button (+)
- Reset zoom button (⊗)

**Section 7: Edit**
- Undo button (↶) - disabled when no undo available
- Redo button (↷) - disabled when no redo available

**Section 8: Actions**
- Clear All button (🗑️)
- Save PNG button (💾)
- Save PDF button (📄)

### Canvas Area
- White drawing surface with optional grid overlay
- Mini-map in bottom-right corner (when enabled)
- User cursors displayed with color coding and names
- Connection overlay when connecting

### Chat Panel (Right Side)
- Toggle button: 💬 icon (bottom-right corner)
- Slides in from right when opened
- Shows message history with timestamps
- Input field for typing messages
- Send button (or press Enter)

### Footer
- Shows: "Draw together in real-time • WebSocket powered • Session: [ID]"

---

## 🎯 Common Workflows

### Drawing a Diagram
1. Press P for Pen, draw basic shapes
2. Use R for rectangles, C for circles, A for arrows
3. Press [ to reduce stroke width for details
4. Use L tool with Shift for straight connectors

### Using Grid
1. Press G to toggle grid ON
2. Enable snap with the 🧲 button
3. Shapes automatically align to 20px grid
4. Press G again to hide grid

### Zooming & Panning
1. Scroll wheel to zoom in/out (or +/− keys)
2. Middle-click and drag to pan canvas
3. Press M to see mini-map for navigation
4. Press 0 to reset to 100%

### Collaborating in a Room
1. Click "Create Room" → get 6-character code
2. Share code with others (copy button in share modal)
3. Others click "Join Room" → enter code
4. Room owner approves requests (notification bell)
5. All users see each other's drawings in real-time
6. Chat in the right panel 💬

### Text Annotations
1. Press T for Text tool
2. Click where you want to place text
3. Type message in the popup
4. Press Enter to confirm
5. Text appears in current color/size

### High-Quality Export
1. Arrange your drawing
2. Click "Save PNG" button
3. File downloads as `whiteboard-YYYY-MM-DD.png`
4. Use image editor if PDF conversion needed

---

## ⌨️ Keyboard Shortcuts Cheatsheet

### Drawing Tools (Press once to select)
```
P = Pen          L = Line         R = Rectangle    C = Circle
A = Arrow        H = Highlighter  T = Text         E = Eraser
```

### Canvas
```
G = Toggle Grid       M = Toggle Minimap
```

### Zoom
```
+ = Zoom In          − = Zoom Out         0 = Reset Zoom
```

### Edit
```
Ctrl+Z = Undo          Ctrl+Y = Redo
[ = Less thick         ] = More thick
Delete = Clear Canvas
```

### Shape Constraints (hold while drawing)
```
Shift + Circle = Perfect circle
Shift + Rectangle = Perfect square
Shift + Line = Straight horizontal/vertical
```

---

## 📊 Performance Tips

1. **Reduce zoom level** (zoom out) if canvas feels slow
2. **Use thinner strokes** for detailed work (saves drawing data)
3. **Disable mini-map** if not needed (M key) to save memory
4. **Clear canvas regularly** to free up memory (Delete key)
5. **Limit undo history** - max 50 states stored

---

## 🐛 Troubleshooting

### "Cannot connect to server"
- Verify Tomcat is running: `pgrep -f catalina`
- Check MySQL is running: `mysql -u root -e "SELECT 1"`
- Verify app is deployed: `curl http://localhost:8080/whiteboard/`

### Drawing doesn't appear
- Check you're not in a room awaiting approval
- Check connection status (top-left green dot)
- Try refreshing the page (F5)

### Chat not working
- Confirm you're logged in (username visible top-right)
- Check WebSocket connection is established
- Verify message isn't empty

### Zoom/Pan not responding
- Use mouse wheel for zoom (not touchpad on Mac)
- Middle-click drag for pan (Ctrl+click on Mac)
- Or use +/−/0 keys

### Undo/Redo buttons grayed out
- You're at the beginning/end of history
- History only tracks recent 50 actions
- Creating new drawings resets undo stack

---

## 📱 Mobile Considerations

- **Touch Drawing**: Works with touch events (pinch zoom not yet supported)
- **Toolbar**: Collapses to icons on small screens
- **Chat**: Panel width reduces to 280px
- **Zoom**: Use on-screen buttons instead of scroll wheel
- **Best Experience**: Use on tablet or large screen

---

## 🔐 Security Notes

- **Password**: Stored hashed in MySQL (never transmitted plain)
- **Token**: Generated on login, expires per session
- **Room Access**: Only approved users can draw in rooms
- **Messages**: All data transmitted over WebSocket
- **HTTPS**: Recommended for production (currently HTTP)

---

## 📚 Additional Resources

- **GitHub**: https://github.com/chandu/whiteboard
- **Features List**: See `FEATURES_IMPLEMENTED.md`
- **Java Docs**: Check `java-whiteboard-project/` folder
- **API Reference**: WebSocket messages documented in source

---

## 🚀 Version Info

- **Version**: 1.0.0
- **Build Date**: January 14, 2026
- **Features**: 65+ implemented
- **Java**: 11+
- **Tomcat**: 9.0+
- **MySQL**: 5.7+
- **Browser**: Modern browsers with Canvas 2D & WebSocket

---

**Happy Drawing! 🎨**
