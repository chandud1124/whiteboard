# Real-Time Collaborative Whiteboard - Testing Guide

## Test Environment Setup

### Prerequisites Verification
```bash
# 1. Verify Java is installed
java -version
# Expected: Java 11 or higher

# 2. Verify MySQL is running
mysql -u root -p -e "SELECT 1;"
# Expected: Query OK, no output

# 3. Verify Tomcat is accessible
curl http://localhost:8080/
# Expected: Tomcat home page (or 404 if no ROOT app)
```

## Pre-Deployment Checklist

- [ ] Java JDK 11+ installed
- [ ] Apache Tomcat 9+ downloaded and configured
- [ ] MySQL 8.0+ running and accessible
- [ ] Database schema created (`whiteboard_db` exists)
- [ ] Database credentials updated in `DatabaseConnection.java`
- [ ] Maven build completed successfully (whiteboard.war created)
- [ ] No port conflicts on 8080 (Tomcat), 3306 (MySQL)

## Deployment Steps

### 1. Prepare MySQL Database
```bash
# Login to MySQL
mysql -u root -p

# Execute at MySQL prompt:
CREATE DATABASE IF NOT EXISTS whiteboard_db;
USE whiteboard_db;

# Create tables
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

# Verify
SHOW TABLES;
DESCRIBE drawing_events;
EXIT;
```

### 2. Verify Database Credentials
Edit: `java-whiteboard-project/src/main/java/com/whiteboard/util/DatabaseConnection.java`

Ensure these match your MySQL setup:
```java
private static final String DB_URL = "jdbc:mysql://localhost:3306/whiteboard_db";
private static final String DB_USER = "root";
private static final String DB_PASSWORD = "your_mysql_password";
```

### 3. Deploy WAR File
```bash
# Copy WAR to Tomcat webapps (choose one method)

# Method A: Direct copy
cp java-whiteboard-project/target/whiteboard.war /path/to/tomcat/webapps/

# Method B: Verify file location
ls -lh java-whiteboard-project/target/whiteboard.war
# Should show: -rw-r--r--  1 user  staff  3.8M Jan 12 18:03 whiteboard.war
```

### 4. Start Tomcat
```bash
# Navigate to Tomcat bin directory
cd /path/to/tomcat/bin

# Start server
./startup.sh

# Verify startup
# - Wait 5-10 seconds
# - Check logs
tail -f ../logs/catalina.out

# Expected output:
# ...
# Server startup in X ms
# ...
```

### 5. Verify Deployment
```bash
# Check WAR was expanded
ls -la /path/to/tomcat/webapps/whiteboard/

# Expected files:
# - index.html
# - css/style.css
# - js/whiteboard.js
# - WEB-INF/
# - META-INF/

# Check logs for errors
grep -i "error\|exception" /path/to/tomcat/logs/catalina.out

# Should see no errors related to whiteboard deployment
```

## Functional Testing

### Test 1: Basic Application Load

**Objective**: Verify application loads in browser

**Steps**:
1. Open browser to: `http://localhost:8080/whiteboard/`
2. Wait for page to load (should see canvas and toolbar)
3. Check browser console (F12 → Console) for errors

**Expected Results**:
- [ ] Page loads without errors
- [ ] Canvas visible
- [ ] Toolbar elements visible (pen, color, stroke width)
- [ ] Room controls visible (Create Room, Join Room)
- [ ] Connection status shows "Connecting..." then "Connected"
- [ ] No JavaScript errors in console

**Pass/Fail**: ___________

---

### Test 2: WebSocket Connection

**Objective**: Verify WebSocket connects successfully

**Steps**:
1. Open application
2. Check connection status indicator in header
3. Open browser DevTools → Network tab
4. Look for WebSocket connection

