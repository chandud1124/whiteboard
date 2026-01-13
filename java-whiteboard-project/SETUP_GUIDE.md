# Real-Time Collaborative Whiteboard - Complete Setup Guide

## Overview

This is a complete web-based real-time collaborative whiteboard application that runs entirely on localhost. Multiple users can draw simultaneously, and all drawings appear instantly on every connected client. Features include:

- **Real-time Drawing Synchronization**: All strokes appear instantly across all connected clients
- **Room-Based Collaboration**: Create rooms with unique codes and share them with others
- **User Approval System**: Room owners can approve/reject join requests
- **Persistent Canvas**: Drawing history is stored in MySQL database
- **Multiple Tools**: Pen and eraser tools with customizable colors and stroke widths
- **Core Java WebSocket Backend**: No Spring/Spring Boot, pure Java WebSocket API (JSR-356)
- **Vanilla JavaScript Frontend**: Pure HTML5 Canvas and WebSocket client implementation

## Technology Stack

### Backend
- **Runtime**: Java JDK 11+
- **Server**: Apache Tomcat 9+
- **WebSocket**: Java WebSocket API (JSR-356)
- **Database**: MySQL 8.0+
- **Build Tool**: Maven 3.6+
- **Connection Pool**: JDBC (raw connections with proper management)

### Frontend
- **HTML5**: Semantic HTML with Canvas API
- **CSS3**: Modern CSS with Flexbox and Grid
- **JavaScript**: Vanilla ES6+ (no frameworks)
- **WebSocket**: Native WebSocket API

### Dependencies
- `javax.websocket-api:1.1` - WebSocket API
- `javax.servlet-api:4.0.1` - Servlet API for Tomcat
- `mysql-connector-java:8.0.33` - MySQL JDBC Driver

## Prerequisites

Before starting, ensure you have the following installed:

### 1. Java Development Kit (JDK) 11 or higher
```bash
# Check Java version
java -version

# If not installed:
# macOS: brew install openjdk@11
# Ubuntu: sudo apt-get install openjdk-11-jdk
# Windows: Download from https://www.oracle.com/java/technologies/javase-jdk11-downloads.html
```

### 2. Apache Maven 3.6+
```bash
# Check Maven version
mvn -version

# If not installed:
# macOS: brew install maven
# Ubuntu: sudo apt-get install maven
# Windows: Download from https://maven.apache.org/download.cgi
```

### 3. MySQL Server 8.0+
```bash
# Check MySQL version
mysql --version

# If not installed:
# macOS: brew install mysql
# Ubuntu: sudo apt-get install mysql-server
# Windows: Download from https://dev.mysql.com/downloads/mysql/

# Start MySQL (if not running)
# macOS: brew services start mysql
# Ubuntu: sudo systemctl start mysql
# Windows: Use MySQL Installer or services
```

### 4. Apache Tomcat 9+
Download from: https://tomcat.apache.org/download-9.cgi
- Extract to a convenient location (e.g., ~/tomcat or C:\tomcat)
- Note the Tomcat home directory for later

## Step-by-Step Setup

### Step 1: Set Up MySQL Database

```bash
# Connect to MySQL
mysql -u root -p

# At MySQL prompt, run the schema creation:
SOURCE /path/to/java-whiteboard-project/sql/schema.sql;

# Or manually run these commands:
CREATE DATABASE IF NOT EXISTS whiteboard_db;
USE whiteboard_db;

CREATE TABLE IF NOT EXISTS drawing_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    x1 INT NOT NULL,
    y1 INT NOT NULL,
    x2 INT NOT NULL,
    y2 INT NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    tool VARCHAR(20) DEFAULT 'pen',
    stroke_width INT DEFAULT 3,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS whiteboard_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(100),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

# Verify tables were created
SHOW TABLES;
DESCRIBE drawing_events;
DESCRIBE whiteboard_sessions;
```

### Step 2: Configure Database Connection

Edit the file: `java-whiteboard-project/src/main/java/com/whiteboard/util/DatabaseConnection.java`

Update these values according to your MySQL setup:

```java
private static final String DB_URL = "jdbc:mysql://localhost:3306/whiteboard_db";
private static final String DB_USER = "root";
private static final String DB_PASSWORD = "your_mysql_password";  // Change this!
```

