**L4 értékelési \& kalibrációs réteg**

**100 meccses gördülő ablakok: Brier Score, LogLoss, Expected Calibration Error (ECE) és Skill vs B1 baseline. Ez a lap kizárólag mérési felület — az újraszámítás, a teljes újraépítés és a beállítások a Pipeline Üzemeltetés képernyőn érhetők el.**





**Adatok másolása**

**Nincs kiértékelt mérkőzés ebben a ligában.**

**Nincs elég adat**

**Angol**

**Töltsd fel a szezon CSV-ket, majd futtasd a pipeline-t a Pipeline Üzemeltetés képernyőn.**

**LogLoss (ensemble vs B1)**

**— / —**

**Skill vs B1: —**

**Skill 95% CI: nincs adat**

**Brier Score**

**—**

**Alacsonyabb = jobb**

**ECE (kalibrációs hiba)**

**—**

**Küszöb: < 0.05**

**Aktív kalibrációs hőmérséklet**

**T = 0.95**

**In-sample T: nincs elég adat (min. 50 meccs)**

**Kalibráció**

**Elméleti korlát és sávonkénti megbízhatóság**

**Entrópia-plafon és mozgástér (Oracle baseline)**

**Elméleti plafon (H)**

**0.893**

**Oracle LogLoss**

**1.041**

**B1 Poisson (as-of)**

**1.060**

**Teljes mozgástér**

**0.167**

**A rés 0.167 logloss: ennyi az összes elérhető javulás, amit bármilyen modell megszerezhet. Minden „javulást” ehhez kell mérni.**



**Empirikus kalibrációs sáv-tábla (1X2)**

**Konfidencia-sávonként: mennyit jelzett a modell az 1X2 csúcstippre, és mennyi lett belőle valóban. A Gap a hibahatárral (Wilson 95%) együtt értelmezendő. Minimális értékelhető minta: 20 eset.**



**Nincs kiértékelt mérkőzés — futtasd le a pipeline-t az aktív ligára.**

**Piacspecifikus kalibráció (out-of-sample)**

**Valószínűségi sávonként: a modell szerinti esély és a TÉNYLEGES beválás ugyanarra a piacra. A mérés egysége a mérkőzés előtti modellvalószínűség és a tény — nem a stabilitás és nem a H2H konfidencia. Minimális értékelhető minta sávonként: 20 eset.**



**Mindkét csapat szerez gólt**

**(0)**

**2,5 gól felett**

**(0)**

**Hazai csapat gólt szerez**

**(0)**

**Hazai csapat nem szerez gólt**

**(0)**

**Vendég csapat gólt szerez**

**(0)**

**Vendég csapat nem szerez gólt**

**(0)**

**Nem értékelhető — Nem értékelhető: egyetlen valószínűségi sáv sem érte el a 20 esetes minimumot.**



**Megfigyelés**

**0**

**Átlagos jelzett P**

**—**

**Tényleges arány**

**—**

**Brier**

**—**

**ECE**

**—**

**Nincs megfigyelés ehhez a piachoz ebben a ligában.**

**A Core-jogosultság mindig a MINTA SAJÁT modellvalószínűségéhez tartozó sávon dől el, nem a piac átlagán: egy 0,68-as HOME\_O0.5 becslést kizárólag a 65–75%-os sáv minősíthet. A csapatgól-család addig Joker-only, amíg az adott liga és az adott piac saját sávja nem lesz egyszerre értékelhető és kalibrált.**



**Joint-mátrix invariáns tesztek**

**10/10 eset rendben (tolerancia 1e-9)**

**homeOver05 + homeUnder05 = 1 · awayOver05 + awayUnder05 = 1 · bttsYes ≤ mindkét 0.5+ · under 0.5 ≥ P(0-0) · Σ mátrix = 1 · highGoalNoBtts ≤ cleanSheetBlowout ≤ bttsNo · a két kiütés-mező különbsége pontosan P(3-0) + P(0-3) — minden λ/ρ kombinációra teljesül.**



**Alacsony gólvárakozás, ρ = 0	0.4	0.3	0	12	OK**

**Tipikus liga, ρ = 0	1.55	1.15	0	12	OK**

**Tipikus liga, ρ = +0.12	1.55	1.15	0.12	12	OK**

**Tipikus liga, ρ = −0.12	1.55	1.15	-0.12	12	OK**

**Magas gólvárakozás, ρ = +0.05	3.4	2.8	0.05	12	OK**

**Magas gólvárakozás, ρ = −0.05	3.4	2.8	-0.05	12	OK**

**Erősen aszimmetrikus, ρ = −0.08	2.9	0.45	-0.08	12	OK**

**Nullához tartó vendég λ, ρ = 0	1.2	0.000001	0	12	OK**

**Nullához tartó mindkét λ, ρ = 0	0.000001	0.000001	0	12	OK**

**Nullához tartó λ, ρ = +0.1	0.05	0.05	0.1	12	OK**

**Core evidencia-életciklus tesztek**

**14/14 eset rendben · minta-minimum 20 · core-evidence/1.1**

**Kevés adat + jó egyéb jel → Feltételes · elég adat + jó kalibráció → Kalibrált · elég adat + rossz kalibráció → Kizárt. A bővített szomszédos környezet megerősíthet, de nem zárhat ki, és cáfolat kizárólag a sor saját sávjából származhat.**



