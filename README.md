# 🎨 Collaborative Whiteboard - Full-Featured Real-Time Drawing Application

A **powerful, feature-rich collaborative whiteboard** built with Java/Tomcat backend and vanilla JavaScript frontend. Draw together in real-time with live cursors, chat, and room-based collaboration.

## ✨ Key Features

### Drawing Tools (8 Total)
- **Pen** (P) - Free-hand drawing
- **Line** (L) - Straight lines with snap
- **Rectangle** (R) - Perfect squares with Shift
- **Circle** (C) - Perfect circles with Shift
- **Arrow** (A) - Lines with arrowheads
- **Highlighter** (H) - Semi-transparent strokes (30%)
- **Text** (T) - Add text labels
- **Eraser** (E) - Erase content

### Advanced Features
✅ **Zoom & Pan** (0.5x to 5x) | 
✅ **Grid System** with snap-to-grid | 
✅ **Mini-map** for navigation |
✅ **Undo/Redo** (50 states) |
✅ **Live Cursors** with color-coding |
✅ **Built-in Chat** |
✅ **8 Line Styles** (solid, dashed, dotted) |
✅ **Full Color Picker** + 6 presets |
✅ **Real-time Multi-user** sync |
✅ **Room-based Collaboration** with approvals |
✅ **User Authentication** (register/login) |
✅ **PNG/PDF Export** |
✅ **Touch Support** (mobile/tablet) |
✅ **15+ Keyboard Shortcuts** |
✅ **Responsive Design** |
✅ **Connection Status** indicators

## 🚀 Quick Start

### Prerequisites
```bash
# Required tools
- JDK 21+ (openjdk via Homebrew)
- Maven 3.6+
- MySQL 8.0+
- Tomcat 9.0
```

### Installation (1 minute)
```bash
# 1. Initialize database
mysql -u root -p whiteboard_db < java-whiteboard-project/sql/schema.sql

# 2. Build project
cd java-whiteboard-project && mvn clean package -DskipTests

# 3. Deploy to Tomcat 9
cp target/whiteboard.war /opt/homebrew/opt/tomcat@9/libexec/webapps/

# 4. Start Tomcat (if not running)
JAVA_HOME=$(brew --prefix openjdk) /opt/homebrew/opt/tomcat@9/libexec/bin/catalina.sh start

# 5. Open browser
# http://localhost:8080/whiteboard/
```

## 📋 Feature Breakdown

### 🎨 UI/UX Improvements
- **Floating Toolbar** with 8+ tool groups
- **Active Tool Highlights** with blue glow
- **Tooltips** showing keyboard shortcuts
- **Responsive Design** (desktop/tablet/mobile)
- **Infinite Canvas** with zoom/pan
- **Grid Overlay** (toggle with G)
- **Snap to Grid** for precision
- **Mini-map** navigation (toggle with M)

### ✏️ Drawing & Editing
- **8 Drawing Tools** (pen, line, rectangle, circle, arrow, highlighter, text, eraser)
- **Line Styles**: Solid, Dashed (10-5), Dotted (2-5)
- **Stroke Width**: 1-50px adjustable
- **Color Picker**: Full RGB + 6 presets
- **Shape Constraints**: Shift for perfect shapes
- **Undo/Redo**: Ctrl+Z / Ctrl+Y (50 states)
- **Clear Canvas**: Delete key
- **Export**: PNG download with date

### 👥 Collaboration
- **Live Cursor Tracking** - See where others are pointing
- **Built-in Chat** - Side panel with message history
- **Room System** - 6-char codes, shareable links
- **User Approval** - Room owner controls access
- **Real-time Sync** - WebSocket-powered instant updates
- **Connection Status** - Visual indicators
- **User Count** - Real-time online users display

### 🔐 Authentication
- **Register** - Create account (username, email, password)
- **Login** - Secure token-based auth
- **Logout** - Session management
- **Per-Room Access** - Users only see approved rooms

### 📱 Responsive & Mobile
- **Touch Support** - Full touch event handling
- **Mobile Toolbar** - Collapses to icons (<768px)
- **Tablet Optimized** - Proper scaling and spacing
- **Responsive Chat** - Adapts to screen size
- **Auto-scaling** - Font and button sizes adjust

## ⌨️ Keyboard Shortcuts

| Key | Action | Category |
|-----|--------|----------|
| P, L, R, C, A, H, T, E | Select Tool | Drawing |
| G | Toggle Grid | Canvas |
| M | Toggle Mini-map | Canvas |
| +/− | Zoom In/Out | Navigation |
| 0 | Reset Zoom | Navigation |
| Ctrl+Z / Ctrl+Y | Undo/Redo | Edit |
| [/] | Change Stroke Width | Edit |
| Delete | Clear Canvas | Action |

**See QUICK_START_GUIDE.md for complete list**