**Important**: If you want to use a non-root user for better security:

```sql
-- In MySQL:
CREATE USER 'whiteboard_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON whiteboard_db.* TO 'whiteboard_user'@'localhost';
FLUSH PRIVILEGES;
```

Then update DatabaseConnection.java:
```java
private static final String DB_USER = "whiteboard_user";
private static final String DB_PASSWORD = "secure_password_here";
```

### Step 3: Build the Java Project with Maven

```bash
# Navigate to the java-whiteboard-project directory
cd java-whiteboard-project

# Clean previous builds and create a fresh WAR file
mvn clean package

# Expected output:
# [INFO] Building war: .../target/whiteboard.war
# [INFO] BUILD SUCCESS
```

**If you encounter build errors**:
- Ensure JDK 11+ is in your PATH: `java -version`
- Ensure Maven is in your PATH: `mvn -version`
- Check that all source files exist in `src/main/java/com/whiteboard/`

### Step 4: Deploy to Apache Tomcat

#### Option A: Copy WAR to Tomcat (Recommended)

```bash
# Copy the WAR file to Tomcat's webapps directory
cp java-whiteboard-project/target/whiteboard.war /path/to/tomcat/webapps/

# OR on Windows:
# copy java-whiteboard-project\target\whiteboard.war C:\tomcat\webapps\
```

#### Option B: Configure Tomcat via catalina.properties

Add to `tomcat/conf/catalina.properties`:
```properties
whiteboard=/path/to/java-whiteboard-project/target/whiteboard
```

### Step 5: Start Apache Tomcat

```bash
# Navigate to Tomcat bin directory
cd /path/to/tomcat/bin

# Start Tomcat
# macOS/Linux:
./startup.sh

# Windows:
# startup.bat

# You should see output like:
# Using CATALINA_BASE:   /path/to/tomcat
# Using CATALINA_HOME:   /path/to/tomcat
# ...
# Server startup in [X] ms
```

**Verify Tomcat Started**:
- Open browser: http://localhost:8080/whiteboard/
- You should see the whiteboard application

### Step 6: Access the Whiteboard Application

Open your browser and navigate to:

```
http://localhost:8080/whiteboard/
```

You should see the collaborative whiteboard interface with:
- Canvas area for drawing
- Toolbar with pen/eraser tools
- Color picker and stroke width slider
- Room controls (Create Room, Join Room)
- Connection status indicator
- User count display

## Usage Guide

### Single User (Without Rooms)

1. Open http://localhost:8080/whiteboard/ in a browser
2. Start drawing on the canvas with the mouse
3. The drawing is saved to the database automatically

### Multi-User Collaboration (With Rooms)

#### For the Room Owner/Host:
1. Click "Create Room" button
2. Share the room code with other users
3. Other users' join requests will appear
4. Click "Approve" or "Reject" for each request
5. Once approved, all approved users can draw together

#### For Users Joining a Room:
1. Click "Join Room" button
2. Enter the room code shared by the owner
3. Optionally enter a username
4. Wait for owner to approve your request
5. Once approved, you can start drawing

### Drawing Features
- **Pen Tool**: Draw lines on the canvas
- **Eraser Tool**: Erase parts of the drawing
- **Color Picker**: Choose custom colors or use presets
- **Stroke Width**: Adjust brush size (1-50px)
- **Clear All**: Clear the entire canvas
- **Download**: Save canvas as PNG image

## Project Structure

```
java-whiteboard-project/
├── pom.xml                          # Maven project configuration
├── sql/
│   └── schema.sql                   # Database schema
├── src/
│   └── main/
│       ├── java/
│       │   └── com/whiteboard/
│       │       ├── dao/
│       │       │   └── DrawingEventDAO.java    # Database operations
│       │       ├── model/
│       │       │   ├── DrawingEvent.java       # Event model
│       │       │   └── Room.java               # Room model
│       │       ├── util/
│       │       │   └── DatabaseConnection.java # JDBC connection pool
│       │       └── websocket/
│       │           └── WhiteboardEndpoint.java # WebSocket server
│       └── webapp/
│           ├── index.html                      # Main HTML
│           ├── css/
│           │   └── style.css                   # Styling
│           ├── js/
│           │   └── whiteboard.js               # Client logic
│           └── WEB-INF/
│               └── web.xml                     # Deployment descriptor
└── target/
    └── whiteboard.war               # Compiled WAR file (after build)
```

