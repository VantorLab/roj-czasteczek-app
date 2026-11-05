# Rój Cząsteczek — instrukcja obsługi

Zdjęcie produktu → efektowne wideo reklamowe w kilka minut. Film instruktażowy: `docs/instrukcja.mp4`.

## Gdzie uruchomić
| Wersja | Jak |
|---|---|
| **Windows** | Pobierz `…setup.exe` z [Releases](https://github.com/VantorLab/roj-czasteczek-app/releases/latest) → uruchom. Przy ostrzeżeniu Windows: *Więcej informacji → Uruchom mimo to*. |
| **iPhone / Android** | Otwórz [vantorlab.github.io/roj-czasteczek-app](https://vantorlab.github.io/roj-czasteczek-app/) w Safari → *Udostępnij → Do ekranu początkowego*. |
| **Online w Claude** | Link do Artifactu (Doradca AI działa tu bez klucza API). |

## Najszybciej: niech zrobi to Doradca AI (1 minuta)
1. Zakładka **Doradca AI** → **Wrzuć zdjęcie lub logo**.
2. W polu *Cel / uwagi* wpisz np. „rolka na Instagram, luksusowo, cena 6900 zł”.
3. Kliknij **Zaproponuj i zastosuj**. Doradca dobierze efekt, kolory, napisy i sekwencję i od razu ją odtworzy.
4. Pasek na dole: **Gotowe** (zostaw) albo **Anuluj** (wróć do poprzedniego stanu).
5. Popraw słowami (np. „bardziej dynamicznie, złote napisy”) i **oceń wynik** — tak Doradca się uczy.

> W aplikacji Windows/telefon Doradca potrzebuje klucza API Anthropic (*Doradca AI → Silnik AI poza Claude*).

## Ręcznie: 6 kroków
1. **Kształty** → *Wgraj* zdjęcie do kształtu 1. Masz zdjęcie z tłem? *Obrysuj* obiekt kliknięciami (lub *Wytnij automatycznie* AI). Dla ciemnych zdjęć ustaw *Tło zdjęcia: Zostaw całe zdjęcie*.
2. **Efekty** → wybierz efekt główny: Cząsteczki, Relief 3D, Klocki z fizyką, Rozbite szkło. Dodaj *Płyn*, *Połysk*, *Retro*, jeśli chcesz.
3. **Wygląd** → *Szablon stylu* (np. Luksus złoty) albo własne kolory, tło, jasność. Przy zdjęciach mebli: wyłącz *Świecenie*.
4. **Marka** → tytuł, cena, przycisk (CTA), logo, znak wodny.
5. **Sekwencja** → gotowy szablon (*zdjęcie → rój*, *kolory żywicy*) albo własne kroki; *Ruch kamery*. Sprawdź: **Odtwórz sekwencję** (P).
6. **Eksport** → *Format* 9:16 (rolka) / 1:1 / 4:5 / 16:9 → **Renderuj MP4** (Ctrl+Enter) → *Zapisz wideo*.

## Przydatne
- **Stoły z żywicą:** *Kształty → Kolor żywicy* — przemaluj żywicę, drewno zostaje; szablon sekwencji *kolory żywicy* pokazuje kilka wariantów w jednym filmie.
- **Muzyka:** *Dźwięk → Wgraj muzykę* — rój pulsuje w rytm, muzyka trafia do MP4.
- **Paralaksa:** *Ruch → Paralaksa* — przechyl telefon (lub rusz myszą), scena 3D obraca się.
- **Cały katalog naraz / testy A/B:** *Eksport* → ZIP z wieloma filmami.
- **Zapis pracy:** Ctrl+S zapisuje projekt (.json), Ctrl+O wczytuje.

## Skróty
Ctrl+Z cofnij · Ctrl+Y ponów · Ctrl+S zapisz projekt · Ctrl+O otwórz · Ctrl+Enter render MP4 · Ctrl+Shift+S zrzut PNG · P odtwórz/stop · R nagrywaj · F pełny ekran · H ukryj panel · M poprzedni kształt · 1–6 kształt · Spacja rozsyp · Esc anuluj · ? lista skrótów

## Gdy coś nie działa
- **Wolno / zacina się:** *Wygląd → Liczba* — mniej cząsteczek (auto-wydajność robi to sama).
- **Zdjęcie ciemne lub znika:** wyłącz *Świecenie*, ustaw *Zostaw całe zdjęcie*.
- **Biała plama odblasku:** *Kształty → Gaś odblaski*.
- **Film z dźwiękiem nie wgrywa się na Instagram:** renderuj w Chrome/Edge na Windows (dźwięk AAC).
