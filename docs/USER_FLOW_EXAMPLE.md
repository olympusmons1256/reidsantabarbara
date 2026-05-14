## Concrete Example: Reid's Resume Generation Flow

This shows step-by-step how a user (Reid) would use the system with the improvements implemented.

### Before: Current Limitations

Reid tries to generate a resume:
```
1. Opens editor, sees blank form
2. Pastes resume text → clicks "Generate AI Draft"
   (No validation, form looks empty)
3. Clicks anyway
4. Waits... "Generating..."
5. Gets result but unsure if it's real or placeholder
6. Wants to try again with LinkedIn added
7. No way to reset without reloading page
8. Loses work
```

### After: Phase 1 Improvements

**Setup:**
```
Reid's content:
- Full resume text (2000 words)
- LinkedIn profile URL
- Potential to add portfolio ZIP
```

**Step-by-Step:**

#### 1. Opens Editor
```
Sees three input sections:
✓ Full Name: [text]
✓ LinkedIn URL: [text] — Help: "Profile auto-fetched for content"
✓ Web URLs (one per line)
✓ Resume Text: [textarea, 6 rows]
✓ Additional Context: [textarea, 4 rows]
✓ Add Source Documents: [file picker]

Button: "Generate AI Draft" — DISABLED (grayed out 50% opacity)
Status: "Idle"
```

#### 2. Provides Intake
```
Reid fills in:
✓ Full Name: "Reid Santabarbara"
✓ LinkedIn URL: "https://www.linkedin.com/in/reid-santabarbara-9a70364b/"
✓ Resume Text: [pastes full 2000-word resume]

Sees list of ingested documents:
- (none yet)
```

#### 3. Validation Triggers
```
hasContentForGeneration() checks:
- resumeText.trim() → ✓ Has content (2000+ chars)
- linkedinUrl.trim() → ✓ Has URL
- intakeDocuments.length → 0 (none yet)
- intakeWebSources → 0 (none yet)

Result: Returns TRUE
Button: "Generate AI Draft" — ENABLED (100% opacity)
```

#### 4. Starts Generation
```
Reid: Clicks "Generate AI Draft"
Status: "Generating AI draft..."
Button: Shows "Generating..." + disables

Backend:
1. Fetches LinkedIn profile (auto-extracts JSON-LD data)
2. Parses resume text line-by-line:
   - Detects "RESUME", "EDUCATION", "BIOGRAPHY" sections
   - Groups items: Odyssey, RSD, Hotmax, Ride-Show, etc.
   - Extracts: title, company, dates, description
3. Calls Claude API to structure into template
4. Returns 2 variants with tags populated
```

#### 5. Results Display
```
After 8-12 seconds:

Status: "✅ Draft generated: 2 variants, 5 sections, 20 items. 📡 Sources: 2/3 usable (2 fetched)."

Summary stats:
- Variants: 2 ✓ (Full Portfolio, Technical Focus)
- Sections: 5 ✓ (Summary, Experience, Spectacles, Education, Skills)
- Items: 20 ✓ (6 in Experience, 3 in Spectacles, etc.)

Source diagnostics:
• https://www.linkedin.com/in/reid-... — ok, 4521 chars
• [resumeText] — ok, 2047 chars
  (LinkedIn fetch may fail due to anti-bot, but resume text covers it)

Ingested documents:
- (none)
```

#### 6. Auto-Display
```
Page auto-scrolls to "Sections + Items + Media" editor
Active variant: "Full Portfolio" (auto-selected as most-populated)

Reid can now see:
- Summary section with professional overview
- Experience section with Odyssey, RSD, Hotmax, Ride-Show, Connors & Co, Seattle Theatre Group
- Select Works with Sub Pop, Boeing, Smithsonian spectacles
- Education with UW certificate
- Skills section

All items have:
✓ Title, summary, detail filled in (real content, not placeholder)
✓ Tags populated: company, role, project-scale
✓ Ready to edit
```

#### 7. Iterates (New in Phase 1)
```
Reid reviews and thinks:
"I want to also include my portfolio case studies"

Option A - Add documents:
- Clicks "Add Source Documents"
- Uploads portfolio-pdf.pdf
- Browser extracts text
- Clicks "Generate AI Draft" again
- (Can reset first to clear old template)

Option B - Reset and Try Again:
- Clicks "Reset" button
- Confirms: "Clear current template and start over? Intake data will be preserved."
- Template clears, but intake fields still have:
  - Full Name: "Reid Santabarbara"
  - LinkedIn URL: "https://www.linkedin.com/in/..."
  - Resume Text: (preserved)
- Adds portfolio PDF
- Clicks "Generate AI Draft"
- Gets new variant with portfolio content merged in

Option C - Just Edit:
- Manually edits sections/items
- All changes persist to localStorage
- Can save to Supabase later
```

