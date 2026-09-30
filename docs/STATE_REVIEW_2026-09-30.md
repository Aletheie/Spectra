# Spectra — review stavu, chyb a zbytečného balastu

Datum: **30. 9. 2026**. Referenční snapshot: **15:59:46 Europe/Prague**.
Rozsah: extension host, provider adaptéry, protokol, validace, React UI, preview,
kurátorované transformace, testy, build a lokální balíček.

## Verdikt

**Základ aplikace není nahodilý AI scaffold. Největší problémy jsou v detailech
pracovního toku a v kvalitě kurátorovaného dema.** Host drží autoritativní zdroje,
protokol má runtime validaci a generované komponenty se nespouštějí přímo v Reactu.
To má smysl zachovat.

Za „slop“ zde považuji hlavně generické marketingové fráze v ukázkách, tvrzení
o změnách, které už existovaly v Original, a stavové texty neodpovídající právě
prováděné akci. Samotné srovnávací sloupce, systémové písmo a editorové barvy
nejsou problém — slouží účelu tohoto produktu.

Nejdřív bych řešil:

1. Rozbité skládání demo remixu a rozporné informace o úsporách.
2. Kontrast textu v kurátorovaných ukázkách.
3. Zastaralou variantu v expanded dialogu po regenerování.
4. Dostupnost Choose / Refine / handoff a orientaci v nových revizích.
5. Oddělení stavů generování, potvrzení, exportu a konfigurace.

Níže je **21 nálezů: 2× P1, 14× P2 a 5× P3**. Žádný potvrzený P0.
P1 = opravit před vydáním; P2 = konkrétní problém nebo důležitá mezera;
P3 = menší UX či technický dluh. Priorita neznamená, že každý bod je runtime bug:
u každého rozlišuji reprodukci, závěr z kódu a návrh zlepšení.

## Co bylo skutečně ověřeno

Během review se souběžně měnily zdrojové soubory: opravila se serializace/testy
a přibyla integrace Cursor CLI. Proto je závěrečná sada kontrol vztažená
k samostatné kopii zdrojů z času uvedeného nahoře. Pozdější úpravy tento dokument
automaticky neověřuje. Změny aplikačního kódu nejsou součástí tohoto review.

| Kontrola                                                                | Výsledek a hranice                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Čtení PRODUCT, LLM_CONTRACT, DEMO_CHECKLIST a protokolu                 | Provedeno, porovnáno s implementací. Checklist nebyl považován za důkaz funkčnosti.                                                                                                             |
| `npm run check` na snapshotu                                            | **Neprošel formátováním.** Lint před ním prošel; navazující test/build tento příkaz nespustil.                                                                                                  |
| Samostatný `npm run format:check`                                       | Neshody v `extension/cursor.ts`, `extension/extension.ts`, `extension/providers.ts`, `src/components/PromptPanel.tsx`, `src/components/SettingsDialog.tsx`. Jde o zachycené rozpracované změny. |
| Samostatné `npm test` na snapshotu                                      | **30/30 prošlo.** Testy používají mocky VS Code/providerů; nejsou důkazem živého editorového flow.                                                                                              |
| Samostatné `npm run build` na snapshotu                                 | **Prošel:** TypeScript, Vite a esbuild. JS webview 277,73 kB / gzip 86,14 kB; CSS 17,06 kB; host přibližně 64,6 kB.                                                                             |
| Lokální VSIX                                                            | **Vytvořen** přímo přes `vsce package` z již postaveného snapshotu. Ověřena přítomnost tří build artefaktů. Nešlo o instalaci, publikaci ani celý příkaz `npm run package`.                     |
| Browser harness                                                         | Headless Chromium: sample → generate → choose → compare → remix → refine; také expanded/settings dialog. Šířky 1440, 600 a 320 px.                                                              |
| Simulovaný host v prohlížeči                                            | Ověřeny opožděné změny state, zastaralý expanded dialog, text při copy busy a chybějící konfigurace v refinementu. Žádné skutečné API volání.                                                   |
| Kontrast sample                                                         | Odečteny CSS barvy, u základního textu potvrzeny computed styles; poměry spočteny podle relativní luminance sRGB.                                                                               |
| F5, instalace VSIX, native SecretStorage, reálná clipboard/save operace | **Neověřeno.**                                                                                                                                                                                  |
| Živé OpenAI / Anthropic / Cursor CLI generování                         | **Neověřeno.** Kvalitu skutečných AI návrhů nelze odvodit z dema.                                                                                                                               |
| Světlé a high-contrast téma skutečného Cursor webview                   | **Neověřeno.** Browser fallback dark theme není náhrada těchto kontrol.                                                                                                                         |

