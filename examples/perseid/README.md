# Perseid — demo pro Spectru

Malá smyšlená služba pro rezervaci pozorování oblohy, postavená na **Reactu 19,
TypeScriptu a Tailwind CSS 4**. Vite spouští aplikaci a sestavuje produkční soubory.
Rezervace, seznam a upozornění mají vlastní React komponenty; společné ovládání
je v `src/ui.tsx` a barevné tokeny v `src/styles.css`.

Interakce jsou pouze místní: bez backendu, skutečných rezervací a plateb. Stav se
po obnovení stránky vrátí na začátek. Živé generování ve Spectře je samostatná akce.

## Spuštění

Z kořene repozitáře:

```sh
npm install
npm run dev:perseid
```

Otevřete **http://127.0.0.1:5174**. Odkazy `booking.html`, `observation-list.html`
a `weather-alert.html` zůstávají stejné. HTML soubory jsou nyní vstupní body Vite;
neotevírají se přímo přes `file://`. Editace TSX a Tailwind tříd se projeví přes HMR.
Pokud port 5174 používá jiný server, Vite vybere další volný port; použijte adresu
vypsanou v terminálu. Konkrétní port lze zadat: `npm run dev:perseid -- --port 5175`.

```sh
npm run build:perseid    # TypeScript + produkční sestavení do dist/perseid
npm run preview:perseid  # Náhled sestavení na http://127.0.0.1:4174
npm run lint:perseid     # Kontrola React/TypeScript a přístupnosti
npm run test:perseid     # Sestaví aplikaci a spustí browser regrese
```

Browser testy potřebují Playwright Chromium (`npx playwright install chromium`).
Všechny závislosti sdílí kořenový `package.json` a npm lockfile; ve složce dema není
potřeba samostatný `npm install`. Tailwind se sestavuje lokálně, bez CDN.

Rozcestník obsahuje náhledové odkazy a zadání s kopírováním. Pro práci ve Spectře
otevřete v **Cursoru** přímo jednu z těchto komponent:

| Zdroj                                              | Co funguje                                                        | Co porovnávat                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| [src/Booking.tsx](src/Booking.tsx)                 | Termín, počet návštěvníků, čaj, cena, validace a místní potvrzení | Hierarchie ceny, rozložení formuláře, počet kroků  |
| [src/ObservationList.tsx](src/ObservationList.tsx) | Hledání bez diakritiky, filtry, zaškrtávání, postup a nulování    | Hustota seznamu, práce na mobilu, čitelnost ve tmě |
| [src/WeatherAlert.tsx](src/WeatherAlert.tsx)       | Vysvětlení, náhradní termín nebo refundace, potvrzení a návrat    | Klidné vysvětlení problému a další krok            |

Každá komponenta obsahuje vlastní data a chování a vejde se do limitu 60 000 znaků.
**Spectra importy nesbírá:** nezachytí automaticky `ui.tsx`, theme tokeny ani
vygenerované Tailwind CSS. Výsledný Original je přibližná AI rekonstrukce. Běžící
React originál posuzujte v prohlížeči; požadované barvy či další kontext popište v zadání.

## První průchod v Cursoru

1. **Otevřete kořen tohoto repozitáře v Cursoru** a povolte důvěru workspace, pokud mu důvěřujete.
   Samotný osamocený soubor bez otevřené pracovní složky nestačí.
2. **Zpřístupněte rozšíření.** Pokud už máte Spectru nainstalovanou, pokračujte dál.
   Jinak v paletě příkazů (`⌘⇧P` na Macu / `Ctrl+Shift+P` jinde) použijte
   **Extensions: Install from VSIX…** a vyberte nejnovější `spectra-<verze>.vsix` z kořene repozitáře.
   Chybí-li balíček, vytvořte ho příkazem `npm run package` v kořeni.
   Alternativně spusťte F5 s konfigurací **Run Spectra extension** a v novém
   Extension Development Hostu otevřete tento repozitář.
3. **Otevřete `examples/perseid/src/Booking.tsx` jako zdroj v editoru.** Kliknutím zrušte
   případný výběr textu. Spectra bez výběru zachytí celou React komponentu včetně dat, JSX, Tailwind tříd a obsluhy událostí.
4. Spusťte **Spectra: Explore Component** z palety příkazů nebo kontextového menu editoru.
   V panelu zkontrolujte cestu a zachycený zdroj přes **Review captured source**.
