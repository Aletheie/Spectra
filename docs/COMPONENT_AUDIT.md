# Spectra — kontrola komponent a porovnání, 30. září 2026

> Historický stav před opravami. Doporučení byla následně zapracována;
> aktuální změny a provedené ověření shrnuje [COMPONENT_IMPROVEMENTS.md](COMPONENT_IMPROVEMENTS.md).

Základní tok porovnání funguje v kurátorovaném Browser harnessu. Pro malé a průhledné
komponenty však náhled vnucuje bílé pozadí a výšku určenou spíš pro celou sekci stránky.
Výchozí zadání ani systémový prompt nemají zvláštní pravidla pro tlačítko, formulář,
navigaci nebo tabulku. Zdroj komponenty se do požadavku posílá, takže model kontext má;
jeho správné využití ale není vynucené a nebylo ověřeno živým generováním.

Jde o audit a doporučení. V rámci této kontroly nebyl měněn aplikační kód.

## Co bylo skutečně ověřeno

- `npm test`: při posledním běhu prošlo všech **37 testů**. Host a poskytovatelé používají
  testovací náhrady VS Code, fetch nebo CLI; nejsou to živé provider requesty.
- `npm run build`: prošel TypeScript, Vite a esbuild; vznikl host bundle i webview assets.
- `npm run lint`: při posledním běhu neprošel kvůli nepoužitému `emphasis` v
  `src/variants.ts:15`.
- `npm run format:check`: při posledním běhu hlásil `src/variants.ts`.
- Chromium, existující Browser harness na `127.0.0.1:5178`: generate → compare → choose,
  refinement v porovnání i vybrané variantě, remix dvou variant, návrat do porovnání,
  opětovné generování, nastavení a stažení HTML. Bez zachycených chyb JavaScriptu stránky.
- Přepnutí měsíčního účtování ve variantě C změnilo cenu na $30, odpovídající text období
  a úspor; Original zůstal na $24. Otevření/zavření nastavení stav náhledu zachovalo.
- Remix přidal novou variantu a zachoval zdrojové varianty. Refinement vybrané varianty
  následně vybral její novou revizi. Stažené HTML obsahovalo přesný HTML fragment z
  inspektoru a neobsahovalo preview CSP.
- Další browser test dodal přes simulovaný host tři syntetické komponenty. Použil skutečné
  React komponenty, validaci zpráv a iframe renderer, ale **neprovedl capture ani AI generování**.
  Změny host busy stavu zachovaly místní interakci; simulovaná chyba refinementu zachovala
  vybranou variantu i rozepsané zadání a odeslaný požadavek obsahoval přesné ID varianty.

Zdrojové soubory se během auditu měnily i mimo tento audit; proto byl závěrečný stav
testů, lintu a formátu znovu zkontrolován. Výsledky popisují provedené běhy, nikoli zmrazený commit.

Nebyl proveden F5 / skutečný Extension Development Host, živé generování přes poskytovatele,
ověření nativního clipboardu a save dialogu, instalace ani vytvoření VSIX. Nelze tedy tvrdit,
že všechny funkce jsou ověřené od začátku do konce v Cursoru. Original u vlastního zdroje
je vždy AI rekonstrukce; React, importované styly ani aplikace se zde nespouštějí.

## Konkrétní komponenty

| Příklad                                                       | Zjištěný výsledek                                                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orbit pricing, kurátorovaný vzorek                            | Porovnání a jednotlivé akce fungovaly. Náhledy mají nezávislé místní interakce. Jde o předpřipravené návrhy a transformace.                                                                             |
| Průhledné tlačítko se světlým textem, diagnostická komponenta | Body je průhledné, ale iframe bílý. Text téměř zaniká. Tlačítko zabírá 37 px výšky body, celý iframe 560 px. Bez resetu zůstává také výchozí 8px margin prohlížeče. Kliknutí dává místní zpětnou vazbu. |
| Tmavý panel nastavení, diagnostická komponenta                | Vlastní tmavé pozadí panelu se zachová. Pod panelem vysokým přibližně 126 px zůstává bílý zbytek 560px náhledu.                                                                                         |
| Formulář, diagnostická komponenta                             | Pole a místní kontrola neplatného/platného e-mailu fungují. Formulář je vysoký přibližně 170 px, iframe má znovu 560 px. Skutečné odeslání formuláře se záměrně neprovádí.                              |

Diagnostické implementace A/B/C jsou kopie pro kontrolu rendereru, nikoli důkaz kvality
nebo rozmanitosti AI návrhů. Screenshoty jsou takto viditelně označené.

## Prioritní nálezy