První běh během rozpracovaných změn měl 29/30 testů a chybnou očekávanou hodnotu
pro bezpečný text `</script` v tagged template. V referenčním snapshotu už je
test opraven a prochází. **Tento historický pád není aktuální nález ani důkaz
úniku z iframe sandboxu.**

VSIX snapshotu, dočasné reprodukční skripty, screenshoty a otisky zdrojů byly
vytvořeny mimo repozitář v `/private/tmp/` pod tehdejším názvem produktu; nejde
o trvalou testovací infrastrukturu repozitáře.
Projektové závislosti už byly nainstalované. Pomocný Playwright byl instalovaný
pouze mimo repozitář; projektový manifest ani lockfile toto review neměnilo.

## Podrobné nálezy

### R01 · P1 — Demo remix rozbíjí strukturu HTML a umí zobrazovat neslučitelné úspory

**Důkaz:** reprodukováno voláním domény i v browser preview.
**Místo:** [demo.ts](../src/domain/demo.ts), `remixedHtml`, ř. 18;
[variants.ts](../src/variants.ts), `interaction`, ř. 9.

Regex pro převzetí `.quote` hledá konec `</div></div>`. U Trust first ale takto
nekončí samotná citace: match vezme také `.status` a uzavření celé `.page`.
Remix A + B proto obsahuje dva `.status` a přebytečný konec obalu. Prohlížeč
pak opravuje dokument jinak, než zamýšlel kód.

Druhá reprodukce: vytvořit revizi C a remixovat **C + tuto revizi**. Jde o dva
platné různé identifikátory. Výsledek obsahuje dva bloky `.saving`, ale billing
handler aktualizuje jen první přes `querySelector`. Po Monthly současně zůstane:

- cena `$30 / month` a výzva „Switch to yearly and save $72“;
- druhý blok „$72 back in your pocket. That’s 20% saved with a yearly plan.“

**Dopad:** rozbitá struktura a zavádějící finanční informace přežijí i Save HTML.
Nejde jen o nedokonalé kombinování stylů, na které UI upozorňuje.

**Oprava:** skládat kontrolované demo fragmenty ze strukturovaných částí, ne regexem
přes libovolné vnořené HTML. Mít jediný autoritativní billing stav a konzistentně
aktualizovat všechny jeho výskyty. Přidat DOM/browser regresi pro A+B a C+revizi C;
současný test kontroluje hlavně výskyt textu a CTA.

### R02 · P1 — Kurátorované vzorky mají prokazatelně nízký kontrast

**Důkaz:** výpočet z barev použitých v preview; nejde o odhad podle screenshotu.
**Místo:** [variants.ts](../src/variants.ts), `baseCSS` a CSS variant A/C.

| Text / plocha            | Barvy                 | Kontrast     |
| ------------------------ | --------------------- | ------------ |
| Základní odstavec sample | `#85818e` / `#ffffff` | **3,80 : 1** |
| Odstavec v A             | `#999084` / `#fbfaf8` | **3,02 : 1** |
| Malý doprovod ceny       | `#96929d` / `#ffffff` | **3,05 : 1** |
| Doprovod úspory v C      | `#a08ab8` / `#f5f0fb` | **2,75 : 1** |
| Bílý text CTA v C        | `#ffffff` / `#956ed1` | **3,87 : 1** |

Tyto texty jsou malé, typicky 8–12 px, takže nesplňují výjimku pro velký text.
WCAG 2.2, kritérium 1.4.3, požaduje u běžného textu alespoň 4,5 : 1.

**Dopad:** vlastní ukázka „lepšího UI“ je hůře čitelná a nekvalitní hodnoty
se exportují. Tento nález se týká kurátorovaných vzorků; neprokazuje špatný
kontrast všech editorových témat ani budoucích AI výsledků.

**Oprava:** upravit kontrast textů a CTA v sample, zvednout nejmenší důležité
popisky, zkontrolovat i výsledky preset transformací. Zachovat viditelné
označení fiktivního customer proof.

### R03 · P2 — Expanded dialog po regenerování nabízí už neexistující variantu

**Důkaz:** reprodukováno v prohlížeči se simulovaným hostem.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), ř. 60, 165 a 182;
[ExpandedDialog.tsx](../src/components/ExpandedDialog.tsx), ř. 7.