**Nincs egyetlen mérés sem	Üres kalibrációs napló → feltételes, adathiány indokkal. Sosem kizárás.	Feltételes	Feltételes	missing\_evidence	0 / 20	—	OK**

**Vékony saját sáv, nincs használható környezet	A saját sáv 20 alatt van → feltételes, nem cáfolat.	Feltételes	Feltételes	missing\_evidence	6 / 20	20–100%	OK**

**n = 0 / 20 auditált megfigyelés	Üres saját sáv → feltételes, adathiány. TILOS a kizárás és a „Cáfolt sáv”.	Feltételes	Feltételes	missing\_evidence	0 / 20	20–100%	OK**

**n = 19 / 20 auditált megfigyelés	Egy megfigyeléssel a minimum alatt → még mindig feltételes, sosem kizárás.	Feltételes	Feltételes	missing\_evidence	19 / 20	20–100%	OK**

**n = 20, saját sáv cáfolt	A minimumot pont elérő, NEM kalibrált saját sáv → kemény kizárás.	Kizárt	Kizárt	disproved	20 / 20	55–65%	OK**

**n = 20, saját sáv kalibrált	A minimumot pont elérő, kalibrált saját sáv → kalibrált.	Kalibrált	Kalibrált	verified	20 / 20	55–65%	OK**

**Megmért és igazolt saját sáv	A jelzett valószínűség a Wilson-intervallumon belül → kalibrált.	Kalibrált	Kalibrált	verified	120 / 20	55–65%	OK**

**Megmért és cáfolt saját sáv	A jelzett valószínűség az intervallumon kívül → KEMÉNY kizárás.	Kizárt	Kizárt	disproved	671 / 20	55–65%	OK**

**Vékony saját sáv, egyező bővített környezet	A bővített környezet MEGERŐSÍTHET: kalibrált, láthatóan bővített sávval.	Kalibrált	Kalibrált	verified	126 / 20	40–75% (bővített)	OK**

**Vékony saját sáv, eltérő bővített környezet	A bővített környezet SOSEM zárhat ki — feltételes marad, eltérő környezet indokkal.	Feltételes	Feltételes	divergent\_environment	166 / 20	40–75% (bővített)	OK**

**Nem regisztrált piac, nincs értékelhető globális sáv	A régi 1X2 konfidencia-sáv úton is: mérés nélkül feltételes.	Feltételes	Feltételes	missing\_evidence	0 / 20	—	OK**

**Elche – Real Madrid (cáfolt sáv, magas modell)	A modell \~60% BTTS, de a saját sáv cáfolt (671 mérés, 228 találat) → Policy A: hard kizárás, modelProb nem felülbírálja.	Kizárt	Kizárt	disproved	671 / 20	55–65%	OK**

**Wolverhampton – Newcastle (vékony sáv, feltételes)	A modell \~60% BTTS, de a saját sáv vékony (6 mérés) → feltételes, nem kizárás. Az adathiány nem cáfolat.	Feltételes	Feltételes	missing\_evidence	6 / 20	20–100%	OK**

**Real Madrid – Getafe (kalibrált sáv, magas modell)	A modell \~60% BTTS, a saját sáv kalibrált (120 mérés, 72 találat) → kalibrált, jogosult core kártyára.	Kalibrált	Kalibrált	verified	120 / 20	55–65%	OK**

**0 / 20 … 19 / 20 sosem kizárás**

**Az `exclusionAllowed` csak megmért, NEM kalibrált sávra igaz**

**Minden visszaadott snapshot koherens**

**A kézzel hamisított kizárás visszaminősül feltételesre**

**A feltételes szint core kártyára kerülhet (adathiány nem kizárás)**

**A kalibrált sor core kártyára kerülhet**

**A cáfolt saját sáv evidencia-szintje `excluded` (a kapu a Phase 6 zászló mögött van)**

**A feltételes sor `band` kapuja NEM bukik el (adathiány nem cáfolat)**

**A fixture-szintű konfliktus-jelzés önmagában NEM zár ki (keresztpiaci veto megszűnt)**

**Piac-szintű extrém eltérés (≥ 25%) + vékony minta (ESS < 6) kizárva (`model\_conflict`)**

**A bővített környezet nem termel kizárást**

**A kizárás mindig hordozza a Wilson-korlátokat**

**Core szintezés (elsődleges / másodlagos) tesztek**

**16/16 eset rendben · core-selection/2.6**

**Cselekvőképes → elsődleges core · volatilis → másodlagos core · lapos és elvetendő továbbra is kizárva. A hideg minta, a stabilitási padló, a cáfolt sáv és a modell-konfliktus kemény kizárás maradt, a másodlagos sor sosem szorít ki elérhető elsődlegest, és nincs kényszerkitöltés.**



**Cselekvőképes jelölt	P ≥ 58% ÉS C ≥ 56 → elsődleges core, jogosult	OK**

**Volatilis jelölt (C a küszöb alatt)	Erős H2H irány, C < 56 → MÁSODLAGOS core, továbbra is jogosult	OK**

**Lapos jelölt	Nincs kimutatható él → nincs core szint, kizárva	OK**

**Elvetendő jelölt	Sem él, sem információ → nincs core szint, kizárva	OK**

**Volatilis + hideg minta	A hideg minta kemény kizárás marad a másodlagos szinten is	OK**

