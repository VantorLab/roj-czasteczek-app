# Rój Cząsteczek

Zdjęcie produktu, logo, napis albo model 3D → efektowne wideo reklamowe: cząsteczki GPU, relief 3D, klocki z fizyką, rozbite szkło, płyn, światło kinowe, retro. Doradca AI sam projektuje efekt i uczy się z ocen.

## Trzy wersje z jednego kodu

| Wersja | Gdzie | Jak zainstalować |
|---|---|---|
| **Windows** | `.exe` / `.msi` z zakładki **Releases** | Pobierz `Roj Czasteczek_…_x64-setup.exe`, uruchom. Działa offline. |
| **iPhone / Android** | strona GitHub Pages tego repozytorium | Otwórz link w Safari → Udostępnij → **Do ekranu początkowego**. Pełny ekran, ikona, działa offline. |
| **Online w Claude** | Artifact w claude.ai | Link w bazie wiedzy (`wiki/produkty/roj-czasteczek.md`). Doradca AI działa na koncie Claude, pamięć wspólna dla zespołu. |

Doradca AI w wersji Windows i na telefonie potrzebuje **klucza API Anthropic** (zakładka *Doradca AI → Silnik AI poza Claude*). Klucz zostaje na urządzeniu.

## Struktura

```
src/            kod aplikacji (CSS, HTML panelu, moduły JS)
tools/build.py  buduje: dist/ (wersja online i Artifact) oraz app/index.html (Windows + telefon, biblioteki lokalnie)
app/            aplikacja offline: index.html, vendor/ (three.js i in.), ikony, manifest, service worker
src-tauri/      powłoka Windows (Tauri 2)
.github/workflows/build.yml   automatycznie: instalator Windows → Releases, strona → GitHub Pages
```

## Rozwój

```bash
python3 tools/build.py          # po każdej zmianie w src/
python3 -m http.server -d app   # podgląd wersji aplikacji na http://localhost:8000
```

Wypchnięcie na `main` buduje instalator Windows i aktualizuje stronę dla telefonów.

### Jednorazowo w ustawieniach repozytorium
**Settings → Pages → Source: GitHub Actions** (dla wersji na telefon). GitHub Pages w repozytorium prywatnym wymaga płatnego planu GitHub; w publicznym jest darmowe.