Postup: mít A/B/C → spustit pomalé generování → během něj rozbalit A → dokončit
generování s novými IDs. `expanded` stále drží celý starý objekt; aktualizace
ověřuje existenci `selectedId` a `remixIds`, ale expanded při běžné regeneraci nečistí.
Po kliknutí na Choose direction není žádný selected panel a Selected direction
je disabled. Uživatel vybíral variantu, která už není v autoritativním stavu.

**Oprava:** uchovávat `expandedId` a řešit jej vůči aktuálním variantám, případně
dialog při odstranění daného ID zavřít. `choose` musí také ověřit členství
v aktuálním stavu. Testovat dokončení regenerace při otevřeném dialogu.

### R04 · P2 — „Generating“ se zobrazuje také při kopírování, exportu a konfiguraci

**Důkaz:** simulované `copyHandoff` + host busy skutečně zobrazí
„Generating implementations…“. Závěr odpovídá dispatchi v hostu.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), `loading`, ř. 43;
[PromptPanel.tsx](../src/components/PromptPanel.tsx), ř. 47;
[ComparisonCanvas.tsx](../src/components/ComparisonCanvas.tsx), ř. 82;
[extension.ts](../extension/extension.ts), `execute`.

Jediný boolean `busy` slučuje čekání na potvrzení, čtení zdroje, nastavení
providera, export i skutečný síťový request. Copy for Cursor tak může vypadat
jako další placené generování. Placeholder rovněž hlásí čekání na model,
i když uživatel teprve řeší nativní dialog.

**Oprava:** ponechat zámek proti souběhu, ale doplnit typ probíhající operace
a rozlišit skutečné čekání na souhlas od requestu. Nepřidávat vymyšlené fáze
modelového „přemýšlení“. Změnu protokolu promítnout do validace a kontraktu.

### R05 · P2 — Refinement bez připojeného providera končí slepým disabled formulářem

**Důkaz:** reprodukováno simulovaným host state bez dostupného providera.
**Místo:** [VariantCard.tsx](../src/components/VariantCard.tsx), ř. 87;
[RefinementDialog.tsx](../src/components/RefinementDialog.tsx), ř. 64;
[WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), `canGenerate`.

Refine lze otevřít, pokud aplikace není busy. Submit ale používá `canGenerate`,
které může být false kvůli klíči, připojení nebo trustu. Dialog neřekne proč,
neukáže konkrétního providera/model a nevysvětlí cestu k nápravě. Hláška
„Exact source sent to the selected provider“ tu nepomáhá.

**Oprava:** zobrazit uvnitř dialogu konkrétní blokující podmínku a cestu
k nastavení. Změna providera musí zachovat rozepsanou instrukci a source IDs.
Stejný princip použít pro limit 15 směrů ještě před odesláním refinementu.

### R06 · P2 — Primární pracovní akce jsou schované pod příliš vysokým obsahem

**Důkaz:** měřeno v harnessu při 1440 × 1000: začátek iframe přibližně
**y = 536 px**, Choose / Refine přibližně **y = 1189 px**.
**Místo:** [styles.css](../src/styles.css), `.preview iframe`, ř. 604,
`.card-actions`, ř. 637, `.ship-layout`, ř. 738;
[ChosenDirection.tsx](../src/components/ChosenDirection.tsx).

Snapshot context, prompt, toolbar, názvy a hypotézy spotřebují velkou část výšky.
Následuje pevný iframe 560 px a teprve pak akce. V narrow selected view se
navíc dva 630px náhledy skládají nad panel s handoffem. Vzniká stránka,
kterou je nutné dlouho scrollovat, místo přehledné pracovní plochy.

**Oprava:** dát rozhodovací akce do záhlaví nebo trvale dostupné lišty.
Po generování nabídnout kompaktní zadání s Edit intent a zachovat dostupný
snapshot/AI reconstruction štítek. Přizpůsobit výšku preview dostupnému panelu.
Měření zahrnuje harness banner; není vydáváno za měření native webview.

### R07 · P2 — Delší povolená hypotéza rozbije zarovnání porovnání

**Důkaz:** simulovaná platná hypotéza pod limitem 1200 znaků posunula její iframe
na **y ≈ 884 px**, ostatní zůstaly na **y ≈ 510 px**.
**Místo:** [styles.css](../src/styles.css), `.hypothesis`, ř. 589;
[VariantCard.tsx](../src/components/VariantCard.tsx), ř. 65;
[validation.ts](../src/domain/validation.ts), limit hypotézy.