**Volatilis + stabilitás a padló alatt	A stabilitási padló (55) kemény kizárás marad	OK**

**Volatilis + cáfolt sáv (Phase 6 inaktív)	A megmért cáfolat látszik és rangsor-büntet, de Release D-ig nem zár ki terminálisan	OK**

**Volatilis + feltételes sáv + fixture-szintű konfliktus-jelzés	A fixture-szintű jelzés önmagában nem zár ki — a kapu piac-szintű (keresztpiaci veto megszűnt)	OK**

**Volatilis + feltételes sáv + piac-szintű extrém konfliktus	|hitRate − modelProb| ≥ 0,25 ÉS ESS < 6 → kizárva marad	OK**

**Cselekvőképes + feltételes sáv	A feltételes evidencia nem kizárás — elsődleges szinten is jogosult	OK**

**Elsődleges feltételes vs. másodlagos kalibrált	A szint az első kulcs: a másodlagos sor sosem szorít ki elérhető elsődlegest	OK**

**Szinten belül az evidencia dönt	Azonos szinten a kalibrált sor előbb kerül kártyára, mint a feltételes	OK**

**Egy elsődleges + két másodlagos	Három kártya telik meg, az elsődleges az első, lapos sor nem kerül be	OK**

**Kevés érvényes jelölt	Nincs kényszerkitöltés: a hármas szám kedvéért nem kerül fel érvénytelen sor	OK**

**Egy mérkőzés — egy sor	A mérkőzés-egyediség a szintezés után is sérthetetlen	OK**

**Determinisztikus sorrend	Minden mért kritériumon holtversenyes sorok mindig ugyanúgy rendeződnek	OK**

**Core kanonikus populációk (kapu-először) tesztek**

**1 HIBÁS eset — a kanonikus kiválasztás szerződése sérült**

**A kanonikus populációk nem a szerződés szerint állnak elő — a core kártyák számlálói és kiválasztása addig NEM megbízható.**



**A — nincs duplikátum	Három külön mérkőzés, egy piac: a kanonikus halmaz megegyezik a nyerssel.	OK**

**B — egy mérkőzés, két rekord	Ugyanaz a mérkőzés és piac: pontosan EGY kanonikus nyertes, a magasabb szintű.	OK**

**C — kapun kívüli rekord nem nyomhat el kapun belülit	A kapuk ELŐBB futnak, mint az összevonás: a kapun belüli sor megmarad.	OK**

**D — minden rekord kapun kívül	Nulla kanonikus jogosult, és nincs kényszerkitöltés a core kártyákon.	OK**

**E — mérkőzés-ütközés a kártyák között	Két piac ugyanarra a mérkőzésre két kanonikus rekord, de csak EGY core kártya.	OK**

**F — másodlagos tölt, de nem szorít ki elsődlegest	Mindkettő bekerül, az elsődleges sor előbb.	OK**

**G — feltételes evidencia a helyes számlálóban	A cáfolt sáv kizár; a kalibrált és a feltételes sor külön számlálóba kerül.	kizárt evidencia nem jogosult → 3**

**H — populáció-invariáns	Kártyára került ⊆ kanonikus jogosult ⊆ nyers rekordok, minden lépésnél monoton.	OK**

**Rangadó (büntetőpont) rangsor-tesztek**

**6/6 eset rendben · core-selection/2.6 · árnyék mód**

**A rangadó-címke önmagában nem büntet · kis mintán soha nincs korrekció · a verdikt sosem zár ki sort · a nem-BTTS piacok bitre azonosak · árnyék módban a sorrend változatlan.**



**A címke önmagában nem büntet	Megjelölt párosítás ép BTTS profillal: 0 pont levonás, és az indoklás ki is mondja	OK**

**Kis minta — nincs korrekció	ESS < 4 esetén a szélsőséges nyers arányok sem termelnek levonást	OK**

**Evidencia esetén levonás — de sosem kizárás	A saját H2H minta indokol levonást, a jelölt viszont Core-jogosult marad és minden mért értéke változatlan	OK**

**Más piacok bitre azonosak	A rangsor-levonás kizárólag BTTS soron létezik; minden más piac hitRate-je érintetlen	OK**

**Árnyék mód — a sorrend nem mozdul	MARQUEE\_RANKING\_ACTIVE = false mellett a rangsor bitre azonos a korrekció nélküli sorrenddel	OK**

**A regiszter irányított	A hazai–vendég sorrend számít: az „A otthon B ellen” megjelölés nem jelöli meg a fordítottját	OK**

**Gördülő kiértékelési ablakok**

**0 lezárt ablak**

**Nincs adat ehhez a ligához.**

**Kimenetel megoszlás (valós H / D / A)**

**Nincs kiértékelt mérkőzés ehhez a ligához.**



**Reliability diagram (kalibráció 5 sávban)**

**Nincs kiértékelt mérkőzés ehhez a ligához.**



**Visszacsatolás és futási előzmény**

**Zárt hurok és modellállapot**

**Piaci visszacsatolás (zárt hurok, csak diagnosztika)**

**Piaconként: mennyit jelzett a modell, és mennyi lett belőle valóban a Tipp Naplóban. Figyelmeztetés csak akkor, ha |eltérés| > 10 pp ÉS n ≥ 8 ÉS a jelzett átlag a Wilson-intervallumon kívül esik. A panel egyetlen modellparamétert sem módosít.**



