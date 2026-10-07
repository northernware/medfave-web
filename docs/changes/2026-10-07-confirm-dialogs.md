# Chart confirmations are our own dialog, not the browser's

Remove (allergy, alert), Resolve (condition) and Stop (medicine) asked with the browser's `confirm()` box. They now open an in-app dialog like Archive's: the question as the title ("Mark Arthritis resolved?"), the reason beneath it, Cancel (focused) and the action named ("Mark resolved", "Stop", or a solid red "Remove"). Escape or a click outside cancels. In `ChartForm`, so every chart change with `confirm` gets it.

Also: dialog backdrops dimmed with the light text colour, which washed the page out pink in dark mode. All three dialogs (chart confirm, danger zone, action dialog) now dim with a dark tint in both themes.