`min-height: 76px` zarovná krátké ukázky, ale nezajistí společný začátek
náhledů při skutečném modelovém výstupu. Srovnávání stejného místa komponenty
pak vyžaduje mentální posun mezi sloupci. Dlouhé názvy a jednotlivá velmi
dlouhá slova také potřebují explicitní řešení zalamování.

**Oprava:** sjednotit řádky záhlaví/rationale, například sdíleným gridem či
subgridem, nebo ukázat stručnou hypotézu s dostupným rozbalením. Důležitý text
nesmí jen zmizet pod ořezem. Ověřit hraniční, ale validní modelové texty.

### R08 · P2 — Choose zahodí právě vyzkoušený stav preview

**Důkaz:** v C přepnout Monthly na `$30 / month` → Choose → nový selected preview
znovu ukazuje `$24 / month`.
**Místo:** [ComparisonCanvas.tsx](../src/components/ComparisonCanvas.tsx), ř. 89;
[ChosenDirection.tsx](../src/components/ChosenDirection.tsx), ř. 28;
[Preview.tsx](../src/components/Preview.tsx).

Přepnutí větve React stromu odmountuje původní iframe a vytvoří nový. Ochrana
před resetem při host status updates je správná, ale tento přechod nepokrývá.
Stejně se může při návratu ztratit stav lokálně vyplněného formuláře.

**Dopad:** ztráta kontextu při hodnocení interakcí. Není to změna uloženého kódu
a export aktuálního DOM stavu není ve specifikaci slíben.

**Oprava:** rozhodnout, zda zachovávat instance náhledů, nebo jasně sdělit reset
na výchozí stav. Kvůli zachování interakcí nepřidávat iframe `allow-same-origin`
ani důvěru v příkazy odeslané generovaným kódem.

### R09 · P2 — Úspěšná revize se může objevit mimo dohled a vybraná karta nemá marker

**Důkaz:** z kódu; browser flow potvrdil přidání revize do dalších sloupců.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), `run`, ř. 165;
[ComparisonCanvas.tsx](../src/components/ComparisonCanvas.tsx), ř. 121;
[VariantCard.tsx](../src/components/VariantCard.tsx), ř. 27.

V Compare se výsledek pouze přidá na konec. Není přesun na novou revizi,
neotevře se její inspekce a chybí trvalé zvýraznění výsledku. Po návratu ze
Selected nemá zvolená karta odlišné Choose ani označení; vizuálně se značí
jen remix selection. Revize nemají parent IDs, takže vztah A → A v2 se nedá
spolehlivě zjistit z dat.

**Oprava:** po úspěchu novou revizi ukázat a označit, při chybě zachovat předchozí
polohu a volbu. Označovat current selection také v Compare. Případnou genealogii
ukládat explicitně do domény, ne odvozovat z modelového názvu.

### R10 · P2 — Regenerate maže revize, ale tlačítko tento důsledek nesděluje

**Důkaz:** jednoznačné nahrazení pole v session a reset selected v UI.
**Místo:** [session.ts](../extension/session.ts), `applyGeneration`, ř. 39;
[PromptPanel.tsx](../src/components/PromptPanel.tsx), ř. 48;
[WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), ř. 166.

I po několika refinements tlačítko stále říká Generate 3 directions.
Úspěšná operace nahradí všechny dosavadní směry a resetuje volbu. To odpovídá
specifikaci, ale UI nesděluje cenu této akce a nenabízí undo. Na limitu 15
směrů je uživatel k této cestě přímo nasměrován chybovou hláškou.

**Oprava:** po prvním výsledku použít označení Replace directions / New comparison
a předem popsat ztrátu revizí. Cílené potvrzení dává smysl, pokud existují
rozpracované revize; nevyžadovat další potvrzení pro každou běžnou akci.

### R11 · P2 — Třetí remix checkbox potichu odškrtne první zdroj

**Důkaz:** `toggleRemix` při třetím výběru vrací `[previous[1], id]`.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), ř. 187–203;
[VariantCard.tsx](../src/components/VariantCard.tsx), remix checkbox.

Výběr A → B → C končí B+C. Pořadí přitom není kosmetické: výchozí instrukce
bere layout z prvního a CTA z druhého. Čísla 1/2 nejsou vidět na kartách,
uživatel vidí jen Remix 2/2. Je snadné omylem požádat o jinou kombinaci.

**Oprava:** zobrazit obě pojmenované role/pořadí v toolbaru. Třetí výběr buď
zablokovat s vysvětlením, nebo nechat explicitně určit, který zdroj nahradí.
Umožnit snadno vyčistit výběr.

### R12 · P2 — Některé hypotézy a „changes“ v sample jsou marketingová výplň