**Még nincs lezárt szelvénysor — rögzíts eredményeket a Tipp Naplóban, és a visszacsatolás azonnal megjelenik itt.**

**Aktív modellállapot és döntési mátrix**

**M1 együtthatók**

**illesztett (n=9840)**

**Ensemble súly (M1)**

**0.85 (hangolt)**

**Kísérletek**

**kikapcsolva**

**Utolsó futás**

**nincs futás ebben a munkamenetben**

**◆**

**Cselekvőképes**

**Van kimutatható él, és van mögötte elegendő megbízható információ. Mindkét tengely teljesül egyszerre.**

**◈**

**Volatilis**

**Az él megvan, de az információ-megbízhatóság a küszöb alatt van. Másodlagos, magasabb kockázatú core sor lehet — elsődlegest nem szorít ki.**

**▬**

**Lapos**

**Az információ szilárd, de nincs kimutatható él. Nem hiba — csak nincs mire tenni.**

**·**

**Elvetendő**

**Sem él, sem elegendő információ. A sor nem kerül döntési felületre.**

**Prequenciális kalibráció előzménye (T újrafittelések)**

**545 fittelés**

**#1	36	0.95	0.060	36**

**#2	54	1.80	0.040	54**

**#3	72	1.50	0.039	72**

**#4	90	1.30	0.012	90**

**#5	108	1.35	0.012	108**

**#6	126	1.70	0.023	126**

**#7	144	1.55	0.016	144**

**#8	162	1.65	0.029	162**

**#9	180	1.60	0.027	180**

**#10	198	1.55	0.031	198**

**#11	216	1.45	0.026	216**

**#12	234	1.40	0.027	234**

**#13	252	1.45	0.024	252**

**#14	270	1.45	0.021	270**

**#15	288	1.45	0.017	288**

**#16	306	1.40	0.014	306**

**#17	324	1.40	0.014	324**

**#18	342	1.40	0.015	342**

**#19	360	1.35	0.020	360**

**#20	378	1.35	0.023	378**

**#21	396	1.30	0.019	396**

**#22	414	1.30	0.020	414**

**#23	432	1.35	0.021	432**

**#24	450	1.30	0.019	450**

**#25	468	1.30	0.019	468**

**#26	486	1.25	0.019	486**

**#27	504	1.25	0.020	504**

**#28	522	1.25	0.018	522**

**#29	540	1.25	0.017	540**

**#30	558	1.25	0.014	558**

**#31	576	1.25	0.017	576**

**#32	594	1.20	0.018	594**

**#33	612	1.20	0.016	612**

**#34	630	1.20	0.017	630**

**#35	648	1.20	0.014	648**

**#36	666	1.20	0.018	666**

**#37	684	1.15	0.025	684**

**#38	702	1.20	0.020	702**

**#39	720	1.15	0.023	720**

**#40	738	1.15	0.026	738**

**#41	756	1.15	0.024	756**

**#42	774	1.15	0.024	774**

**#43	792	1.10	0.028	792**

**#44	810	1.10	0.028	810**

**#45	828	1.10	0.028	828**

**#46	846	1.10	0.028	846**

**#47	864	1.10	0.029	864**

**#48	882	1.10	0.024	882**

**#49	900	1.10	0.023	900**

**#50	918	1.10	0.022	918**

**#51	936	1.10	0.023	936**

**#52	954	1.10	0.022	954**

**#53	972	1.10	0.023	972**

**#54	990	1.10	0.023	990**

**#55	1008	1.10	0.022	1008**

**#56	1026	1.10	0.022	1026**

**#57	1044	1.10	0.022	1044**

**#58	1062	1.10	0.022	1062**

**#59	1080	1.10	0.023	1080**

**#60	1098	1.10	0.023	1098**

**#61	1116	1.10	0.022	1116**

**#62	1134	1.10	0.023	1134**

**#63	1152	1.10	0.022	1152**

**#64	1170	1.10	0.022	1170**

**#65	1188	1.10	0.021	1188**

**#66	1206	1.10	0.021	1206**

**#67	1224	1.10	0.020	1224**

**#68	1242	1.10	0.021	1242**

**#69	1260	1.10	0.019	1260**

**#70	1278	1.10	0.019	1278**

**#71	1296	1.10	0.019	1296**

**#72	1314	1.10	0.019	1314**

**#73	1332	1.10	0.020	1332**

**#74	1350	1.10	0.018	1350**

**#75	1368	1.10	0.019	1368**

**#76	1386	1.10	0.019	1386**

**#77	1404	1.10	0.018	1404**

**#78	1422	1.10	0.020	1422**

**#79	1440	1.10	0.019	1440**

**#80	1458	1.10	0.016	1458**

**#81	1476	1.10	0.016	1476**

**#82	1494	1.10	0.019	1494**

**#83	1512	1.10	0.018	1512**

**#84	1530	1.10	0.018	1530**

**#85	1548	1.10	0.019	1548**

**#86	1566	1.10	0.019	1566**

**#87	1584	1.10	0.019	1584**

**#88	1602	1.10	0.020	1602**

**#89	1620	1.10	0.020	1620**

**#90	1638	1.10	0.020	1638**

**#91	1656	1.10	0.020	1656**

**#92	1674	1.10	0.021	1674**

**#93	1692	1.10	0.022	1692**

**#94	1710	1.10	0.022	1710**

**#95	1728	1.10	0.020	1728**

