package com.whiteboard.model;

import java.sql.Timestamp;

/**
 * Model class representing a guest session.
 * Guest sessions expire after a certain time period.
 */
public class GuestSession {
    private Long id;
    private String sessionId;
    private String sessionData;
    private Timestamp createdAt;
    private Timestamp expiresAt;
    private boolean isActive;

    // Constructors
    public GuestSession() {}

    public GuestSession(String sessionId, Timestamp expiresAt) {
        this.sessionId = sessionId;
        this.expiresAt = expiresAt;
        this.isActive = true;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getSessionData() { return sessionData; }
    public void setSessionData(String sessionData) { this.sessionData = sessionData; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Timestamp expiresAt) { this.expiresAt = expiresAt; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public boolean isExpired() {
        return expiresAt != null && expiresAt.before(new Timestamp(System.currentTimeMillis()));
    }

    @Override
    public String toString() {
        return "GuestSession{" +
                "id=" + id +
                ", sessionId='" + sessionId + '\'' +
                ", isActive=" + isActive +
                ", expiresAt=" + expiresAt +
                '}';
    }
}