// Package corsorigin normalizes browser Origin / configured frontend URLs for CORS allowlists.
package corsorigin

import "strings"

// Normalize trims space and a trailing slash so env like "https://app.example.com/"
// matches the browser Origin "https://app.example.com".
func Normalize(o string) string {
	return strings.TrimSuffix(strings.TrimSpace(o), "/")
}