**#96	1746	1.10	0.021	1746**

**#97	1764	1.10	0.020	1764**

**#98	1782	1.10	0.020	1782**

**#99	1800	1.10	0.018	1800**

**#100	1818	1.10	0.019	1818**

**#101	1836	1.10	0.019	1836**

**#102	1854	1.10	0.019	1854**

**#103	1872	1.10	0.019	1872**

**#104	1890	1.10	0.019	1890**

**#105	1908	1.10	0.019	1908**

**#106	1926	1.10	0.019	1926**

**#107	1944	1.10	0.018	1944**

**#108	1962	1.05	0.017	1962**

**#109	1980	1.05	0.016	1980**

**#110	1998	1.05	0.016	1998**

**#111	2016	1.05	0.017	2016**

**#112	2034	1.05	0.016	2034**

**#113	2052	1.05	0.016	2052**

**#114	2070	1.05	0.017	2070**

**#115	2088	1.05	0.016	2088**

**#116	2106	1.05	0.016	2106**

**#117	2124	1.05	0.016	2124**

**#118	2142	1.05	0.015	2142**

**#119	2160	1.05	0.015	2160**

**#120	2178	1.05	0.016	2178**

**#121	2196	1.05	0.016	2196**

**#122	2214	1.05	0.016	2214**

**#123	2232	1.05	0.016	2232**

**#124	2250	1.05	0.016	2250**

**#125	2268	1.05	0.016	2268**

**#126	2286	1.05	0.016	2286**

**#127	2304	1.05	0.016	2304**

**#128	2322	1.05	0.016	2322**

**#129	2340	1.00	0.015	2340**

**#130	2358	1.00	0.015	2358**

**#131	2376	1.00	0.015	2376**

**#132	2394	1.05	0.015	2394**

**#133	2412	1.00	0.014	2412**

**#134	2430	1.00	0.015	2430**

**#135	2448	1.00	0.014	2448**

**#136	2466	1.05	0.015	2466**

**#137	2484	1.00	0.013	2484**

**#138	2502	1.00	0.013	2502**

**#139	2520	1.00	0.015	2520**

**#140	2538	1.00	0.014	2538**

**#141	2556	1.05	0.015	2556**

**#142	2574	1.00	0.014	2574**

**#143	2592	1.05	0.014	2592**

**#144	2610	1.05	0.014	2610**

**#145	2628	1.05	0.013	2628**

**#146	2646	1.00	0.012	2646**

**#147	2664	1.05	0.012	2664**

**#148	2682	1.00	0.011	2682**

**#149	2700	1.00	0.011	2700**

**#150	2718	1.00	0.011	2718**

**#151	2736	1.05	0.013	2736**

**#152	2754	1.05	0.013	2754**

**#153	2772	1.00	0.011	2772**

**#154	2790	1.00	0.011	2790**

**#155	2808	1.00	0.011	2808**

**#156	2826	1.00	0.012	2826**

**#157	2844	1.00	0.012	2844**

**#158	2862	1.00	0.012	2862**

**#159	2880	1.00	0.012	2880**

**#160	2898	1.00	0.012	2898**

**#161	2916	1.00	0.012	2916**

**#162	2934	1.00	0.012	2934**

**#163	2952	1.00	0.013	2952**

**#164	2970	1.00	0.013	2970**

**#165	2988	1.00	0.013	2988**

**#166	3006	1.00	0.013	3006**

**#167	3024	1.00	0.013	3024**

**#168	3042	1.00	0.014	3042**

**#169	3060	1.00	0.014	3060**

**#170	3078	1.00	0.014	3078**

**#171	3096	1.00	0.014	3096**

**#172	3114	1.00	0.014	3114**

**#173	3132	1.00	0.014	3132**

**#174	3150	1.00	0.014	3150**

**#175	3168	1.00	0.014	3168**

**#176	3186	1.00	0.014	3186**

**#177	3204	1.00	0.015	3204**

**#178	3222	1.00	0.014	3222**

**#179	3240	1.00	0.013	3240**

**#180	3258	1.00	0.013	3258**

**#181	3276	1.00	0.012	3276**

**#182	3294	1.00	0.012	3294**

**#183	3312	1.00	0.012	3312**

**#184	3330	1.00	0.012	3330**

**#185	3348	1.00	0.012	3348**

**#186	3366	1.00	0.011	3366**

**#187	3384	1.00	0.011	3384**

**#188	3402	1.00	0.011	3402**

**#189	3420	1.00	0.011	3420**

**#190	3438	1.00	0.011	3438**

**#191	3456	1.00	0.011	3456**

**#192	3474	1.00	0.011	3474**

**#193	3492	1.00	0.011	3492**

**#194	3510	1.00	0.011	3510**

**#195	3528	0.95	0.010	3528**

**#196	3546	0.95	0.009	3546**

**#197	3564	1.00	0.010	3564**

**#198	3582	1.00	0.010	3582**

**#199	3600	1.00	0.010	3600**

**#200	3618	1.00	0.010	3618**

**#201	3636	1.00	0.010	3636**

**#202	3654	1.00	0.010	3654**

**#203	3672	1.00	0.009	3672**

**#204	3690	1.00	0.009	3690**

**#205	3708	1.00	0.009	3708**

**#206	3726	1.00	0.009	3726**

**#207	3744	1.00	0.009	3744**