**Důkaz:** obsahové srovnání Original a A/B/C, vizuální posouzení screenshotů.
**Místo:** [variants.ts](../src/variants.ts), Original a varianty A–C;
[demo.ts](../src/domain/demo.ts), názvy, hypotézy a changes.

Konkrétní příklady:

- A tvrdí „One focused plan, no comparison overload“ a „Annual billing as the
  default“. Original už má právě jeden plán a default Yearly. To nejsou nové změny.
- „Less friction. More flow.“, „Your best year starts with a better workspace“
  nebo „Unlock a year of possibilities“ neříkají nic konkrétního o zlepšení UI.
- Demo remix se vždy jmenuje „The best of both“, i když zkopírování druhého CSS
  přebije vizuální hierarchii první varianty.
- A používá béžový editorial preset, B dark/gold „trust“ a C pastelově fialový
  savings preset. Včetně drobných uppercase sloganů je to velmi známá AI estetika.
- C navíc kombinuje border a velký měkký stín na `.valueplan`, aniž by to pomáhalo
  rozhodnutí. Original říká „Your current pricing section“, přestože jde o sample.

**Dopad:** produkt slibuje tři věcné designové hypotézy, ale demo část své
argumentace nedokládá. Označení Curated je poctivé; samo o sobě nezaručuje kvalitu.

**Oprava:** popsat skutečný rozdíl vůči baseline, například přesun informace,
odstranění konkrétního kroku nebo změnu pořadí rozhodování. Zachovat sample jako
sample; nevyvozovat z jeho slabin kvalitu živých providerů. Měnit copy a důraz
cíleně, nikoli přepisovat celou aplikaci do jiného marketingového stylu.

### R13 · P2 — Chyby nejsou přiřazené operaci a mohou označit nevinný input za chybný

**Důkaz:** z datového toku; `error` je společný pro celý workspace.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), ř. 39 a 123;
[RefinementDialog.tsx](../src/components/RefinementDialog.tsx), ř. 56;
[ExportDialog.tsx](../src/components/ExportDialog.tsx), ř. 51.

Chyba exportu nebo konfigurace zůstane ve společném `error`. Otevření Refine
ji nečistí a textarea dostane `aria-invalid=true`, i když se problém netýká
instrukce. Vnější banner a modal navíc mohou obsahovat tutéž zprávu. Běžné
zrušení native potvrzení se zobrazuje jako chyba, ačkoli nejde o selhání uživatele.

**Oprava:** oddělit chybu konkrétní operace od globálního stavu. `aria-invalid`
používat pro chybu daného vstupu. Cancellation rozlišit jako neutrální výsledek
a zachovat rozepsaný text.

### R14 · P2 — Současné testy nepokrývají chyby na hranici React / DOM / iframe

**Důkaz:** všech 30 testů prochází, zatímco R01 a R03 jsou reprodukovatelné.
**Místo:** [domain.test.ts](../src/domain/domain.test.ts), remix test;
[extension.test.ts](../extension/extension.test.ts), mock host;
[package.json](../package.json), `test`.

Testy dobře pokrývají validaci dat a chyby transportu. Nekontrolují skutečně
vytvořenou strukturu remixovaného DOM, změnu stavu při otevřeném dialogu,
fokus při výměně výsledků ani viditelnost právě vzniklé revize. `runInNewContext`
testuje JS, ale nesimuluje HTML parser a inherited CSP skutečného webview.

**Oprava:** přidat několik cílených regresí na uživatelské výsledky: duplicitní
billing bloky, regenerace s otevřeným expanded, výběr nové revize a zachování
poslední validní volby při chybě. Jeden pravidelný native smoke průchod je
hodnotnější než další desítky testů kopírujících implementaci. Jestli přibudou
`.test.tsx` testy, rozšířit jejich discovery — současný script vybírá `.test.ts`.

### R15 · P2 — Filename guard odmítá i běžné design tokeny

**Důkaz:** regex explicitně blokuje segment `token`/`tokens` bez ohledu na obsah.
**Místo:** [source.ts](../extension/source.ts), `validateSource`, ř. 31.

Například `src/styles/tokens.css` spadá do podporovaných CSS souborů, ale skončí
jako „hidden, generated or sensitive file“. Podobně adresář `tokens` zablokuje
vnořený soubor. U UI nástroje jde o běžné legitimní pojmenování, ne nutně API token.

**Oprava:** zpřesnit pravidla a chybové vysvětlení; oddělit opravdu zjevné secret
cesty od nejednoznačných jmen. Zachovat explicitní kontrolu snapshotu, trust,
realpath a vendor consent. Automatický filename filtr stále nesmí být prezentován
jako detektor tajných údajů v obsahu.

