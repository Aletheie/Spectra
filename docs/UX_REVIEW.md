# Spectra — UX review, 30. září 2026

Cíl: zjednodušit práci s variantami a přiblížit prostředí Cursoru / VS Code.
Jde o návrhy změn, nikoli o hotovou implementaci.

## Závěr

Vizuální základ už odpovídá editoru: používá jeho barvy a písmo, ploché panely,
jemné oddělovače a malé rohy. Největší slabinou je rozložení pracovní plochy:
kontext a zadání zabírají velkou část okna, zatímco rozhodovací a exportní akce
jsou pod náhledy. Prioritou je dostupnost akcí a orientace mezi variantami.

## Ověření a jeho hranice

Prohlédnuty produktové dokumenty, protokol, komponenty, stav UI, CSS a relevantní
části extension hostu. V existujícím Browser harnessu na `127.0.0.1:5178` byl
v samostatném headless Chromiu vyzkoušen kurátorovaný vzorek: generování, remix
výběr, refinement, volba varianty, návrat do porovnání a opětovné generování.
Prohlédnuty screenshoty prázdného stavu, širokého i úzkého porovnání a vybrané varianty.

Rozměry níže zahrnují banner Browser harnessu a kurátorovaný obsah. Nejsou měřením
skutečného webview v Cursoru. Native capture, provider requests, clipboard, uložení HTML,
F5, VSIX ani skutečná světlá / kontrastní témata editoru nebyly v tomto auditu ověřeny.
Při průchodu nebyly zachyceny chyby JavaScriptu stránky. Nastavení na šířce 320 px
nemělo vnitřní horizontální overflow. Build ani unit testy nebyly spouštěny;
aplikační kód se neměnil.

## Doporučení podle priority

### 1. P1 — Dostat rozhodovací akce do viditelné pracovní plochy

**Ověřeno v prohlížeči:** při 1440 × 900 začínají náhledy na y ≈ 536 px a řádek
Choose / Refine až na y ≈ 1189 px. Uživatel tedy při prvním pohledu nevidí hlavní akce.
V režimu Selected při šířce 720 px začíná panel s akcemi až na y ≈ 1066 px;
při 600 px se náhledy skládají pod sebe a panel začíná na y ≈ 1815 px.

**Návrh:** po úspěšném generování zabalit zadání do jednořádkového shrnutí s Edit intent.
Zachovat dostupnou kontrolu snapshotu a viditelné označení AI reconstruction.
Choose / Refine umístit do záhlaví varianty nebo stále dostupné lišty.
Po volbě varianty mít Copy for Cursor a Save HTML přímo v horní liště;
prohlížení kódu ponechat samostatnou vedlejší akcí.

**Hotovo, když:** při 720 × 800 lze zvolit variantu a najít handoff bez vertikálního
scrollování přes oba náhledy. Náhledy používají zbývající výšku panelu.

Zdroje: `src/components/PromptPanel.tsx`, `VariantCard.tsx`, `ChosenDirection.tsx`;
`src/styles.css`: `.hypothesis`, `.preview iframe`, `.preview-large`, `.ship-layout`.

### 2. P1 — Přizpůsobit porovnání panelu vedle editoru

**Ověřeno v prohlížeči:** při 720 px mají čtyři náhledy každý jen 287 px a porovnání
šířku 1152 px. Část směrů vyžaduje vodorovný scroll. Přepnutí na mobile šířku v tomto
rozložení nic nezmění: iframe zůstává 287 px. Stejně při 1440 px zůstává pod limitem
375 px. Ikona monitoru znamená vyplnění sloupce, nikoli desktop viewport.

**Návrh:** zachovat ORIGINAL | A | B | C na široké ploše. V užším panelu nabídnout
záložky A / B / C a vedle aktivního směru připnutý Original; ve velmi úzkém zobrazení
umožnit přepínání Original ↔ Selected při stejné šířce. Všechny směry zůstanou dostupné.
U rozměrů používat přesné názvy Fit / 375 px a zobrazit skutečnou šířku; pokud se
375 px nevejde, uvést omezení nebo nabídnout rozšířený náhled.

**Hotovo, když:** uživatel vždy vidí, které směry existují, co porovnává a při jakém
rozměru. Ovládání nepředstírá desktopový náhled v úzkém sloupci.

Zdroje: `src/components/ComparisonCanvas.tsx`, `Preview.tsx`;
`src/styles.css`: `.comparison-grid`, `.preview.mobile-preview iframe`.

### 3. P1 — Dovést uživatele k nové revizi a zachovat orientaci

**Ověřeno v prohlížeči:** po refinementu z Compare se nový výsledek přidá jako
REVISION 1 mimo obrazovku. Při šířce 720 px začínal na x = 1152 px; porovnání zůstalo
na scrollLeft = 0 a fokus se vrátil na původní Refine. Po návratu z Selected není
zvolená karta v Compare označena — má opět stejné Choose jako ostatní.

