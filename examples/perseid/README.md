# Perseid — demo pro Spectru

Malá smyšlená služba pro rezervaci pozorování oblohy. Tři samostatné komponenty mají
vlastní HTML, CSS i JavaScript, takže Spectra získá celý kontext jedním zachycením souboru.
Nejsou potřeba závislosti, server ani další instalace. Nic se neposílá do sítě a stav
se po obnovení stránky vrátí na začátek. Živé generování ve Spectře je samostatná akce.

## Prohlédnutí dema

Otevřete [index.html](index.html) v prohlížeči, například na macOS z kořene repozitáře:

```sh
open examples/perseid/index.html
```

Rozcestník obsahuje náhledové odkazy a hotová zadání s tlačítkem pro kopírování.
Soubory otevřené v prohlížeči ukazují skutečné demo; pro práci ve Spectře otevřete
jejich zdroj v **Cursoru**. Do Spectry zachycujte jednu z těchto komponent, ne rozcestník:

| Soubor                                         | Co funguje                                                                 | Co porovnávat                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| [booking.html](booking.html)                   | Termín, počet návštěvníků, čaj, přepočet ceny, validace a místní potvrzení | Hierarchie ceny, rozložení formuláře, počet kroků    |
| [observation-list.html](observation-list.html) | Hledání i bez diakritiky, filtry, zaškrtávání, postup a nulování           | Hustota seznamu, práce na mobilu, čitelnost ve tmě   |
| [weather-alert.html](weather-alert.html)       | Rozbalení vysvětlení, volba termínu nebo refundace, potvrzení a návrat     | Klidné vysvětlení problému a srozumitelný další krok |

Každý soubor se vejde do limitu 60 000 znaků. Obsah je záměrně přímo v souboru;
v běžném projektu by šlo společné styly sdílet, ale Spectra importy sama nesbírá.

## První průchod v Cursoru

1. **Otevřete kořen tohoto repozitáře v Cursoru** a povolte důvěru workspace, pokud mu důvěřujete.
   Samotný osamocený soubor bez otevřené pracovní složky nestačí.
2. **Zpřístupněte rozšíření.** Pokud už máte Spectru nainstalovanou, pokračujte dál.
   Jinak v paletě příkazů (`⌘⇧P` na Macu / `Ctrl+Shift+P` jinde) použijte
   **Extensions: Install from VSIX…** a vyberte nejnovější `spectra-<verze>.vsix` z kořene repozitáře.
   Chybí-li balíček, vytvořte ho příkazem `npm run package` v kořeni.
   Alternativně spusťte F5 s konfigurací **Run Spectra extension** a v novém
   Extension Development Hostu otevřete tento repozitář.
3. **Otevřete `examples/perseid/booking.html` jako zdroj v editoru.** Kliknutím zrušte
   případný výběr textu. Spectra bez výběru zachytí celý soubor včetně stylů a skriptu.
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
    doplňte například: „Uprav podle tohoto směru pouze `examples/perseid/booking.html`.
    Zachovej funkční výpočet cen, validaci a označení dema.“ Teprve tím požádáte Cursor o úpravu.
    **Save HTML** uloží samostatný návrh přes nativní dialog. Uložte jej pod novým názvem,
    třeba `booking-experiment.html`, aby zůstal zachovaný vstup. Před otevřením exportu
    zkontrolujte generovaný kód: export už neběží v izolaci náhledu.

**Original je i pro HTML rekonstrukce vytvořená AI.** Nejde o zachycený běžící soubor.
Skutečný výchozí vzhled proto porovnejte také se souborem otevřeným v prohlížeči.
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
- Capture je nedostupný: otevřete důvěryhodnou pracovní složku a přímo jeden z HTML souborů.
- Náhled ztratil styly: zachyťte celý soubor, ne pouze část mezi `<body>` a `</body>`.
- Generování čeká: zkontrolujte nativní potvrzovací dialog editoru. Případnou chybu providera
  řešte podle zprávy; vestavěný sample není náhrada živého vygenerování těchto komponent.
- Po změně zdroje vidíte starou verzi: explicitně proveďte nové zachycení. Snapshot se sám neobnovuje.
- Po zavření panelu zmizely varianty: relace je jen v paměti. Vybraný výsledek před zavřením
  zkopírujte nebo uložte přes Save HTML.

`npm run dev` v kořeni spouští pouze vývojový browser harness Spectry s vestavěným samplem.
Pro tyto HTML soubory ho nepotřebujete; pro skutečný capture a generování používejte extension v Cursoru.
