INTAKE for Product Studio (from Hearth, Nov 19, 2026): retire the old Hearth page

Repo: holroydchase-afk.github.io (portfolio). Page: `family-photos.html`. Owner: Product Studio.

What we found (loaded live Nov 19): `https://chaseholroyd.com/family-photos.html` still serves the old Hearth page with the old nav (Resume, About) and links to `/Hearth/`. The homepage no longer links to it; the current Hearth case study is the dialog at `https://chaseholroyd.com/#p-hearth`.

Done in Hearth (DEC-71, R60): every way back from the demo (the phone bar's "← Portfolio", the drawer's "Back to the Hearth case study", the laptop panel's "Read the case study") now opens `https://chaseholroyd.com/#p-hearth`.

Ask: replace `family-photos.html` with a redirect to `index.html#p-hearth` (a meta refresh plus a plain link), so old bookmarks and search results land on the current case study. Then check `/family-photos.html` opens the Hearth dialog.