**#208	3762	1.00	0.008	3762**

**#209	3780	1.00	0.008	3780**

**#210	3798	1.00	0.008	3798**

**#211	3816	0.95	0.006	3816**

**#212	3834	0.95	0.006	3834**

**#213	3852	0.95	0.007	3852**

**#214	3870	1.00	0.008	3870**

**#215	3888	1.00	0.008	3888**

**#216	3906	1.00	0.008	3906**

**#217	3924	1.00	0.008	3924**

**#218	3942	1.00	0.008	3942**

**#219	3960	1.00	0.008	3960**

**#220	3978	1.00	0.008	3978**

**#221	3996	1.00	0.008	3996**

**#222	4014	1.00	0.008	4014**

**#223	4032	1.00	0.008	4032**

**#224	4050	0.95	0.006	4050**

**#225	4068	0.95	0.006	4068**

**#226	4086	1.00	0.008	4086**

**#227	4104	0.95	0.006	4104**

**#228	4122	1.00	0.008	4122**

**#229	4140	1.00	0.008	4140**

**#230	4158	0.95	0.006	4158**

**#231	4176	1.00	0.009	4176**

**#232	4194	1.00	0.008	4194**

**#233	4212	1.00	0.008	4212**

**#234	4230	1.00	0.008	4230**

**#235	4248	1.00	0.008	4248**

**#236	4266	1.00	0.008	4266**

**#237	4284	1.00	0.008	4284**

**#238	4302	1.00	0.008	4302**

**#239	4320	1.00	0.007	4320**

**#240	4338	1.00	0.007	4338**

**#241	4356	1.00	0.007	4356**

**#242	4374	1.00	0.006	4374**

**#243	4392	1.00	0.006	4392**

**#244	4410	1.00	0.006	4410**

**#245	4428	1.00	0.006	4428**

**#246	4446	1.00	0.006	4446**

**#247	4464	1.00	0.006	4464**

**#248	4482	1.00	0.006	4482**

**#249	4500	1.00	0.006	4500**

**#250	4518	1.00	0.006	4518**

**#251	4536	1.00	0.006	4536**

**#252	4554	1.00	0.006	4554**

**#253	4572	1.00	0.006	4572**

**#254	4590	1.00	0.006	4590**

**#255	4608	1.00	0.006	4608**

**#256	4626	1.00	0.006	4626**

**#257	4644	1.00	0.006	4644**

**#258	4662	1.00	0.006	4662**

**#259	4680	1.00	0.006	4680**

**#260	4698	1.00	0.006	4698**

**#261	4716	1.00	0.005	4716**

**#262	4734	1.00	0.005	4734**

**#263	4752	1.00	0.005	4752**

**#264	4770	1.00	0.005	4770**

**#265	4788	1.00	0.005	4788**

**#266	4806	1.00	0.005	4806**

**#267	4824	1.00	0.005	4824**

**#268	4842	1.00	0.005	4842**

**#269	4860	1.00	0.005	4860**

**#270	4878	1.00	0.005	4878**

**#271	4896	1.00	0.005	4896**

**#272	4914	1.00	0.004	4914**

**#273	4932	1.00	0.004	4932**

**#274	4950	1.00	0.004	4950**

**#275	4968	1.00	0.004	4968**

**#276	4986	1.00	0.003	4986**

**#277	5004	1.00	0.003	5004**

**#278	5022	1.00	0.004	5022**

**#279	5040	1.00	0.003	5040**

**#280	5058	1.00	0.003	5058**

**#281	5076	1.00	0.003	5076**

**#282	5094	1.00	0.003	5094**

**#283	5112	1.00	0.003	5112**

**#284	5130	1.00	0.004	5130**

**#285	5148	1.00	0.004	5148**

**#286	5166	1.00	0.003	5166**

**#287	5184	1.00	0.003	5184**

**#288	5202	1.00	0.003	5202**

**#289	5220	1.00	0.003	5220**

**#290	5238	1.00	0.003	5238**

**#291	5256	1.00	0.003	5256**

**#292	5274	1.00	0.004	5274**

**#293	5292	1.00	0.003	5292**

**#294	5310	1.00	0.004	5310**

**#295	5328	1.00	0.004	5328**

**#296	5346	1.00	0.004	5346**

**#297	5364	1.00	0.004	5364**

**#298	5382	1.00	0.004	5382**

**#299	5400	1.00	0.004	5400**

**#300	5418	1.00	0.004	5418**

**#301	5436	1.00	0.004	5436**

**#302	5454	1.00	0.005	5454**

**#303	5472	1.00	0.005	5472**

**#304	5490	1.00	0.004	5490**

**#305	5508	1.00	0.005	5508**

**#306	5526	1.00	0.005	5526**

**#307	5544	1.00	0.005	5544**

**#308	5562	1.00	0.005	5562**

**#309	5580	1.00	0.005	5580**

**#310	5598	1.00	0.005	5598**

**#311	5616	1.00	0.005	5616**

**#312	5634	1.00	0.005	5634**

**#313	5652	1.00	0.005	5652**

**#314	5670	1.00	0.005	5670**

**#315	5688	1.00	0.005	5688**

**#316	5706	1.00	0.005	5706**

**#317	5724	1.00	0.005	5724**

**#318	5742	1.00	0.005	5742**

**#319	5760	1.00	0.005	5760**

**#320	5778	1.00	0.004	5778**

