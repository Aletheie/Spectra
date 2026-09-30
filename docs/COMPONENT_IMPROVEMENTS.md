# Komponenty a porovnání: zapracované úpravy

30. září 2026, návaznost na [původní audit](COMPONENT_AUDIT.md).

## Změny

- Iframe má průhledné pozadí. Společný podklad Light / Dark / Transparency grid je pouze
  pomůcka pro prohlížení; nepřidává se do komponenty, exportu ani promptu. Vlastní pozadí
  komponenty se zachovává. Výchozí margin body je nulový a autorovo CSS ho může přepsat.
- Náhled nabízí skutečné šířky 375, 768 a 1280 px nebo Fit column a výšky 240, 560 a 720 px.
  Zobrazuje změřené rozměry. Pevné šířky se posouvají, nezmenšují. Rozpoznaný ovládací prvek
  nebo navigace začíná kompaktní výškou. Nastavení nemění srcdoc a nemaže stav interakcí.
- Choose a Refine jsou před náhledem, exportní akce před vybraným porovnáním. Úspěšná
  generace sbalí zadání; Edit intent ho znovu zpřístupní. Nová revize se zobrazí a získá
  focus, starší varianty zůstanou dostupné. Vybraná varianta je označená i v porovnání.
- Remix ukazuje pořadí dvou zdrojů. Třetí nelze vybrat bez odškrtnutí některého z nich.
  Po úspěchu se výběr zdrojů vyčistí a otevře se nový výsledek. Úzké rozhraní včetně
  320px panelu nepřetéká kvůli popisku porovnání.
- Výchozí zadání a společný provider kontext zohledňují tlačítko/ovládací prvek, formulář,
  navigaci, tabulku/seznam, dialog/popover, sekci nebo samostatné styly. Rozpoznání vychází
  pouze ze zachyceného textu; je to pomocná heuristika, ne ověření běžící komponenty.
  Nejasný zdroj dostane obecné zadání. Suggested focus nabízí jiný návrh zadání, ale
  rozepsaný text nahradí až explicitní Use suggestion. Uživatelovo zadání má přednost.
- Prompt požaduje zachování rozsahu, tématu a průhlednosti. Malé tlačítko se nemá měnit
  v celou stránku; chybějící styly se nemají nahrazovat předpokladem bílého pozadí.
  U formulářů se kontrolují místní validace, u navigace orientace a klávesnice, u tabulek
  data a přetékání, u dialogů místní otevření/zavření a focus. Kvalitu živého výstupu je
  stále potřeba posoudit, samotná pravidla ji nezaručují.

## Provedené ověření

- `npm run check`: lint, formát, **49 testů**, TypeScript, Vite a esbuild prošly.
- `npm run test:browser`: **12 testů prošlo** s lokálním Chromium. Zahrnují izolované
  interakce, výběr, klávesový refinement, pořadí remixu, chyby a zrušení přes simulovaný
  host, skutečnou šířku náhledu, úzké rozhraní a zachování náhledů při stavových zprávách.
- Samostatná kontrola skutečného React rozhraní v Browser harnessu na portu 5178:
  generate → compare → remix → choose → refine → inspect → download. Vyzkoušeny všechny
  pevné šířky, změny podkladu/výšky, expanded preview a panely 1440/720/600/320 px.
  Změny nastavení zachovaly místní stav; stažený HTML fragment odpovídal inspektoru,
  bez preview CSP a podkladu canvasu. Nebyly zachyceny chyby JavaScriptu rodičovské stránky.
- Syntetické komponenty přes simulovaný host: průhledné tlačítko se světlým textem,
  tmavý panel a formulář. Iframe zůstal průhledný, vlastní tmavý/světlý povrch zachovaný,
  kliknutí a místní e-mailová validace fungovaly. Stavové zprávy a změny podkladu zachovaly
  interakce i rozepsané zadání; simulovaná chyba refinementu zachovala výběr a instrukci.
  Tyto komponenty nejsou živým AI výstupem.
- `npm run package`: vytvořen lokální `spectra-0.2.0.vsix`. Nejde o publikaci ani instalaci.

Reprodukční skript, výsledky a označené screenshoty samostatné kontroly jsou v dočasném
adresáři `/private/tmp/forkui-review-tools/` (`component-verification.mjs`,
`component-verification-results.json`, `verified-*.png`, `verified-export.html`).
Projektové browser testy jsou v `tests/browser/`.

## Co ještě není ověřeno

F5 / Extension Development Host, skutečné zachycení zdroje v Cursoru, nativní clipboard
a save dialog, přihlášení a živé generování přes providery ani instalace VSIX nebyly
v této kontrole provedeny. Testy hostu a providerů používají náhrady. Original vlastního
zdroje zůstává AI rekonstrukcí, nikoli spuštěnou React komponentou.

Nejmenší další krok: otevřít Extension Development Host v Cursoru, zachytit vlastní
tlačítko a formulář, potvrdit živé generování a ověřit přesný výsledek i nativní export.