**Expected Results**:
- [ ] Status dot turns green
- [ ] Status text shows "Connected"
- [ ] Network tab shows WebSocket (ws://localhost:8080/whiteboard/whiteboard)
- [ ] WebSocket status is "101 Switching Protocols"
- [ ] Session ID displayed in footer

**Pass/Fail**: ___________

---

### Test 3: Single User Drawing

**Objective**: Verify drawing works in a single browser

**Steps**:
1. Open application
2. Draw on canvas (mouse down → drag → mouse up)
3. Try different tools and colors
4. Change stroke width
5. Clear canvas

**Expected Results**:
- [ ] Pen tool draws lines
- [ ] Eraser tool removes content
- [ ] Color changes affect drawing color
- [ ] Stroke width slider changes brush size
- [ ] Clear All button clears entire canvas
- [ ] No lag or delays

**Pass/Fail**: ___________

---

### Test 4: Real-Time Multi-User Synchronization

**Objective**: Verify drawing syncs across multiple browsers in real-time

**Setup**:
- Open 2-3 browser windows/tabs to: `http://localhost:8080/whiteboard/`
- Wait for all to connect

**Steps**:
1. Draw in Window 1 while watching Window 2 and 3
2. Change color in Window 2 and draw
3. Use eraser in Window 3
4. Clear canvas in any window
5. Adjust stroke width in different windows

**Expected Results**:
- [ ] Drawing in Window 1 appears instantly in Windows 2 and 3
- [ ] Color changes reflect across all windows
- [ ] Eraser works across all windows
- [ ] Clear All clears canvas in all windows simultaneously
- [ ] No synchronization lag (< 100ms)
- [ ] All windows stay in sync

**Pass/Fail**: ___________

---

### Test 5: Room Creation

**Objective**: Verify room creation and room code generation

**Steps**:
1. In Window 1, click "Create Room"
2. Observe room code display
3. Copy room code
4. Verify format (6 uppercase alphanumeric)

**Expected Results**:
- [ ] "Create Room" button changes to "Leave Room"
- [ ] Room code badge appears in header
- [ ] Room code is 6 characters (A-Z, 2-9)
- [ ] Copy button copies code to clipboard
- [ ] "Share Room" button appears

**Pass/Fail**: ___________

---

### Test 6: Room Joining with Approval

**Objective**: Verify user can join room and request approval

**Setup**:
- Window 1: Room created and room code visible
- Window 2: Same application

**Steps (Window 2)**:
1. Click "Join Room"
2. Enter room code from Window 1
3. Enter username (e.g., "Alice")
4. Click "Join Room"
5. Modal should show "Waiting for Approval"

**Steps (Window 1)**:
1. Modal should appear: "Join Request: Alice wants to join"
2. Click "Approve"

**Steps (Window 2)**:
1. Modal closes
2. Notification shows "Approved, you can now draw"
3. User count updates

**Expected Results**:
- [ ] Join modal appears and closes
- [ ] Request received by room owner
- [ ] Approval modal shows correct username
- [ ] Approve/Reject buttons work
- [ ] Approved user sees notification
- [ ] User count updates in both windows

**Pass/Fail**: ___________

---

### Test 7: Room Rejection

**Objective**: Verify user can be rejected from room

**Setup**:
- Window 1: Room created
- Window 2: Sent join request

**Steps**:
1. In Window 1, click "Reject" on join request
2. Observe Window 2

**Expected Results**:
- [ ] Window 1: Join request disappears
- [ ] Window 2: Modal shows "Rejected"
- [ ] Window 2: User cannot draw until approved

**Pass/Fail**: ___________

---

### Test 8: Real-Time Drawing in Room

**Objective**: Verify only approved users can draw and changes sync

**Setup**:
- Window 1: Room created (owner)
- Window 2: User joined and approved
- Window 3: User waiting for approval

**Steps**:
1. Draw in Window 1 → should appear in Windows 2 and 3
2. Draw in Window 2 → should appear in Windows 1 and 3
3. Try drawing in Window 3 (should not work)
4. Owner approves Window 3 user
5. Window 3 receives drawing history
6. Window 3 can now draw → appears in Windows 1 and 2

**Expected Results**:
- [ ] Owner and approved users can draw
- [ ] Waiting users cannot draw
- [ ] New approved users receive drawing history
- [ ] All strokes sync across approved users
- [ ] Non-approved users see changes but cannot draw

**Pass/Fail**: ___________

---

### Test 9: Canvas History/Persistence

**Objective**: Verify drawing history persists in database

**Setup**:
- Room with 2 approved users
- Both have drawn on canvas

**Steps**:
1. Note the drawings in the room
2. New user joins room
3. Check if new user sees drawing history

**Expected Results**:
- [ ] New approved user receives all previous drawings
- [ ] Canvas history appears immediately on approval
- [ ] All strokes are correctly positioned and colored

**Pass/Fail**: ___________

---

### Test 10: Database Verification

**Objective**: Verify drawings are stored in database

**Setup**:
- Multiple users have drawn on whiteboard

**Steps**:
```bash
# Connect to MySQL
mysql -u root -p whiteboard_db

# At MySQL prompt:
SELECT COUNT(*) FROM drawing_events;
SELECT * FROM drawing_events LIMIT 5;
SELECT * FROM whiteboard_sessions WHERE is_active = 1;
```

**Expected Results**:
- [ ] `drawing_events` table has entries matching your drawings
- [ ] Fields show correct coordinates (x1, y1, x2, y2)
- [ ] Colors match what was drawn
- [ ] Tools are correct (pen, eraser)
- [ ] Timestamps are recent
- [ ] `whiteboard_sessions` shows active users

**Pass/Fail**: ___________

---

### Test 11: Keyboard Shortcuts

**Objective**: Verify keyboard shortcuts work

**Steps**:
1. Press `P` → should select Pen tool
2. Press `E` → should select Eraser tool
3. Press `C` → should clear canvas
4. Press `D` → should download canvas
5. Press `[` → should decrease stroke width
6. Press `]` → should increase stroke width

**Expected Results**:
- [ ] All shortcuts work as expected
- [ ] Tool buttons update to show selection
- [ ] Clear/download dialogs appear

**Pass/Fail**: ___________

---

### Test 12: Mobile Responsiveness

**Objective**: Verify application works on mobile/tablet

**Steps**:
1. Open on mobile device or use DevTools device emulation (F12)
2. Test touch drawing
3. Test tool selection
4. Test color picker
5. Verify layout adapts

**Expected Results**:
- [ ] Touch drawing works (mousedown/move/up not needed)
- [ ] Toolbar adapts to smaller screen
- [ ] Canvas fills viewport
- [ ] No horizontal scrolling
- [ ] All buttons accessible

**Pass/Fail**: ___________

---

### Test 13: Room Owner Disconnection

**Objective**: Verify room closes when owner leaves

**Setup**:
- Window 1: Room owner with 2 members
- Window 2, 3: Regular room members

**Steps**:
1. In Window 1, click "Leave Room" or close browser
2. Observe Windows 2 and 3

**Expected Results**:
- [ ] Windows 2 and 3 receive "Room Closed" message
- [ ] Room controls reset in Windows 2 and 3
- [ ] Users can create/join new room

**Pass/Fail**: ___________

---

### Test 14: Concurrent Drawing

**Objective**: Verify multiple users can draw simultaneously

**Setup**:
- 3+ users in same room

**Steps**:
1. All users draw simultaneously on different canvas areas
2. Each user draws different shapes/colors
3. Observe all strokes appear correctly

**Expected Results**:
- [ ] No dropped strokes
- [ ] All colors appear correctly
- [ ] No overlapping/corruption of drawings
- [ ] Strokes appear in correct order
- [ ] No lag with multiple concurrent users

**Pass/Fail**: ___________

---

### Test 15: Error Handling

**Objective**: Verify application handles errors gracefully

**Steps**:
1. Close MySQL database
2. Try drawing → should show error gracefully
3. Restart MySQL
4. Application should recover
5. Disconnect network (disable WiFi)
6. Try to draw → should show connection error
7. Reconnect network

**Expected Results**:
- [ ] Error messages are user-friendly
- [ ] Application doesn't crash
- [ ] Recovery works after errors
- [ ] Connection status updates

**Pass/Fail**: ___________

---

## Performance Testing

### Test 16: Drawing Performance

**Objective**: Verify smooth drawing with many strokes

**Setup**:
- Multiple users in same room

**Procedure**:
1. Rapidly draw many strokes
2. Monitor performance
3. Check CPU usage
4. Observe for lag or stuttering

**Metrics to Track**:
- [ ] Frame rate remains smooth (60 FPS)
- [ ] No dropped frames when drawing
- [ ] Broadcast latency < 100ms
- [ ] CPU usage < 30%
- [ ] Memory usage stable

**Pass/Fail**: ___________

---

### Test 17: Large Drawing History

**Objective**: Verify performance with large drawing history

**Setup**:
- 1000+ strokes in database

**Procedure**:
1. New user joins room
2. Observe time to receive history
3. Canvas renders without lag
4. User can continue drawing

**Metrics**:
- [ ] History load time < 2 seconds
- [ ] Canvas renders smoothly after history
- [ ] No memory leaks

**Pass/Fail**: ___________

---

## Stress Testing

### Test 18: Many Concurrent Users

**Objective**: Verify stability with many simultaneous connections

**Setup**:
- 10+ browser windows/tabs

**Procedure**:
1. All connected to same room
2. Each user draws
3. Monitor server logs
4. Check memory usage

**Expected Results**:
- [ ] No dropped connections
- [ ] Drawings sync across all users
- [ ] Server logs show no errors
- [ ] Memory usage acceptable

**Pass/Fail**: ___________

---

## Browser Compatibility Testing

Test on:
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Expected Results**:
- [ ] All features work in all browsers
- [ ] No console errors
- [ ] Layout correct in all browsers

**Pass/Fail**: ___________

---

## Post-Deployment Verification

```bash
# 1. Check WAR deployment
ls -la /path/to/tomcat/webapps/whiteboard/

# 2. Verify no startup errors
grep "ERROR\|SEVERE" /path/to/tomcat/logs/catalina.out

# 3. Check database connection
mysql -u root -p whiteboard_db -e "SELECT COUNT(*) FROM drawing_events;"

# 4. Verify WebSocket is accessible
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:8080/whiteboard/whiteboard

# 5. Check firewall (if remote access needed)
telnet localhost 8080
```

## Final Checklist

- [ ] All tests passed
- [ ] No errors in Tomcat logs
- [ ] Database is working correctly
- [ ] WebSocket communication established
- [ ] Real-time synchronization verified
- [ ] Room functionality working
- [ ] Drawing history persists
- [ ] Application handles errors gracefully
- [ ] Performance is acceptable
- [ ] No console errors in browser

## Reporting Issues

If any test fails:

1. **Check Logs**:
   ```bash
   # Tomcat logs
   tail -100 /path/to/tomcat/logs/catalina.out
   
   # MySQL logs
   tail -100 /var/log/mysql/error.log
   
   # Browser console
   F12 → Console tab
   ```

2. **Verify Configuration**:
   - Database URL and credentials
   - Tomcat port (default 8080)
   - MySQL port (default 3306)
   - WebSocket endpoint path

3. **Check Prerequisites**:
   - Java version >= 11
   - MySQL running and accessible
   - Tomcat running and accessible
   - No port conflicts

4. **Try Debug Mode**:
   - Add console logs to JavaScript
   - Enable debug logging in Tomcat
   - Use MySQL query logs

---

**Testing Completed**: ___________
**Date**: ___________
**Tester Name**: ___________
**Notes**: ___________