**#321	5796	1.00	0.004	5796**

**#322	5814	1.00	0.004	5814**

**#323	5832	1.00	0.004	5832**

**#324	5850	1.00	0.004	5850**

**#325	5868	1.00	0.004	5868**

**#326	5886	1.00	0.004	5886**

**#327	5904	1.00	0.004	5904**

**#328	5922	1.00	0.004	5922**

**#329	5940	1.00	0.004	5940**

**#330	5958	1.00	0.004	5958**

**#331	5976	1.00	0.004	5976**

**#332	5994	1.00	0.004	5994**

**#333	6012	1.00	0.004	6012**

**#334	6030	1.00	0.004	6030**

**#335	6048	1.00	0.004	6048**

**#336	6066	1.00	0.003	6066**

**#337	6084	1.00	0.003	6084**

**#338	6102	1.00	0.004	6102**

**#339	6120	1.00	0.004	6120**

**#340	6138	1.00	0.003	6138**

**#341	6156	1.00	0.003	6156**

**#342	6174	1.00	0.004	6174**

**#343	6192	1.00	0.004	6192**

**#344	6210	1.00	0.003	6210**

**#345	6228	1.00	0.004	6228**

**#346	6246	1.00	0.003	6246**

**#347	6264	1.00	0.003	6264**

**#348	6282	1.00	0.003	6282**

**#349	6300	1.00	0.003	6300**

**#350	6318	1.00	0.004	6318**

**#351	6336	1.00	0.003	6336**

**#352	6354	1.00	0.003	6354**

**#353	6372	1.00	0.003	6372**

**#354	6390	1.00	0.003	6390**

**#355	6408	1.00	0.003	6408**

**#356	6426	1.00	0.003	6426**

**#357	6444	1.00	0.003	6444**

**#358	6462	1.00	0.002	6462**

**#359	6480	1.00	0.002	6480**

**#360	6498	1.00	0.003	6498**

**#361	6516	1.00	0.003	6516**

**#362	6534	1.00	0.003	6534**

**#363	6552	1.00	0.003	6552**

**#364	6570	1.00	0.003	6570**

**#365	6588	1.00	0.003	6588**

**#366	6606	1.00	0.003	6606**

**#367	6624	1.00	0.003	6624**

**#368	6642	1.00	0.003	6642**

**#369	6660	1.00	0.003	6660**

**#370	6678	1.00	0.003	6678**

**#371	6696	1.00	0.003	6696**

**#372	6714	1.00	0.003	6714**

**#373	6732	1.00	0.003	6732**

**#374	6750	1.00	0.003	6750**

**#375	6768	1.00	0.003	6768**

**#376	6786	1.00	0.003	6786**

**#377	6804	1.00	0.003	6804**

**#378	6822	1.00	0.003	6822**

**#379	6840	1.00	0.003	6840**

**#380	6858	1.00	0.003	6858**

**#381	6876	1.00	0.003	6876**

**#382	6894	1.00	0.003	6894**

**#383	6912	1.00	0.003	6912**

**#384	6930	1.00	0.004	6930**

**#385	6948	1.00	0.003	6948**

**#386	6966	1.00	0.004	6966**

**#387	6984	1.00	0.004	6984**

**#388	7002	1.00	0.003	7002**

**#389	7020	1.00	0.003	7020**

**#390	7038	1.00	0.003	7038**

**#391	7056	1.00	0.003	7056**

**#392	7074	1.00	0.003	7074**

**#393	7092	1.00	0.004	7092**

**#394	7110	1.00	0.004	7110**

**#395	7128	1.00	0.004	7128**

**#396	7146	1.00	0.003	7146**

**#397	7164	1.00	0.003	7164**

**#398	7182	1.00	0.004	7182**

**#399	7200	1.00	0.003	7200**

**#400	7218	1.00	0.003	7218**

**#401	7236	1.00	0.003	7236**

**#402	7254	1.00	0.003	7254**

**#403	7272	1.00	0.003	7272**

**#404	7290	1.00	0.003	7290**

**#405	7308	1.00	0.003	7308**

**#406	7326	1.00	0.003	7326**

**#407	7344	1.00	0.003	7344**

**#408	7362	1.00	0.003	7362**

**#409	7380	1.00	0.003	7380**

**#410	7398	1.00	0.003	7398**

**#411	7416	1.00	0.003	7416**

**#412	7434	1.00	0.003	7434**

**#413	7452	1.00	0.003	7452**

**#414	7470	1.00	0.003	7470**

**#415	7488	1.00	0.004	7488**

**#416	7506	1.00	0.004	7506**

**#417	7524	1.00	0.004	7524**

**#418	7542	1.00	0.004	7542**

**#419	7560	1.00	0.004	7560**

**#420	7578	1.00	0.004	7578**

**#421	7596	1.00	0.004	7596**

**#422	7614	1.00	0.004	7614**

**#423	7632	1.00	0.004	7632**

**#424	7650	1.00	0.004	7650**

**#425	7668	1.00	0.004	7668**

**#426	7686	0.95	0.004	7686**

**#427	7704	0.95	0.004	7704**

**#428	7722	0.95	0.004	7722**

**#429	7740	0.95	0.004	7740**

**#430	7758	0.95	0.004	7758**

**#431	7776	0.95	0.004	7776**

**#432	7794	0.95	0.004	7794**

