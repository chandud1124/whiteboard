package com.whiteboard.model;

import java.sql.Timestamp;

/**
 * Model class representing a drawing event on the whiteboard.
 * Contains coordinates, styling, and metadata for each stroke segment.
 */
public class DrawingEvent {
    
    private Long id;
    private String sessionId;
    private int x1;
    private int y1;
    private int x2;
    private int y2;
    private String color;
    private String tool;
    private int strokeWidth;
    private Timestamp timestamp;
    
    // Default constructor
    public DrawingEvent() {
        this.color = "#000000";
        this.tool = "pen";
        this.strokeWidth = 3;
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
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
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
            "\"color\":\"%s\",\"tool\":\"%s\",\"strokeWidth\":%d,\"sessionId\":\"%s\"}",
            x1, y1, x2, y2, color, tool, strokeWidth, sessionId != null ? sessionId : ""
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
    
    @Override
    public String toString() {
        return "DrawingEvent{" +
                "id=" + id +
                ", sessionId='" + sessionId + '\'' +
                ", x1=" + x1 +
                ", y1=" + y1 +
                ", x2=" + x2 +
                ", y2=" + y2 +
                ", color='" + color + '\'' +
                ", tool='" + tool + '\'' +
                ", strokeWidth=" + strokeWidth +
                ", timestamp=" + timestamp +
                '}';
    }
}
