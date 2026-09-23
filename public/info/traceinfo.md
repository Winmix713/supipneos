**# CORE DECISION TRACE**

**Stratégia: Top 3 BTTS Igen — Profil-biztos (btts\_profile\_safe) · piac: BTTS · veto: shadow (nem vesz le sort)**

**Core: 2 / 3 kártya feltöltve**



**## 1–2. Tölcsér**

**Elemzett mérkőzés: 16 — A fordulóból kitöltött és lefuttatott fixture-ök. Tájékoztató sor: nem jelölt-populáció.**

**Összes piaci sor: 142 — Minden mérkőzés minden market pattern-je, minden piacon. Tájékoztató sor.**

**Nyers stratégiajelölt-rekordok (BTTS): 6 — A stratégia piacának MINDEN nyers rekordja, duplikátumokkal együtt. Ez az audit populáció, nem a Core nevező.**

**Minőségi kapun belül (kvadráns + minta + stabilitás): 3 (−3) — Kalibrációtól független minőségi feltételek, rekordonként.**

**Cáfolt saját sáv nélkül: 3 — Csak megmért, SAJÁT és cáfolt sáv zár ki; bővített környezet soha.**

**Feltételes modell–H2H konfliktus nélkül: 3 — Csak feltételes evidencia mellett kizáró.**

**Core-szinttel rendelkező rekordok: 3 — Elsődleges vagy másodlagos szint; szint nélküli sor nem lehet Core.**

**Kiütés-profil után (ÁRNYÉK mód): 3 — Árnyék módban a szűrő nem vesz le rekordot.**

**Kanonikus, kapun belüli Core-jelöltek: 2 (−1) — Egy (mérkőzés, piac) = egy jelölt. 1 kapun belüli duplikált rekord lett összevonva.**

**Core-kártyára került: 2 — Rangsor, egy mérkőzés egy sor, legfeljebb 3 kártya.**



**## 3. Kapuk**

**1. Piac-szűrés (stratégia kódjai) \[scope] — utils/slip.ts › strategySlots → spec.codes.includes(p.code) — küszöb: a stratégia pontos market kódjai (pl. BTTS)**

**2. Kvadráns (core szint) \[hard] — utils/decision.ts + utils/slip.ts › decisionQuadrantOf(hitRate, marketConfidence, …) → effectiveDecisionOf — küszöb: P = súly. H2H ≥ 0.58 ÉS C = piaci konfidencia ≥ 56 (gól/HT-FT piac, BTTS is); minden más családnál P ≥ 0.5 ÉS C = stability ≥ 56**

**3. Hideg minta (Kish ESS) \[hard] — utils/slip.ts › coreQualityFailures → pattern.sufficiency === 'cold' — küszöb: ESS ≥ 4 (a 'cold' fokozat felett)**

**4. Stabilitás \[hard] — utils/slip.ts › coreQualityFailures → pattern.stability < CORE\_STABILITY\_MIN — küszöb: stabilitás ≥ 55**

**5. Csapatgól-piac core tilalom \[hard] — utils/slip.ts › coreQualityFailures → isTeamGoalCoreBlocked — küszöb: csapatgól kód ÉS marketCalibrationStatus !== 'calibrated'**

**6. Cáfolt saját valószínűségi sáv \[hard] — utils/coreEvidence.ts + utils/slip.ts › resolveCoreEvidence → level === 'excluded' → gateFailuresForKind (Policy A — ALWAYS active) — küszöb: a SAJÁT sávban n ≥ 20, és a jelzett érték Wilson-intervallumon kívül van**

**7. Modell–H2H konfliktus (csak feltételes sornál) \[conditional\_hard] — utils/slip.ts › gateFailuresForKind → level === 'conditional' \&\& hasMaterialModelConflict (piac-szintű) — küszöb: |hitRate − modelProb| ≥ 0,25 ÉS ESS < 6 — a piac saját értékein**

**8. Kiütés-profil szűrő (BTTS) \[conditional\_hard] — utils/bttsProfile.ts + utils/slip.ts › assessBttsBlowoutRisk → strategySlots → flagged(p) — küszöb: bttsRisk.wouldVeto — csak ÉLES veto módban és profileVeto stratégiánál**

