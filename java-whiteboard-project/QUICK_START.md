# Quick Start Guide

## Prerequisites Checklist

- [ ] Java JDK 11+ installed (`java -version`)
- [ ] Apache Tomcat 9+ downloaded
- [ ] MySQL 8.0+ running on localhost
- [ ] Maven installed (optional, for easier builds)

## Step-by-Step Instructions

### 1. Set Up MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database and tables
SOURCE /path/to/java-whiteboard-project/sql/schema.sql;

# Verify
USE whiteboard_db;
SHOW TABLES;
```

### 2. Configure Database Connection

Edit `src/main/java/com/whiteboard/util/DatabaseConnection.java`:

```java
private static final String DB_URL = "jdbc:mysql://localhost:3306/whiteboard_db";
private static final String DB_USER = "root";
private static final String DB_PASSWORD = "YOUR_PASSWORD_HERE";  // ← Change this!
```

### 3. Build the Project

**Option A: Using Maven (Recommended)**
```bash
cd java-whiteboard-project
mvn clean package
```
This creates `target/whiteboard.war`

**Option B: Manual Compilation**
```bash
# Create build directory
mkdir -p build/WEB-INF/classes

# Compile Java files
javac -cp "path/to/tomcat/lib/*" \
      -d build/WEB-INF/classes \
      src/main/java/com/whiteboard/**/*.java

# Copy web resources
cp -r src/main/webapp/* build/
cp src/main/webapp/WEB-INF/web.xml build/WEB-INF/

# Create WAR file
cd build
jar -cvf whiteboard.war .
```

### 4. Deploy to Tomcat

```bash
# Copy WAR to Tomcat
cp target/whiteboard.war $TOMCAT_HOME/webapps/

# OR for manual build:
cp build/whiteboard.war $TOMCAT_HOME/webapps/
```

### 5. Add MySQL Driver to Tomcat

```bash
# Download mysql-connector-java-8.x.x.jar and copy to:
cp mysql-connector-java-8.x.x.jar $TOMCAT_HOME/lib/
```

### 6. Start Tomcat

```bash
# Linux/Mac
$TOMCAT_HOME/bin/startup.sh

# Windows
$TOMCAT_HOME\bin\startup.bat

# Check logs
tail -f $TOMCAT_HOME/logs/catalina.out
```

### 7. Open the Application

Open multiple browser windows to:
```
http://localhost:8080/whiteboard/
```

Draw in one window - see it appear in others!

## Troubleshooting

### WebSocket Connection Failed
- Ensure Tomcat is running: `curl http://localhost:8080`
- Check WebSocket URL in `whiteboard.js`: `ws://localhost:8080/whiteboard/whiteboard`

### Database Connection Error
- Verify MySQL is running: `mysql -u root -p`
- Check credentials in `DatabaseConnection.java`
- Ensure database exists: `SHOW DATABASES;`

### Class Not Found: MySQL Driver
- Copy `mysql-connector-java-8.x.x.jar` to `$TOMCAT_HOME/lib/`
- Restart Tomcat

### 404 Error
- Verify WAR deployed: check `$TOMCAT_HOME/webapps/whiteboard/`
- Check `$TOMCAT_HOME/logs/localhost*.log` for errors

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| P | Pen tool |
| E | Eraser tool |
| C | Clear canvas |
| D | Download canvas |
| [ | Decrease stroke |
| ] | Increase stroke |

## Testing Multi-User

1. Open `http://localhost:8080/whiteboard/` in Chrome
2. Open the same URL in Firefox (or another browser)
3. Draw in one browser - watch it sync to the other!

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Clients                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Client 1 │  │ Client 2 │  │ Client 3 │   ...        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│       └─────────────┼─────────────┘                     │
│                     │ WebSocket (ws://)                 │
└─────────────────────┼───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Apache Tomcat (localhost:8080)             │
│  ┌────────────────────────────────────────────────┐    │
│  │           WhiteboardEndpoint.java               │    │
│  │  • Manages WebSocket sessions                   │    │
│  │  • Broadcasts drawing events                    │    │
│  │  • Handles connect/disconnect                   │    │
│  └────────────────────┬───────────────────────────┘    │
│                       │                                 │
│  ┌────────────────────▼───────────────────────────┐    │
│  │           DrawingEventDAO.java                  │    │
│  │  • JDBC database operations                     │    │
│  │  • Save/retrieve drawing events                 │    │
│  └────────────────────┬───────────────────────────┘    │
└───────────────────────┼─────────────────────────────────┘
                        │ JDBC
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 MySQL (localhost:3306)                  │
│  ┌────────────────────────────────────────────────┐    │
│  │              whiteboard_db                      │    │
│  │  • drawing_events table                         │    │
│  │  • whiteboard_sessions table                    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```
