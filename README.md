# OpenProject Wiki Enhancements

Two lightweight enhancements for **OpenProject Community (self-hosted)** that are not available without an Enterprise license:

1. **Custom CSS injection** — apply your own brand colors, typography, and readable-width layout to wiki content.
2. **Wiki sidebar collapse** — automatically collapse the wiki page tree to the current path on every page load and navigation.

Both work by injecting a CSS file and a JS file into every HTML response via Apache `mod_substitute`. No OpenProject source changes, no recompilation — the configuration lives outside the installer's reach and survives upgrades.

**Tested with:** OpenProject Community 16.6.3 · Apache 2.4.52 · Ubuntu 22.04 LTS

---

## Why this approach?

The *Administration → Design* page (logo, colors, theme) is an **Enterprise add-on** and is not present in the Community edition. The only reliable alternative without recompiling SASS assets is to inject a stylesheet via the reverse proxy that already sits in front of every OpenProject request.

---

## Files

| File | Purpose |
|---|---|
| `css/op-custom.css` | Wiki content styles — colors, font, headings, code, tables, blockquotes |
| `js/op-wiki-collapse.js` | Collapses wiki sidebar tree to current path |
| `apache/op-custom-vhost.conf` | Apache configuration snippet for injection |

---

## Setup

### 1 · Enable Apache modules

```bash
sudo a2enmod substitute filter headers
```

### 2 · Create the asset directory

```bash
sudo mkdir -p /opt/op-custom/fonts
```

Copy `css/op-custom.css` and `js/op-wiki-collapse.js` into `/opt/op-custom/`. If you want a custom font, place the `.woff2` files in `/opt/op-custom/fonts/` and update the `@font-face` block in `op-custom.css` accordingly.

```bash
sudo cp css/op-custom.css js/op-wiki-collapse.js /opt/op-custom/
sudo chown -R root:root /opt/op-custom
sudo chmod -R a+rX /opt/op-custom
```

### 3 · Install the Apache configuration

For **package installations (DEB/RPM)**, place the conf in the upgrade-safe custom include directory — this path is **not overwritten** by `openproject configure`:

```bash
sudo cp apache/op-custom-vhost.conf \
  /etc/openproject/addons/apache2/custom/vhost/op-custom.conf
```

> If this directory does not exist, create it:
> `sudo mkdir -p /etc/openproject/addons/apache2/custom/vhost`

For **Docker or custom setups**, include the snippet in your own reverse proxy configuration.

### 4 · Test and reload Apache

```bash
sudo apache2ctl configtest   # must output: Syntax OK
sudo systemctl reload apache2
```

### 5 · Verify

```bash
# Check assets are served (replace with your domain)
curl -kI -H 'Host: your-op-domain.example.com' https://127.0.0.1/op-custom/op-custom.css
curl -kI -H 'Host: your-op-domain.example.com' https://127.0.0.1/op-custom/op-wiki-collapse.js
```

Both should return `HTTP/1.1 200 OK`.

Open your OpenProject instance in a browser, view the page source (Ctrl+U), and confirm that `op-custom.css` appears before `</head>` and `op-wiki-collapse.js` appears before `</body>`.

---

## Customizing the CSS

Open `css/op-custom.css` and edit the CSS variables at the top of the file:

```css
:root {
  --custom-primary:   #2A6EBB;   /* H1, accent, blockquote border */
  --custom-secondary: #1A4A7A;   /* H2/H3, table header background */
  --custom-text:      #333333;   /* body text */
}
```

All color references in the file use these variables, so you only need to change values in one place.

To use a **custom font**, replace `YourFont` in the `@font-face` block and the `font-family` declaration with your font's actual name and file paths. To use the OP default font (Lato), remove the `@font-face` block and the `font-family` line entirely.

---

## Known issues & gotchas

### `RequestHeader unset Accept-Encoding` is mandatory
Without this directive, the OpenProject backend delivers gzip-compressed HTML. `mod_substitute` cannot search inside compressed content, so the `</head>` and `</body>` markers are never found and injection silently fails. The directive forces the backend to respond with uncompressed HTML for this virtual host.

### `ProxyPass /op-custom !` must come first
OpenProject's default vhost contains a catch-all `ProxyPass /` that forwards every request to the backend process. Without the `!` exception before it, requests for `/op-custom/op-custom.css` are forwarded to the OpenProject application, which returns 404. The exception must appear **before** the catch-all.

