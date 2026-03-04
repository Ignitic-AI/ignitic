package unit

import (
	"encoding/base64"
	"testing"

	"backend/services"
)

func TestEncryptionService_EncryptDecryptRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))

	svc, err := services.NewEncryptionService()
	if err != nil {
		t.Fatalf("NewEncryptionService() error = %v", err)
	}

	plaintext := "hello, secure world"
	app, name := "test-app", "test-name"

	ciphertext, iv, err := svc.Encrypt(app, name, plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}
	if len(ciphertext) == 0 || len(iv) == 0 {
		t.Fatalf("Encrypt() returned empty ciphertext or IV")
	}

	decrypted, err := svc.Decrypt(app, name, iv, ciphertext)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}
	if decrypted != plaintext {
		t.Fatalf("Decrypt() = %q, want %q", decrypted, plaintext)
	}
}

func TestEncryptionService_InvalidKeyLength(t *testing.T) {
	shortKey := base64.StdEncoding.EncodeToString([]byte("short"))
	t.Setenv("ENCRYPTION_KEY", shortKey)

	_, err := services.NewEncryptionService()
	if err == nil {
		t.Fatal("NewEncryptionService() expected error for invalid key length, got nil")
	}
}

func TestEncryptionService_MissingKey(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "")

	_, err := services.NewEncryptionService()
	if err == nil {
		t.Fatal("NewEncryptionService() expected error when ENCRYPTION_KEY is empty, got nil")
	}
}

func TestEncryptionService_DecryptWrongAAD(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	t.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))

	svc, err := services.NewEncryptionService()
	if err != nil {
		t.Fatalf("NewEncryptionService() error = %v", err)
	}

	ciphertext, iv, err := svc.Encrypt("app1", "name1", "secret")
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	_, err = svc.Decrypt("app2", "name2", iv, ciphertext)
	if err == nil {
		t.Fatal("Decrypt() with wrong app/name (AAD) expected error, got nil")
	}
}