#### 8. Form Validation in Action

**Scenario A: Empty form**
```
Reid opens fresh, sees form empty
Clicks "Generate AI Draft"

hasContentForGeneration() returns FALSE:
- hasResume = "".trim().length > 0 → FALSE
- hasLinkedIn = "".trim().length > 0 → FALSE
- hasDocuments = 0 → FALSE
- hasWebSources = 0 → FALSE

Result: FALSE

Button: DISABLED
Status: (unchanged, no attempt made)
```

**Scenario B: Only name**
```
Full Name: "Reid Santabarbara"
Everything else: empty

hasContentForGeneration() returns FALSE

Button: DISABLED
Status: "Please provide at least one content source: resume text, LinkedIn URL, web URLs, or documents."
```

**Scenario C: Name + resume**
```
Full Name: "Reid Santabarbara"
Resume Text: "I have 15 years of experience..."

hasContentForGeneration() returns TRUE:
- hasResume = true

Button: ENABLED
```

#### 9. Error Handling

**Case 1: Model temporarily unavailable**
```
API returns error: "API rate limit exceeded, try again in 30 seconds"

Error catch block:
- Detects: errorMsg.includes("model") || errorMsg.includes("api")
- User-friendly: "AI model temporarily unavailable. Try again in a moment. Details: API rate limit..."
- Action: Reid waits 30s and retries
```

**Case 2: Token limit**
```
API returns error: "Token limit exceeded for model"

Error catch block:
- Detects: errorMsg.includes("token")
- User-friendly: "Token limit exceeded. Try with less content. Details: Token limit exceeded..."
- Action: Reid removes one long document and retries
```

**Case 3: Malformed input**
```
Resume text is unstructured junk

API falls back to deterministic parsing:
- Can't find section headers
- Returns 5-section scaffold with placeholder items
- Uses names from intake (full name + company hints)

Result: At least gives Reid a starting point to edit
```

#### 10. Document Removal (New in Phase 1)

```
Reid uploads 3 files:
• portfolio.pdf — "Zip extracted..." — [Remove]
• resume.txt — "✓" — [Remove]
• cover-letter.docx — "Document attached: cover-letter.docx (binary)" — [Remove]

Realizes portfolio.pdf is 50MB and would slow generation.
Clicks [Remove] next to it.

intakeDocuments now has 2 items.
Status: "Removed document 1."

Generates with just resume.txt + cover-letter.docx parsed.
```

### Key Improvements Visible to Reid

| Before | After |
|--------|-------|
| Must provide something but unclear what | "Please provide at least one content source..." |
| Button always available, might fail silently | Button disables until content provided |
| No way to reset without reloading | "Reset" button with confirmation |
| Can't remove wrong file | "Remove" button per document |
| Generic "failed" error | "Token limit exceeded" + "try with less content" |
| "Generating..." with no ETA | "✅ Draft generated: 2 variants, 5 sections, 20 items..." |
| Must manually delete whole template | "Reset" but keep intake data for quick iteration |

### Real Numbers from Reid's Data

**Intake:**
- Resume text: 2,047 characters
- LinkedIn profile URL: 1 URL
- Documents: (optionally) 1-3 files

**Generation (API call):**
- Request size: ~3-4 KB (after compression)
- Response size: ~8-12 KB (full template JSON)
- Duration: 8-12 seconds (varies by web fetch success)
- Token usage: ~1,500-2,000 tokens (varies by content length)

**Output:**
- 2 variants generated
- 5 sections populated
- 20+ items with real content
- Tags filled in for filtering
- All ready for user editing

### Success Criteria (What User Sees)

✅ Intake validation prevents "nothing provided" scenario
✅ Reset button enables quick iteration
✅ Document removal lets users fix mistakes
✅ Better errors guide recovery actions
✅ Status messages show progress + results
✅ All changes persist to browser
✅ Can save to Supabase when satisfied

**Reid's workflow:**
1. Paste resume → See filled template instantly
2. "Hmm, missing portfolio case studies" → Add file + regenerate
3. "Reset, try different structure" → Clear + adjust + regenerate
4. "Good enough" → Save to Supabase → Share link
