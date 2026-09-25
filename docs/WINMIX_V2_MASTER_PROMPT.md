# WINMIX V2 MASTER DEVELOPMENT PROMPT

> **Verzió:** V2 · 2026-09-24
> **Cél:** Irányított H2H, predikciós visszajelzés, megbízhatóság és kiértékelés kontrollált integrációja a meglévő WINMIX architektúrába.

---

## Abszolút első válasz követelmény

Mielőtt BÁRMILYEN SQL migrációt, Edge Function-t, adatbázis-függvényt, worker-t, táblát, indexet, RLS policy-t, triggert, view-t vagy alkalmazáskódot létrehoznál vagy módosítanál:

**ÁLLJ.**

Ne implementálj semmit. Az első deliverable egy architektúra-audit kell legyen (lásd: `WINMIX_PHASE0_AUDIT_PROMPT.md`).

Az auditnak kifejezetten válaszolnia kell:
1. Melyek a tényleges meglévő táblák, amelyek relevánsak meccsekhez, csapatokhoz, adatverziókhoz, paraméterekhez, engine run-okhoz, engine job-okhoz, predikciókhoz, predikciós kártyákhoz, fixture kérésekhez, kalibrációhoz és mérkőzés-eredményekhez?
2. Melyek a tényleges oszlopok és adattípusok?
3. Mely meglévő objektum képvisel már egy predikciót, egy predikció eredményét, egy modell run-t, egy adatverziót, egy publikált predikciót vagy egy kalibrációs eredményt?
4. Van-e már a jelenlegi architektúrában irányított H2H aggregáció?
5. Van-e már predikciós visszajelzés, matchup-szintű történelmi megbízhatóság, büntetés/megbízhatóság tárolás, megváltoztathatatlan predikciós történet vagy eredmény-/kiértékeléstörténet?
6. Mely javasolt képességek implementálhatók meglévő objektumok kibővítésével?
7. Mely képességek igényelnek valóban új táblákat?
8. Mely RLS policy-k vonatkoznak azokra az objektumokra?
9. Mely szerepköröknek van jelenleg SELECT, INSERT, UPDATE, DELETE vagy EXECUTE jogosultságuk?
10. Hogyan történik jelenleg az engine job-ok claimingje, retry-ja és promotion-je?
11. Hol fut jelenleg a tartós történelmi számítás?
12. Mi a jelenlegi igazságforrás a mérkőzés-eredményekhez, predikciós valószínűségekhez, modellverziókhoz, adatverziókhoz és paraméter-pillanatképekhez?
13. Kövess egy meglévő predikciót a forrásadattól a végleges predikciós kártyáig.
14. Azonosítsd az összes helyet, ahol történelmi eredményadat véletlenül bekerülhet egy pre-match feature-be.
15. Azonosítsd az összes meglévő indexet, amely releváns a javasolt H2H lekérdezésekhez.
16. Azonosítsd az összes meglévő objektumot, amely a specifikáció egy részét feleslegessé vagy redundánssá teszi.

Ezután állíts elő egy kompatibilitási mátrixot:

| Képesség | Meglévő objektum | Újrafelhasználható? | Kibővítés szükséges? | Új objektum szükséges? | Bizonyíték |
|----------|------------------|---------------------|----------------------|------------------------|------------|

Ne írj implementációs kódot, amíg ez a mátrix nem készült el.
Ne következz úgy, hogy egy objektum létezik, mert ez a prompt megnevezi.
Ne következz úgy, hogy egy objektum nem létezik, mert ez a prompt nem nevezi meg.
A repository és a tényleges adatbázis-séma a mérvadó.

---

## 1. Non-negotiable rules

### 1.1 Audit before implementation

