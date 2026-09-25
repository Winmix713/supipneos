# WINMIX — PHASE 0: READ-ONLY ARCHITECTURE AUDIT

> **Verzió:** v1.1 · 2026-09-24
> **Cél:** A meglévő WINMIX alkalmazás és Supabase projekt jelenlegi architektúrájának ellenőrzött felmérése és a hiányok azonosítása.
> **Mód:** Csak olvasás. Nem implementál semmit.

---

## Absolute restrictions

Amíg a felhasználó kifejezetten nem jóváhagy egy későbbi implementációs fázist, NE:
- módosíts, hozzon létre vagy töröljön repository fájlokat
- hozzon létre vagy szerkesszen SQL migrációkat
- hajtson végre mutáló SQL-t vagy alkalmazzon migrációkat
- hozzon létre vagy módosítson táblákat, oszlopokat, indexeket, függvényeket, triggereket, policy-ket, grantokat vagy view-kat
- deployoljon, módosítson vagy töröljön Edge Function-öket
- változtasson titkokat, konfigurációt vagy production adatokat
- generáljon implementációs kódot úgy, mintha alkalmazható lenne

A csak olvasásra szolgáló vizsgálat engedélyezett. Ha a repository vagy az adatbázis-környezet nem érhető el, állítsd ezt korlátként. Ne állítsd, hogy egy élő objektum létezik vagy nem létezik bizonyíték nélkül.

Soha ne kérj, írj ki vagy tegyél közzé jelszavakat, API kulcsokat, service-role kulcsokat, JWT titkokat vagy más titkos értékeket.

---

## Source-of-truth rules

1. A tényleges repository és a tényleges vizsgált adatbázis-környezet a mérvadó, ha elérhető.
2. A meglévő migrációk és generált típusok a tervezett vagy történelmi struktúra bizonyítékai, nem a jelenlegi élő séma bizonyítékai.
3. A feladatban megadott dokumentáció hipotézis, amíg ellenőrzésre nem kerül.
4. Ha a források ellentmondanak, jelentsd az ellentmondást és azonosítsd, melyik forrás a jelenlegi/érvényes, ha ellenőrizhető.
5. Ne következtess úgy, hogy egy objektum létezik, mert ez a prompt megnevezi.
6. Ne következtess úgy, hogy egy objektum nem létezik, mert ez a prompt nem nevezi meg.
7. Ha egy tény nem ellenőrizhető, címkézd „ismeretlen\" vagy „nem ellenőrzött\"; ne találgass.
8. Különítsd el a közvetlen bizonyítékot a következtetéstől minden lényeges megállapításnál.

---

## Environment separation

Azonosítsd, mely környezetek elérhetők és ténylegesen vizsgáltak:
- production
- staging
- development/local

Ne feltételezd, hogy ezek a környezetek azonos sémát, policy-ket, grantokat, függvényeket, titkokat vagy adatokat osztanak.
Minden környezetnél:
- állítsd, hogy vizsgálva volt-e
- állítsd, mely bizonyítékforrások voltak elérhetők
- rögzítsd a lényeges séma- vagy konfigurációkülönbségeket
- címkézd a környezetet „nem ellenőrzött\"-ként, ha nem volt vizsgálható

Ne férj hozzá környezethez, hacsak a hozzáférés nem már biztosított az autorizált audit kontextuson keresztül. Ne kérd a felhasználót, hogy illesszen be hitelesítő adatokat.

---

## Repository dependency tracing

Minden meglévő adatbázis-objektumnál, amely relevánsnak tűnik, keresd a repository-ban a tényleges hívókat és fogyasztókat.
Ne következz üzleti szemantikát tábla- vagy függvénynevekből.

Minden releváns tábla, view, függvény, RPC vagy más adatbázis-objektum esetén azonosítsd, hol:
- olvassák
- írják
- frissítik
- hívják
- használják az alkalmazáslogikában

Ahol lehetséges, kövesd:

```
adatbázis-objektum
  → adatbázis-függvény/RPC
  → Edge Function vagy worker
  → API/szolgáltatás-réteg
  → frontend fogyasztó
  → predikciós kártya vagy publikált kimenet
```

Vizsgáld a repository hivatkozásokat, migrációkat, generált típusokat, teszteket és alkalmazáskódot, amennyiben elérhetők. Hivatkozz repository útvonalakra és sorszám-tartományokra, ahol lehetséges.