**9. Szint- és evidencia-elsőbbség \[rank] — utils/slip.ts › byTierThenEvidenceThenStrategy → coreTierRank → evidenceRank — küszöb: elsődleges < másodlagos; kalibrált < feltételes < kizárt**

**10. Lexikografikus rangsor \[rank] — utils/slip.ts › byStrategyRank — küszöb: H2H% → modell% → Kish ESS → modell-egyezés → kiütés-risk**

**11. Egy mérkőzés — egy sor \[scope] — utils/slip.ts › pickDistinctFixtures — küszöb: fixtureId egyszer szerepelhet a core oldalon**

**12. Core 01 / 02 / 03 slot-kitöltés \[scope] — utils/slip.ts › strategySlots → CORE\_ROLES.slice(0, spec.slots) — küszöb: legfeljebb 3 sor; relaxed tartalék tiltott**

**13. Kohéziós érték (átlaggól) \[display] — utils/patterns.ts → goalProfile.weightedAvgGoals › CoreCandidateTable — csak megjelenítés — küszöb: nincs küszöb**



**## 0. Populáció-elszámolás (nyers → kanonikus)**

**Nyers stratégiajelölt-rekordok: 6 — 0 kalibrált · 6 feltételes · 0 kizárt**

**Minőségi kapun belül: 3 · cáfolt sáv nélkül: 3 · konfliktus nélkül: 3 · éles veto után: 3**

**Kanonikus, kapun belüli Core-jelöltek: 2 — 0 kalibrált · 2 feltételes**

**Összevont kapun belüli duplikátumok: 1 · nyers duplikátum-csoportok: 1**

**Core-kártyára került: 2 / 3 — 0 kalibrált · 2 feltételes**

**Tölcsér-integritás: rendben**



**## 4. Nyers rekordok (audit populáció)**

**Osasuna – Valencia | id spanyol-7::streak::BTTS | generátor streak | kód BTTS | modell 55.2% | H2H 77.4% | stab 84 | ESS 5.00 | actionable | agree | sáv 20–100% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu átjutott | kanonikus winner |  | rangadó nem jelölt |  | CORE 1 | Core 1**

**Madrid Piros – Villarreal | id spanyol-4::goal\_market::BTTS | generátor goal\_market | kód BTTS | modell 46.6% | H2H 62.5% | stab 62 | ESS 10.30 | volatile | neutral | sáv 0–75% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu átjutott | kanonikus winner |  | rangadó nem jelölt |  | CORE 2 | Core 2**

**Osasuna – Valencia | id spanyol-7::goal\_market::BTTS | generátor goal\_market | kód BTTS | modell 55.2% | H2H 73.4% | stab 79 | ESS 10.30 | volatile | agree | sáv 20–100% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu átjutott | kanonikus merged → spanyol-7::streak::BTTS | Erősebb core-szint (primary > secondary). | rangadó nem jelölt |  | flagged\_shadow | Duplikátum összevonva (kanonikus vesztes)**

**Girona – Madrid Fehér | id spanyol-3::goal\_market::BTTS | generátor goal\_market | kód BTTS | modell 71.0% | H2H 57.7% | stab 62 | ESS 10.30 | ignore | agree | sáv 40–100% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu elbukott | kanonikus — |  | rangadó nem jelölt |  | gate\_failed | kvadráns**

**Wolverhampton – Tottenham | id angol-7::goal\_market::BTTS | generátor goal\_market | kód BTTS | modell 61.3% | H2H 53.8% | stab 58 | ESS 11.13 | ignore | agree | sáv 20–100% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu elbukott | kanonikus — |  | rangadó nem jelölt |  | gate\_failed | kvadráns**

**Aston Oroszlán – Brighton | id angol-1::goal\_market::BTTS | generátor goal\_market | kód BTTS | modell 30.4% | H2H 57.8% | stab 51 | ESS 11.13 | ignore | conflict | sáv 0–65% | n 0/20 | hits 0 | jelzett — | mért — | Wilson —–— | verdikt conditional | kapu elbukott | kanonikus — |  | rangadó nem jelölt |  | gate\_failed | kvadráns**



**## 4c. Nyers rekord-duplikátumok — nem számolnak a kanonikus Core-nevezőbe**

**Osasuna – Valencia — nyertes: spanyol-7::streak::BTTS**