Fájlok szerkesztése vagy adatbázis-objektumok létrehozása előtt:
1. Vizsgáld meg a repository-t, migrációkat, generált adatbázis-típusokat, SQL függvényeket, Edge Function-öket, teszteket és frontend integrációkat.
2. Vizsgáld meg a tényleges jelenlegi Supabase sémát, megszorításokat, indexeket, RLS policy-ket, grantokat, view-kat, triggereket és függvényeket, ha élő adatbázis-hozzáférés elérhető.
3. Kövesd a meglévő lifecycle-t: adatimport és validáció → adatverzió-sealing és promotion → paraméter-pillanatképek → engine-job claiming és retry-k → engine run-ok és promotion → predikciók és kalibráció → fixture predikció kérések, kártyák, kiválasztások és publikálás → eredményrögzítés és kiértékelés.
4. Azonosítsd a hívókat és függőségeket, mielőtt bármilyen meglévő objektumot módosítanál.
5. Állíts elő audit-jelentést, amely elkülöníti: ellenőrzött repository tények, ellenőrzött élő adatbázis tények, korábbi dokumentáció által megadott de nem függetlenül ellenőrzött tények, feltételezések és megoldatlan kérdések.

Ha élő adatbázis-hozzáférés nem elérhető, mondd ezt kifejezetten. Ne tekintsd a megadott séma-jegyzeteket ellenőrzött élő sémának.

Ne hozz létre táblát, függvényt, Edge Function-t, queue-t vagy párhuzamos lifecycle-ot csak azért, mert ez a prompt javasolja. Először állapítsd meg, hogy létezik-e már egy egyenértékű és hogy biztonságosan kibővíthető-e.

Ha egy kritikus tervezési döntés nem oldható meg a repository-ból, sémából vagy tesztekből, állj meg annál a döntésnél és jelentsd az opciókat és következményeket. Ne találj ki csendben üzleti szabályokat.

### 1.2 Preserve the existing architecture

A meglévő WINMIX koncepciók, amelyek már jelen lehetnek:
- `winmix_data_versions`
- `winmix_parameter_snapshots`
- `winmix_engine_jobs`
- `winmix_engine_runs`
- `winmix_match_features`
- `winmix_team_state_snapshots`
- `winmix_predictions`
- `winmix_calibration_results`
- `winmix_fixture_prediction_requests`
- `winmix_fixture_prediction_cards`
- `winmix_fixture_prediction_selections`

Ezeket a neveket audit-célokként kezeld, nem bizonyítékként, hogy az objektumok léteznek vagy a feltételezett definícióval rendelkeznek.

A megadott séma-jegyzetek azt jelzik, hogy a fixture kérések már rögzíthetik a `source_run_id`, `data_version_id` és `parameter_snapshot_id` értékeket. Ellenőrizd ezt és használd újra a meglévő származást, ahol megfelelő.

Ne hozz létre dupla verzióit a meglévő tábláknak, run promotion-nek, job claiming-nek, fixture publikálásnak vagy kalibrációs workflow-nak.

### 1.3 No production mutation or deployment without approval

Megvizsgálhatod a projektet és előkészíthetsz migrációkat és kódváltoztatásokat. Ne alkalmazz migrációkat a kapcsolt production adatbázison, ne változtass production adatokat, ne deployolj Edge Function-öket, ne változtass titkokat és ne publikálj kiadásokat, hacsak kifejezetten nem autorizálják.

Ne végezz visszafordíthatatlan műveleteket, mint `DROP`, `TRUNCATE`, korlátozás nélküli `DELETE`, destruktív oszlopváltoztatások vagy destruktív adat-újraírások.

Preferálj additív, visszafelé kompatibilis változtatásokat és expand/contract migrációs stratégiát.

---

## 2. Execution phases

Tartsd be ezeket a fázisokat sorrendben. Ne ugord át az audit vagy merge fázisokat.

### Phase 0 — Existing architecture audit
Lásd: `WINMIX_PHASE0_AUDIT_PROMPT.md`

### Phase 1 — Compatibility and security design
Minden javasolt képességnél döntsd el, hogy:
- újrahasználj egy meglévő objektumot,
- bővíts egy meglévő objektumot, vagy
- vezess be egy új objektumot csak akkor, ha az audit bizonyítja, hogy nem létezik megfelelő egyenértékű.

Dokumentáld az adattulajdonjogot, hozzáférési szerepköröket, írási útvonalat, lifecycle-t és idegen-kulcs származást minden érintett objektumnál.

Ne feltételezd, hogy `authenticated` jelentse az adminisztrátort. Fedezd fel a tényleges admin autorizációs modellt.

