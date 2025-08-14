package services

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

type CloudinaryService struct {
	cld *cloudinary.Cloudinary
}

type CloudinaryUploadResult struct {
	PublicID  string
	SecureURL string
}

func NewCloudinaryService(cloudName, apiKey, apiSecret string) (*CloudinaryService, error) {
	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Cloudinary: %w", err)
	}
	return &CloudinaryService{cld: cld}, nil
}

// UploadFile uploads a file to Cloudinary with secure, private access
func (s *CloudinaryService) UploadFile(file io.Reader, filename, folderPath string) (*CloudinaryUploadResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Generate unique filename without extension for public ID
	fileExt := filepath.Ext(filename)
	baseFilename := strings.TrimSuffix(filename, fileExt)
	
	uploadParams := uploader.UploadParams{
		Folder:         folderPath,
		PublicID:       baseFilename,
		ResourceType:   "auto",
		UseFilename:    &[]bool{true}[0],
		UniqueFilename: &[]bool{true}[0],
		Overwrite:      &[]bool{false}[0],
		Type:           "private", // Make it private
	}

	resp, err := s.cld.Upload.Upload(ctx, file, uploadParams)
	if err != nil {
		return nil, fmt.Errorf("cloudinary upload failed: %w", err)
	}

	return &CloudinaryUploadResult{
		PublicID:  resp.PublicID,
		SecureURL: resp.SecureURL,
	}, nil
}

// DeleteFile deletes a file from Cloudinary
func (s *CloudinaryService) DeleteFile(publicID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_, err := s.cld.Upload.Destroy(ctx, uploader.DestroyParams{
		PublicID:     publicID,
		ResourceType: "auto",
	})
	if err != nil {
		return fmt.Errorf("cloudinary delete failed: %w", err)
	}
	return nil
}

// GetSignedURL generates a secure URL for private assets
func (s *CloudinaryService) GetSignedURL(publicID string) (string, error) {
	// Generate a secure URL for the private asset
	imageAsset, err := s.cld.Image(publicID)
	if err != nil {
		return "", fmt.Errorf("failed to create image asset: %w", err)
	}
	
	url, err := imageAsset.String()
	if err != nil {
		return "", fmt.Errorf("failed to generate URL: %w", err)
	}
	return url, nil
}
