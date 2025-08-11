package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
)

type EncryptionService struct {
	appKey []byte
}

// NewEncryptionService creates a new encryption service instance
func NewEncryptionService() (*EncryptionService, error) {
	// Load encryption key from environment variable
	keyStr := os.Getenv("ENCRYPTION_KEY")
	if keyStr == "" {
		return nil, errors.New("ENCRYPTION_KEY environment variable not set")
	}

	// Decode the key (assuming it's base64 encoded)
	key, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil {
		// Try hex encoding if base64 fails
		key, err = hexDecode(keyStr)
		if err != nil {
			return nil, fmt.Errorf("failed to decode ENCRYPTION_KEY: %v", err)
		}
	}

	// Validate key length (AES-256 requires 32 bytes)
	if len(key) != 32 {
		return nil, fmt.Errorf("ENCRYPTION_KEY must be 32 bytes, got %d", len(key))
	}

	return &EncryptionService{
		appKey: key,
	}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM with AAD
func (e *EncryptionService) Encrypt(app, name, plaintext string) ([]byte, []byte, error) {
	// Generate random 12-byte IV
	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		return nil, nil, fmt.Errorf("failed to generate IV: %v", err)
	}

	// Create AES cipher
	block, err := aes.NewCipher(e.appKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create cipher: %v", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create GCM: %v", err)
	}

	// Create AAD (Additional Authenticated Data)
	aad := fmt.Sprintf("%s|%s", app, name)

	// Encrypt with AAD
	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), []byte(aad))

	return ciphertext, iv, nil
}

// Decrypt decrypts ciphertext using AES-256-GCM with AAD
func (e *EncryptionService) Decrypt(app, name string, iv, ciphertext []byte) (string, error) {
	// Create AES cipher
	block, err := aes.NewCipher(e.appKey)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %v", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %v", err)
	}

	// Create AAD (Additional Authenticated Data)
	aad := fmt.Sprintf("%s|%s", app, name)

	// Decrypt with AAD
	plaintext, err := gcm.Open(nil, iv, ciphertext, []byte(aad))
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %v", err)
	}

	return string(plaintext), nil
}

// hexDecode decodes a hex string to bytes
func hexDecode(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, errors.New("hex string must have even length")
	}

	result := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		a, err := hexCharToByte(s[i])
		if err != nil {
			return nil, err
		}
		b, err := hexCharToByte(s[i+1])
		if err != nil {
			return nil, err
		}
		result[i/2] = (a << 4) | b
	}
	return result, nil
}

// hexCharToByte converts a hex character to its byte value
func hexCharToByte(c byte) (byte, error) {
	switch {
	case '0' <= c && c <= '9':
		return c - '0', nil
	case 'a' <= c && c <= 'f':
		return c - 'a' + 10, nil
	case 'A' <= c && c <= 'F':
		return c - 'A' + 10, nil
	default:
		return 0, fmt.Errorf("invalid hex character: %c", c)
	}
}