**Návrh:** po úspěšném refinementu novou revizi ukázat a označit, při chybě ponechat
původní výběr. Viditelně označit aktuální Selected také v Compare. Jako další krok
seskupit revize k původnímu směru (např. A → A v2), s dostupnými staršími verzemi.
Pro skutečný rodokmen revizí bude potřeba rozšířit doménová data, validaci a kontrakt;
nelze ho spolehlivě odvozovat z názvu varianty.

**Hotovo, když:** dokončená revize je vidět bez hledání a je jasné, z čeho vznikla.

Zdroje: `src/state/WorkspaceProvider.tsx`: `run`, `choose`;
`src/components/ComparisonCanvas.tsx`, `VariantCard.tsx`.

### 4. P2 — Zpřehlednit remix a pořadí zdrojů

**Ověřeno v prohlížeči:** zaškrtnutí A, B, C skončí výběrem B + C. A se automaticky
odškrtne bez vysvětlení. Pořadí přitom určuje výchozí instrukci, ze které varianty
vzít layout a ze které CTA. Checkboxy také vizuálně konkurují akci Choose.

**Návrh:** nabídnout explicitní režim Remix a v liště zobrazit dva pojmenované zdroje
v pořadí 1 / 2. Po výběru dvou další výběr zablokovat s vysvětlením nebo nechat
uživatele výslovně určit, který zdroj nahradí. Nabídnout zrušení výběru.

Zdroje: `src/state/WorkspaceProvider.tsx`: `toggleRemix`, `openRemix`;
`src/components/VariantCard.tsx`, `ComparisonCanvas.tsx`.

### 5. P2 — Přiblížit refinement běžné práci v editoru

**Ověřeno v prohlížeči:** Ctrl+Enter v refinement textarea nic neudělá, zatímco
hlavní zadání tuto zkratku podporuje. Dialog překrývá referenční variantu.

**Návrh:** nejdřív sjednotit Cmd/Ctrl+Enter a viditelnou nápovědu napříč zadáním,
refinementem a remixem. Následně zvážit připojený panel s instrukcí vedle náhledu
(v úzkém režimu pod ním), aby při psaní zůstal vidět upravovaný výsledek.
Zachovat správnou práci s fokusem, Escape a obnovu ovládání po chybě.

Zdroje: `src/components/RefinementDialog.tsx`, `PromptPanel.tsx`, `Dialog.tsx`.

### 6. P2 — Pojmenovat opětovné generování a průběh podle skutečné akce

**Ověřeno v prohlížeči:** po vytvoření revize má hlavní tlačítko stále název Generate
3 directions. Jeho použití vrátí porovnání na tři nové směry, odstraní revize
z aktuální relace a zruší volbu. To je předepsané chování, ale označení neříká,
že nahrazuje rozpracované výsledky.

**Zjištěno v kódu, native runtime neověřen:** obecné `editor.busy` se používá pro
Generating i při konfiguraci klíče či exportu. Zrušení nativního potvrzení je
zpracováno jako chyba. V refinementu se při busy zablokuje zavření dialogu;
skutečné rušení generování je v nativní notifikaci.

**Návrh:** po prvním generování použít New comparison / Replace directions a vysvětlit
nahrazení revizí a výběru. Rozlišit čekání na native potvrzení od probíhající generace
a od exportu, bez fiktivních fází. Běžné zrušení zobrazit jako neutrální stav.
V UI jasně ukázat, kde lze generování zrušit. Změna stavového protokolu vyžaduje
aktualizaci hostu, validace a smluvní dokumentace.

Zdroje: `src/components/PromptPanel.tsx`, `ComparisonCanvas.tsx`;
`src/state/WorkspaceProvider.tsx`; `extension/extension.ts`: `execute`, generování.

## Konkrétní směr pro Cursor / VS Code vzhled

- Zachovat současné `--vscode-*` barvy a editorové písmo. Změna celé palety má malý přínos.
- Sjednotit kontext do kompaktního řádku: soubor, rozsah snapshotu, Review source,
  Re-capture a provider/model. Nepřidávat falešný explorer nebo activity bar.
- Hlavní plochu uspořádat jako editorové panely s jasnými záložkami a oddělovači.
  Sekundární toolbar akce 28–32 px vysoké, ikony kolem 16 px, běžný text 12–13 px.
- Důležité štítky nyní mají místy jen 9–10 px. U označení baseline, variant a stavu
  dát přednost čitelnosti 11–12 px a relativnímu škálování vůči písmu editoru.
- Model a provider zobrazit u zadání; konfigurace klíčů zůstává v native InputBoxu.
- Pro případnou sjednocenou sadu ikon zvážit lokálně přibalené Codicons. Menší priorita
  než rozložení, stav výběru a ovládání klávesnicí.
- Světlé a high-contrast téma ověřit přímo v editoru; zkontrolovat focus, výběr,
  disabled stavy a použití `--vscode-contrastBorder`. Tento audit nepotvrzuje jejich selhání.

## Nejmenší další krok

Implementovat bod 1 a viditelné označení vybrané varianty z bodu 3, potom prověřit
720 × 800 v reálném Extension Development Hostu. Následně řešit úzké porovnávání,
navigaci revizí a remix. Zachovat bezpečnostní potvrzení, označení rekonstrukce,
kurátorovaného obsahu a ruční povahu Copy for Cursor.
