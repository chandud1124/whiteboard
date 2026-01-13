package com.whiteboard.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Utility class for authentication operations.
 * Provides password hashing, token generation, and validation.
 */
public class AuthenticationUtil {
    
    private static final int SALT_LENGTH = 16;
    private static final String HASH_ALGORITHM = "SHA-256";
    private static final int TOKEN_LENGTH = 32;
    
    /**
     * Hash a password with salt using SHA-256
     * @param password The plain text password
     * @return Salted and hashed password (format: salt:hash)
     */
    public static String hashPassword(String password) {
        try {
            // Generate random salt
            SecureRandom random = new SecureRandom();
            byte[] salt = new byte[SALT_LENGTH];
            random.nextBytes(salt);
            
            // Hash password with salt
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            digest.update(salt);
            byte[] hash = digest.digest(password.getBytes());
            
            // Return salt:hash in Base64 format
            String saltB64 = Base64.getEncoder().encodeToString(salt);
            String hashB64 = Base64.getEncoder().encodeToString(hash);
            
            return saltB64 + ":" + hashB64;
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
    
    /**
     * Verify a password against its hash
     * @param password The plain text password to verify
     * @param passwordHash The stored password hash (format: salt:hash)
     * @return true if password matches, false otherwise
     */
    public static boolean verifyPassword(String password, String passwordHash) {
        try {
            // Extract salt and hash
            String[] parts = passwordHash.split(":");
            if (parts.length != 2) {
                return false;
            }
            
            byte[] salt = Base64.getDecoder().decode(parts[0]);
            byte[] storedHash = Base64.getDecoder().decode(parts[1]);
            
            // Hash the provided password with the same salt
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            digest.update(salt);
            byte[] computedHash = digest.digest(password.getBytes());
            
            // Compare hashes
            return MessageDigest.isEqual(computedHash, storedHash);
        } catch (Exception e) {
            System.err.println("Error verifying password: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Generate a random authentication token
     * @return A random token string
     */
    public static String generateToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[TOKEN_LENGTH];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    
    /**
     * Validate username format
     * @param username The username to validate
     * @return true if valid, false otherwise
     */
    public static boolean isValidUsername(String username) {
        if (username == null || username.isEmpty()) {
            return false;
        }
        // Username: 3-50 characters, alphanumeric and underscore only
        return username.matches("^[a-zA-Z0-9_]{3,50}$");
    }
    
    /**
     * Validate email format
     * @param email The email to validate
     * @return true if valid, false otherwise
     */
    public static boolean isValidEmail(String email) {
        if (email == null || email.isEmpty()) {
            return false;
        }
        // Basic email validation
        return email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    }
    
    /**
     * Validate password strength
     * @param password The password to validate
     * @return true if valid, false otherwise
     */
    public static boolean isValidPassword(String password) {
        if (password == null || password.isEmpty()) {
            return false;
        }
        // Password: at least 6 characters
        return password.length() >= 6;
    }
}