### Phase 2 — Statistical design
Írj pontos definíciókat a számítások implementálása előtt:
- a pontos irányított-pár kulcs
- a meccs-felvételi szabályok és cutoff
- minden count és rate jelentése és nevezője
- a recency-súlyozás és annak felezési ideje, ha használják
- a Kish effektív mintaméret (ESS) képlete és súlyai
- a nulla mintájú párok és NULL értékek kezelése
- a pre-match predikciós feature-ök és post-match eredmények szétválasztása
- a kalibrációs és kiértékelési minta-jogosultsági szabályok

Minden modell-, H2H-, kalibrációs-, megbízhatósági- és kiválasztási küszöbnek verziózott paraméternek kell lennie — nem szétszórt hard-kódolt konstansoknak.

### Phase 3 — Feedback and immutable-history design
Definiáld, hogyan kapcsolódik egy eredeti predikció a tényleges eredményéhez anélkül, hogy a kiadott predikciót megváltoztatná.

Preferáld a meglévő predikció-/kártya-/kiadás-lifecycle-t, ahol megfelelő. Csak akkor vezess be új append-only eredmény- vagy kiértékelés-rekordot, ha az audit bizonyítja, hogy a jelenlegi séma nem tudja biztonságosan reprezentálni a szükséges lifecycle-t.

### Phase 4 — Migration design
Additív SQL migrációkat készíts csak a Phase 0–3 befejezése után.

A migrációk véglegesítése előtt:
- validáld az idegen kulcsokat és egyediségi kulcsokat a tényleges séma ellen
- definiáld a grantokat és RLS-t együtt
- ellenőrizd az oszloptípusokat és numerikus konvenciókat a meglévő kód ellen
- bizonyítsd, hogy minden megszorítás kompatibilis az írási útvonallal
- definiáld az indexeket a tényleges lekérdezési mintákból
- biztosítsd, hogy a migráció biztonságosan alkalmazható a meglévő adatokra
- biztosíts egy rollback vagy forward-recovery tervet, amely nem támaszkodik destruktív adatvesztésre

Ne alkalmazd a migrációkat production-re.

### Phase 5 — Worker and aggregation implementation
A történelmi aggregációt set-alapú SQL műveletben vagy tartós workerben implementáld, az audit és a mért terhelés alapján választva.

A teljes történelmi pipeline vagy nagy történelmi aggregáció NEM implementálható Edge Function loop-ként, amely csapatonként vagy meccsenként egy-egy Supabase lekérdezést végez.

Worker-alapú tervnél:
- használj korlátozott batch-eket és folytatható checkpoint-okat
- a retry-k legyenek biztonságosak és idempotensek
- rögzítsd a haladást tartósan
- a kimenet legyen kötve a pontos adatverzióhoz, paraméter-pillanatképhez és run-hoz
- validáld az összes kimenetet a promotion előtt
- használj bulk olvasást/írást páronkénti hálózati kérés helyett

Adatbázis-aggregációnál:
- használj set-alapú SQL-t soronkénti alkalmazás-loop helyett
- vizsgáld a lekérdezési tervet és a releváns indexeket
- biztosítsd, hogy az aggregáció csak a megfelelő sealed adatverziót és cutoff-ot olvassa
- írd az eredményeket atomikusan vagy stage-eld és promotion-özd atomikusan

Egy Edge Function autentikálhat kéréseket, validálhat kis payload-okat, enqueue-olhat vagy triggerelhet munkát, végezhet rövid adminisztratív műveleteket és jelenthet job-státuszt. Ne támaszkodj egy Edge Function háttérfeladatára mint tartós worker vagy job queue helyettesítő. Tervezz megszakításra és retry-ra.

### Phase 6 — Edge Function orchestration
Csak akkor adj hozzá vagy módosíts Edge Function-t, ha az audit azonosít egy szükséges API/orchestration hiányt.

A függvények:
- autentikálják a hívót kifejezetten a meglévő bizalmi modell szerint
- validálják a bemeneteket szerveroldalon
- sosem teszik ki a service/secret kulcsot a böngészőnek
- kerülik a nagy adathalmaz-feldolgozást és korlátozás nélküli loop-okat
- használják a meglévő job-claim és promotion mechanizmusokat, ahol megfelelő
- visszaadnak egyértelmű státuszt és hibakódokat
- idempotensek, ahol a kérések retry-olhatók
- pin-elt függőségeket és támogatott Deno API-kat használnak
- korlátozzák a CORS-t a szükséges originokra, ahol megfelelő
- védik a privilégált RPC-ket least-privilege `EXECUTE` grantokkal