**P1 — Bílé pozadí náhledu zkresluje komponenty.**
V `src/styles.css:604` má iframe `background: white`, `color-scheme: light` a výšku 560 px.
To je skutečná příčina bílé plochy u průhledného obsahu. Opaque pozadí uvnitř komponenty
se nepřepisuje. `src/domain/document.ts` žádný bílý obal do HTML nevkládá; tato konkrétní
vnější bílá plocha se neexportuje. Bílé pozadí napsané samotným modelem nebo vzorkem v CSS
se samozřejmě exportuje.

Doporučení: nabídnout společné pozadí náhledu světlé / tmavé / indikace průhlednosti,
oddělené od kódu komponenty a exportu. Zachovat autorovy barvy i průhlednost. Stejnou
volbu použít pro Original i A/B/C. Pouhé odstranění bílé bez řešení podkladu nestačí:
černý text na tmavém editoru by měl opačný problém. Pro malé komponenty nabídnout
kompaktní náhled; velikost plochy volit v rodiči bez změny sandboxu a bez důvěry v zprávy
z generovaného kódu. Související krok: `$impeccable adapt`.

**P1 — Rozhodovací akce jsou příliš daleko od viditelného porovnání.**
`src/components/VariantCard.tsx:82` umisťuje Choose/Refine až za náhled a seznam změn.
V Browser harnessu 1440 × 900 začínaly náhledy na y ≈ 536 a akce na y ≈ 1189.
U vybrané varianty začínal panel akcí při šířce 720 px na y ≈ 1066; při 600 px až na
y ≈ 1815, protože dva velké náhledy leží nad sebou. Uživatel při rozhodování nevidí
hlavní ovládání. Hodnoty zahrnují Browser harness banner.

Doporučení: Choose/Refine vedle názvu varianty, zkrácené zadání po úspěšné generaci,
a akce vybrané varianty nad porovnáním v úzkém panelu. Související krok: `$impeccable layout`.

**P2 — Mobilní přepínač neurčuje skutečný testovací viewport.**
`src/styles.css:612` používá pouze `max-width: 375px`; `ComparisonCanvas.tsx:56` přitom
popisuje ovládání jako omezení na 375 pixelů. Při šířce okna 720 px měly náhledy 287 px
před přepnutím i po něm. Se šesti kartami totéž nastalo i v okně širokém 1440 px.
Režim Fill available width také neznamená desktop — při čtyřech kartách to bylo 359 px.
Model má navíc instruováno podporovat 300 px a větší, zatímco UI dovoluje 287 px.

Doporučení: zobrazovat skutečnou šířku, umožnit přesné rozměry pro všechny porovnávané
varianty a dostatečně širokou samostatnou inspekci; případně poctivě přejmenovat současnou
volbu na maximum 375 px. Související krok: `$impeccable adapt`.

**P2 — Nové revize a aktuální volba nemají dostatečné označení.**
`WorkspaceProvider.tsx` po refinementu v porovnání zachová pohled, ale nepřesune jej
k novému výsledku. Naměřeno: po přidání revize začínala nová karta na x = 1152 při
šířce okna 720, vodorovný scroll zůstal 0. Po návratu z Selected nenese původně zvolená
karta značku výběru. Třetí zaškrtnutí Remix navíc bez vysvětlení odškrtne první položku.

Doporučení: po úspěchu odhalit novou revizi a oznámit její vznik, označit zvolenou kartu,
ukazovat pořadí dvou zdrojů remixu. Související krok: `$impeccable harden`.

**P2 — Zadání je příliš obecné pro odlišné typy komponent.**
`src/domain/protocol.ts:66` používá pro všechny vlastní komponenty stejné zadání
„Improve the hierarchy and make the primary action clearer.“ V `extension/providers.ts`
je jeden systémový prompt; mění se action, snapshot, zadání a přesné zdrojové varianty.
Rozdíl generate/refine/remix je ošetřen. Zvláštní pravidla pro rozsah, povrch či jednotlivé
typy komponent chybějí. Předvyplněný remix v `WorkspaceProvider.tsx` vždy mluví o CTA,
i když komponentou může být tabulka nebo navigace.

Doporučení: zachovat společný kontrakt a doplnit vodítka podle skutečné role komponenty.
Nevyvozovat ji jen z přípony souboru. Typ odhadovat z explicitního snapshotu; při nejistotě
ponechat obecné zadání a umožnit uživateli upřesnění. Neměnit uživateli rozepsaný prompt
při obnově stavu poskytovatele. Související krok: `$impeccable clarify`.

## Jak přizpůsobit prompt