## WebSocket Protocol

### Message Types

#### Drawing Message (Client → Server → All)
```json
{
  "type": "draw",
  "x1": 100,
  "y1": 150,
  "x2": 110,
  "y2": 160,
  "color": "#000000",
  "tool": "pen",
  "strokeWidth": 3,
  "sessionId": "..."
}
```

#### Create Room (Client → Server)
```json
{
  "type": "createRoom"
}
```

#### Join Room (Client → Server)
```json
{
  "type": "joinRoom",
  "roomCode": "ABCDEF",
  "username": "John"
}
```

#### Approve User (Owner → Server)
```json
{
  "type": "approveUser",
  "sessionId": "..."
}
```

#### Clear Canvas (Client → Server → All)
```json
{
  "type": "clear"
}
```

#### Ping/Keep-Alive (Client → Server)
```json
{
  "type": "ping"
}
```

## Troubleshooting

### Issue: "Connection refused" on localhost:8080

**Solution**:
```bash
# Check if Tomcat is running
ps aux | grep tomcat

# Check Tomcat logs
tail -f /path/to/tomcat/logs/catalina.out

# Restart Tomcat
cd /path/to/tomcat/bin
./shutdown.sh
./startup.sh
```

### Issue: "Database connection failed"

**Solution**:
```bash
# Check MySQL is running
mysql -u root -p -e "SELECT 1;"

# Verify database exists
mysql -u root -p -e "USE whiteboard_db; SHOW TABLES;"

# Check DB credentials in DatabaseConnection.java match your MySQL setup
```

### Issue: WebSocket connection fails

**Solution**:
- Check browser console (F12 → Console tab)
- Verify WebSocket URL is correct: `ws://localhost:8080/whiteboard/whiteboard`
- Ensure Tomcat started without errors
- Check Tomcat logs in `tomcat/logs/catalina.out`

### Issue: Maven build fails

**Solution**:
```bash
# Clean Maven cache
rm -rf ~/.m2/repository
mvn clean package

# Check Java version
java -version  # Should be 11+

# Check Maven version
mvn -version
```

### Issue: "Drawing not appearing in other browsers"

**Solution**:
- Verify WebSocket connection is active (green dot in status)
- Check if users are in the same room (same room code)
- For room mode, ensure user is "Approved" before drawing
- Check Tomcat logs for errors

## Performance Optimization Tips

1. **Database**: Indexes on `session_id` and `timestamp` improve query performance
2. **WebSocket**: Messages are broadcasted directly without buffering
3. **Canvas**: Drawing is optimized using stroke segments rather than pixel-by-pixel
4. **Memory**: Old events can be cleaned up via `DrawingEventDAO.deleteOldEvents(hoursOld)`

## Security Considerations

**Current Implementation** (Localhost Use):
- No authentication required
- Database uses default MySQL user
- WebSocket has no encryption (ws://)

**For Production**, consider:
- Implement user authentication with JWT
- Use encrypted WebSocket (wss://)
- Add rate limiting to prevent abuse
- Validate all user inputs
- Use database user with limited privileges
- Implement IP whitelisting

## Stopping the Servers

```bash
# Stop Tomcat
cd /path/to/tomcat/bin
./shutdown.sh

# Stop MySQL
# macOS: brew services stop mysql
# Ubuntu: sudo systemctl stop mysql
# Windows: Use Services or MySQL Installer
```

## Additional Resources

- [Java WebSocket API Documentation](https://javaee.github.io/javaee-spec/javadocs/javax/websocket/package-summary.html)
- [Apache Tomcat Documentation](https://tomcat.apache.org/tomcat-9.0-doc/)
- [MySQL JDBC Driver](https://dev.mysql.com/downloads/connector/j/)
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the Tomcat logs in `tomcat/logs/`
3. Check browser console (F12 → Console)
4. Verify all prerequisites are installed and configured correctly
5. Ensure MySQL database is set up with the correct schema
6. Confirm database credentials in DatabaseConnection.java match your setup

## License

This project is provided as-is for educational and development purposes.

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Tested on**: Java 11+, Tomcat 9+, MySQL 8.0+
