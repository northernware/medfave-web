# Landing page: fit phones

Opened: 2026-10-25 15:06 PHT

**What**
- Header on phones: only the logo and Sign in. The theme toggle and Get started appear from the small breakpoint up; they overflowed at 390px.
- Hero film: a taller 4:5 crop on phones, centred on the phone in the film. 16:9 stays on wider screens.
- Product story on phones: each step shows the matching screen from the doctor or patient app in a phone frame. The desktop screenshots were unreadable at phone width.
- Apps section: smaller tilt and side padding on phones, so the three phones stay inside the screen.

**Why**
The landing page from #260 didn't read well on a phone.

**Tested**
`tsc` and `eslint` pass. Checked at 390×844 down the page, and at 1440px for the desktop layout (unchanged). Not checked on a real device.
