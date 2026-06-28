package audit

import "testing"

func TestNormalize(t *testing.T) {
	if Normalize("ok") != "ok" {
		t.Fatal("unexpected normalize result")
	}
}