Ne adj hozzá harmadik fél AI/LLM hívást, hacsak kifejezetten nem jóváhagyják. A rendszernek determinisztikusan kell működnie LLM nélkül.

### Phase 7 — Golden-path integration
Implementálj egy végpont-útvonalat a meglévő architektúrán keresztül:
1. Válassz egy validált, sealed adatverziót.
2. Hozz létre vagy válassz egy verziózott paraméter-pillanatképet.
3. Generálj pre-match feature-öket, csak a predikciós cutoff előtt elérhető információkból.
4. Számítsd ki az irányított H2H statisztikákat a pontos hazai/vendég sorrenddel.
5. Generáld és tárold a predikciót a származással: adatverzió, paraméterek és run.
6. Alkalmazd a kalibrációs és megbízhatósági szabályokat verziózott paraméterekkel.
7. Hozd létre vagy frissítsd a meglévő fixture predikciós kártyát/kiadást a megszokott lifecycle-en keresztül.
8. Rögzítsd a tényleges eredményt külön a meccs után.
9. Értékeld ki az eredeti tárolt predikciót anélkül, hogy a valószínűségét vagy döntési nyomát átírnád.
10. Állíts elő reprodukálható metrikákat és auditálható megbízhatósági frissítést.

Az első deliverable egy egyszerű, reprodukálható baseline modell legyen — nem validálatlan küszöbök vagy fejlett optimalizációs szabályok gyűjteménye.

### Phase 8 — Backtest
Hozz létre egy idő-sorrendelt backtest-et, amely megakadályozza a leakage-t:
- egy fixture feature-jei csak a predikciós cutoff előtt elérhető adatokat használhatnak
- a cél meccs eredménye nem járulhat hozzá a saját feature-éhez
- későbbi eredmények nem befolyásolhatnak korábbi predikciókat
- használd a pontos tárolt paraméter-pillanatképet és adatverziót a reprodukálhatósághoz
- jelentsd a mintaméretet minden metrika mellett
- hasonlítsd össze a baseline és a javasolt változtatásokat ugyanazon a jogosult adathalmazon

Ne válassz küszöböket a végső tesztállapot vizsgálatával. Válaszd külön a hangolási adatot a végső kiértékelési időszaktól.

### Phase 9 — Security, correctness, and performance validation
Teszteld az adatbázis-hozzáférést `anon`, `authenticated` és privilégált szerver-szerepkörökként. Ellenőrizd mind az RLS-t, mind az SQL grantokat; a policy önmagában nem bizonyítja, hogy az API-hozzáférés engedélyezett vagy tiltott.

### Phase 10 — Final report
Jelentsd:
- újrahasznált, megváltoztatott és újonnan javasolt objektumok
- előkészített migrációk és kódfájlok
- végrehajtott tesztek és eredményeik
- backtest módszertan és eredmények
- lekérdezés-/futásidő-mérések és ismert korlátok
- megoldatlan feltételezések
- hogy bármi alkalmazva vagy deployolva volt-e

Soha ne állítsd, hogy egy migráció, függvény, worker vagy funkció deployolva van, hacsam ténylegesen deployolva és ellenőrizve nem lett.

---

## 3. Directional H2H requirements

### 3.1 Pair identity and sample
Az irányt a tényleges történelmi fixture oszlopok definiálják:
`(home_team_id, away_team_id)`

Egy jövőbeli Fulham-hazai/Chelsea-vendég fixture-nél csak azokat a minősítő történelmi meccseket vedd fel, amelyekben Fulham volt a hazai csapat és Chelsea a vendég. Ne merge-eld a fordított sorrendet ebbe a mintába.

Ha egy jövőbeli követelmény irányítatlan rivalizálási összefoglalót kér, tárold vagy számítsd külön és címkézd egyértelműen. Soha ne helyettesítsd vele az irányított H2H-t.

### 3.2 Counts first, rates second
Az aggregációnak minden százalékot ugyanabból a szűrt meccshalmazból és nevezőből kell levezetnie:

```
nyers minősítő meccsek
  → aggregált eredmény-/piaci count-ok
  → százalékok levezetése a count-okból és mintaméretből
  → invariánsok validálása
  → atomikus upsert vagy promotion
```