Ha egy objektum létezik, de az üzleti szemantikája nem állítható be a definícióból és a hívókból, címkézd a szemantikáját „nem teljesen ellenőrzött\"-ként.

---

## Audit scope

Vizsgáld meg a repository-t és, ahol elérhető, minden autorizált Supabase környezetet. Kövesd a meglévő lifecycle-t:

- csapatok, szezonok, fixture-ök és mérkőzés-eredmények
- importok, validáció, adatverziók és sealing/promotion
- meccs feature-ök és csapat-állapot pillanatképek
- paraméter-pillanatképek és modellkonfiguráció
- engine job-ok, run-ok létrehozása, claiming, retry-k, locking és promotion
- predikciók és az adat-/run-/paraméter-származásuk
- fixture kérések, predikciós kártyák, kiválasztások és publikálás
- kalibráció, eredményrögzítés és történelmi kiértékelés
- Edge Function-ök, worker-ek, ütemezők, queue-k és más tartós feldolgozás

Vizsgáld meg a releváns adatbázis-objektumok tényleges definícióit, beleértve:
- oszlopok és adattípusok
- elsődleges kulcsok, idegen kulcsok, egyedi megszorítások és CHECK megszorítások
- indexek
- triggerek és adatbázis-függvények
- view-k és azok biztonsági viselkedése
- RLS engedélyezettség és policy-k
- tábla grantok és függvény `EXECUTE` grantok

Ne vizsgálj vagy tegyél közzé alkalmazás-titkokat.

---

## Required questions

Minden tételnél válaszolj bizonyítékkal, vagy címkézd ismeretlen/nem ellenőrzött.

1. Melyek a tényleges táblák, amelyek relevánsak meccsekhez, csapatokhoz, adatverziókhoz, paraméterekhez, engine job-okhoz/run-okhoz, feature-ökhöz, predikciókhoz, kártyákhoz, eredményekhez és kalibrációhoz?
2. Melyek az ellenőrzött oszlopok és típusok ezeknél az objektumoknál?
3. Mely meglévő objektumok képviselik:
   - egy eredetileg kiadott predikciót
   - a tényleges eredményét
   - egy engine run-t
   - egy adatverziót
   - egy paraméter-pillanatképet
   - egy publikált predikciót/kártyát
   - egy kalibrációs vagy kiértékelési eredményt
4. Létezik-e már irányított H2H aggregáció? Ha igen, hol és hogyan van a hazai/vendég irány reprezentálva?
5. Van-e már a projektnek predikciós visszajelzése, matchup-szintű megbízhatósága, büntetése vagy megváltoztathatatlan eredmény-/kiértékeléstörténete?
6. Mely javasolt képességek teljesíthetők meglévő objektumok újrafelhasználásával vagy kibővítésével?
7. Mely képességek tűnnek új objektumot igénylőnek, és milyen bizonyíték támasztja alá ezt a következtetést?
8. Milyen RLS policy-k és tábla-/függvény-grantok kormányozzák jelenleg az egyes releváns objektumokat?
9. Mely szerepkörök hajthatnak végre jelenleg SELECT, INSERT, UPDATE, DELETE vagy EXECUTE műveleteket, ahol ellenőrizhető?
10. Hogyan történik a job-ok claimingje, retry-ja, lockolása, folytatása és promotion-je?
11. Hol fut jelenleg a tartós vagy történelmi számítás?
12. Mi az ellenőrzött igazságforrás a mérkőzés-eredményekhez, predikciós valószínűségekhez, modellverziókhoz, adatverziókhoz és paraméter-pillanatképekhez?
13. Kövess egy predikciót a jelenlegi lifecycle-en keresztül, a forrásadattól a publikált kártyáig és, ha támogatott, az eredménykiértékelésig.
14. Azonosítsd a lehetséges leakage-útvonalakat, ahol egy mérkőzés-eredmény vagy jövőbeli adat bekerülhet egy pre-match feature-be vagy történelmi predikcióba.
15. Mely indexek támogatják jelenleg az irányított H2H lekérdezéseket és a releváns verzió-/run-szűrőket?
16. Mely részei a javasolt tervnek már fedettek, redundánsak, ellentmondásosak vagy ellenőrizhetetlenek?
17. Mely megállapítások különböznek a production, staging és development környezetek között?

---

## Required deliverable

Csak audit-jelentést adj vissza. Ne tartalmazzon implementációs kódot vagy végrehajtható migrációkat.

A jelentést a következőképpen szervezd:

### A. Access and verification limits
Állítsd:
- a repository hozzáférés elérhető volt-e
- mely adatbázis-környezetek voltak elérhetők és vizsgálva
- mely források voltak vizsgálva
- mely releváns területek nem voltak ellenőrizhetők

### B. Verified architecture
Foglald össze a jelenlegi adatmodellt és lifecycle-t. Különítsd el:
- élő adatbázis-bizonyíték
- repository bizonyíték
- migráció-/típusgenerálási bizonyíték
- megadott dokumentáció, amely nem függetlenül ellenőrzött

### C. Repository dependency trace
Minden releváns objektumnál foglald össze az ellenőrzött definíciókat és hívókat/fogyasztókat.
Ahol lehetséges, mutasd a láncot:
```
adatbázis-objektum
  → adatbázis-függvény/RPC
  → Edge Function vagy worker
  → API/szolgáltatás
  → frontend fogyasztó
  → predikciós kártya/kiadás
```
Azonosítsd a törött vagy nem ellenőrzött linkeket a láncban.

### D. Prediction lifecycle trace
Írd le az ellenőrzött útvonalat a forrás meccs-adattól a predikciós kártyáig és eredmény/kiértékelésig, vagy állítsd pontosan, hol nem fejezhető be a nyomkövetés.

### E. Security findings
Minden releváns objektumnál foglald össze külön az RLS engedélyezettséget, policy-ket és grantokat. Ne következtess effektív API hozzáférést a policy-kből egyedül.
Azonosítsd környezet-specifikus különbségeket, ahol ellenőrizhető.

### F. Compatibility findings
Minden alábbi képességnél állítsd:
- meglévő objektum(ok) és bizonyíték
- hogy újrafelhasználhatónak tűnik-e
- hogy a kibővítés szükségesnek tűnik-e
- hogy új objektum szükségesnek tűnik-e
- megoldatlan kérdések

Képességek:
- irányított H2H
- predikciós visszajelzés és megváltoztathatatlan történet
- matchup-szintű megbízhatóság vagy büntetések
- kalibráció és backtesting
- worker/job orchestration
- fixture kártya publikálás

### G. Gaps, risks, and priorities
Minden megállapításnál rendelj egy státuszt:
- ellenőrzött hiba
- ellenőrzött hiányzó képesség
- megoldatlan/ismeretlen
- dokumentáció-eltérés
- potenciális kockázat, amely tesztet igényel

Rendelj egy prioritást is:
- Blocker
- High
- Medium
- Low

Magyarázd el a bizonyítékot és a következményt minden Blocker vagy High tételnél. Ne címkézz valamit hibaként pusztán azért, mert hiányzik a megadott dokumentációból.

### H. Readiness statements
Ne adj meg nem támogatott általános készültségi százalékot.
Ha százalékot kérnek, adj meg egyet csak:
- definiált nevezővel vagy rubrikával
- közvetlen bizonyítékkal a teljesített kritériumokra
- explicit nem ellenőrzött kritériumokkal
- rövid magyarázattal a bizonytalanságról

Preferálj bizonyítékalapú állításokat, mint például:
„A predikciós származás részben ellenőrzött: a run-, adatverzió- és paraméter-hivatkozások jelen vannak a vizsgált sémában; a megváltoztathatatlanság és az idempotens eredménykiértékelés nem volt ellenőrizve.\"

### I. Recommended next phase
Javasld a legkisebb biztonságos következő fázist az ellenőrzött megállapítások alapján. Ne kezdd el.

### J. Evidence index
Minden lényeges állításhoz rendelj egy bizonyíték-azonosítót, például `[E01]`.
Minden bizonyítéktételnél hivatkozz a vizsgált forrásra, alkalmazható esetben:
- repository útvonal és sorszám-tartomány
- migráció fájlnév és releváns sorok
- minősített adatbázis-objektum név
- megszorítás, index, policy, trigger vagy függvény név
- csak olvasásra szolgáló metaadat/katalógus-vizsgálat
- vizsgált környezet

Különítsd el egyértelműen:
- közvetlen bizonyíték
- bizonyítékon alapuló következtetés
- nem ellenőrzött állítások

Ne tartalmazzon titkokat, érzékeny sor tartalmakat vagy hitelesítő adatokat a bizonyíték-jegyzékben.

---

## Completion rule

Az audit-jelentés leadása után állj meg és várj kifejezett felhasználói jóváhagyásra, mielőtt bármilyen kód-, séma-, policy-, konfigurációs- vagy deploy-változtatást végeznel.