### R16 · P2 — Přijatý výstup může mít nefunkční preview bez vysvětlení

**Důkaz:** riziko přímo z implementace, ne reprodukovaný neúspěch skutečného modelu.
**Místo:** [validation.ts](../src/domain/validation.ts), `validVariant`;
[Preview.tsx](../src/components/Preview.tsx), iframe;
[document.ts](../src/domain/document.ts), `documentFor`.

Validace kontroluje typy, velikosti a některé serializační limity. Neprokazuje
syntaktickou správnost JS, viditelnost obsahu ani fungování tlačítek. Textový HTML
fragment, skrytý obsah nebo JS se syntaktickou chybou mohou projít. Preview nemá
uživatelský stav „obsah se nepodařilo zobrazit“ ani cestu k inspekci jednotlivé
nevybrané implementace; úspěch provider requestu působí jako úspěch preview.

**Oprava:** dát uživateli možnost nahlásit/zkontrolovat vadný náhled a otevřít jeho
kód bez nuceného Choose. Volitelnou syntaktickou či runtime diagnostiku chápat
jako pomoc, nikoli bezpečnostní audit. Generovaný kód nesmí kvůli diagnostice
dostat širší sandbox práva nebo možnost posílat autoritativní host příkazy.

### R17 · P3 — Přepínač mobile neukazuje skutečný viewport

**Důkaz:** při šířce panelu 600 px mají iframy 287 px před přepnutím i po něm.
**Místo:** [styles.css](../src/styles.css), ř. 612;
[ComparisonCanvas.tsx](../src/components/ComparisonCanvas.tsx), ř. 44.

Jde o `max-width: 375px`, nikoli nastavení skutečné šířky 375 px. Ikona monitoru
znamená vyplnění sloupce, ne desktop. Samotné omezení maximální šířky je správně
implementované; problém je slabá informace pro člověka hodnotícího breakpointy.

**Oprava:** pojmenovat režimy Fit / Max 375 px a zobrazit skutečnou šířku.
Pro přesný 375px viewport nabídnout expanded náhled, pokud se do panelu vejde.
Horizontální scroll comparison gridu sám o sobě není bug — produkt jej připouští.

### R18 · P3 — Cmd/Ctrl+Enter funguje jen v hlavním zadání

**Důkaz:** Control+Enter v refinementu nechal otevřený dialog bez requestu.
**Místo:** [PromptPanel.tsx](../src/components/PromptPanel.tsx), `onKeyDown`;
[RefinementDialog.tsx](../src/components/RefinementDialog.tsx), textarea.

**Oprava:** sdílet obsluhu zkratky také pro refine/remix, včetně trim, busy
a dostupnosti providera. Zkratku popsat a zachovat běžný Enter pro nový řádek.

### R19 · P3 — Jeden široký context a celé state zprávy zvyšují cenu drobných změn

**Důkaz:** technický dluh z kódu; žádný změřený závažný výkonový problém.
**Místo:** [WorkspaceProvider.tsx](../src/state/WorkspaceProvider.tsx), ř. 22 a 206;
[extension.ts](../extension/extension.ts), `publish` / `refreshProviders`.

Controller spojuje host session, prompt, provider, remix, selection, všechny
dialogy, exportní tab i toast. Změna promptu přerenderuje všechny context
consumers. Host navíc při busy/provider změnách posílá znovu celý snapshot
a všechny implementace. U 15 směrů na hranici limitů jde řádově o čtyři miliony
znaků implementací ještě před JSON escapingem.

**Oprava:** nejprve profilovat delší session. Pak oddělit editor data, operace
a přechodné UI stavy; u transportu zvážit status zprávy bez opakovaného kódu.
Nedoplňovat plošně `useMemo` bez důvodu. Současné `memo(Preview)` a zachování
identity nezměněných variant jsou dobré a mají zůstat.

### R20 · P3 — Kurátorované implementace jsou obtížně udržovatelné řetězce

**Důkaz:** [variants.ts](../src/variants.ts), dlouhé jednořádkové HTML/CSS;
[demo.ts](../src/domain/demo.ts), řetězení CSS a selektory s `!important`.

Sample se tváří krátce podle počtu řádků, ale zásah do struktury, ceny nebo
disclaimeru je obtížně reviewovatelný. Iterované refinements vrství CSS a remix
kopíruje celé CSS obou zdrojů. Tím se zvyšuje šance na chyby typu R01 a na
rozpor mezi tvrzením changes a skutečnou transformací.