| Typ                      | Vhodné zaměření                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Tlačítko / malé ovládání | Zachovat rozsah a průhlednost. Zkoumat popisek, prioritu, focus, disabled/loading stav; nepřidávat okolní stránku.    |
| Formulář                 | Seskupení polí, popisky, validace a chybové stavy; zachovat význam polí, lokálně simulovat odeslání.                  |
| Navigace / menu          | Orientace, aktivní položka, klávesové ovládání a zobrazení na úzké šířce; nevymýšlet nové sekce produktu.             |
| Tabulka / seznam         | Skenovatelnost, hustota, hierarchie dat, akce řádku a overflow; nevymýšlet data ani automaticky měnit vše na karty.   |
| Modal / popover          | Zachovat jeho roli, obsah a místní ovládání. Nezaměňovat náhled modalového UI za volání browser alert/confirm/prompt. |
| Celá sekce / stránka     | Layout, hierarchie a cesta k cíli; větší plocha je zde opodstatněná.                                                  |
| Samotné CSS/SCSS         | Výslovně přiznat chybějící markup. Ukázkový obsah považovat za ilustraci, nikoli věrnou rekonstrukci.                 |

Do společných instrukcí patří zejména: „Zachovej rozsah zachycené komponenty. K malému
prvku nepřidávej stránku, nadpis, kartu ani bílé pozadí, pokud je zdroj nebo zadání
nevyžaduje. Zachovej známé téma a průhlednost. Chybějící okolní styl přiznej. Tři směry
odlišuj rozhodnutími vhodnými pro tuto komponentu; zachovej její funkci a fakta.“

To je doplnění současných pravidel, nikoli jejich nahrazení. Limity JSON, přesný počet
variant, pevný Original, izolace, zákaz sítě a potvrzení přenosu musí zůstat zachované.
Kvalitu takové úpravy je třeba porovnat na stejných vstupech a stejném modelu při živém
rehearsalu; správné JSON ani průchod testů ji samy neprokazují.

## Technické hodnocení rozhraní

Orientační hodnocení pro prověřený browser povrch, nikoli úplný WCAG nebo výkonový audit.

| Oblast                     | Skóre / 4 | Hlavní důvod                                                                                                                                              |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Přístupnost                | 2         | Pojmenované ovládání a native dialogy; bílý podklad může znečitelnit vlastní komponentu. Screen reader nebyl ověřen.                                      |
| Výkon                      | 3         | Nezměněné náhledy zachovávají stav při host aktualizacích; Vite bundle přibližně 86 kB gzip. Bez výkonového profilování složitých generovaných komponent. |
| Responzivita               | 2         | Porovnání vodorovně scrolluje; vzdálené akce a nepřesná interpretace šířky ztěžují práci.                                                                 |
| Témata                     | 2         | Rodič používá editorové tokeny; iframe vynucuje bílou/light. Reálná témata Cursoru nebyla ověřena.                                                        |
| Vizuální konvence produktu | 4         | Střízlivé prostředí editoru, srozumitelná struktura porovnání, bez falešných účtů a marketingové navigace.                                                |
| **Celkem**                 | **13/20** | Funkční základ; hlavní slabinou je prezentace komponent v kontextu.                                                                                       |

Vizuální konvence samotného workspace obstály. Kurátorované návrhy uvnitř iframe jsou
samostatný obsah a nejsou důkazem kvality návrhu pro libovolnou vlastní komponentu.

## Nejmenší další krok

Nejprve upravit pozadí a velikost náhledu společně s dostupností Choose/Refine; pak doplnit
pravidla promptu pro rozsah a typ komponenty. Doporučené pořadí UI práce:
`$impeccable adapt` → `$impeccable layout` → `$impeccable harden` → `$impeccable clarify`
→ `$impeccable polish`. Kroky lze provést jednotlivě nebo společně a následně zopakovat audit.

Pro potvrzení živé funkčnosti otevřít v Cursoru malou samostatnou komponentu, provést
capture, potvrdit jedinou generaci a porovnat ji s diagnostikou. Následně ověřit skutečný
clipboard/save dialog a totéž na formuláři s importovanými styly. Uvést použitý model
a chybějící kontext, zejména u rekonstrukce Original.

Dočasné reprodukční artefakty vznikly v `/private/tmp/` pod tehdejším názvem produktu: `component-audit.mjs`,
`component-audit-results.json`, `audit-transparent-button.png`, `audit-dark-panel.png`,
`audit-form.png` a `audit-export.html` ve stejném adresáři. Screenshoty diagnostik nejsou
screenshoty živého AI výstupu ani skutečného editorového webview.