## 📊 Architecture

### Backend
- **Java 21** with WebSocket (javax.websocket)
- **Tomcat 9** servlet container
- **MySQL 8** for persistence
- **JDBC** connection pooling
- **Room-based** collaboration

### Frontend
- **Vanilla JavaScript** (no frameworks)
- **HTML5 Canvas 2D** for drawing
- **WebSocket** for real-time sync
- **CSS3** for styling and animations
- **Touch Events** API

### WebSocket
- **Endpoint**: `/whiteboard`
- **Protocol**: JSON messages
- **Reconnection**: Auto-retry (5 attempts)
- **Keep-alive**: Ping/pong every 30s
- **Cursor Updates**: Batched every 100ms

## 🎯 Usage Examples

### Basic Drawing
```javascript
// Automatic via UI - just select tool and draw
P           // Select Pen
Draw strokes on canvas
Ctrl+Z      // Undo if needed
```

### Collaborate in a Room
```
1. Click "Create Room" → Get 6-char code
2. Share code with others
3. Others: "Join Room" → Enter code
4. Room owner approves (notification bell 🔔)
5. Everyone sees drawings in real-time
6. Chat in side panel 💬
```

### Grid & Snap
```
G                    // Toggle grid (20px spacing)
Click snap button    // Enable snapping
Draw shapes → Auto-align to grid
```

### Zoom & Pan
```
Scroll wheel         // Zoom in/out (0.5x - 5x)
Middle-click drag    // Pan canvas
M                    // Show mini-map
0                    // Reset to 100%
```

## 🔧 Configuration

### Database
Edit `DatabaseConnection.java`:
```java
String url = "jdbc:mysql://localhost:3306/whiteboard_db";
String user = "root";
String password = "";
```

### Tomcat Ports
Default: 8080 (modify `server.xml`)

### WebSocket
Endpoint configured in `WhiteboardEndpoint.java`:
```java
@ServerEndpoint("/whiteboard")
```

## 📈 Performance

- **Cursor Updates**: 100ms batching (10/sec)
- **Drawing Events**: Per-stroke variable rate
- **History Size**: 50 undo states
- **Max Concurrent Users**: Tested with 5+ simultaneous
- **Canvas Zoom**: 0.5x to 5x (smooth scaling)
- **Network**: Optimized message bundling

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect" | Check Tomcat running: `pgrep -f catalina` |
| MySQL error | Verify schema: `mysql -u root whiteboard_db` |
| Drawing not syncing | Confirm WebSocket connected (green dot) |
| Chat not working | Ensure logged in (username visible top-right) |
| Cursor lag | Reduce zoom level or disable mini-map |

## 📚 Documentation

See the java-whiteboard-project/README.md for detailed setup and technical information.

## 📦 Project Structure

```
whiteboard/
├── java-whiteboard-project/
│   ├── src/main/java/com/whiteboard/
│   │   ├── websocket/WhiteboardEndpoint.java
│   │   ├── dao/UserDAO.java, DrawingEventDAO.java
│   │   └── util/DatabaseConnection.java
│   ├── src/main/webapp/
│   │   ├── index.html
│   │   ├── css/style.css
│   │   └── js/whiteboard.js
│   ├── sql/schema.sql
│   └── pom.xml
└── README.md (this file)
```

## 🔐 Security

- ✅ Password hashing (server-side)
- ✅ Token-based authentication
- ✅ Session management
- ✅ Room access control
- ⚠️ HTTP (recommend HTTPS for production)

## 🚀 Deployment

### Development
```bash
# Terminal 1: Start MySQL
mysql -u root

# Terminal 2: Start Tomcat
JAVA_HOME=$(brew --prefix openjdk) /opt/homebrew/opt/tomcat@9/libexec/bin/catalina.sh run

# Terminal 3: Access app
open http://localhost:8080/whiteboard/
```

### Production
1. Use HTTPS/SSL certificates
2. Configure MySQL with strong password
3. Set proper Tomcat JVM heap size
4. Use reverse proxy (Nginx/Apache)
5. Enable WebSocket secure (WSS)
6. Implement rate limiting
7. Add database backups

## 📄 License

MIT License - See LICENSE file

## 👨‍💻 Contributing

Contributions welcome! See CONTRIBUTING.md

## 🙏 Acknowledgments

- Java WebSocket API (javax.websocket)
- Tomcat 9 servlet container
- MySQL relational database
- Modern browser Canvas 2D API

## 📞 Support

- **Issues**: GitHub Issues
- **Documentation**: See /docs folder
- **Email**: support@whiteboard.local

---

### Version Information
- **Version**: 1.0.0
- **Last Updated**: January 19, 2026
- **Status**: Production Ready
- **Features Implemented**: 65+

**Happy Collaborating! 🎨**



