package server

import "testing"

// A register/ file is split into its documents, each PUT to its kind's
// resource by its name.
func TestResourceDocs(t *testing.T) {
	docs, err := resourceDocs([]byte("# skills\napiVersion: mywant.io/v1\nkind: CharacterSkill\nmetadata:\n  name: throw\nspec:\n  label: 投げる\n---\nkind: CharacterSkill\nmetadata:\n  name: connect\n---\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(docs) != 2 || docs[0].plural != "character-skills" || docs[0].name != "throw" || docs[1].name != "connect" {
		t.Fatalf("docs = %+v", docs)
	}
	if _, err := resourceDocs([]byte("kind: CharacterSkill\nspec: {}\n")); err == nil {
		t.Error("a document without a name was taken")
	}
}
