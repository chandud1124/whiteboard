package com.whiteboard.websocket;

import com.whiteboard.dao.DrawingEventDAO;
import com.whiteboard.dao.UserDAO;
import com.whiteboard.model.DrawingEvent;
import com.whiteboard.model.Room;
import com.whiteboard.model.User;
import com.whiteboard.util.AuthenticationUtil;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Optional;

/**
 * WebSocket endpoint for the collaborative whiteboard.
 * Handles real-time drawing synchronization between all connected clients.
 * Supports room-based collaboration with invite links and approval system.
 */
@ServerEndpoint("/whiteboard")
public class WhiteboardEndpoint {
    
    // Thread-safe set of all active sessions
    private static final Set<Session> sessions = 
        Collections.newSetFromMap(new ConcurrentHashMap<Session, Boolean>());
    
    // Room management - roomCode -> Room
    private static final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
    
    // Session to Room mapping - sessionId -> roomCode
    private static final ConcurrentHashMap<String, String> sessionToRoom = new ConcurrentHashMap<>();
    
    // Session to User mapping - sessionId -> userId
    private static final ConcurrentHashMap<String, Long> sessionToUser = new ConcurrentHashMap<>();
    
    // Session to Username mapping - sessionId -> username
    private static final ConcurrentHashMap<String, String> sessionToUsername = new ConcurrentHashMap<>();
    
    // DAOs for database operations
    private static final DrawingEventDAO drawingEventDAO = new DrawingEventDAO();
    private static final UserDAO userDAO = new UserDAO();
    
    // Enable/disable database persistence (set to false if DB not configured)
    private static final boolean PERSIST_TO_DATABASE = true;
    
    /**
     * Called when a new WebSocket connection is opened
     */
    @OnOpen
    public void onOpen(Session session) {
        sessions.add(session);
        String sessionId = session.getId();
        
        System.out.println("New connection: " + sessionId + " | Total clients: " + sessions.size());
        
        // Send welcome message to the new client
        try {
            String welcomeMessage = String.format(
                "{\"type\":\"welcome\",\"sessionId\":\"%s\",\"connectedClients\":%d}",
                sessionId, sessions.size()
            );
            session.getBasicRemote().sendText(welcomeMessage);
            
        } catch (IOException e) {
            System.err.println("Error sending welcome message: " + e.getMessage());
        }
    }
    
    /**
     * Called when a WebSocket connection is closed
     */
    @OnClose
    public void onClose(Session session, CloseReason reason) {
        sessions.remove(session);
        String sessionId = session.getId();
        
        // Remove from any room
        String roomCode = sessionToRoom.remove(sessionId);
        if (roomCode != null) {
            Room room = rooms.get(roomCode);
            if (room != null) {
                room.removeSession(session);
                
                // If owner left, notify remaining users and optionally close room
                if (room.isOwner(sessionId)) {
                    notifyRoomClosed(room, roomCode);
                    rooms.remove(roomCode);
                } else {
                    // Notify room about user leaving
                    broadcastToRoom(room, String.format(
                        "{\"type\":\"userLeft\",\"sessionId\":\"%s\",\"userCount\":%d}",
                        sessionId, room.getApprovedCount()
                    ), null);
                }
            }
        }
        
        System.out.println("Connection closed: " + sessionId + 
                          " | Reason: " + reason.getReasonPhrase() + 
                          " | Remaining clients: " + sessions.size());
    }
    
