# Examples: Accessibility Check in Action

## Example 1: WCAG 2.1 AA Compliance Audit on a React Application

**User Request:** "Our product team says we need WCAG 2.1 AA compliance — audit the entire frontend."

### Loop 1: Component Inventory
```bash
health_score                                              # establish baseline
get_context filepath="src/components/"                    # load component context
search_code query="<img" path="src/" glob="*.tsx"         # find all images (alt text check)
search_code query="<button\|<a " path="src/" glob="*.tsx" # find interactive elements
search_code query="onClick" path="src/" glob="*.tsx"      # find click handlers (keyboard check)
```

### Loop 2: ARIA and Semantic HTML Audit
```bash
audit_file filepath="src/components/Navigation.tsx"       # audit nav component
audit_file filepath="src/components/Modal.tsx"            # audit modal (critical ARIA)
audit_file filepath="src/components/Form.tsx"             # audit form (label associations)
search_code query="aria-" path="src/" glob="*.tsx"        # find existing ARIA usage
search_code query="role=" path="src/" glob="*.tsx"        # find role attributes
```

### Loop 3: Remediation Task Generation
```bash
run_skill skill="accessibility-check" filepath="src/components/"  # full a11y audit
task_create title="A11y: Add alt text to all 23 images missing alt attribute" category="accessibility"
task_create title="A11y: Add aria-label to icon-only buttons in Navigation" category="accessibility"
task_create title="A11y: Fix modal focus trap — focus must not escape modal" category="accessibility"
task_create title="A11y: Associate all form labels with inputs using htmlFor" category="accessibility"
generate_report type="accessibility" path="src/components/"
task_next
```

---

## Example 2: Keyboard Navigation Audit

**User Request:** "A user reported they can't navigate our app with keyboard only — fix everything."

### Loop 1: Focus Management Analysis
```bash
get_context filepath="src/components/"                    # load component context
search_code query="tabIndex" path="src/" glob="*.tsx"     # find manual tab index usage
search_code query="tabIndex={-1}" path="src/" glob="*.tsx" # find intentionally unfocusable elements
search_code query="onKeyDown\|onKeyPress\|onKeyUp" path="src/" glob="*.tsx"  # find keyboard handlers
```

### Loop 2: Interactive Element Keyboard Support
```bash
audit_file filepath="src/components/Dropdown.tsx"         # audit dropdown keyboard support
audit_file filepath="src/components/DatePicker.tsx"       # audit datepicker keyboard support
audit_file filepath="src/components/DataTable.tsx"        # audit table keyboard navigation
search_code query="div.*onClick\|span.*onClick" path="src/" glob="*.tsx"  # find non-semantic click handlers
search_code query="cursor.*pointer" path="src/" glob="*.css"  # find CSS-only interactive indicators
```

### Loop 3: Focus Visibility and Order
```bash
search_code query="outline.*none\|outline: 0" path="src/" glob="*.css"   # find hidden focus indicators
search_code query=":focus" path="src/" glob="*.css"       # find focus styles (ensure visible)
run_skill skill="accessibility-check" filepath="src/"     # comprehensive keyboard audit
task_create title="A11y: Replace div onClick with button element in Dropdown" category="accessibility"
task_create title="A11y: Add keyboard event handlers to DataTable row selection" category="accessibility"
task_create title="A11y: Restore visible focus outline — CSS outline:none removed it" category="accessibility"
generate_report type="accessibility" path="src/"
```

---

## Example 3: Color Contrast and Visual Accessibility Audit

**User Request:** "Our design team changed the color scheme — check that contrast ratios are still WCAG compliant."

### Loop 1: Color Usage Discovery
```bash
get_context filepath="src/styles/"                        # load styles context
search_code query="color:" path="src/" glob="*.css"       # find text color declarations
search_code query="background-color:" path="src/" glob="*.css"  # find background colors
search_code query="--color\|--bg" path="src/" glob="*.css"  # find CSS custom properties
audit_file filepath="src/styles/tokens.css"               # audit design token definitions
```

### Loop 2: Contrast Ratio and Color Dependency Analysis
```bash
search_code query="color.*error\|color.*warning\|color.*success" path="src/" glob="*.css"  # status colors
search_code query="color.*gray\|color.*grey\|color.*light" path="src/" glob="*.css"        # low-contrast suspects
audit_file filepath="src/components/Badge.tsx"            # audit status badge component
audit_file filepath="src/components/Alert.tsx"            # audit alert component
search_code query="color.*only\|only.*color" path="src/"  # find color-only information conveyance
```

### Loop 3: WCAG Contrast Compliance Tasks
```bash
run_skill skill="accessibility-check" filepath="src/styles/"
task_create title="A11y: Increase text contrast on gray-400 (#9CA3AF on white fails AA)" category="accessibility"
task_create title="A11y: Add icon/pattern to color-coded status badges (color alone fails)" category="accessibility"
task_create title="A11y: Fix error state red (#EF4444) on white — 3.85:1 fails AA (need 4.5:1)" category="accessibility"
task_create title="A11y: Update placeholder text color to meet 4.5:1 contrast ratio" category="accessibility"
generate_report type="accessibility" path="src/"
task_next
```