**#433	7812	1.00	0.005	7812**

**#434	7830	1.00	0.005	7830**

**#435	7848	0.95	0.004	7848**

**#436	7866	0.95	0.004	7866**

**#437	7884	0.95	0.004	7884**

**#438	7902	1.00	0.005	7902**

**#439	7920	1.00	0.005	7920**

**#440	7938	1.00	0.005	7938**

**#441	7956	1.00	0.005	7956**

**#442	7974	1.00	0.005	7974**

**#443	7992	1.00	0.005	7992**

**#444	8010	0.95	0.004	8010**

**#445	8028	0.95	0.004	8028**

**#446	8046	0.95	0.004	8046**

**#447	8064	0.95	0.004	8064**

**#448	8082	0.95	0.004	8082**

**#449	8100	0.95	0.004	8100**

**#450	8118	0.95	0.004	8118**

**#451	8136	0.95	0.004	8136**

**#452	8154	0.95	0.004	8154**

**#453	8172	0.95	0.004	8172**

**#454	8190	0.95	0.004	8190**

**#455	8208	0.95	0.004	8208**

**#456	8226	0.95	0.004	8226**

**#457	8244	0.95	0.004	8244**

**#458	8262	0.95	0.004	8262**

**#459	8280	0.95	0.004	8280**

**#460	8298	0.95	0.004	8298**

**#461	8316	0.95	0.004	8316**

**#462	8334	0.95	0.004	8334**

**#463	8352	0.95	0.004	8352**

**#464	8370	0.95	0.004	8370**

**#465	8388	0.95	0.004	8388**

**#466	8406	0.95	0.004	8406**

**#467	8424	0.95	0.004	8424**

**#468	8442	0.95	0.004	8442**

**#469	8460	0.95	0.004	8460**

**#470	8478	0.95	0.004	8478**

**#471	8496	0.95	0.004	8496**

**#472	8514	0.95	0.004	8514**

**#473	8532	0.95	0.004	8532**

**#474	8550	0.95	0.004	8550**

**#475	8568	0.95	0.004	8568**

**#476	8586	0.95	0.003	8586**

**#477	8604	0.95	0.003	8604**

**#478	8622	0.95	0.003	8622**

**#479	8640	0.95	0.003	8640**

**#480	8658	0.95	0.003	8658**

**#481	8676	0.95	0.003	8676**

**#482	8694	0.95	0.003	8694**

**#483	8712	0.95	0.003	8712**

**#484	8730	0.95	0.003	8730**

**#485	8748	0.95	0.003	8748**

**#486	8766	0.95	0.003	8766**

**#487	8784	0.95	0.003	8784**

**#488	8802	0.95	0.003	8802**

**#489	8820	0.95	0.003	8820**

**#490	8838	0.95	0.003	8838**

**#491	8856	0.95	0.003	8856**

**#492	8874	0.95	0.003	8874**

**#493	8892	0.95	0.003	8892**

**#494	8910	0.95	0.003	8910**

**#495	8928	0.95	0.003	8928**

**#496	8946	0.95	0.003	8946**

**#497	8964	0.95	0.003	8964**

**#498	8982	0.95	0.003	8982**

**#499	9000	0.95	0.003	9000**

**#500	9018	0.95	0.003	9018**

**#501	9036	0.95	0.003	9036**

**#502	9054	0.95	0.003	9054**

**#503	9072	0.95	0.003	9072**

**#504	9090	0.95	0.003	9090**

**#505	9108	0.95	0.003	9108**

**#506	9126	0.95	0.003	9126**

**#507	9144	0.95	0.003	9144**

**#508	9162	0.95	0.003	9162**

**#509	9180	0.95	0.003	9180**

**#510	9198	0.95	0.003	9198**

**#511	9216	0.95	0.003	9216**

**#512	9234	0.95	0.003	9234**

**#513	9252	0.95	0.003	9252**

**#514	9270	0.95	0.003	9270**

**#515	9288	0.95	0.003	9288**

**#516	9306	0.95	0.003	9306**

**#517	9324	0.95	0.003	9324**

**#518	9342	0.95	0.003	9342**

**#519	9360	0.95	0.003	9360**

**#520	9378	0.95	0.003	9378**

**#521	9396	0.95	0.003	9396**

**#522	9414	0.95	0.003	9414**

**#523	9432	0.95	0.003	9432**

**#524	9450	0.95	0.003	9450**

**#525	9468	0.95	0.003	9468**

**#526	9486	0.95	0.003	9486**

**#527	9504	0.95	0.003	9504**

**#528	9522	0.95	0.003	9522**

**#529	9540	0.95	0.003	9540**

**#530	9558	0.95	0.003	9558**

**#531	9576	0.95	0.003	9576**

**#532	9594	0.95	0.003	9594**

**#533	9612	0.95	0.003	9612**

**#534	9630	0.95	0.003	9630**

**#535	9648	0.95	0.003	9648**

**#536	9666	0.95	0.003	9666**

**#537	9684	0.95	0.003	9684**

**#538	9702	0.95	0.003	9702**

**#539	9720	0.95	0.003	9720**

**#540	9738	0.95	0.003	9738**

**#541	9756	0.95	0.003	9756**

**#542	9774	0.95	0.003	9774**

**#543	9792	0.95	0.003	9792**

**#544	9810	0.95	0.003	9810**

**#545	9828	0.95	0.003	9828**