    /**
     * Called when a message is received from a client
     */
    @OnMessage
    public void onMessage(String message, Session senderSession) {
        System.out.println("Received from " + senderSession.getId() + ": " + message);
        
        try {
            // Parse the message type
            String messageType = extractMessageType(message);
            
            switch (messageType) {
                // Authentication
                case "register":
                    handleRegister(message, senderSession);
                    break;
                case "login":
                    handleLogin(message, senderSession);
                    break;
                case "logout":
                    handleLogout(senderSession);
                    break;
                // Room management
                case "createRoom":
                    handleCreateRoom(message, senderSession);
                    break;
                case "joinRoom":
                    handleJoinRoom(message, senderSession);
                    break;
                case "approveUser":
                    handleApproveUser(message, senderSession);
                    break;
                case "rejectUser":
                    handleRejectUser(message, senderSession);
                    break;
                case "leaveRoom":
                    handleLeaveRoom(senderSession);
                    break;
                // Drawing
                case "draw":
                    handleDrawEvent(message, senderSession);
                    break;
                case "clear":
                    handleClearCanvas(senderSession);
                    break;
                case "ping":
                    handlePing(senderSession);
                    break;
                default:
                    System.out.println("Unknown message type: " + messageType);
            }
            
        } catch (Exception e) {
            System.err.println("Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Called when an error occurs
     */
    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("WebSocket error for session " + session.getId() + ": " + throwable.getMessage());
        throwable.printStackTrace();
    }
    
    // ========================================
    // Authentication Handlers
    // ========================================
    
    /**
     * Handle user registration request
     */
    private void handleRegister(String message, Session session) {
        String username = extractField(message, "username");
        String email = extractField(message, "email");
        String password = extractField(message, "password");
        
        // Validation
        if (username == null || username.isEmpty()) {
            sendError(session, "Username is required");
            return;
        }
        if (!AuthenticationUtil.isValidUsername(username)) {
            sendError(session, "Username must be 3-50 characters (alphanumeric and underscore only)");
            return;
        }
        if (email == null || email.isEmpty()) {
            sendError(session, "Email is required");
            return;
        }
        if (!AuthenticationUtil.isValidEmail(email)) {
            sendError(session, "Invalid email format");
            return;
        }
        if (password == null || password.isEmpty()) {
            sendError(session, "Password is required");
            return;
        }
        if (!AuthenticationUtil.isValidPassword(password)) {
            sendError(session, "Password must be at least 6 characters");
            return;
        }
        
        // Check if username/email already exists
        if (userDAO.usernameExists(username)) {
            sendError(session, "Username already exists");
            return;
        }
        if (userDAO.emailExists(email)) {
            sendError(session, "Email already registered");
            return;
        }
        
        // Hash password and register user
        String passwordHash = AuthenticationUtil.hashPassword(password);
        User user = new User(username, email, passwordHash);
        long userId = userDAO.registerUser(user);
        
        if (userId > 0) {
            try {
                String response = String.format(
                    "{\"type\":\"registerSuccess\",\"userId\":%d,\"username\":\"%s\",\"message\":\"Registration successful. Please log in.\"}",
                    userId, username
                );
                session.getBasicRemote().sendText(response);
                System.out.println("User registered successfully: " + username);
            } catch (IOException e) {
                System.err.println("Error sending register response: " + e.getMessage());
            }
        } else {
            sendError(session, "Registration failed. Please try again.");
        }
    }
    
    /**
     * Handle user login request
     */
    private void handleLogin(String message, Session session) {
        String username = extractField(message, "username");
        String password = extractField(message, "password");
        
        if (username == null || username.isEmpty()) {
            sendError(session, "Username is required");
            return;
        }
        if (password == null || password.isEmpty()) {
            sendError(session, "Password is required");
            return;
        }
        
        // Find user by username
        Optional<User> userOpt = userDAO.findByUsername(username);
        if (!userOpt.isPresent()) {
            sendError(session, "Invalid username or password");
            return;
        }
        
        User user = userOpt.get();
        
        // Verify password
        if (!AuthenticationUtil.verifyPassword(password, user.getPasswordHash())) {
            sendError(session, "Invalid username or password");
            return;
        }
        
        // Update last login
        userDAO.updateLastLogin(user.getId());
        
        // Store session-to-user mapping
        sessionToUser.put(session.getId(), user.getId());
        sessionToUsername.put(session.getId(), user.getUsername());
        
        try {
            String token = AuthenticationUtil.generateToken();
            String response = String.format(
                "{\"type\":\"loginSuccess\",\"userId\":%d,\"username\":\"%s\",\"displayName\":\"%s\",\"token\":\"%s\"}",
                user.getId(), user.getUsername(), user.getDisplayName(), token
            );
            session.getBasicRemote().sendText(response);
            System.out.println("User logged in: " + username);
        } catch (IOException e) {
            System.err.println("Error sending login response: " + e.getMessage());
        }
    }
    
    /**
     * Handle user logout request
     */
    private void handleLogout(Session session) {
        String sessionId = session.getId();
        sessionToUser.remove(sessionId);
        sessionToUsername.remove(sessionId);
        
        try {
            session.getBasicRemote().sendText("{\"type\":\"logoutSuccess\"}");
        } catch (IOException e) {
            System.err.println("Error sending logout response: " + e.getMessage());
        }
        
        System.out.println("User logged out: " + sessionId);
    }
    
    // ========================================
    // Room Management Handlers
    // ========================================
    
    /**
     * Handle room creation request
     */
    private void handleCreateRoom(String message, Session session) {
        Room room = new Room(session);
        String roomCode = room.getRoomCode();
        
        rooms.put(roomCode, room);
        sessionToRoom.put(session.getId(), roomCode);
        
        try {
            String response = String.format(
                "{\"type\":\"roomCreated\",\"roomCode\":\"%s\",\"roomId\":\"%s\",\"isOwner\":true}",
                roomCode, room.getRoomId()
            );
            session.getBasicRemote().sendText(response);
            
            // Send room user count
            broadcastRoomUserCount(room);
            
            System.out.println("Room created: " + roomCode + " by " + session.getId());
            
        } catch (IOException e) {
            System.err.println("Error sending room created response: " + e.getMessage());
        }
    }
    
    /**
     * Handle join room request
     */
    private void handleJoinRoom(String message, Session session) {
        String roomCode = extractField(message, "roomCode");
        String username = extractField(message, "username");
        
        if (roomCode == null || roomCode.isEmpty()) {
            sendError(session, "Room code is required");
            return;
        }
        
        roomCode = roomCode.toUpperCase();
        Room room = rooms.get(roomCode);
        
        if (room == null) {
            sendError(session, "Room not found. Please check the code and try again.");
            return;
        }
        
        // Add to pending approval
        room.addPendingRequest(session, username);
        sessionToRoom.put(session.getId(), roomCode);
        
        try {
            // Notify the joining user they're waiting for approval
            String waitingResponse = String.format(
                "{\"type\":\"waitingApproval\",\"roomCode\":\"%s\"}",
                roomCode
            );
            session.getBasicRemote().sendText(waitingResponse);
            
            // Notify room owner about the pending request
            Session ownerSession = room.getOwnerSession();
            if (ownerSession != null && ownerSession.isOpen()) {
                String pendingRequest = String.format(
                    "{\"type\":\"joinRequest\",\"sessionId\":\"%s\",\"username\":\"%s\",\"pendingCount\":%d}",
                    session.getId(),
                    username != null ? username : "Anonymous",
                    room.getPendingCount()
                );
                ownerSession.getBasicRemote().sendText(pendingRequest);
            }
            
            System.out.println("Join request for room " + roomCode + " from " + session.getId() + " (" + username + ")");
            
        } catch (IOException e) {
            System.err.println("Error handling join room: " + e.getMessage());
        }
    }
    
    /**
     * Handle user approval by room owner
     */
    private void handleApproveUser(String message, Session ownerSession) {
        String roomCode = sessionToRoom.get(ownerSession.getId());
        if (roomCode == null) {
            sendError(ownerSession, "You are not in a room");
            return;
        }
        
        Room room = rooms.get(roomCode);
        if (room == null || !room.isOwner(ownerSession)) {
            sendError(ownerSession, "Only room owner can approve users");
            return;
        }
        
        String targetSessionId = extractField(message, "sessionId");
        Session targetSession = findSessionById(targetSessionId);
        
        if (targetSession == null || !room.isPending(targetSession)) {
            sendError(ownerSession, "User request not found or already processed");
            return;
        }
        
        // Approve the user
        room.approveSession(targetSession);
        
        try {
            // Notify the approved user
            String approvedResponse = String.format(
                "{\"type\":\"approved\",\"roomCode\":\"%s\",\"userCount\":%d}",
                roomCode, room.getApprovedCount()
            );
            targetSession.getBasicRemote().sendText(approvedResponse);
            
            // Send canvas history to the new user
            if (PERSIST_TO_DATABASE) {
                sendCanvasHistory(targetSession, roomCode);
            }
            
            // Notify all room members about new user
            broadcastToRoom(room, String.format(
                "{\"type\":\"userJoined\",\"sessionId\":\"%s\",\"userCount\":%d}",
                targetSessionId, room.getApprovedCount()
            ), null);
            
            // Update owner's pending count
            String pendingUpdate = String.format(
                "{\"type\":\"pendingUpdate\",\"pendingCount\":%d}",
                room.getPendingCount()
            );
            ownerSession.getBasicRemote().sendText(pendingUpdate);
            
            System.out.println("User " + targetSessionId + " approved for room " + roomCode);
            
        } catch (IOException e) {
            System.err.println("Error approving user: " + e.getMessage());
        }
    }
    
    /**
     * Handle user rejection by room owner
     */
    private void handleRejectUser(String message, Session ownerSession) {
        String roomCode = sessionToRoom.get(ownerSession.getId());
        if (roomCode == null) return;
        
        Room room = rooms.get(roomCode);
        if (room == null || !room.isOwner(ownerSession)) return;
        
        String targetSessionId = extractField(message, "sessionId");
        Session targetSession = findSessionById(targetSessionId);
        
        if (targetSession == null) return;
        
        room.rejectSession(targetSession);
        sessionToRoom.remove(targetSessionId);
        
        try {
            // Notify the rejected user
            targetSession.getBasicRemote().sendText("{\"type\":\"rejected\"}");
            
            // Update owner's pending count
            String pendingUpdate = String.format(
                "{\"type\":\"pendingUpdate\",\"pendingCount\":%d}",
                room.getPendingCount()
            );
            ownerSession.getBasicRemote().sendText(pendingUpdate);
            
            System.out.println("User " + targetSessionId + " rejected from room " + roomCode);
            
        } catch (IOException e) {
            System.err.println("Error rejecting user: " + e.getMessage());
        }
    }
    
    /**
     * Handle user leaving a room
     */
    private void handleLeaveRoom(Session session) {
        String sessionId = session.getId();
        String roomCode = sessionToRoom.remove(sessionId);
        
        if (roomCode == null) return;
        
        Room room = rooms.get(roomCode);
        if (room == null) return;
        
        room.removeSession(session);
        
        if (room.isOwner(sessionId)) {
            // Owner left - close the room
            notifyRoomClosed(room, roomCode);
            rooms.remove(roomCode);
        } else {
            // Regular user left
            broadcastToRoom(room, String.format(
                "{\"type\":\"userLeft\",\"sessionId\":\"%s\",\"userCount\":%d}",
                sessionId, room.getApprovedCount()
            ), null);
        }
        
        try {
            session.getBasicRemote().sendText("{\"type\":\"leftRoom\"}");
        } catch (IOException e) {
            System.err.println("Error sending leftRoom: " + e.getMessage());
        }
    }
    
    // ========================================
    // Drawing Handlers
    // ========================================
    
    /**
     * Handle a draw event - broadcast to room members and optionally save to database
     */
    private void handleDrawEvent(String message, Session senderSession) {
        String roomCode = sessionToRoom.get(senderSession.getId());
        
        // Check if user is in a room and approved
        Room room = roomCode != null ? rooms.get(roomCode) : null;
        if (room != null && !room.isApproved(senderSession)) {
            return; // Not approved, ignore drawing
        }
        
        // Parse the drawing event
        DrawingEvent event = DrawingEvent.fromJson(message);
        event.setSessionId(senderSession.getId());
        
        // Save to database if enabled
        if (PERSIST_TO_DATABASE) {
            try {
                drawingEventDAO.saveEvent(event);
            } catch (Exception e) {
                System.err.println("Failed to save to database: " + e.getMessage());
            }
        }
        
        // Broadcast to room members or all connected clients
        String broadcastMessage = event.toJson();
        
        if (room != null) {
            broadcastToRoom(room, broadcastMessage, null);
        } else {
            broadcast(broadcastMessage);
        }
    }
    
    /**
     * Handle clear canvas request
     */
    private void handleClearCanvas(Session senderSession) {
        String roomCode = sessionToRoom.get(senderSession.getId());
        
        System.out.println("Canvas clear requested by: " + senderSession.getId());
        
        // Clear database if enabled
        if (PERSIST_TO_DATABASE) {
            drawingEventDAO.clearAllEvents();
        }
        
        // Broadcast clear command
        String clearMessage = "{\"type\":\"clear\"}";
        
        Room room = roomCode != null ? rooms.get(roomCode) : null;
        if (room != null) {
            broadcastToRoom(room, clearMessage, null);
        } else {
            broadcast(clearMessage);
        }
    }
    
    /**
     * Handle ping message (keep-alive)
     */
    private void handlePing(Session session) {
        try {
            session.getBasicRemote().sendText("{\"type\":\"pong\"}");
        } catch (IOException e) {
            System.err.println("Error sending pong: " + e.getMessage());
        }
    }
    
    // ========================================
    // Helper Methods
    // ========================================
    
    /**
     * Send canvas history to a newly connected/approved client
     */
    private void sendCanvasHistory(Session session, String roomCode) {
        try {
            List<DrawingEvent> events = drawingEventDAO.getAllEvents();
            
            if (!events.isEmpty()) {
                // Send history start marker
                session.getBasicRemote().sendText("{\"type\":\"historyStart\"}");
                
                // Send each event
                for (DrawingEvent event : events) {
                    session.getBasicRemote().sendText(event.toJson());
                }
                
                // Send history end marker
                session.getBasicRemote().sendText("{\"type\":\"historyEnd\"}");
                
                System.out.println("Sent " + events.size() + " historical events to " + session.getId());
            }
        } catch (IOException e) {
            System.err.println("Error sending canvas history: " + e.getMessage());
        }
    }
    
    /**
     * Broadcast user count to room
     */
    private void broadcastRoomUserCount(Room room) {
        String message = String.format("{\"type\":\"userCount\",\"count\":%d}", room.getApprovedCount());
        broadcastToRoom(room, message, null);
    }
    
    /**
     * Notify all room members that room is closed
     */
    private void notifyRoomClosed(Room room, String roomCode) {
        String message = "{\"type\":\"roomClosed\",\"reason\":\"Owner left the room\"}";
        
        for (Session session : room.getApprovedSessions()) {
            if (session.isOpen() && !room.isOwner(session)) {
                try {
                    session.getBasicRemote().sendText(message);
                    sessionToRoom.remove(session.getId());
                } catch (IOException e) {
                    System.err.println("Error notifying room closed: " + e.getMessage());
                }
            }
        }
        
        // Also notify pending users
        for (Session session : room.getPendingApproval()) {
            if (session.isOpen()) {
                try {
                    session.getBasicRemote().sendText(message);
                    sessionToRoom.remove(session.getId());
                } catch (IOException e) {
                    System.err.println("Error notifying pending user: " + e.getMessage());
                }
            }
        }
    }
    
    /**
     * Broadcast a message to all approved room members
     */
    private void broadcastToRoom(Room room, String message, Session excludeSession) {
        for (Session session : room.getApprovedSessions()) {
            if (session.isOpen() && (excludeSession == null || !session.equals(excludeSession))) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (IOException e) {
                    System.err.println("Error broadcasting to room member: " + e.getMessage());
                }
            }
        }
    }
    
    /**
     * Broadcast a message to all connected clients (legacy - no room)
     */
    private void broadcast(String message) {
        for (Session session : sessions) {
            if (session.isOpen()) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (IOException e) {
                    System.err.println("Error broadcasting to " + session.getId() + ": " + e.getMessage());
                }
            }
        }
    }
    
    /**
     * Find a session by its ID
     */
    private Session findSessionById(String sessionId) {
        for (Session session : sessions) {
            if (session.getId().equals(sessionId)) {
                return session;
            }
        }
        return null;
    }
    
    /**
     * Send error message to a session
     */
    private void sendError(Session session, String errorMessage) {
        try {
            String error = String.format("{\"type\":\"error\",\"message\":\"%s\"}", errorMessage);
            session.getBasicRemote().sendText(error);
        } catch (IOException e) {
            System.err.println("Error sending error message: " + e.getMessage());
        }
    }
    
    /**
     * Extract message type from JSON
     */
    private String extractMessageType(String json) {
        return extractField(json, "type");
    }
    
    /**
     * Extract a field value from JSON string
     */
    private String extractField(String json, String fieldName) {
        String pattern = "\"" + fieldName + "\":\"";
        int start = json.indexOf(pattern);
        if (start == -1) return null;
        
        start += pattern.length();
        int end = json.indexOf("\"", start);
        if (end == -1) return null;
        
        return json.substring(start, end);
    }
    
    /**
     * Get the number of connected clients
     */
    public static int getConnectedClientCount() {
        return sessions.size();
    }
}