### Font family not applied despite file loading
OpenProject's default `font-family` rule has higher specificity than a simple class selector. The workaround is the double-class pattern `.op-uc-container.op-uc-container` combined with `!important`. This is the minimum required to reliably override the default. Verify with: `document.fonts.check('16px "YourFont"')` in the browser console — `true` means the font is loaded but possibly blocked by specificity.

### Wiki sidebar toggle requires a real MouseEvent
OpenProject's sidebar is an Angular app using Stimulus controllers. The collapse script uses `dispatchEvent(new MouseEvent('click', {bubbles: true, …}))` instead of the plain `.click()` method. Plain `.click()` does not reliably trigger the Stimulus event handler in OP 16.6.3.

### Local curl test returns 400
Requests to `https://127.0.0.1` are rejected by OpenProject with "Invalid host_name configuration". Always include the correct Host header when testing locally: `curl -kI -H 'Host: your-op-domain.example.com' https://127.0.0.1/...`

### Check after OpenProject upgrades
The conf file survives upgrades (it lives outside the installer's scope), but verify the following after any major update:
- Apache modules still active: `apachectl -M | grep substitute`
- Conf still loaded: `sudo apache2ctl -t -D DUMP_INCLUDES | grep op-custom`
- Assets still return 200
- CSS selectors `op-uc-*` and JS selectors `tree-menu--*` still match the rendered DOM (inspect with browser DevTools)

---

## License

MIT — see [LICENSE](LICENSE).

---

---

# OpenProject Wiki Erweiterungen

Zwei einfache Erweiterungen für **OpenProject Community (selbst gehostet)**, die ohne Enterprise-Lizenz nicht verfügbar sind:

1. **CSS-Injektion** — eigene Markenfarben, Typografie und Lesebreite im Wiki-Inhalt.
2. **Sidebar-Kollaps** — der Wiki-Seitenbaum wird bei jedem Laden und bei jeder Navigation auf den aktuellen Pfad reduziert.

Beide Erweiterungen funktionieren, indem Apache via `mod_substitute` eine CSS- und eine JS-Datei in jede HTML-Antwort injiziert. Keine Änderungen am OpenProject-Quellcode, keine Neukompilierung — die Konfiguration liegt außerhalb des Installers und übersteht Upgrades.

**Getestet mit:** OpenProject Community 16.6.3 · Apache 2.4.52 · Ubuntu 22.04 LTS

---

## Warum dieser Ansatz?

Die Seite *Administration → Design* (Logo, Farben, Theme) ist ein **Enterprise-Add-on** und in der Community-Edition nicht vorhanden. Die einzige zuverlässige Alternative ohne SASS-Neukompilierung ist die Injektion eines Stylesheets über den Reverse-Proxy.

---

## Einrichtung

### 1 · Apache-Module aktivieren

```bash
sudo a2enmod substitute filter headers
```

### 2 · Asset-Verzeichnis anlegen

```bash
sudo mkdir -p /opt/op-custom/fonts
sudo cp css/op-custom.css js/op-wiki-collapse.js /opt/op-custom/
sudo chown -R root:root /opt/op-custom
sudo chmod -R a+rX /opt/op-custom
```

Eigene Schriftarten (`.woff2`) in `/opt/op-custom/fonts/` ablegen und den `@font-face`-Block in `op-custom.css` anpassen.

### 3 · Apache-Konfiguration einbinden

Bei **Paket-Installationen (DEB/RPM)** in das upgrade-sichere Verzeichnis legen — dieses wird von `openproject configure` **nicht** überschrieben:

```bash
sudo cp apache/op-custom-vhost.conf \
  /etc/openproject/addons/apache2/custom/vhost/op-custom.conf
```

### 4 · Testen und neu laden

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

### 5 · Prüfen

```bash
curl -kI -H 'Host: deine-op-domain.example.com' https://127.0.0.1/op-custom/op-custom.css
```

Antwort muss `HTTP/1.1 200 OK` sein. Im Browser-Quelltext (Strg+U) muss `op-custom.css` vor `</head>` und `op-wiki-collapse.js` vor `</body>` stehen.

---

## CSS anpassen

Die Farbvariablen am Anfang von `op-custom.css` ersetzen:

```css
:root {
  --custom-primary:   #2A6EBB;
  --custom-secondary: #1A4A7A;
  --custom-text:      #333333;
}
```

Alle Farbreferenzen in der Datei nutzen diese Variablen — nur hier anpassen.

---

## Lizenz

MIT — siehe [LICENSE](LICENSE).