**Oprava:** rozdělit sample na čitelné fragmenty/šablony a explicitní data pro
fakta, CTA a billing. Styly presetů skládat deterministicky a minimální variantu
odvozovat bez nekonečného připisování override bloků. Není potřeba přidávat
obecný framework pro generované komponenty ani kompilaci Reactu.

### R21 · P3 — Footer používá příliš absolutní „No project files changed“

**Důkaz:** statický text a native export na uživatelem zvolenou URI.
**Místo:** [App.tsx](../src/App.tsx), ř. 44;
[extension.ts](../extension/extension.ts), `exportHtml` / `workspace.fs.writeFile`.

Save HTML může legitimně vytvořit nebo přepsat soubor uvnitř projektu. Footer
pak stále tvrdí, že se žádné projektové soubory nezměnily. Nejde o automatické
neautorizované editování, ale formulace zaměňuje „nic neměníme automaticky“
za tvrzení o aktuálním stavu filesystemu.

**Oprava:** použít přesné „No automatic project edits“ nebo informaci o ručním
handoffu. Nepředstírat sledování git diffu, které aplikace neprovádí.

## Rozpracovaná Cursor CLI integrace — samostatná hranice review

Ve snapshotu už existuje [cursor.ts](../extension/cursor.ts), třetí provider
v [protocol.ts](../src/domain/protocol.ts), host routing a nastavení
`spectra.cursorModel` / `spectra.cursorCliPath`. Nejde tedy o čistě plánovaný soubor.
Frontend v tomto snapshotu používá Cursor jako výchozí engine. Tato část vznikala
souběžně s review a **nemá ověřené přihlášení ani skutečné generování**.

Konkrétní věci k dokončení či ověření před vydáním:

- **Sjednotit produktový a bezpečnostní kontrakt.** Referenční PRODUCT/LLM_CONTRACT
  a README stále popisují jen přímé vendory a žádné využití Cursor účtu. Kód už
  spouští externí CLI, vytváří jeho profil a předává mu zdroj přes stdin.
  UI/native souhlas musí přesně odpovídat této cestě i případnému ukládání CLI historie.
- **Samostatně ověřit model oprávnění CLI.** `--sandbox enabled`, ask mode, vlastní
  dočasný workspace a deny pravidla jsou rozumný záměr. Z přečtení argumentů nelze
  potvrdit, že konkrétní instalovaná verze CLI všechna pravidla skutečně vynucuje.
- **Doplnit cílené testy adaptéru.** Ve snapshotu nejsou testy `cursor.ts`.
  Ověřit chybějící executable, nepodporovanou platformu, odhlášený účet, neúspěšný
  envelope, EPIPE, limit stdout/stderr, timeout, cancel a cleanup potomků/temp adresáře.
- **Ověřit chování po novém otevření panelu.** `cursorReady` začíná false, zatímco
  přihlašovací profil je persistentní. Uživatel může být přihlášený, ale musí znovu
  zjistit stav. To je možná záměrná kontrola, nesmí však být prezentovaná jako ztráta účtu.
- **Na Windows dát srozumitelnou alternativu.** CLI resolver Windows odmítá,
  ale UI default je Cursor. Přímé API providery mají zůstat jasně dostupné.
- **Dokončit formátování a zopakovat gate.** Pět formátovacích neshod výše patří
  zachycenému rozpracovanému stavu, ne původní již opravené serializaci.

Tyto body nejsou tvrzením, že CLI prokazatelně čte zakázané soubory nebo unikají
credentials. Takový runtime důkaz review nemá. Stejně tak starší úspěšné unit
testy přímých providerů tuto novou cestu nepokrývají.

## Další rizika, která nejsou potvrzenou chybou

