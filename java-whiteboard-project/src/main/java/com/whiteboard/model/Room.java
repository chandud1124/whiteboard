package com.whiteboard.model;

import java.util.UUID;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import javax.websocket.Session;

/**
 * Represents a whiteboard room that users can join via invite link.
 * Supports approval-based access control.
 */
public class Room {
    
    private final String roomId;
    private final String roomCode; // Short code for sharing
    private final Session ownerSession;
    private final String ownerSessionId;
    private final Set<Session> approvedSessions;
    private final Set<Session> pendingApproval;
    private final ConcurrentHashMap<String, String> pendingUsernames; // sessionId -> username
    private final long createdAt;
    private volatile Long boardId;
    private volatile String boardTitle;
    private volatile String boardCanvas;
    
    public Room(Session ownerSession) {
        this.roomId = UUID.randomUUID().toString();
        this.roomCode = generateRoomCode();
        this.ownerSession = ownerSession;
        this.ownerSessionId = ownerSession.getId();
        this.approvedSessions = ConcurrentHashMap.newKeySet();
        this.pendingApproval = ConcurrentHashMap.newKeySet();
        this.pendingUsernames = new ConcurrentHashMap<>();
        this.createdAt = System.currentTimeMillis();
        
        // Owner is automatically approved
        approvedSessions.add(ownerSession);
    }
    
    /**
     * Generate a short, easy-to-share room code
     */
    private String generateRoomCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            int index = (int) (Math.random() * chars.length());
            code.append(chars.charAt(index));
        }
        return code.toString();
    }
    
    public String getRoomId() {
        return roomId;
    }
    
    public String getRoomCode() {
        return roomCode;
    }
    
    public Session getOwnerSession() {
        return ownerSession;
    }
    
    public String getOwnerSessionId() {
        return ownerSessionId;
    }
    
    public boolean isOwner(Session session) {
        return session.getId().equals(ownerSessionId);
    }
    
    public boolean isOwner(String sessionId) {
        return sessionId.equals(ownerSessionId);
    }
    
    public void addPendingRequest(Session session, String username) {
        pendingApproval.add(session);
        pendingUsernames.put(session.getId(), username != null ? username : "Anonymous");
    }
    
    public void approveSession(Session session) {
        pendingApproval.remove(session);
        pendingUsernames.remove(session.getId());
        approvedSessions.add(session);
    }
    
    public void rejectSession(Session session) {
        pendingApproval.remove(session);
        pendingUsernames.remove(session.getId());
    }
    
    public void removeSession(Session session) {
        approvedSessions.remove(session);
        pendingApproval.remove(session);
        pendingUsernames.remove(session.getId());
    }
    
    public boolean isApproved(Session session) {
        return approvedSessions.contains(session);
    }
    
    public boolean isPending(Session session) {
        return pendingApproval.contains(session);
    }
    
    public Set<Session> getApprovedSessions() {
        return approvedSessions;
    }
    
    public Set<Session> getPendingApproval() {
        return pendingApproval;
    }
    
    public String getPendingUsername(String sessionId) {
        return pendingUsernames.getOrDefault(sessionId, "Anonymous");
    }
    
    public int getApprovedCount() {
        return (int) approvedSessions.stream().filter(Session::isOpen).count();
    }
    
    public int getPendingCount() {
        return (int) pendingApproval.stream().filter(Session::isOpen).count();
    }
    
    public long getCreatedAt() {
        return createdAt;
    }

    public Long getBoardId() {
        return boardId;
    }

    public String getBoardTitle() {
        return boardTitle;
    }

    public String getBoardCanvas() {
        return boardCanvas;
    }

    public void setBoardMetadata(Long boardId, String boardTitle, String boardCanvas) {
        this.boardId = boardId;
        this.boardTitle = boardTitle;
        this.boardCanvas = boardCanvas;
    }

    public void setBoardCanvas(String boardCanvas) {
        this.boardCanvas = boardCanvas;
    }

    public void setBoardTitle(String boardTitle) {
        this.boardTitle = boardTitle;
    }

    public void clearBoardMetadata() {
        this.boardId = null;
        this.boardTitle = null;
        this.boardCanvas = null;
    }
}
