# TC Grüze - Moderne Website

Eine moderne, responsive Website für den Tennisclub Grüze in Winterthur.

## Features

### Design
- Schlichtes, modernes Design mit dezenten Farben und viel Weissraum
- Responsive Design für alle Geräte (Desktop, Tablet, Mobile)
- Farbige Navigation mit eindeutiger Zuordnung der Bereiche
- Verwendung der Bilder von der bestehenden Website

### Struktur
- **Home**: Startseite mit Hero-Bereich, Club-Informationen und Übersicht
- **Club**: Informationen über den Verein
- **Mitgliedschaft**: Mitgliedschaftsoptionen für Tennis und Pickleball
- **Sport**: Sportangebote und Trainingsmöglichkeiten
- **Events**: Veranstaltungen und Termine
- **Service**: Downloads und Services
- **Kontakt**: Kontaktinformationen
- **Members**: Passwortgeschützter Mitgliederbereich

### Mitgliederbereich
- Passwortgeschützter Zugang (Demo: Benutzername "demo", Passwort "password")
- Download-Bereich mit verschiedenen Kategorien:
  - Protokolle & Berichte
  - Reglemente & Formulare
  - Trainingspläne & Listen
- Schnellzugriff auf wichtige Funktionen
- Interne News für Mitglieder

### Technische Details
- Reines HTML, CSS und JavaScript (keine Frameworks)
- Client-seitige Authentifizierung für den Mitgliederbereich
- Optimierte Bilder (WebP-Format mit JPEG-Fallback)
- SEO-optimiert mit Meta-Tags
- Barrierefreie Navigation

## Dateien

### Hauptdateien
- `index.html` - Startseite
- `css/style.css` - Hauptstil-Datei
- `css/responsive.css` - Responsive Styles
- `css/members.css` - Styles für den Mitgliederbereich
- `js/main.js` - Hauptskript für Interaktivität
- `js/auth.js` - Authentifizierungsskript

### Mitgliederbereich
- `pages/members/index.html` - Login-Seite
- `pages/members/dashboard.html` - Dashboard nach Login

### Bilder
- `images/hero/` - Hero-Bilder für die Startseite
- `images/club/` - Club-Bilder
- `images/icons/` - Logos und Icons

## Installation

1. Alle Dateien auf einen Webserver hochladen
2. Sicherstellen, dass alle Pfade korrekt sind
3. Website über den Browser aufrufen

## Demo-Zugang

Für den Mitgliederbereich:
- **Benutzername**: demo
- **Passwort**: password

## Browser-Kompatibilität

- Chrome/Edge (neueste Versionen)
- Firefox (neueste Versionen)
- Safari (neueste Versionen)
- Mobile Browser (iOS Safari, Chrome Mobile)

## Anpassungen

Die Website kann einfach angepasst werden:
- Farben in `css/style.css` unter `:root` ändern
- Inhalte in den HTML-Dateien bearbeiten
- Bilder in den entsprechenden Ordnern ersetzen
- Für echte Authentifizierung: Backend-System implementieren

## Kontakt

Bei Fragen zur Website wenden Sie sich an den Entwickler oder an info@tcgrueze.ch.