&#x20; **spanyol-7::streak::BTTS | streak | H2H 77.4% | stab 84 | ESS 5.00 | actionable | conditional | kapu átjutott | kanonikus winner**

&#x20; **spanyol-7::goal\_market::BTTS | goal\_market | H2H 73.4% | stab 79 | ESS 10.30 | volatile | conditional | kapu átjutott | kanonikus merged → spanyol-7::streak::BTTS | Erősebb core-szint (primary > secondary).**



**## 4b. Kvadráns-kapu**

**Számolja: utils/decision.ts › decisionQuadrantOf(pTop, confidence, thresholds)**

**Hozzárendeli: utils/patterns.ts › buildPatterns — decision = decisionQuadrantOf(hitRate, stability); marketDecision = decisionQuadrantOf(hitRate, marketConfidence, SECONDARY\_MARKET\_THRESHOLDS)**

**Kapuként alkalmazza: utils/slip.ts › coreQualityFailures → csak effectiveDecisionOf(pattern) === ’flat’ vagy ’ignore’ ad GateCondition ’decision’ kizárást (actionable = elsődleges Core, volatile = másodlagos Core, mindkettő átjut)**

**Feltétel: actionable ⟺ (P ≥ pMin) ÉS (C ≥ cMin). Ha nem: P < ignorePMax → 'ignore'; különben P ≥ pMin → 'volatile'; C ≥ cMin → 'flat'; egyébként 'ignore'.**

**Küszöbök: Gól- / HT-FT piac (BTTS is ide tartozik): pMin = 0.58, cMin = 56, ignorePMax = 0.5. Minden más család (1X2 alapú): pMin = 0.5, cMin = 56, nincs ignore-padló.**

**Osasuna – Valencia \[streak/BTTS]: P 77.4% vs pMin 50% → OK · C 84 vs cMin 56 → OK · kvadráns actionable · Mindkét tengely teljesül — ez a sor a kvadráns-kapun belül van.**

**Madrid Piros – Villarreal \[goal\_market/BTTS]: P 62.5% vs pMin 58% → OK · C 41 vs cMin 56 → BUKÓ · kvadráns volatile · actionable EBBŐL A HELYZETBŐL NEM ÉRHETŐ EL egyetlen tengely elmozdításával sem: C ≥ 56 egyetlen tengely elmozdításával sem érhető el: az élesség (0.25), az elegendőség (0.69) és az egyezés (0.47) együtt túl alacsony.**

**Osasuna – Valencia \[goal\_market/BTTS]: P 73.4% vs pMin 58% → OK · C 53 vs cMin 56 → BUKÓ · kvadráns volatile · actionable = true ettől: |H2H − modell| ≤ 14.2 százalékpont (jelenleg 18.2 pp) · Kish ESS ≥ 11.48 (jelenleg 10.30).**

**Girona – Madrid Fehér \[goal\_market/BTTS]: P 57.7% vs pMin 58% → BUKÓ · C 34 vs cMin 56 → BUKÓ · kvadráns ignore · actionable EBBŐL A HELYZETBŐL NEM ÉRHETŐ EL egyetlen tengely elmozdításával sem: P ≥ 58% (jelenleg 57.7%) · C ≥ 56 egyetlen tengely elmozdításával sem érhető el: az élesség (0.15), az elegendőség (0.69) és az egyezés (0.56) együtt túl alacsony.**

**Wolverhampton – Tottenham \[goal\_market/BTTS]: P 53.8% vs pMin 58% → BUKÓ · C 27 vs cMin 56 → BUKÓ · kvadráns ignore · actionable EBBŐL A HELYZETBŐL NEM ÉRHETŐ EL egyetlen tengely elmozdításával sem: P ≥ 58% (jelenleg 53.8%) · C ≥ 56 egyetlen tengely elmozdításával sem érhető el: az élesség (0.08), az elegendőség (0.74) és az egyezés (0.75) együtt túl alacsony.**

**Aston Oroszlán – Brighton \[goal\_market/BTTS]: P 57.8% vs pMin 58% → BUKÓ · C 27 vs cMin 56 → BUKÓ · kvadráns ignore · actionable EBBŐL A HELYZETBŐL NEM ÉRHETŐ EL egyetlen tengely elmozdításával sem: P ≥ 58% (jelenleg 57.8%) · C ≥ 56 egyetlen tengely elmozdításával sem érhető el: az élesség (0.16), az elegendőség (0.74) és az egyezés (0.09) együtt túl alacsony.**