| Oblast                          | Konkrétní riziko / nejmenší užitečné ověření                                                                                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native webview CSP              | Browser harness neověřuje inherited CSP Cursoru. V Extension Development Hostu zkusit lokální JS interakci a blokování fetch/external asset/form submission. Neoslabovat CSP jen proto, že něco nefunguje v preview.                |
| Časování requestů               | Bridge má 180 s od odeslání, provider 90 s až po potvrzení. Dlouho otevřený native dialog může vést k timeoutu UI před pozdějším úspěchem hostu. Ověřit, že se následná revize správně ukáže a nespustí se duplicitní práce.        |
| Velikost celého provider vstupu | Limity jsou hlavně na jednotlivá pole. Source + Original + dva maximálně dlouhé remix zdroje mohou překročit kontext vybraného modelu. Chyba je obsloužená, ale vhodný celkový budget a konkrétnější guidance by zlepšily recovery. |
| Výstupní budget                 | První generování musí vtěsnat čtyři implementace do 16 000 výstupních tokenů. U složité komponenty může přijít truncation. Ověřit reálné modely a reprezentativní vstupy; zatím není doložená běžná úspěšnost.                      |
| CPU v iframe                    | `allow-scripts` neznamená časový limit JS. Náročný nebo nekonečný skript může způsobit zamrznutí rendereru. Jde o zbývající riziko, ne zde reprodukovaný host escape; nepoužívat absolutní tvrzení o bezpečnosti.                   |
| High contrast a škálování       | Editorové tokeny jsou dobrý základ. Ještě ověřit focus, selected/disabled stavy a čitelnost 9–10px badge při zvětšeném editor fontu. Samotných 28px toolbar buttons není důvod označit desktop extension za nepřístupnou.           |

## Orientační UI audit

Skóre zahrnuje shell a kurátorované náhledy. Je to heuristické hodnocení rozsahu
tohoto review, nikoli certifikace WCAG, benchmark nebo hodnocení živých AI výstupů.

| Oblast                            | Skóre / 4   | Hlavní důvod                                                                         |
| --------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Přístupnost                       | 2           | Nízký kontrast sample; u shellu jsou labely, focus a native dialog základ dobře.     |
| Výkon                             | 3           | Kompaktní bundle, memo preview; riziko velkých state zpráv nebylo profilované.       |
| Responzivita                      | 2           | Akce hluboko pod foldem, nevyrovnané rationale; narrow comparison má funkční scroll. |
| Theming                           | 3           | Používají se editorové tokeny; skutečný light/high-contrast editor ještě neověřen.   |
| Vizuální a obsahové anti-patterns | 2           | Shell je střídmý, sample má generickou estetiku a slabé argumenty changes.           |
| **Celkem**                        | **12 / 20** | **Použitelný základ, který potřebuje podstatné dotažení workflow a sample.**         |

## Co zachovat

- Standardní VS Code extension architekturu; žádný návrat k Express webu,
  fake účtu, marketingové navigaci či implicitnímu načítání celého workspace.
- Hostem držený snapshot včetně unsaved source a řešení source IDs na hostu.
- Runtime allowlist příkazů, limity velikostí, atomický commit a pevný Original.
- Native password InputBox a SecretStorage pro přímé API klíče.
- Restriktivní parent CSP a preview sandbox bez same-origin oprávnění.
- Oddělení Browser harness / Curated sample / živého generování.
- Označení Original jako rekonstrukce a exportní varování. Chybějící dependencies,
  skutečný rendered capture nebo automatický Apply jsou vědomě omezený scope,
  nikoli bugy, které by se měly „opravit“ obcházením kontraktu.
- Zachování identity preview při nezměněných implementacích, reduced-motion
  pravidla shellu a native `<dialog>` s obnovou fokusu.

## Doporučené pořadí práce

1. Opravit R01 a R02. U dema kontrolovat výsledný DOM, obsah a billing stav,
   nikoli jen existenci textových fragmentů.
2. Opravit R03–R05 a R13; přidat k nim malé regresní scénáře podle R14.
3. Zpřístupnit akce a výsledky podle R06–R11. Nejdřív funkční pracovní tok,
   teprve pak kosmetika.
4. Dokončit Cursor CLI cestu podle jejího samostatného checklistu, sjednotit
   dokumentaci a spustit plný `npm run check` na stabilním checkoutu.
5. Provést skutečný F5 smoke: malý vlastní komponent → zachycení unsaved snapshotu
   → potvrzené živé generování → refine → Copy for Cursor → Save HTML.
   Provider, model, prostředí a skutečný výsledek zaznamenat zvlášť.
6. Až potom řešit P3 a výkonová doporučení na základě profilování.

Pro navazující UI práci odpovídají těmto skupinám `$impeccable harden`,
`$impeccable clarify`, `$impeccable layout` / `$impeccable adapt` a nakonec
`$impeccable polish`. Lze je zadat jednotlivě či společně; následný
`$impeccable audit` má přeměřit opravené chování.

Tento dokument doplňuje [UX_REVIEW.md](UX_REVIEW.md), který se soustředí na
pracovní plochu a editorový vzhled. Neimplementuje jeho doporučení.
**Nejmenší další krok:** opravit deterministické skládání demo remixu a přidat
regresi pro přepnutí Monthly po remixu C s vlastní revizí.