Minimum a következő mezőket, ha a terv tárolja őket:
- `home_win_count`, `draw_count`, `away_win_count`
- `home_win_pct`, `draw_pct`, `away_win_pct`
- piaci count-ok és megfelelő rate-ek
- `match_count`
- súlyozott mintametrikák, mint ESS, ha a súlyozási definíció fix

Ne illessz be részleges eredmény-százalékokat, miközben egy megszorítás megköveteli az összegük ~1-nek lenni.

Nem üres mintánál:
- eredmény-count-ok összege = mintaméret
- eredmény-rate-ek a count-okból és ugyanabból a nevezőből levezetve
- a rate-ek a repository numerikus konvencióját használják (tört vagy százalék); ne keverd a konvenciókat
- a kerekítés konzisztens a megszorítás-toleranciával

Üres mintánál definiálj explicit viselkedést. Ne használj `coalesce(NULL, 0)`-t úgy, hogy nem üres sor véletlenül kielégíti vagy megsérti az invariánst.

Validáld az invariánsokat az írás előtt és kikényszerítsd azokat az adatbázisban, ahol megfelelő. Csak teljes, validált aggregátumokat upsert-elj.

### 3.3 Atomicity and lineage
Minden aggregátum a megfelelő meglévő run-/verzió-származáshoz legyen társítva. Ne rendelj hozzá statisztikát olyan run-hoz, amely más adatverziót vagy paraméter-pillanatképet használt.

Írj staging vagy nem-current run scope-ba, validáld a sorszámokat és invariánsokat, majd promotion-özd a meglévő single promotion mechanizmuson keresztül, ahol elérhető. Ne tedd ki részlegesen számított kimenetet current-ként.

---

## 4. Versioned parameters; no invented fixed cutoffs

Ne hard-kódolj javasolt küszöböket, mint:
- minimum ESS
- minimum H2H minta
- valószínűség- vagy konfidencia-küszöbök
- egymást követő hiba-küszöbök
- büntetés-küszöbök vagy hűtési időszakok
- H2H lookback ablakok
- recency felezési idő
- kalibrációs bucket-méret vagy minimum kalibrációs minta

Először vizsgáld meg a `winmix_parameter_snapshots`-ot és a tényleges JSON sémáját és lifecycle-ját. Használd újra a meglévő paraméter-pillanatkép- és engine-run-származást. Ha a jelenlegi pillanatkép-formátum nem tudja kifejezni egy szükséges paramétert, javasolj visszafelé kompatibilis kiterjesztést.

Minden run azonosítsa a pontos használt paraméter-pillanatképet. Perzisztálj elég modell- és kód-/verzió-metaadatot a kimenet reprodukálásához és auditálásához.

Ne hangolj automatikusan paramétereket a végső backtest-időszak ellen.

---

## 5. Immutable prediction and result history

Az eredetileg kiadott predikció megváltoztathatatlan történelmi tény kiértékelési célból.

Egyszer kiadott vagy publikált predikció:
- soha ne írd át az eredeti valószínűségét, piaci döntését, predikciós időpontját, modell-/run-származását, feature-pillanatképét vagy döntési nyomát
- soha ne „korrigálj\" történelmi predikciókat a legújabb modell régi fixture-ökön való újrafuttatásával
- rögzítsd a tényleges eredményt külön eseményként vagy kiértékelés-rekordként
- ha a tényleges eredmények korrigálhatók, őrizd meg a korrekciós történetet és tedd az autoritatív eredményt levezethetővé a korábbi rekord törlése nélkül
- a duplikált eredmény-beküldések legyenek idempotensek
- a Brier score, log loss, kalibráció és backtest-ek a ténylegesen kiadott valószínűséget használják

Ne írj le egy táblát megváltoztathatatlinként, hacsam adatbázis-grantok, RLS, triggerek, append-only eseménytervezés vagy más kikényszeríthető mechanizmus ténylegesen meg nem akadályozza az unauthorized update/delete-eket.

A generated column nem trigger. Írd le és teszteld a tényleges adatbázis-viselkedést pontosan.

---

## 6. RLS, grants, and privileged access

Alkalmazz deny-by-default elveket minden új vagy módosított kitett táblán és függvényen.

