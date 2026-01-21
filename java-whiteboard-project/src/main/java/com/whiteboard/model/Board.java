package com.whiteboard.model;

import java.sql.Timestamp;

/**
 * Model class representing a whiteboard board.
 * Each user can have multiple boards (like Canva).
 */
public class Board {
    private Long id;
    private Long userId;
    private String title;
    private String description;
    private String thumbnail;
    private String canvasData;
    private boolean isActive;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private Timestamp lastAccessed;

    // Constructors
    public Board() {}

    public Board(Long userId, String title) {
        this.userId = userId;
        this.title = title;
        this.isActive = true;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getThumbnail() { return thumbnail; }
    public void setThumbnail(String thumbnail) { this.thumbnail = thumbnail; }

    public String getCanvasData() { return canvasData; }
    public void setCanvasData(String canvasData) { this.canvasData = canvasData; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }

    public Timestamp getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Timestamp updatedAt) { this.updatedAt = updatedAt; }

    public Timestamp getLastAccessed() { return lastAccessed; }
    public void setLastAccessed(Timestamp lastAccessed) { this.lastAccessed = lastAccessed; }

    @Override
    public String toString() {
        return "Board{" +
                "id=" + id +
                ", userId=" + userId +
                ", title='" + title + '\'' +
                ", isActive=" + isActive +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}