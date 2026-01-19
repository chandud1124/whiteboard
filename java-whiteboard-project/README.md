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

1. **Java JDK 21+** - [Download](https://adoptium.net/)
2. **Apache Tomcat 9+** - [Download](https://tomcat.apache.org/download-90.cgi)
3. **MySQL 8.0+** - [Download](https://dev.mysql.com/downloads/mysql/)
4. **Maven 3.6+** - [Download](https://maven.apache.org/download.cgi)

## Setup Instructions

### Step 1: Set Up MySQL Database

1. Start MySQL server
2. Create the database and run the schema:
   ```bash
   mysql -u root -p < sql/schema.sql
   ```

### Step 2: Build and Deploy

1. Build the project:
   ```bash
   mvn clean package
   ```

2. Deploy to Tomcat:
   ```bash
   cp target/whiteboard.war /opt/homebrew/opt/tomcat@9/libexec/webapps/
   ```

### Step 3: Start Tomcat

1. Start Tomcat server:
   ```bash
   JAVA_HOME=$(brew --prefix openjdk) /opt/homebrew/opt/tomcat@9/libexec/bin/catalina.sh start
   ```

2. Access the application:
   ```
   http://localhost:8080/whiteboard/
   ```

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