5. V **AI providers** nastavte živého poskytovatele:
   - **Cursor account:** nainstalujte oficiální [Cursor CLI](https://cursor.com/docs/cli/installation),
     pokud ho ještě nemáte. Použijte **Connect / check**, případně **Sign in to Cursor**,
     dokončete přihlášení a spusťte **Check connection**. Běžné přihlášení do editoru samo
     připojení nezaručuje. Výchozí CLI model je `auto`; nepřebírá model editorového chatu.
   - **OpenAI / Claude:** vložte vlastní API klíč do nativního heslového dialogu editoru.
     Použití API se účtuje u daného poskytovatele.
6. Do **Design instruction** vložte první zadání níže. V **Engine** vyberte připojeného
   poskytovatele. **Curated demo** se vztahuje jen na vestavěný Orbit sample; tyto soubory
   jsou vlastní zdroj a vyžadují živé generování.
7. Klikněte na **Generate 3 directions** nebo stiskněte `⌘Enter` / `Ctrl+Enter`.
   V nativním dialogu zkontrolujte poskytovatele, model a posílaný soubor a potvrďte odeslání.
   Volání používá účet a limity vybraného poskytovatele.
8. Porovnejte **Original | A | B | C**. Vyzkoušejte ve variantách změnu počtu návštěvníků
   a ceny. U náhledů lze nastavit přesnou šířku, například **375 px**, a vyšší plochu pro formulář.
   Ve zúženém panelu můžete porovnání vodorovně posouvat nebo náhled rozšířit.
9. Použijte **Refine** na jedné variantě nebo vyberte přesně dvě pro **Remix**.
   Tyto akce přidají další výsledek. Pak použijte **Choose** na variantě, kterou chcete dál zpracovat.
10. **Copy for Cursor** zkopíruje kompletní předání. Ručně ho vložte do Cursor chatu a
    doplňte například: „Uprav podle tohoto směru pouze `examples/perseid/src/Booking.tsx`.
    Použij React a Tailwind. Zachovej funkční výpočet cen, validaci a označení dema.“ Teprve tím požádáte Cursor o úpravu.
    **Save HTML** uloží samostatný návrh přes nativní dialog. Uložte jej pod novým názvem,
    třeba `booking-experiment.html`, aby zůstal zachovaný vstup. Před otevřením exportu
    zkontrolujte generovaný kód: export už neběží v izolaci náhledu.

**Original je rekonstrukce vytvořená AI.** Spectra nekompiluje React ani Tailwind.
Skutečný výchozí vzhled proto porovnejte také s aplikací spuštěnou přes `npm run dev:perseid`.
Save HTML je samostatný HTML/CSS/JS návrh; převedení návrhu zpět do Reactu a Tailwindu
probíhá ručním předáním do Cursoru.
Demo není důkazem kvality živých návrhů; zachované chování ověřte ve výsledných variantách.

## Zadání pro první generování

### Rezervační formulář

```text
Zjednoduš rezervaci večera u dalekohledu. Navrhni tři různé přístupy k rozložení,
hierarchii a průchodu formulářem. Uživatel má rychle pochopit termín, počet míst
a konečnou cenu. Zachovej češtinu, všechny ceny, limit 6 osob, dostupné termíny
a viditelné označení dema. Rozdíly nesmějí být jen v barvách.
```

Mantinely vedle zadání můžete vyzkoušet na **Brand colors**. Do **Elements to keep** napište:

```text
Zachovej přepočet ceny: dospělý 390 Kč, dítě 6–15 let 190 Kč, čaj 40 Kč jednou
za rezervaci. Nejvýše 6 osob. Zachovej dostupné termíny, pravidla zrušení při
špatném počasí a viditelné označení, že jde o místní simulaci bez platby.
```

Pro volnější změnu rozložení nechte **Dimensions** vypnuté. **Text** použijte,
pokud chcete zachovat přesné znění a měnit jen vizuální uspořádání. Mantinely jsou
instrukce pro model; zachování výsledku je potřeba zkontrolovat.

**Refine:**

```text
Zachovej směr této varianty. Na telefonu ukaž výběr termínu a počtu lidí před
doplňujícími informacemi. Souhrn ceny dej bezprostředně před hlavní tlačítko.
Zachovej všechny výpočty a validaci a nepřidávej další povinná pole.
```

**Remix** (vyberte nejprve variantu s lepším rozložením, pak variantu s lepším souhrnem):

```text
Z prvního vybraného návrhu použij uspořádání formuláře. Z druhého převezmi
hierarchii souhrnu ceny a hlavního tlačítka. Vytvoř jednu soudržnou komponentu,
zachovej původní ceny, termíny, výpočty, validaci a označení dema.
```

### Pozorovací seznam

```text
Zpřehledni pozorovací seznam pro telefon používaný venku večer. Navrhni tři
rozdílné způsoby uspořádání objektů, filtrů a postupu. Zachovej tmavé pozadí,
všech pět objektů, hledání, označení pozorovaných objektů, nulování a české
texty. Časy i viditelnost dál označuj jako ilustrativní.
```

### Upozornění na počasí

```text
Navrhni tři různá řešení upozornění na zrušené pozorování. Uživatel má hned
pochopit, co se stalo a že může zvolit náhradní termín nebo vrácení celé
částky. Zachovej 2 dospělé, cenu 780 Kč, oba náhradní termíny, český jazyk
a označení simulace. Zůstaň u kompaktní komponenty bez další stránky či navigace.
```

## Co zkontrolovat ve vygenerovaném výsledku

- **Rezervace:** 2 dospělí + 1 dítě + čaj = **1 010 Kč**. Čaj je 40 Kč za celou
  rezervaci. Více než 6 osob ani prázdné jméno nesmí projít. Obsazený termín nejde vybrat.
- **Seznam:** hledání `mesic` najde Měsíc. Zaškrtnutí mění počet a filtry,
  prázdný výsledek nabízí cestu zpět a vynulování obnoví začátek.
- **Počasí:** přesun zachová 2 dospělé a cenu 780 Kč. Druhou možností je vrácení
  celé částky. Každé potvrzení stále říká, že jde pouze o ukázku.
- **Ovládání:** zkuste Tab, Enter, mezerník a šířku 375 px. Všechny akce mají
  čitelné popisky a viditelný fokus; žádný výsledek nemá zavádět skutečnou platbu.

## Když něco nejde

- Nevidíte příkazy Spectry: ověřte instalaci VSIX nebo spuštění v Extension Development Hostu.
- Capture je nedostupný: otevřete důvěryhodnou pracovní složku a přímo jeden z TSX souborů komponent.
- Náhled se liší od aplikace: zachyťte celou TSX komponentu. Importované UI a Tailwind
  tokeny ve snapshotu chybí; popište je v instrukci. Jde o rekonstrukci, ne spuštěný React.
- Generování čeká: zkontrolujte nativní potvrzovací dialog editoru. Případnou chybu providera
  řešte podle zprávy; vestavěný sample není náhrada živého vygenerování těchto komponent.
- Po změně zdroje vidíte starou verzi: explicitně proveďte nové zachycení. Snapshot se sám neobnovuje.
- Po zavření panelu zmizely varianty: relace je jen v paměti. Vybraný výsledek před zavřením
  zkopírujte nebo uložte přes Save HTML.

`npm run dev` v kořeni spouští pouze vývojový browser harness Spectry s vestavěným samplem.
Perseid spouštějte přes `npm run dev:perseid`; pro skutečný capture a generování používejte extension v Cursoru.

## Ověření React verze

Po převodu prošly `npm run lint:perseid`, `npm run build:perseid` a všech **9 testů**
v `npm run test:perseid`. Testy běží nad produkčním sestavením: ověřují cenu a validaci,
filtry a postup, přesun/refundaci, návrat fokusu, kopírování i ruční fallback.
Všechny čtyři stránky prošly šířkami 300, 375, 768 a 1280 px bez vodorovného přetékání,
chyb JavaScriptu nebo požadavků na cizí servery. Kopírování používá testovací clipboard.

Všechny tři TSX komponenty prošly `validateSource` a kontrolou umístění ve workspace;
největší má méně než 12 000 znaků. Prošel i kořenový `npm run check` včetně buildu
rozšíření. Nativní capture v Cursoru a živé generování tato migrace neověřovala.

## Historické ověření původních HTML stránek

Následující záznam se týká původní HTML verze před převodem na React, nikoli současného
buildu. Aktuální opakovatelné kontroly jsou v `tests/perseid.spec.ts`.

Při přípravě 30. září 2026 byly všechny čtyři HTML stránky vyzkoušeny v headless Chromu
při šířkách 300, 375, 768 a 1280 px bez horizontálního přetékání. Prošly výpočty a chyby
formuláře, filtry a postup seznamu, náhradní termín i refundace a návraty fokusu.
Rozcestník prošel kontrolou odkazů a obou větví kopírování zadání s testovací náhradou
clipboardu. Stránky nevyvolaly chyby JavaScriptu ani HTTP požadavky.

Byly zkontrolovány popisky formulářových prvků, viditelný fokus a vybrané páry textu
a pozadí; nejnižší naměřený kontrast těchto párů byl 6,28 : 1. Nejde o úplný audit WCAG.
Všechny tři vstupy prošly skutečnou funkcí `validateSource` a kontrolou umístění uvnitř
workspace; každý má méně než 18 000 znaků.

Tato kontrola neprováděla capture v reálném Extension Development Hostu, živé generování,
nativní clipboard ani Save HTML. Tyto kroky jsou součástí postupu výše a je potřeba je
vyzkoušet s připojeným poskytovatelem v Cursoru.