**## 5. Cáfolt sávok bizonyítása**

**Nincs cáfolt sávú jelölt ebben a futásban.**



**## 7. Feltételes sorok elszámolása**

**A stratégia piacában: 6 feltételes sor (kapun belül 2, kapun kívül 4). Más piacokban / szerepkörökben: 136.**

&#x20; **BTTS (stratégia piaca): 6 feltételes, ebből kapun belül 3**

&#x20; **HTFT:NOREV: 16 feltételes, ebből kapun belül 16**

&#x20; **HOME\_O0.5: 15 feltételes, ebből kapun belül 0**

&#x20; **AWAY\_O0.5: 14 feltételes, ebből kapun belül 0**

&#x20; **U2.5: 13 feltételes, ebből kapun belül 6**

&#x20; **12: 12 feltételes, ebből kapun belül 12**

&#x20; **NOBTTS: 11 feltételes, ebből kapun belül 6**

&#x20; **U3.5: 10 feltételes, ebből kapun belül 10**

&#x20; **O1.5: 6 feltételes, ebből kapun belül 6**

&#x20; **1X: 4 feltételes, ebből kapun belül 4**

&#x20; **O2.5: 4 feltételes, ebből kapun belül 4**

&#x20; **HT:1: 3 feltételes, ebből kapun belül 2**

&#x20; **CS:0-1: 3 feltételes, ebből kapun belül 0**

&#x20; **HT:X: 3 feltételes, ebből kapun belül 3**

&#x20; **CS:1-0: 2 feltételes, ebből kapun belül 0**

&#x20; **CS:2-1: 2 feltételes, ebből kapun belül 0**

&#x20; **1: 2 feltételes, ebből kapun belül 2**

&#x20; **AWAY\_U0.5: 2 feltételes, ebből kapun belül 0**

&#x20; **CS:2-0: 2 feltételes, ebből kapun belül 0**

&#x20; **X2: 2 feltételes, ebből kapun belül 2**

&#x20; **CS:0-0: 2 feltételes, ebből kapun belül 0**

&#x20; **HT:2: 2 feltételes, ebből kapun belül 2**

&#x20; **CS:1-1: 1 feltételes, ebből kapun belül 0**

&#x20; **HOME\_U0.5: 1 feltételes, ebből kapun belül 0**

&#x20; **CS:1-2: 1 feltételes, ebből kapun belül 0**

&#x20; **CS:0-2: 1 feltételes, ebből kapun belül 0**

&#x20; **CS:1-5: 1 feltételes, ebből kapun belül 0**

&#x20; **CS:5-1: 1 feltételes, ebből kapun belül 0**



**## 9. Attribúció**

**Kvadráns: 3 — effectiveDecisionOf === 'flat' | 'ignore' (a volatilis másodlagos szintként belefér) — elsődleges kizárási okként számolva**

**Hideg minta (ESS): 0 — ESS < 4 — elsődleges kizárási okként számolva**

**Stabilitás: 0 — stabilitás < 55 — elsődleges kizárási okként számolva**

**Piac visszamérés (csapatgól): 0 — csapatgól-család core tilalom — elsődleges kizárási okként számolva**

**Cáfolt sáv (Policy A): 0 — megmért saját sáv, a jelzett valószínűség az intervallumon kívül — Policy A hard veto. 0 sor elsődleges okként kizárva (a minőségi kapun már kiesett sorokkal együtt összesen 0 sor sávja cáfolt)**

**Modell–H2H konfliktus: 0 — csak feltételes sornál, piac-szintű extrém eltérés + vékony minta esetén zár ki**

**Kiütés-profil (ÉLES): 0 — csak éles veto módban vesz le rekordot — a kanonizálás előtt**

**Duplikátum összevonva (kanonikus vesztes): 1 — NEM kapu-elutasítás: teljes kapun átjutott nyers rekord, amely ugyanannak a (mérkőzés, piac) csoportnak a kanonikus döntését elvesztette**

**Rangsor / egy-mérkőzés szabály: 0 — kanonikus, kapun belüli jelölt, amely nem jutott a kártyák valamelyikére**

