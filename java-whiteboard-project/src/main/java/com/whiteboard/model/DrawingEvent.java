package com.whiteboard.model;

import java.sql.Timestamp;

/**
 * Model class representing a drawing event on the whiteboard.
 * Contains coordinates, styling, and metadata for each stroke segment.
 */
public class DrawingEvent {
    
    private Long id;
    private Long boardId;
    private String sessionId;
    private String roomCode;
    private String username;
    private int x1;
    private int y1;
    private int x2;
    private int y2;
    private String color;
    private String tool;
    private int strokeWidth;
    private String lineStyle;
    private Timestamp timestamp;
    
    // Default constructor
    public DrawingEvent() {
        this.color = "#000000";
        this.tool = "pen";
        this.strokeWidth = 3;
        this.lineStyle = "solid";
    }
    
    // Constructor with coordinates
    public DrawingEvent(int x1, int y1, int x2, int y2) {
        this();
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }
    
    // Full constructor
    public DrawingEvent(String sessionId, int x1, int y1, int x2, int y2, 
                        String color, String tool, int strokeWidth) {
        this.sessionId = sessionId;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.tool = tool;
        this.strokeWidth = strokeWidth;
        this.lineStyle = "solid";
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }

    public Long getBoardId() {
        return boardId;
    }

    public void setBoardId(Long boardId) {
        this.boardId = boardId;
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getRoomCode() {
        return roomCode;
    }
    
    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }
    
    public int getX1() {
        return x1;
    }
    
    public void setX1(int x1) {
        this.x1 = x1;
    }
    
    public int getY1() {
        return y1;
    }
    
    public void setY1(int y1) {
        this.y1 = y1;
    }
    
    public int getX2() {
        return x2;
    }
    
    public void setX2(int x2) {
        this.x2 = x2;
    }
    
    public int getY2() {
        return y2;
    }
    
    public void setY2(int y2) {
        this.y2 = y2;
    }
    
    public String getColor() {
        return color;
    }
    
    public void setColor(String color) {
        this.color = color;
    }
    
    public String getTool() {
        return tool;
    }
    
    public void setTool(String tool) {
        this.tool = tool;
    }
    
    public int getStrokeWidth() {
        return strokeWidth;
    }
    
    public void setStrokeWidth(int strokeWidth) {
        this.strokeWidth = strokeWidth;
    }

    public String getLineStyle() {
        return lineStyle;
    }

    public void setLineStyle(String lineStyle) {
        this.lineStyle = (lineStyle == null || lineStyle.isEmpty()) ? "solid" : lineStyle;
    }
    
    public Timestamp getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(Timestamp timestamp) {
        this.timestamp = timestamp;
    }
    
    /**
     * Convert to JSON string for WebSocket transmission
     */
    public String toJson() {
        return String.format(
            "{\"type\":\"draw\",\"x1\":%d,\"y1\":%d,\"x2\":%d,\"y2\":%d," +
            "\"color\":\"%s\",\"tool\":\"%s\",\"strokeWidth\":%d,\"lineStyle\":\"%s\"," +
            "\"sessionId\":\"%s\",\"username\":\"%s\",\"boardId\":%s}",
            x1, y1, x2, y2,
            color != null ? color : "#000000",
            tool != null ? tool : "pen",
            strokeWidth,
            lineStyle != null ? lineStyle : "solid",
            sessionId != null ? sessionId : "",
            username != null ? username : "",
            boardId != null ? boardId.toString() : "null"
        );
    }
    
    /**
     * Parse JSON string to create DrawingEvent object
     */
    public static DrawingEvent fromJson(String json) {
        DrawingEvent event = new DrawingEvent();
        
        try {
            // Simple JSON parsing without external libraries
            event.setX1(extractInt(json, "x1"));
            event.setY1(extractInt(json, "y1"));
            event.setX2(extractInt(json, "x2"));
            event.setY2(extractInt(json, "y2"));
            event.setColor(extractString(json, "color"));
            event.setTool(extractString(json, "tool"));
            event.setStrokeWidth(extractInt(json, "strokeWidth"));
            event.setSessionId(extractString(json, "sessionId"));
            event.setUsername(extractString(json, "username"));
            Long boardId = extractLong(json, "boardId");
            if (boardId != null) {
                event.setBoardId(boardId);
            }
            String style = extractString(json, "lineStyle");
            event.setLineStyle(style);
        } catch (Exception e) {
            System.err.println("Error parsing JSON: " + e.getMessage());
        }
        
        return event;
    }
    
    private static int extractInt(String json, String key) {
        String pattern = "\"" + key + "\":";
        int start = json.indexOf(pattern);
        if (start == -1) return 0;
        
        start += pattern.length();
        int end = start;
        while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) {
            end++;
        }
        
        try {
            return Integer.parseInt(json.substring(start, end));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
    
    private static String extractString(String json, String key) {
        String pattern = "\"" + key + "\":\"";
        int start = json.indexOf(pattern);
        if (start == -1) return "";
        
        start += pattern.length();
        int end = json.indexOf("\"", start);
        if (end == -1) return "";
        
        return json.substring(start, end);
    }

    private static Long extractLong(String json, String key) {
        String pattern = "\"" + key + "\":";
        int start = json.indexOf(pattern);
        if (start == -1) return null;

        start += pattern.length();
        int end = start;
        while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) {
            end++;
        }

        try {
            return Long.parseLong(json.substring(start, end));
        } catch (NumberFormatException e) {
            return null;
        }
    }
    
    @Override
    public String toString() {
        return "DrawingEvent{" +
                "id=" + id +
                ", boardId=" + boardId +
                ", sessionId='" + sessionId + '\'' +
                ", username='" + username + '\'' +
                ", x1=" + x1 +
                ", y1=" + y1 +
                ", x2=" + x2 +
                ", y2=" + y2 +
                ", color='" + color + '\'' +
                ", tool='" + tool + '\'' +
                ", strokeWidth=" + strokeWidth +
                ", lineStyle='" + lineStyle + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}