Minden objektumnál határozd meg:
- a tábla kitett sémában van-e
- az RLS engedélyezve van-e
- mely szerepköröknek van tábla-grantja
- mely szerepköröknek van művelet-specifikus policy-je
- mely adat publikus és miért
- mely hozzáférés korlátozott egy autentikált tulajdonosra, ellenőrzött adminra vagy worker-re

Szabályok:
- Ne használj széles `USING (true)` policy-ket belső vagy érzékeny táblákon.
- Ne feltételezd, hogy több permissive policy metszetként kombinál; auditáld az effektív hozzáférési szemantikát és távolítsd el vagy konszolidáld a nem szándékos széles hozzáférést.
- Ne adj `authenticated` blanket hozzáférést belső adatokhoz csak azért, mert a felhasználók be tudnak jelentkezni.
- Ne feltételezd, hogy létezik „admin\" nevű szerepkör. Ellenőrizd a projekt tényleges autorizációs mechanizmusát.
- Tartsd privátban a visszajelzési történetet, büntetéseket, döntési nyomokat, paraméter-pillanatképeket, belső kalibrációs adatokat, checkpoint-okat és engine végrehajtási metaadatokat, hacsam egy dokumentált use-case nem igényel szűken scope-olt olvasási felületet.
- A frontend sosem kapjon service-role vagy secret hitelesítő adatokat.
- A service-role hozzáférés megbízható szerveroldali műveletekre van; nem ok arra, hogy belső táblákat a frontendnek tegyél láthatóvá.
- Ellenőrizd a tábla-grantokat és az RLS policy-ket. Az RLS sorokat korlátozza az objektum-hozzáférés megadása után; a grantok szabályozzák, hogy a szerepkör egyáltalán hozzáférhet-e az objektumhoz.
- Korlátozd az `EXECUTE`-et a privilégált RPC-ken és `SECURITY DEFINER` függvényeken. Pin-elj biztonságos `search_path`-et minden security-definer függénynél.
- Vizsgáld a view-kat `security_invoker` vagy más biztonságos kitettségi terv szempontjából.
- Teszteld a végső effektív hozzáférést `anon`, rendes `authenticated`, autorizált admin (ha van) és megbízható worker/service kontextusokként.

Ne szűkíts csendben egy meglévő policy-t, ha egy jelenlegi fogyasztó függhet tőle. Azonosítsd az érintett fogyasztókat, készíts elő a változtatást és jelentsd a szükséges frontend/API frissítéseket.

---

## 7. Statistical and model-quality requirements

- Akadályozd meg a cél-leakage-t minden történelmi feature-építésben.
- Definiáld a predikciós cutoff és adatelérhetőség szemantikát, különösen, ha fixture-ök azonos dátumokat vagy időpontokat osztanak.
- Tartsd külön a tényleges eredményeket a pre-match feature-öktől.
- Jelentsd a mintaméretet a pontosság, Brier score, log loss, ECE és minden konfidencia-intervallum mellett.
- Ne kezeld a kis mintájú H2H rate-t megbízhatóként pusztán azért, mert a százaléka magas.
- Definiáld, hogy az H2H shrinkage-t használ-e egy prior felé, és verziózd a prior paramétereit.
- Definiáld a megbízhatósági/büntetési frissítéseket megfigyelt, jogosult predikciókból; ne hagyd, hogy a hiányzó eredmények hibának számítsanak.
- Kerüld a több korrelált büntetés alkalmazását anélkül, hogy tesztelnéd a kombinált hatásukat.
- Biztosítsd, hogy a választott piaci szemantika megegyezik a meglévő WINMIX piaci kódokkal és frontend-elvárásokkal.
- Tartsd a baseline-t determinisztikusnak. Ha véletlenszámot használsz, perzisztáld a seedet és az összes releváns konfigurációt.

Az „AI Conductor\" ne legyen bevezetve mint függőség a helyességre. Bármilyen minőségi vagy külső-LLM réteg opcionális, nem felülírhatja a validált matematikai eredményeket, és kifejezett jóváhagyást igényel külső API hívások vagy projektadatok harmadik félnek küldése előtt.

---

## 8. Required tests and acceptance criteria

Adj hozzá vagy frissíts teszteket, megfelelően a repository és adatbázis szerint, beleértve:

