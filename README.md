# Hari & Rashmi wedding gallery

A free photo site that copies the look of a Pixieset gallery: a full-screen cover photo, album tabs across the top, a tight photo grid, and a swipe viewer. No server, no database, no monthly cost.

```
index.html, style.css, app.js   the website
albums.json                     the album list (made by build_gallery.py)
photos/                         web-sized photos (made by build_gallery.py)
build_gallery.py                resizes your photos and builds albums.json
originals/                      YOUR full-size photos (stays on your computer)
```

## 1. Add your photos

Download your photos from Pixieset (the download arrow in the gallery). Then create one folder per album inside `originals/`. The number at the start of a folder name sets the album order and is hidden on the site.

```
originals/
  _cover.jpg                    the full-screen cover photo (use your favorite couple photo)
  01 Rashmi Mehendi Pics/
  02 Decor/
  03 Engagement Couple Pics/
  04 Engagement Event Pics/
  05 Wedding/
```

If you skip `_cover.jpg`, the first photo of the first album is used as the cover.

## 2. Build the site

You need Python 3 (free from python.org) once:

```
pip3 install pillow
python3 build_gallery.py
```

This makes web-sized copies in `photos/` (about 2000 px on the long side, usually 300 to 600 KB each) and writes `albums.json`. Your originals are not changed. Run it again whenever you add photos; it only processes new ones.

Change the title, date, or optional photographer name at the top of `build_gallery.py` (the cover shows them in capitals).

The grid uses equal-height rows like Pixieset: every row has one height, photos keep their shape, and wide photos take more room. Other options for `grid` in `build_gallery.py` are `"uniform"` (every cell the same 2:3 size, photos cropped) and `"natural"` (columns). Run the script again after changing it. Spacing and text sizes can be fine-tuned in the first lines of `style.css` (`--gap`, `--edge`, `--title-size`, `--tab-size`).

On a wide screen the album tabs that do not fit go under a "More" menu, like Pixieset. The share button copies or shares the link, and the play button runs a slideshow. Inside the photo viewer you get a back arrow, download, share, play/pause, and the file name under each photo. Download saves the web-sized copy (about 2000 px), not your original. Pixieset's print store, favorites and download buttons need Pixieset's own service, so they are not included.

## 3. Preview on your computer

Opening `index.html` by double-clicking will not work, because browsers block loading `albums.json` from a file. Start a small local server instead:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## 4. Host it for free

### Option A: GitHub Pages

1. Create a free account at github.com and install the free GitHub Desktop app.
2. In GitHub Desktop, choose File > New repository, and pick this folder. Name it, for example, `wedding-gallery`. The included `.gitignore` keeps `originals/` off the internet.
3. Commit everything, then choose Publish repository. A public repository is needed for free GitHub Pages on a personal account.
4. On github.com open the repository, go to Settings > Pages, set the source to "Deploy from a branch", choose the `main` branch and the `/ (root)` folder, and save.
5. After a minute your site is live at `https://YOUR-USERNAME.github.io/wedding-gallery/`.

To update later: add photos, run `python3 build_gallery.py`, then commit and push in GitHub Desktop.

### Option B: Cloudflare Pages

1. Put the folder in a GitHub repository as above.
2. At dash.cloudflare.com choose Workers & Pages > Create > Pages > Connect to Git, and pick the repository.
3. Leave the build command empty and set the output directory to `/`. Deploy.
4. Your site is live at `https://PROJECT-NAME.pages.dev`.

## Privacy

A free static site is public to anyone who has the link. This site asks search engines not to list it, and the address is hard to guess, but anyone you share the link with can pass it on. Only share it with people you trust.

If you need real privacy, host on Cloudflare Pages and add Cloudflare Access (free for small groups) to require an emailed code, or share a Google Photos album instead.

## Size limits

Free hosting has size limits (GitHub Pages sites are limited to roughly 1 GB; check the current limits of whichever host you pick). Do not upload the `originals/` folder. Keep your full-size originals in Google Drive or Google Photos as a backup.

## Credit

To show a photographer name on the cover and footer, set `photographer` at the top of `build_gallery.py` and run it again. It is empty by default. Check your agreement with your photographers for rights to publish the photos online.
