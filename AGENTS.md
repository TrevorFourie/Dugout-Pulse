# Dropdown styling standard

All dropdowns in Dugout Pulse must use the same visual style as the **Filter Stats** dropdown implemented by `src/components/ThemedDropdown.tsx`.

## Required rules
- Prefer the shared `ThemedDropdown` component for every selection dropdown. Do not introduce native HTML `<select>` elements for app UI dropdowns.
- For editable/type-to-search comboboxes (such as opponent, tournament, and custom-value fields), preserve their typing, filtering, create, delete, and keyboard behavior, but make the closed field and opened menu visually match `ThemedDropdown`.
- Match its rounded-xl corners, subtle slate border, white light-mode surface, `#252D38` dark-mode surface, compact semibold text, teal focus ring, subtle shadow, and chevron.
- Match menu styling: white/`#252D38` surface, slate border, rounded-xl corners, shadow-xl, compact padded options, slate hover surface (`#F1F5F9` / `#2D3643`), and teal selected state (`#00BFA5` light / `#00D7BC` dark) with a checkmark where appropriate.
- Keep light and dark themes consistent. Do not create a new dropdown palette or a one-off visual treatment.
- If a dropdown needs a capability the shared component does not yet support (for example, disabled state), extend `ThemedDropdown` and reuse it rather than styling a separate dropdown from scratch.
- When adding or modifying a dropdown, check this standard and update the shared component if the styling needs to change globally.

The source of truth is `src/components/ThemedDropdown.tsx`; this file defines the canonical implementation and visual tokens.