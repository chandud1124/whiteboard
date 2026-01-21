package com.whiteboard.websocket;

import com.whiteboard.dao.BoardDAO;
import com.whiteboard.dao.DrawingEventDAO;
import com.whiteboard.dao.GuestSessionDAO;
import com.whiteboard.dao.UserDAO;
import com.whiteboard.model.Board;
import com.whiteboard.model.DrawingEvent;
import com.whiteboard.model.GuestSession;
import com.whiteboard.model.Room;
import com.whiteboard.model.User;
import com.whiteboard.util.AuthenticationUtil;
import com.whiteboard.util.DatabaseConnection;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.Collections;
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

    // Auth token tracking - token -> userId and userId -> token
    private static final ConcurrentHashMap<String, Long> authTokens = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<Long, String> userToToken = new ConcurrentHashMap<>();
    
    // Session to Board mapping - sessionId -> boardId (for authenticated users)
    private static final ConcurrentHashMap<String, Long> sessionToBoard = new ConcurrentHashMap<>();
    
    // Guest session tracking - sessionId -> isGuest
    private static final ConcurrentHashMap<String, Boolean> guestSessions = new ConcurrentHashMap<>();
    
    // DAOs for database operations
    private static final BoardDAO boardDAO = new BoardDAO();
    private static final DrawingEventDAO drawingEventDAO = new DrawingEventDAO();
    private static final GuestSessionDAO guestSessionDAO = new GuestSessionDAO();
    private static final UserDAO userDAO = new UserDAO();
    
    // Enable/disable database persistence (set to false if DB not configured)
    private static final boolean PERSIST_TO_DATABASE = true;
    
    // Check database connectivity on class load
    static {
        if (PERSIST_TO_DATABASE) {
            try {
                boolean dbConnected = DatabaseConnection.testConnection();
                if (dbConnected) {
                    System.out.println("Database connection test successful");
                } else {
                    System.err.println("WARNING: Database connection test failed - some features may not work");
                }
            } catch (Exception e) {
                System.err.println("ERROR: Database connection test failed: " + e.getMessage());
            }
        }
    }
    
    /**
     * Called when a new WebSocket connection is opened
     */
    @OnOpen
    public void onOpen(Session session) {
        sessions.add(session);
        String sessionId = session.getId();

        // Increase max message size to support canvas auto-save payloads
        session.setMaxTextMessageBufferSize(10 * 1024 * 1024);
        session.setMaxBinaryMessageBufferSize(10 * 1024 * 1024);
        
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
                // Authentication & Guest
                case "guestMode":
                    handleGuestMode(message, senderSession);
                    break;
                case "register":
                    handleRegister(message, senderSession);
                    break;
                case "login":
                    handleLogin(message, senderSession);
                    break;
                case "restoreSession":
                    handleRestoreSession(message, senderSession);
                    break;
                case "logout":
                    handleLogout(senderSession);
                    break;
                // Board Management
                case "createBoard":
                    handleCreateBoard(message, senderSession);
                    break;
                case "getBoards":
                    handleGetBoards(senderSession);
                    break;
                case "openBoard":
                    handleOpenBoard(message, senderSession);
                    break;
                case "saveBoard":
                    handleSaveBoard(message, senderSession);
                    break;
                case "updateBoardTitle":
                    handleUpdateBoardTitle(message, senderSession);
                    break;
                case "deleteBoard":
                    handleDeleteBoard(message, senderSession);
                    break;
                case "duplicateBoard":
                    handleDuplicateBoard(message, senderSession);
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
                case "shape":
                    handleShapeEvent(message, senderSession);
                    break;
                case "chat":
                    handleChatMessage(message, senderSession);
                    break;
                case "clear":
                    handleClearCanvas(message, senderSession);
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
            sendAuthError(session, "registerFailed", "Username is required");
            return;
        }
        if (!AuthenticationUtil.isValidUsername(username)) {
            sendAuthError(session, "registerFailed", "Username must be 3-50 characters (alphanumeric and underscore only)");
            return;
        }
        if (email == null || email.isEmpty()) {
            sendAuthError(session, "registerFailed", "Email is required");
            return;
        }
        if (!AuthenticationUtil.isValidEmail(email)) {
            sendAuthError(session, "registerFailed", "Invalid email format");
            return;
        }
        if (password == null || password.isEmpty()) {
            sendAuthError(session, "registerFailed", "Password is required");
            return;
        }
        if (!AuthenticationUtil.isValidPassword(password)) {
            sendAuthError(session, "registerFailed", "Password must be at least 6 characters");
            return;
        }
        
        // Check database connectivity
        if (!DatabaseConnection.testConnection()) {
            sendAuthError(session, "registerFailed", "Database connection error. Please try again later.");
            return;
        }
        
        // Check if username/email already exists
        if (userDAO.usernameExists(username)) {
            sendAuthError(session, "registerFailed", "Username already exists");
            return;
        }
        if (userDAO.emailExists(email)) {
            sendAuthError(session, "registerFailed", "Email already registered");
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
            sendAuthError(session, "registerFailed", "Registration failed. Please try again.");
        }
    }
    
    /**
     * Handle user login request
     */
    private void handleLogin(String message, Session session) {
        String username = extractField(message, "username");
        String password = extractField(message, "password");
        
        if (username == null || username.isEmpty()) {
            sendAuthError(session, "loginFailed", "Username is required");
            return;
        }
        if (password == null || password.isEmpty()) {
            sendAuthError(session, "loginFailed", "Password is required");
            return;
        }
        
        // Check database connectivity
        if (!DatabaseConnection.testConnection()) {
            sendAuthError(session, "loginFailed", "Database connection error. Please try again later.");
            return;
        }
        
        // Find user by username
        Optional<User> userOpt = userDAO.findByUsername(username);
        if (!userOpt.isPresent()) {
            sendAuthError(session, "loginFailed", "Invalid username or password");
            return;
        }
        
        User user = userOpt.get();
        
        // Verify password
        if (!AuthenticationUtil.verifyPassword(password, user.getPasswordHash())) {
            sendAuthError(session, "loginFailed", "Invalid username or password");
            return;
        }
        
        // Update last login
        userDAO.updateLastLogin(user.getId());
        
        // Store session-to-user mapping
        sessionToUser.put(session.getId(), user.getId());
        sessionToUsername.put(session.getId(), user.getUsername());
        
        try {
            String token = AuthenticationUtil.generateToken();

            String existingToken = userToToken.put(user.getId(), token);
            if (existingToken != null) {
                authTokens.remove(existingToken);
            }
            authTokens.put(token, user.getId());

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
        Long userId = sessionToUser.get(sessionId);
        sessionToUser.remove(sessionId);
        sessionToUsername.remove(sessionId);
        sessionToBoard.remove(sessionId);
        guestSessions.remove(sessionId);

        if (userId != null) {
            String token = userToToken.remove(userId);
            if (token != null) {
                authTokens.remove(token);
            }
        }
        
        try {
            session.getBasicRemote().sendText("{\"type\":\"logoutSuccess\"}");
        } catch (IOException e) {
            System.err.println("Error sending logout response: " + e.getMessage());
        }
        
        System.out.println("User logged out: " + sessionId);
    }

    /**
     * Handle session restore request (reconnect with token)
     */
    private void handleRestoreSession(String message, Session session) {
        String token = extractField(message, "token");

        if (token == null || token.isEmpty()) {
            sendSessionRestoreFailed(session, "Session token missing. Please log in again.");
            return;
        }

        Long userId = authTokens.get(token);
        if (userId == null) {
            sendSessionRestoreFailed(session, "Session expired. Please log in again.");
            return;
        }

        Optional<User> userOpt = userDAO.findById(userId);
        if (!userOpt.isPresent()) {
            authTokens.remove(token);
            userToToken.remove(userId);
            sendSessionRestoreFailed(session, "Account not found. Please log in again.");
            return;
        }

        User user = userOpt.get();
        sessionToUser.put(session.getId(), userId);
        sessionToUsername.put(session.getId(), user.getUsername());

        try {
            String response = String.format(
                "{\"type\":\"sessionRestored\",\"userId\":%d,\"username\":\"%s\",\"displayName\":\"%s\",\"token\":\"%s\"}",
                userId, user.getUsername(), user.getDisplayName(), token
            );
            session.getBasicRemote().sendText(response);
            System.out.println("Session restored for user: " + user.getUsername());
        } catch (IOException e) {
            System.err.println("Error sending session restored response: " + e.getMessage());
        }
    }
    
    // ========================================
    // Guest Mode Handler
    // ========================================
    
    /**
     * Handle guest mode activation
     */
    private void handleGuestMode(String message, Session session) {
        String sessionId = session.getId();
        guestSessions.put(sessionId, true);
        
        // Create temporary guest session (expires in 24 hours)
        Timestamp expiresAt = new Timestamp(System.currentTimeMillis() + (24 * 60 * 60 * 1000));
        GuestSession guestSession = new GuestSession(sessionId, expiresAt);
        guestSessionDAO.createGuestSession(guestSession);
        
        try {
            String response = String.format(
                "{\"type\":\"guestModeActivated\",\"sessionId\":\"%s\",\"expiresAt\":\"%s\",\"message\":\"Login to save your work permanently\"}",
                sessionId, expiresAt.toString()
            );
            session.getBasicRemote().sendText(response);
            System.out.println("Guest mode activated for session: " + sessionId);
        } catch (IOException e) {
            System.err.println("Error sending guest mode response: " + e.getMessage());
        }
    }
    
    // ========================================
    // Board Management Handlers
    // ========================================
    
    /**
     * Handle create board request
     */
    private void handleCreateBoard(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        System.out.println("handleCreateBoard - sessionId: " + session.getId() + ", userId: " + userId);
        
        if (userId == null) {
            System.out.println("User not logged in for board creation - sessionToUser map size: " + sessionToUser.size());
            sendError(session, "You must be logged in to create a board");
            return;
        }
        
        String title = extractField(message, "title");
        if (title == null || title.isEmpty()) {
            title = "Untitled Board";
        }
        
        String description = extractField(message, "description");
        
        Board board = new Board(userId, title);
        board.setDescription(description);
        long boardId = boardDAO.createBoard(board);
        
        if (boardId > 0) {
            sessionToBoard.put(session.getId(), boardId);
            try {
                String response = String.format(
                    "{\"type\":\"boardCreated\",\"boardId\":%d,\"title\":\"%s\"}",
                    boardId, title
                );
                session.getBasicRemote().sendText(response);
                System.out.println("Board created: " + boardId + " by user: " + userId);
            } catch (IOException e) {
                System.err.println("Error sending board created response: " + e.getMessage());
            }
        } else {
            sendError(session, "Failed to create board");
        }
    }
    
    /**
     * Handle get boards request (for dashboard)
     */
    private void handleGetBoards(Session session) {
        Long userId = sessionToUser.get(session.getId());
        System.out.println("handleGetBoards - sessionId: " + session.getId() + ", userId: " + userId);
        
        if (userId == null) {
            System.out.println("User not logged in - sessionToUser map size: " + sessionToUser.size());
            sendError(session, "You must be logged in to view boards");
            return;
        }
        
        List<Board> boards = boardDAO.getBoardsByUserId(userId);
        
        try {
            StringBuilder response = new StringBuilder();
            response.append("{\"type\":\"boardsList\",\"boards\":[");
            
            for (int i = 0; i < boards.size(); i++) {
                Board board = boards.get(i);
                response.append(String.format(
                    "{\"id\":%d,\"title\":\"%s\",\"description\":\"%s\",\"thumbnail\":\"%s\",\"updatedAt\":\"%s\"}",
                    board.getId(),
                    board.getTitle(),
                    board.getDescription() != null ? board.getDescription() : "",
                    board.getThumbnail() != null ? board.getThumbnail() : "",
                    board.getUpdatedAt() != null ? board.getUpdatedAt().toString() : ""
                ));
                if (i < boards.size() - 1) {
                    response.append(",");
                }
            }
            
            response.append("]}");
            session.getBasicRemote().sendText(response.toString());
            System.out.println("Sent " + boards.size() + " boards to user: " + userId);
        } catch (IOException e) {
            System.err.println("Error sending boards list: " + e.getMessage());
        }
    }
    
    /**
     * Handle open board request
     */
    private void handleOpenBoard(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        
        if (userId == null) {
            sendError(session, "You must be logged in to open a board");
            return;
        }
        
        long boardId = extractInt(message, "boardId");
        Optional<Board> boardOpt = boardDAO.getBoardById(boardId);
        
        if (!boardOpt.isPresent()) {
            sendError(session, "Board not found");
            return;
        }
        
        Board board = boardOpt.get();
        
        // Verify ownership
        if (!board.getUserId().equals(userId)) {
            sendError(session, "Unauthorized: You don't own this board");
            return;
        }
        
        // Update last accessed
        boardDAO.updateLastAccessed(boardId);
        
        // Set current board for session
        sessionToBoard.put(session.getId(), boardId);
        String ownerRoomCode = sessionToRoom.get(session.getId());
        if (ownerRoomCode != null) {
            Room ownerRoom = rooms.get(ownerRoomCode);
            if (ownerRoom != null && ownerRoom.isOwner(session)) {
                ownerRoom.setBoardMetadata(boardId, board.getTitle(), board.getCanvasData());
            }
        }
        
        try {
            String response = String.format(
                "{\"type\":\"boardOpened\",\"boardId\":%d,\"title\":%s,\"canvasData\":%s}",
                board.getId(),
                toJsonString(board.getTitle()),
                toJsonString(board.getCanvasData())
            );
            session.getBasicRemote().sendText(response);
            System.out.println("Board opened: " + boardId + " by user: " + userId);
        } catch (IOException e) {
            System.err.println("Error sending board opened response: " + e.getMessage());
        }
    }
    
    /**
     * Handle save board request
     */
    private void handleSaveBoard(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        Long boardId = sessionToBoard.get(session.getId());
        
        if (userId == null) {
            sendError(session, "You must be logged in to save a board");
            return;
        }
        
        if (boardId == null) {
            sendError(session, "No active board to save");
            return;
        }
        
        String canvasData = extractField(message, "canvasData");
        
        if (boardDAO.updateBoardData(boardId, canvasData)) {
            try {
                session.getBasicRemote().sendText("{\"type\":\"boardSaved\"}");
                System.out.println("Board saved: " + boardId);
            } catch (IOException e) {
                System.err.println("Error sending board saved response: " + e.getMessage());
            }

            String roomCode = sessionToRoom.get(session.getId());
            if (roomCode != null) {
                Room room = rooms.get(roomCode);
                if (room != null && room.isOwner(session)) {
                    room.setBoardCanvas(canvasData);
                }
            }
        } else {
            sendError(session, "Failed to save board");
        }
    }
    
    /**
     * Handle update board title
     */
    private void handleUpdateBoardTitle(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        
        if (userId == null) {
            sendError(session, "You must be logged in");
            return;
        }
        
        long boardId = extractInt(message, "boardId");
        String newTitle = extractField(message, "title");
        
        Optional<Board> boardOpt = boardDAO.getBoardById(boardId);
        if (!boardOpt.isPresent() || !boardOpt.get().getUserId().equals(userId)) {
            sendError(session, "Board not found or unauthorized");
            return;
        }
        
        Board board = boardOpt.get();
        board.setTitle(newTitle);
        
        if (boardDAO.updateBoard(board)) {
            try {
                String response = String.format(
                    "{\"type\":\"boardTitleUpdated\",\"boardId\":%d,\"title\":\"%s\"}",
                    boardId, newTitle
                );
                session.getBasicRemote().sendText(response);
            } catch (IOException e) {
                System.err.println("Error sending title updated response: " + e.getMessage());
            }

            String roomCode = sessionToRoom.get(session.getId());
            if (roomCode != null) {
                Room room = rooms.get(roomCode);
                if (room != null && room.isOwner(session)) {
                    room.setBoardTitle(newTitle);
                }
            }
        } else {
            sendError(session, "Failed to update title");
        }
    }
    
    /**
     * Handle delete board
     */
    private void handleDeleteBoard(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        
        if (userId == null) {
            sendError(session, "You must be logged in");
            return;
        }
        
        long boardId = extractInt(message, "boardId");
        
        if (boardDAO.deleteBoard(boardId, userId)) {
            try {
                String response = String.format(
                    "{\"type\":\"boardDeleted\",\"boardId\":%d}",
                    boardId
                );
                session.getBasicRemote().sendText(response);
                System.out.println("Board deleted: " + boardId);
            } catch (IOException e) {
                System.err.println("Error sending board deleted response: " + e.getMessage());
            }
        } else {
            sendError(session, "Failed to delete board");
        }
    }
    
    /**
     * Handle duplicate board
     */
    private void handleDuplicateBoard(String message, Session session) {
        Long userId = sessionToUser.get(session.getId());
        
        if (userId == null) {
            sendError(session, "You must be logged in");
            return;
        }
        
        long boardId = extractInt(message, "boardId");
        
        if (boardDAO.duplicateBoard(boardId, userId)) {
            try {
                session.getBasicRemote().sendText("{\"type\":\"boardDuplicated\"}");
                // Send updated boards list
                handleGetBoards(session);
            } catch (IOException e) {
                System.err.println("Error sending board duplicated response: " + e.getMessage());
            }
        } else {
            sendError(session, "Failed to duplicate board");
        }
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

        Long boardId = sessionToBoard.get(session.getId());
        String boardTitle = null;
        String boardCanvas = null;
        if (boardId != null) {
            Optional<Board> boardOpt = boardDAO.getBoardById(boardId);
            if (boardOpt.isPresent()) {
                Board board = boardOpt.get();
                boardTitle = board.getTitle();
                boardCanvas = board.getCanvasData();
                room.setBoardMetadata(boardId, boardTitle, boardCanvas);
            } else {
                room.setBoardMetadata(boardId, null, null);
            }
        }
        
        rooms.put(roomCode, room);
        sessionToRoom.put(session.getId(), roomCode);
        
        try {
            String response = String.format(
                "{\"type\":\"roomCreated\",\"roomCode\":\"%s\",\"roomId\":\"%s\",\"isOwner\":true,\"boardId\":%s,\"boardTitle\":%s}",
                roomCode,
                room.getRoomId(),
                boardId != null ? boardId.toString() : "null",
                toJsonString(boardTitle)
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

        if (username == null || username.isEmpty()) {
            String mappedUsername = sessionToUsername.get(session.getId());
            if (mappedUsername != null && !mappedUsername.isEmpty()) {
                username = mappedUsername;
            }
        }
        
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
        Long boardId = room.getBoardId();
        if (boardId != null) {
            sessionToBoard.put(targetSession.getId(), boardId);
        }
        String boardTitle = room.getBoardTitle();
        String boardCanvas = room.getBoardCanvas();
        if ((boardCanvas == null || boardCanvas.isEmpty()) && boardId != null) {
            Optional<Board> latestBoard = boardDAO.getBoardById(boardId);
            if (latestBoard.isPresent()) {
                if (boardTitle == null || boardTitle.isEmpty()) {
                    boardTitle = latestBoard.get().getTitle();
                }
                boardCanvas = latestBoard.get().getCanvasData();
                if (boardCanvas != null) {
                    room.setBoardCanvas(boardCanvas);
                }
            }
        }
        
        try {
            // Notify the approved user
            String approvedResponse = String.format(
                "{\"type\":\"approved\",\"roomCode\":\"%s\",\"userCount\":%d,\"boardId\":%s,\"boardTitle\":%s,\"canvasData\":%s}",
                roomCode,
                room.getApprovedCount(),
                boardId != null ? boardId.toString() : "null",
                toJsonString(boardTitle),
                toJsonString(boardCanvas)
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
        event.setRoomCode(roomCode); // Set room code for database filtering
        Long boardId = sessionToBoard.get(senderSession.getId());
        if (boardId != null) {
            event.setBoardId(boardId);
        }
        if (event.getUsername() == null || event.getUsername().isEmpty()) {
            String username = sessionToUsername.get(senderSession.getId());
            if (username != null) {
                event.setUsername(username);
            }
        }
        if (event.getLineStyle() == null || event.getLineStyle().isEmpty()) {
            event.setLineStyle(extractField(message, "lineStyle"));
        }
        
        // Save to database if enabled
        if (PERSIST_TO_DATABASE) {
            try {
                drawingEventDAO.saveEvent(event);
            } catch (Exception e) {
                System.err.println("Failed to save to database: " + e.getMessage());
            }
        }
        
        // Broadcast to room members only
        String broadcastMessage = event.toJson();
        if (room != null) {
            broadcastToRoom(room, broadcastMessage, null);
        } else if (boardId != null) {
            broadcastToBoard(boardId, broadcastMessage, senderSession);
        } else {
            broadcast(broadcastMessage);
        }
    }
    
    /**
     * Handle shape drawing event
     */
    private void handleShapeEvent(String message, Session senderSession) {
        String roomCode = sessionToRoom.get(senderSession.getId());
        
        // Check if user is in a room and approved
        Room room = roomCode != null ? rooms.get(roomCode) : null;
        if (room != null && !room.isApproved(senderSession)) {
            return; // Not approved, ignore drawing
        }
        
        // Save shape event to database if enabled
        if (PERSIST_TO_DATABASE) {
            try {
                // Create a drawing event from the shape message
                // Parse the JSON to extract shape data
                String tool = extractField(message, "tool");
                if (tool != null && (tool.equals("line") || tool.equals("rectangle") || tool.equals("circle") || tool.equals("arrow"))) {
                    DrawingEvent event = new DrawingEvent();
                    event.setSessionId(senderSession.getId());
                    event.setRoomCode(roomCode);
                    event.setUsername(extractField(message, "username"));
                    Long boardId = sessionToBoard.get(senderSession.getId());
                    if (boardId != null) {
                        event.setBoardId(boardId);
                    }
                    event.setTool(tool);
                    event.setX1(extractInt(message, "x1"));
                    event.setY1(extractInt(message, "y1"));
                    event.setX2(extractInt(message, "x2"));
                    event.setY2(extractInt(message, "y2"));
                    event.setColor(extractField(message, "color"));
                    event.setStrokeWidth(extractInt(message, "strokeWidth"));
                    event.setLineStyle(extractField(message, "lineStyle"));
                    if (event.getUsername() == null || event.getUsername().isEmpty()) {
                        String username = sessionToUsername.get(senderSession.getId());
                        if (username != null) {
                            event.setUsername(username);
                        }
                    }
                    
                    drawingEventDAO.saveEvent(event);
                }
            } catch (Exception e) {
                System.err.println("Failed to save shape event to database: " + e.getMessage());
            }
        }
        
        // Broadcast to room members only
        if (room != null) {
            broadcastToRoom(room, message, null);
        } else {
            Long boardId = sessionToBoard.get(senderSession.getId());
            if (boardId != null) {
                broadcastToBoard(boardId, message, senderSession);
            } else {
                broadcast(message);
            }
        }
    }
    
    /**
     * Handle chat message
     */
    private void handleChatMessage(String message, Session senderSession) {
        String roomCode = sessionToRoom.get(senderSession.getId());
        
        // Check if user is in a room and approved
        Room room = roomCode != null ? rooms.get(roomCode) : null;
        if (room != null && !room.isApproved(senderSession)) {
            return; // Not approved, ignore chat
        }
        
        // Broadcast chat message to all users in the room or globally
        if (room != null) {
            broadcastToRoom(room, message, null);
        } else {
            broadcast(message);
        }
    }
    
    /**
     * Handle clear canvas request
     */
    private void handleClearCanvas(String message, Session senderSession) {
        String roomCodeFromMessage = extractField(message, "roomCode");
        if (roomCodeFromMessage != null && "null".equalsIgnoreCase(roomCodeFromMessage.trim())) {
            roomCodeFromMessage = null;
        }
        String mappedRoomCode = sessionToRoom.get(senderSession.getId());
        String roomCode = roomCodeFromMessage != null ? roomCodeFromMessage : mappedRoomCode;
        Long boardId = extractLong(message, "boardId");
        if (boardId == null) {
            boardId = sessionToBoard.get(senderSession.getId());
        }

        System.out.println("Canvas clear requested by: " + senderSession.getId() +
                           (boardId != null ? (" | board=" + boardId) : "") +
                           (roomCode != null ? (" | room=" + roomCode) : ""));
        
        if (PERSIST_TO_DATABASE) {
            if (boardId != null) {
                drawingEventDAO.clearEventsForBoard(boardId);
            } else if (roomCode != null && !roomCode.isEmpty()) {
                drawingEventDAO.clearEventsForRoom(roomCode);
            } else {
                drawingEventDAO.clearAllEvents();
            }
        }
        
        StringBuilder clearBuilder = new StringBuilder("{\"type\":\"clear\",\"boardId\":");
        clearBuilder.append(boardId != null ? boardId.toString() : "null");
        if (roomCode != null) {
            clearBuilder.append(",\"roomCode\":\"").append(roomCode).append("\"");
        }
        clearBuilder.append('}');
        String clearMessage = clearBuilder.toString();

        Room room = roomCode != null ? rooms.get(roomCode) : null;
        if (room != null) {
            broadcastToRoom(room, clearMessage, null);
        } else if (boardId != null) {
            broadcastToBoard(boardId, clearMessage, senderSession);
        } else {
            try {
                senderSession.getBasicRemote().sendText(clearMessage);
            } catch (IOException e) {
                System.err.println("Error sending clear confirmation: " + e.getMessage());
            }
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
            List<DrawingEvent> events;
            Long boardId = sessionToBoard.get(session.getId());

            if (boardId != null) {
                events = drawingEventDAO.getEventsByBoard(boardId);
            } else if (roomCode != null) {
                // Send only events for this room
                events = drawingEventDAO.getEventsByRoom(roomCode);
            } else {
                // Fallback to all events if no room code (shouldn't happen in normal operation)
                events = drawingEventDAO.getAllEvents();
            }
            
            if (!events.isEmpty()) {
                // Send history start marker
                session.getBasicRemote().sendText("{\"type\":\"historyStart\"}");
                
                // Send each event
                for (DrawingEvent event : events) {
                    session.getBasicRemote().sendText(event.toJson());
                }
                
                // Send history end marker
                session.getBasicRemote().sendText("{\"type\":\"historyEnd\"}");
                
                System.out.println("Sent " + events.size() + " historical events" +
                                   (boardId != null ? (" for board " + boardId) : (roomCode != null ? (" for room " + roomCode) : "")) +
                                   " to " + session.getId());
            } else {
                // Send empty history markers
                session.getBasicRemote().sendText("{\"type\":\"historyStart\"}");
                session.getBasicRemote().sendText("{\"type\":\"historyEnd\"}");
                System.out.println("Sent empty history" +
                                   (boardId != null ? (" for board " + boardId) : (roomCode != null ? (" for room " + roomCode) : "")) +
                                   " to " + session.getId());
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

        room.clearBoardMetadata();
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
     * Broadcast a message to all clients currently working on the same board
     */
    private void broadcastToBoard(Long boardId, String message, Session excludeSession) {
        for (Session session : sessions) {
            if (!session.isOpen()) {
                continue;
            }
            if (excludeSession != null && session.equals(excludeSession)) {
                continue;
            }
            Long mappedBoard = sessionToBoard.get(session.getId());
            if (mappedBoard != null && mappedBoard.equals(boardId)) {
                try {
                    session.getBasicRemote().sendText(message);
                } catch (IOException e) {
                    System.err.println("Error broadcasting to board session: " + e.getMessage());
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
    
    private void sendAuthError(Session session, String errorType, String errorMessage) {
        try {
            String error = String.format("{\"type\":\"%s\",\"message\":\"%s\"}", errorType, errorMessage);
            session.getBasicRemote().sendText(error);
        } catch (IOException e) {
            System.err.println("Error sending auth error message: " + e.getMessage());
        }
    }

    private void sendSessionRestoreFailed(Session session, String errorMessage) {
        try {
            String error = String.format("{\"type\":\"sessionRestoreFailed\",\"message\":\"%s\"}", errorMessage);
            session.getBasicRemote().sendText(error);
        } catch (IOException e) {
            System.err.println("Error sending session restore error message: " + e.getMessage());
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
     * Properly handles escaped characters in string values (e.g., base64 data URLs)
     */
    private String extractField(String json, String fieldName) {
        try {
            // Simple JSON parsing - look for "fieldName":"value"
            String pattern = "\"" + fieldName + "\":";
            int start = json.indexOf(pattern);
            if (start == -1) return null;

            start += pattern.length();

            // Skip whitespace
            while (start < json.length() && Character.isWhitespace(json.charAt(start))) {
                start++;
            }

            // Check if value is quoted
            if (start < json.length() && json.charAt(start) == '"') {
                start++; // Skip opening quote
                // Find closing quote, accounting for escaped quotes
                StringBuilder value = new StringBuilder();
                boolean escaped = false;
                int i = start;
                while (i < json.length()) {
                    char c = json.charAt(i);
                    if (escaped) {
                        // Handle escape sequences
                        switch (c) {
                            case '"': value.append('"'); break;
                            case '\\': value.append('\\'); break;
                            case '/': value.append('/'); break;
                            case 'n': value.append('\n'); break;
                            case 'r': value.append('\r'); break;
                            case 't': value.append('\t'); break;
                            default: value.append(c); break;
                        }
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        // End of string
                        break;
                    } else {
                        value.append(c);
                    }
                    i++;
                }
                return value.toString();
            } else {
                // Unquoted value (numbers, booleans, null)
                int end = start;
                while (end < json.length() && json.charAt(end) != ',' && json.charAt(end) != '}' && !Character.isWhitespace(json.charAt(end))) {
                    end++;
                }
                return json.substring(start, end);
            }
        } catch (Exception e) {
            System.err.println("Error extracting field '" + fieldName + "' from JSON: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Extract an integer field value from JSON string
     */
    private int extractInt(String json, String fieldName) {
        try {
            String value = extractField(json, fieldName);
            return value != null ? Integer.parseInt(value) : 0;
        } catch (NumberFormatException e) {
            System.err.println("Error parsing integer field '" + fieldName + "' from JSON: " + e.getMessage());
            return 0;
        }
    }

    private Long extractLong(String json, String fieldName) {
        try {
            String value = extractField(json, fieldName);
            if (value == null || value.isEmpty() || "null".equalsIgnoreCase(value)) {
                return null;
            }
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            System.err.println("Error parsing long field '" + fieldName + "' from JSON: " + e.getMessage());
            return null;
        }
    }

    private String toJsonString(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        escaped.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    escaped.append("\\\"");
                    break;
                case '\\':
                    escaped.append("\\\\");
                    break;
                case '\n':
                    escaped.append("\\n");
                    break;
                case '\r':
                    escaped.append("\\r");
                    break;
                case '\t':
                    escaped.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) c));
                    } else {
                        escaped.append(c);
                    }
                    break;
            }
        }
        escaped.append('"');
        return escaped.toString();
    }
    
    /**
     * Get the number of connected clients
     */
    public static int getConnectedClientCount() {
        return sessions.size();
    }
}