### Database and aggregation tests
- a fordított hazai/vendég párok külön aggregátumokat eredményeznek
- eredmény-count-ok összege = `match_count`
- minden rate a megfelelő count-ból és nevezőből számított
- nem üres sorok nem hagyhatnak ki kötelező eredmény-rate-eket
- üres minta viselkedése explicit és valid
- ugyanazon run újrafeldolgozása idempotens
- egy sikertelen validáció nem publikál részleges aggregátumokat
- aggregátum-adat nem rendelhető rossz adatverzióhoz vagy run-hoz

### Leakage and prediction tests
- a cél meccs ki van zárva a saját pre-match feature-iből
- egyetlen jövőbeli meccs-eredmény sem kerül egy korábbi predikcióba
- predikciós valószínűségek változatlanok maradnak eredményrögzítés vagy későbbi modell-run után
- eredmény-korrekciók megőrzik az audit-nyomot
- ismételt eredmény-beküldés nem duplikál kiértékelést vagy büntetést

### RLS and grants tests
- `anon` nem olvathat belső visszajelzést, büntetéseket, paraméter-pillanatképeket, nyomokat vagy végrehajtási metaadatot, hacsam kifejezetten jóvá nem hagyják
- rendes `authenticated` felhasználók nem kapnak admin vagy worker hozzáférést
- publikált fixture-adat csak a tervezett RLS útvonalon látható
- egyetlen böngésző írási útvonal sem módosíthat megváltoztathatatlan predikciós történetet
- privilégált RPC-k nem végrehajthatók publikus szerepkörök által

### Worker and operational tests
- worker retry-k biztonságosak
- megszakított munka folytatható részleges kimenet publikálása nélkül
- duplikált job-feldolgozás nem hoz létre dupla kiadásokat vagy visszajelzést
- queue claim/promotion a meglévő mechanizmusokat használja, ahol lehetséges
- hibák hasznos, nem érzékeny státuszt és logokat eredményeznek

### Performance tests
- nincs páronkénti lekérdezés-loop a történelmi H2H aggregációhoz
- mérd a végrehajtási időt, lekérdezés-számot és memóriát reprezentatív adatokon
- vizsgáld a lekérdezési terveket és adj hozzá indexeket csak demonstrált hozzáférési mintákhoz
- ne állíts teljesítményjavulást mérések nélkül

Használd a repository meglévő teszt-eszközeit. Ahol alkalmazható, adj hozzá adatbázis- és Edge Function-teszteket. Állítsd kifejezetten, mely tesztek futottak és melyek nem.

---

## 9. Stop conditions

Állj meg és jelentsd a találgatás helyett, ha:
- az élő séma vagy repository ellentmond a megadott architektúra-jegyzeteknek
- egy meglévő objektumnak kétértelmű szemantikája vagy fogyasztói vannak
- az admin autorizáció nem azonosítható
- a predikció-/eredmény-származás nem őrizhető meg
- egy javasolt megszorítás ütközik meglévő valid adatokkal
- a worker helye, tartóssága vagy végrehajtás-triggerje ismeretlen
- az egyetlen látható implementáció nagy történelmi Edge Function loop-ot igényelne
- production migráció vagy deploy szükséges lenne a változtatás ellenőrzéséhez

Ne hozz létre párhuzamos rendszert egy megoldatlan meglévő lifecycle megkerülésére.

---

## 10. Final deliverable

Befejezéskor add meg:
1. Audit-megállapítások és bizonyítékforrások.
2. A választott integrációs terv és hogy miért lettek újrahasználva vagy kibővítve a meglévő objektumok.
3. A megváltoztatott vagy javasolt migráció-/kód-/tesztfájlok listája.
4. A pontos invariánsok az irányított H2H és a megváltoztathatatlan predikciós történet számára.
5. RLS és grant változtatások, beleértve az elvárt hozzáférést szerepkörönként.
6. Tesztek és backtest eredmények mintamérettel.
7. Teljesítményeredmények és fennmaradó kockázatok.
8. Explicit megerősítés, hogy a migrációk csak előkészítve, helyileg alkalmazva, távolról alkalmazva vagy deployolva lettek-e.

Ne állíts deployot, production-biztonságot, modell-pontosságot vagy befejezett funkcionalitást, hacsam közvetlenül nem ellenőrizve.
