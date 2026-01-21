package com.whiteboard.dao;

import com.whiteboard.model.Board;
import com.whiteboard.util.DatabaseConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Data Access Object for Board operations.
 */
public class BoardDAO {

    private static final String INSERT_BOARD =
            "INSERT INTO boards (user_id, title, description, canvas_data) VALUES (?, ?, ?, ?)";

    private static final String SELECT_BOARD_BY_ID =
            "SELECT id, user_id, title, description, thumbnail, canvas_data, is_active, " +
            "created_at, updated_at, last_accessed FROM boards WHERE id = ? AND is_active = TRUE";

    private static final String SELECT_BOARDS_BY_USER =
            "SELECT id, user_id, title, description, thumbnail, canvas_data, is_active, " +
            "created_at, updated_at, last_accessed FROM boards " +
            "WHERE user_id = ? AND is_active = TRUE ORDER BY updated_at DESC";

    private static final String UPDATE_BOARD =
            "UPDATE boards SET title = ?, description = ?, canvas_data = ?, thumbnail = ?, " +
            "updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?";

    private static final String UPDATE_BOARD_DATA =
            "UPDATE boards SET canvas_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";

    private static final String UPDATE_LAST_ACCESSED =
            "UPDATE boards SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?";

    private static final String DELETE_BOARD =
            "UPDATE boards SET is_active = FALSE WHERE id = ? AND user_id = ?";

    private static final String DUPLICATE_BOARD =
            "INSERT INTO boards (user_id, title, description, canvas_data, thumbnail) " +
            "SELECT user_id, CONCAT(title, ' (Copy)'), description, canvas_data, thumbnail " +
            "FROM boards WHERE id = ? AND user_id = ?";

    /**
     * Create a new board
     */
    public long createBoard(Board board) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(INSERT_BOARD, Statement.RETURN_GENERATED_KEYS);

            stmt.setLong(1, board.getUserId());
            stmt.setString(2, board.getTitle());
            stmt.setString(3, board.getDescription());
            stmt.setString(4, board.getCanvasData());

            int affected = stmt.executeUpdate();
            if (affected > 0) {
                rs = stmt.getGeneratedKeys();
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error creating board: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (rs != null) rs.close(); } catch (SQLException e) {}
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return -1;
    }

    /**
     * Get board by ID
     */
    public Optional<Board> getBoardById(long boardId) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_BOARD_BY_ID);
            stmt.setLong(1, boardId);

            rs = stmt.executeQuery();
            if (rs.next()) {
                return Optional.of(extractBoardFromResultSet(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error getting board: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (rs != null) rs.close(); } catch (SQLException e) {}
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return Optional.empty();
    }

    /**
     * Get all boards for a user
     */
    public List<Board> getBoardsByUserId(long userId) {
        List<Board> boards = new ArrayList<>();
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_BOARDS_BY_USER);
            stmt.setLong(1, userId);

            rs = stmt.executeQuery();
            while (rs.next()) {
                boards.add(extractBoardFromResultSet(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error getting boards for user: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (rs != null) rs.close(); } catch (SQLException e) {}
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return boards;
    }

    /**
     * Update board
     */
    public boolean updateBoard(Board board) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_BOARD);

            stmt.setString(1, board.getTitle());
            stmt.setString(2, board.getDescription());
            stmt.setString(3, board.getCanvasData());
            stmt.setString(4, board.getThumbnail());
            stmt.setLong(5, board.getId());
            stmt.setLong(6, board.getUserId());

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating board: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Update only board canvas data (for auto-save)
     */
    public boolean updateBoardData(long boardId, String canvasData) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_BOARD_DATA);

            stmt.setString(1, canvasData);
            stmt.setLong(2, boardId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating board data: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Update last accessed timestamp
     */
    public boolean updateLastAccessed(long boardId) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_LAST_ACCESSED);
            stmt.setLong(1, boardId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating last accessed: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Soft delete board
     */
    public boolean deleteBoard(long boardId, long userId) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DELETE_BOARD);

            stmt.setLong(1, boardId);
            stmt.setLong(2, userId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error deleting board: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Duplicate board
     */
    public boolean duplicateBoard(long boardId, long userId) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DUPLICATE_BOARD);

            stmt.setLong(1, boardId);
            stmt.setLong(2, userId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error duplicating board: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Extract Board object from ResultSet
     */
    private Board extractBoardFromResultSet(ResultSet rs) throws SQLException {
        Board board = new Board();
        board.setId(rs.getLong("id"));
        board.setUserId(rs.getLong("user_id"));
        board.setTitle(rs.getString("title"));
        board.setDescription(rs.getString("description"));
        board.setThumbnail(rs.getString("thumbnail"));
        board.setCanvasData(rs.getString("canvas_data"));
        board.setActive(rs.getBoolean("is_active"));
        board.setCreatedAt(rs.getTimestamp("created_at"));
        board.setUpdatedAt(rs.getTimestamp("updated_at"));
        board.setLastAccessed(rs.getTimestamp("last_accessed"));
        return board;
    }
}