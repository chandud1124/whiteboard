# Real-Time Collaborative Whiteboard (Java/Tomcat/MySQL)

A web-based real-time collaborative whiteboard running on localhost using Core Java, WebSocket API (JSR-356), Apache Tomcat, and MySQL.

## Project Structure

```
java-whiteboard-project/
├── src/
│   └── main/
│       ├── java/
│       │   └── com/
│       │       └── whiteboard/
│       │           ├── websocket/
│       │           │   └── WhiteboardEndpoint.java
│       │           ├── model/
│       │           │   └── DrawingEvent.java
│       │           ├── dao/
│       │           │   └── DrawingEventDAO.java
│       │           └── util/
│       │               └── DatabaseConnection.java
│       └── webapp/
│           ├── WEB-INF/
│           │   └── web.xml
│           ├── index.html
│           ├── css/
│           │   └── style.css
│           └── js/
│               └── whiteboard.js
├── sql/
│   └── schema.sql
└── pom.xml (if using Maven) or manual JAR instructions
```

## Prerequisites

1. **Java JDK 8+** - [Download](https://adoptium.net/)
2. **Apache Tomcat 9+** - [Download](https://tomcat.apache.org/download-90.cgi)
3. **MySQL 8.0+** - [Download](https://dev.mysql.com/downloads/mysql/)
4. **MySQL JDBC Driver** - [Download](https://dev.mysql.com/downloads/connector/j/)

## Setup Instructions

### Step 1: Set Up MySQL Database

1. Start MySQL server
2. Log in to MySQL:
   ```bash
   mysql -u root -p
   ```
3. Run the schema script:
   ```sql
   SOURCE /path/to/sql/schema.sql;
   ```

### Step 2: Configure Tomcat

1. Copy `mysql-connector-java-8.x.x.jar` to `TOMCAT_HOME/lib/`
2. Copy the WebSocket API JAR to `TOMCAT_HOME/lib/` (usually included)

### Step 3: Deploy the Application

**Option A: Manual Deployment**
1. Compile Java files with required dependencies
2. Create a WAR file structure
3. Copy to `TOMCAT_HOME/webapps/whiteboard/`

**Option B: Using Maven**
1. Run `mvn clean package`
2. Copy `target/whiteboard.war` to `TOMCAT_HOME/webapps/`

### Step 4: Start the Application

1. Start Tomcat:
   ```bash
   cd TOMCAT_HOME/bin
   ./startup.sh    # Linux/Mac
   startup.bat     # Windows
   ```
2. Open browser: `http://localhost:8080/whiteboard/`

## Features

- ✅ Real-time multi-user drawing
- ✅ Pen tool with color selection
- ✅ Eraser tool
- ✅ Adjustable stroke width
- ✅ Canvas clear function
- ✅ Instant synchronization across all clients
- ✅ Drawing events stored in MySQL database

## WebSocket Protocol

### Client → Server (JSON)
```json
{
  "type": "draw",
  "x1": 100,
  "y1": 150,
  "x2": 110,
  "y2": 160,
  "color": "#000000",
  "tool": "pen",
  "strokeWidth": 3
}
```

### Server → All Clients (Broadcast)
Same JSON format - server broadcasts to all connected sessions.

## Troubleshooting

- **WebSocket connection failed**: Ensure Tomcat is running on port 8080
- **Database connection error**: Check MySQL credentials in `DatabaseConnection.java`
- **ClassNotFoundException**: Ensure all JARs are in `TOMCAT_HOME/lib/`
