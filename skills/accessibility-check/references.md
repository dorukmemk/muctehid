# References: Accessibility Check — Manus Principles Applied

## The 6 Manus Principles for Accessibility Check

### 1. Accessibility Is a Correctness Requirement, Not a Nice-to-Have
An interface that is inaccessible to users with disabilities is a broken interface. Frame accessibility as a correctness issue, not a polish issue.

> "Use `health_score` to track accessibility as a first-class quality metric. An app with excellent test coverage but zero keyboard support is not a quality app."

- In many jurisdictions (ADA, EN 301 549, EAA), accessibility is a legal requirement for commercial software
- WCAG 2.1 AA is the internationally recognized minimum standard for most commercial applications
- WCAG 2.1 AAA is aspirational for general products but required for some government and education contexts

### 2. Test with the POUR Framework
All WCAG success criteria derive from four principles. Audit against principles, not just individual checkboxes.

| Principle | Meaning | Key Checks |
|-----------|---------|-----------|
| Perceivable | All content can be perceived by users with different sensory abilities | Alt text, captions, contrast ratios, text alternatives |
| Operable | All functionality can be operated by users with different motor abilities | Keyboard nav, focus management, no seizure-triggering content |
| Understandable | All content and UI behavior is predictable and clear | Error messages, labels, consistent navigation |
| Robust | Content works with current and future assistive technologies | Valid HTML, ARIA used correctly, semantic structure |

### 3. Keyboard Navigation Is the Foundation
Screen readers, switch devices, and many assistive technologies rely on keyboard navigation. If it does not work with a keyboard, it does not work for many users.

> "Use `search_code query='div.*onClick'` to find every non-semantic interactive element. Each one is a keyboard accessibility violation."

- Every interactive element must be reachable by Tab key
- Every action triggered by mouse must be triggerable by keyboard
- Focus order must be logical — following the visual reading order
- Focus must never be trapped in a component (except intentionally in modals)
- Focus must always be visually visible — `outline: none` without a replacement is a WCAG 2.1 failure

### 4. ARIA Is a Supplement, Not a Replacement for Semantic HTML
Incorrect ARIA is worse than no ARIA. ARIA overrides native semantics — getting it wrong actively misleads screen reader users.

> "Use `search_code query='aria-'` to audit all ARIA usage. Every ARIA attribute must have a valid value and be used in the correct context."

| Rule | Detail |
|------|--------|
| No ARIA is better than wrong ARIA | An incorrect `role` confuses screen readers more than no role |
| Use native HTML elements first | `<button>` beats `<div role="button">` every time |
| Every ARIA widget needs keyboard support | Adding `role="combobox"` requires implementing all combobox keyboard patterns |
| `aria-label` vs `aria-labelledby` | Use `aria-labelledby` when the label is visible text; `aria-label` for invisible labels only |

### 5. Color Contrast Has Precise Numeric Requirements
"Looks OK" is not a WCAG test. Contrast ratios have defined thresholds that must be met mathematically.

> "Audit contrast ratios numerically, not visually. Use `search_code` to find color declarations, then verify ratios against WCAG thresholds."

| Content Type | WCAG AA Ratio | WCAG AAA Ratio |
|-------------|--------------|----------------|
| Normal text (< 18pt) | 4.5:1 | 7:1 |
| Large text (≥ 18pt or 14pt bold) | 3:1 | 4.5:1 |
| UI components and icons | 3:1 | 4.5:1 |
| Decorative elements | No requirement | No requirement |
| Disabled elements | No requirement | No requirement |

- Color must never be the only means of conveying information (color-blindness affects 8% of males)
- Always pair color-coded status with text, icon, or pattern

### 6. Test with Real Assistive Technology
Static code analysis finds structural issues. Only testing with actual screen readers reveals behavioral issues.

> "After `run_skill skill='accessibility-check'` passes, test manually with NVDA + Firefox, VoiceOver + Safari, and JAWS + Chrome for full coverage."

- Automated tools catch approximately 30-40% of WCAG violations
- The remaining 60-70% require human judgment and assistive technology testing
- `task_create` automated findings immediately; schedule manual AT testing as a milestone

---

## Agent Loop: Accessibility Check Steps

```
ANALYZE   → search_code (find interactive elements, images, ARIA, form fields)
THINK     → apply POUR framework: which principle is most likely violated?
SELECT    → choose audit scope: semantic HTML / ARIA / keyboard / contrast / forms
EXECUTE   → run_skill accessibility-check for comprehensive structural analysis
OBSERVE   → categorize findings by WCAG level (A vs AA vs AAA) and impact
ITERATE   → task_create per violation, prioritize by user impact, re-audit
```

---

## Key Quotes

> "Accessibility is not about adding features for 'disabled users' — it is about removing barriers for all users. Most accessibility fixes improve usability for everyone."

> "If you cannot reach it with a keyboard, your keyboard-only users cannot use it. They include people with motor disabilities, power users, and anyone whose mouse died."

> "Screen reader users do not see your interface — they hear it. Every visual design decision must have an audio equivalent."

> "The outline:none CSS rule is the single most common accessibility regression introduced by well-meaning developers who want 'cleaner' focus styles."

---

## 3-Strike Protocol

When accessibility audit finds no violations but user reports persist:

1. **Strike 1:** Test with an actual screen reader (NVDA is free) — automated tools miss reading order, context changes, and dynamic content announcements
2. **Strike 2:** Use `search_code query="aria-live"` to find (or confirm absence of) live region announcements for dynamic content updates
3. **Strike 3:** Audit focus management in interactive widgets (modals, dropdowns, popovers) — use `search_code query="focus()"` to find programmatic focus management and verify it is correct

> "If three automated passes find nothing but users still report issues, the barrier is behavioral (timing, focus, announcements) not structural. Move to manual testing."

---

## WCAG 2.1 Quick Reference Checklist

### Level A (Minimum — Must Have)
- [ ] All images have alt text (`search_code query="<img"`)
- [ ] All form inputs have labels (`search_code query="<input"`)
- [ ] No color-only information conveyed
- [ ] All functionality available from keyboard
- [ ] No keyboard traps (except intentional modal traps)
- [ ] No content that flashes > 3 times per second

### Level AA (Standard — Target)
- [ ] Contrast ratio ≥ 4.5:1 for normal text
- [ ] Contrast ratio ≥ 3:1 for large text and UI components
- [ ] Focus indicator is visible
- [ ] Error messages are descriptive and associated with fields
- [ ] Headings are hierarchical and meaningful
- [ ] No reliance on color alone for status

### Level AAA (Enhanced — Aspirational)
- [ ] Contrast ratio ≥ 7:1 for normal text
- [ ] Sign language alternatives for video
- [ ] Reading level ≤ lower secondary education
